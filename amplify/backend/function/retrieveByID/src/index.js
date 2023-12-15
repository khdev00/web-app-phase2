const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { url } = require('inspector');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDBNotClient = new AWS.DynamoDB();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
const authTable = 'AuthTokens';
const userTable = 'phase2users';
const jwt_secret = "JWT_SECRET_KEY";
const bucketName = 'packageregistry'; // Replace with your S3 bucket name

const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

async function validateToken(auth_token, secret) {
    try{
        if(auth_token && auth_token.includes('"')){
            auth_token = auth_token.replace(/"/g, '');
        }
        console.log("Token: ", auth_token)
        const payload = jwt.verify(auth_token, secret);
        const {username, isAdmin} = payload;

        const params = {
            TableName: authTable,
            Key: {
                "authToken": {S: auth_token}
            }
        };

        //attempt to find token in database
        let authData;
        const data = await dynamoDBNotClient.getItem(params).promise();
        if(data.Item){
            authData = data.Item;
        }
        else {
            console.error('token not found');
            return false;
        }

        //make sure the token is valid for the user
        const dbUsername = authData.username.S;
        if(dbUsername !== username){
            console.error('no user match');
            return false;
        }

        //make sure the token has usages left
        let usageLeft = authData.usages.N;
        if(usageLeft > 0){
            usageLeft -= 1;
        }
        else {
            console.error('no API usage left');
            return false;
        }

        const updateParams = {
            TableName: authTable,
            Key: {
                "authToken": {S: auth_token}
            },
            UpdateExpression: "SET usages = :newUsage",
            ExpressionAttributeValues: {
                ":newUsage": {N: usageLeft.toString()}
            },
        };
        // Perform the update operation
        const dynamoResult = await dynamoDBNotClient.updateItem(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);

        return [isAdmin, username];

    } catch (err) {
        console.error('validation error: ', err);
        throw new Error('Failed to validate token');
    }
}

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event));

    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

    //get JWT secret
    try {
        response = await client.send(
            new GetSecretValueCommand({
                SecretId: jwt_secret
            })
        );
    } catch (error) {
        console.error('Secrets Error:', error);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve JWT key' }),
        };
    }

    const jwtString = response.SecretString;
    const jwtObject = JSON.parse(jwtString);
    const jwt_token = jwtObject.JWT_SECRET_KEY;

    let auth_token;
    console.log("Headers: ", event.headers);
    //retrieve authentication token
    try{
        if(event.headers['X-Authorization']){
            auth_token = event.headers['X-Authorization'];
        }
        else if(event.headers['x-authorization']){
            auth_token = event.headers['x-authorization'];
        }
    }catch(err){
        console.error("Error: ", err)
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid Authentication Token' }),
        };
    }

    if (auth_token === '' || auth_token === null) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Authentication Token not provided' }),
        };
    }

    let isAdmin, username;
    try{
        [isAdmin, username] = await validateToken(auth_token, jwt_token);

        const params = {
            TableName: userTable,
            Key: {
                "username": username
            }
        };

        const data = await dynamoDb.get(params).promise();
        if(isAdmin === false && data.Item.downloadAllow === false){
            console.log('Invalid permissions to get package');
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid Permissions to get package' }),
            };
        }
    }catch(authErr){
        console.error("Auth Error: ", authErr);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Validation of token failed' }),
        };
    }

    const packageId = event.pathParameters?.id;

    if (!packageId) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'PackageID is required' }),
        };
    }

    let packageMetadata;
    try {
        const params = {
            TableName: tableName,
            Key: { "pkgID": packageId }
        };
        const data = await dynamoDb.get(params).promise();
        packageMetadata = data.Item;
        console.log('Package metadata:', packageMetadata);
        if (!packageMetadata) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package metadata does not exist' }),
            };
        }

    } catch (dbError) {
    
        console.error('DynamoDB Error:', dbError);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve package metadata from database' }),
        };
    }

    if (!packageMetadata.contentS3Url) {
        console.error('Content URL not found in package metadata:', packageMetadata);
        return {
            statusCode: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Package content does not exist' }),
        };
    }

    // Fetch the base64 encoded content from the S3 URL
    let encodedContent;
    try {
        const urlParts = new URL(packageMetadata.contentS3Url);
        const s3Key = urlParts.pathname.substring(1); // Remove leading '/'
        const s3ContentParams = {
            Bucket: bucketName,
            Key: s3Key
        };
        const contentObject = await s3.getObject(s3ContentParams).promise();
        encodedContent = contentObject.Body.toString('utf-8');
    } catch (s3Error) {
        console.error('S3 Error:', s3Error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve package content from S3' }),
        };
    }

    /*
    const s3Url = packageMetadata.packageS3Url;
    const urlPartsS3 = new URL(s3Url); 
    const key = urlPartsS3.pathname.substring(1); // Remove leading '/'
    const filename = key.split('/').pop();
    const s3Params = {
        Bucket: bucketName,
        Key: key,
        Expires: 60,
        ResponseContentDisposition: `attachment; filename="${filename}"`
    };
    const signedUrl = s3.getSignedUrl('getObject', s3Params);
    console.log('Signed URL:', signedUrl);
    */

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Content-Type": "application/json"
            
        },
        body: JSON.stringify({
            metadata: {
                Name: packageMetadata.pkgName,
                Version: packageMetadata.pkgVersion,
                ID: packageMetadata.pkgID
            },
            data: {
                Content: encodedContent, // This is the base64 encoded string from the text file
                JSProgram: packageMetadata.JSProgram
            }
        })
    };
};
