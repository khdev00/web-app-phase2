const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDBNotClient = new AWS.DynamoDB();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
const userTable = 'phase2users';
const authTable = 'AuthTokens';
const jwt_secret = "JWT_SECRET_KEY";
const bucketName = 'packageregistry'; 
const packageContentFolderName = 'packagecontent';

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
    //console.log('Event Body:', event.body);
    console.log('Event Path Parameters:', event.pathParameters);
    //console.log('Event Query String Parameters:', event.queryStringParameters);
    console.log('Event Headers:', event.headers);
    console.log('event id:', event.pathParameters.id); 

    //setup secret manager client
    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

    let response;
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
        if(isAdmin === false && data.Item.uploadAllow === false){
            console.log('Invalid permissions to update');
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid Permissions to update' }),
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

    if (!event.body) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Missing request body' }),
        };
    }

    let body;
    try {
        if (typeof event.body !== 'string') {
            event.body = JSON.stringify(event.body); // stringified twice
        }
        console.log('Parsed body:', body);
        body = JSON.parse(event.body); // Second parse if needed
    } catch (error) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }
    const idfrombody = event.pathParameters.id; // added this recently
    const packageID = body.metadata.ID;
    const newContent = body.data.Content; // This is base64-encoded
    
    console.log('Package ID:', packageID);
    console.log('New content:', newContent);

    const getParams = {
        TableName: tableName,
        Key: { "pkgID": idfrombody }
    };

    try {
        const { Item: existingPackage } = await dynamoDb.get(getParams).promise();
        if (!existingPackage) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package not found' }),
            };
        }

        if (idfrombody !== `${body.metadata.Name}_${body.metadata.Version}`) { // changed packageID to idfrombody
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package ID and name_version do not match' }),
            };
        }

        const decodedContent = Buffer.from(newContent, 'base64');
        const contentKey = `${packageContentFolderName}/${existingPackage.pkgName}_${existingPackage.pkgVersion}_content.txt`;

        // Upload new package content
        const contentUploadResult = await s3.upload({
            Bucket: bucketName,
            Key: contentKey,
            Body: newContent
        }).promise();

        // Update the zip file
        const zipKey = new URL(existingPackage.packageS3Url).pathname.substring(1); // Extract the key from the URL
        const zipUploadResult = await s3.upload({
            Bucket: bucketName,
            Key: zipKey,
            Body: decodedContent,
            ContentType: 'application/zip'
        }).promise();

        // Update DynamoDB record
        const updateParams = {
            TableName: tableName,
            Key: { "pkgID": packageID },
            UpdateExpression: 'set contentS3Url = :c, packageS3Url = :z',
            ExpressionAttributeValues: {
                ':c': contentUploadResult.Location,
                ':z': zipUploadResult.Location
            },
            ReturnValues: 'UPDATED_NEW'
        };

        await dynamoDb.update(updateParams).promise();

    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to update package info and content' }),
        };
    }

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package content updated successfully' }),
    };
};
