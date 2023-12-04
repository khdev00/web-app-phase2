const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });
const { Readable } = require('stream');
const unzipper = require('unzipper');

const dynamoDb = new AWS.DynamoDB();
const s3 = new AWS.S3();
const userTable = 'phase2users';
const pkgTable = 'pkgmetadata';
const authTable = 'AuthTokens';
const bucketName = 'packageregistry';
const folderNames = ['gradedpackages', 'nongradedpackages'];
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const secret_name = "JWT_SECRET_KEY";

async function validateToken(auth_token, secret) {
    try{
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
        const data = await dynamoDb.getItem(params).promise();
        if(data.Item){
            authData = data.Item;
        }
        else {
            console.error('token not found');
            return false;
        }

        //make sure the token is valid for the user
        const dbUsername = authData.username.S;
        if(dbUsername != username){
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

        updateParams = {
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
        const dynamoResult = await dynamoDb.updateItem(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);
        return isAdmin;

    } catch (err) {
        console.error('validation error: ', err);
        throw new Error('Failed to validate token');
        return;
    }
}

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

    //retrieve the JWT secret key for use in validating token
    let response;
    try {
        response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name
            })
        );
    } catch (error) {
        console.error('Secrets Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve JWT key' }),
        };
    }

    let secretString = response.SecretString;
    let secretObject = JSON.parse(secretString);
    let secretKey = secretObject.JWT_SECRET_KEY;

    /*let auth_token;
    console.log("Headers: ", event.headers);

    //retrieve authentication token
    try{
        auth_token = event.headers['x-authorization'];
        console.log("Token: ", auth_token);
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

    if (auth_token == null) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Authentication Token not provided' }),
        };
    }

    //attempt to validate the authentication token
    try{
        await validateToken(auth_token, secretKey);
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
    }*/

    //verify event.body exists
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

    //this is just to handle AWS console test formatting
    if (typeof event.body !== 'string') {
        event.body = JSON.stringify(event.body);
    }

    let body, content, URL;

    // Try to parse the event.body
    try {
        body = JSON.parse(event.body);
        //console.log(body);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }

    //search for content and URL fields
    try{
        content = body.Content;
        URL = body.URL;
    }catch(err){
        console.log("Input Error")
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Input Error' }),
        };
    }


    if ((content === '' && URL === '') || (content !== '' && URL !== '')) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Neither or both inputs provided' }),
        };
    }

    if(content !== ''){
        try{
            console.log("Content: ", content);
            // 1. Decode Base64 String
            const buffer = Buffer.from(content, 'base64');

            // 2. Unzip the Repository
            const readableStream = Readable.from(buffer);
            const files = await readableStream.pipe(unzipper.Parse()).promise();

            console.log("Files: ", files);

            if (!files || typeof files[Symbol.iterator] !== 'function') {
                throw new Error('Invalid or empty zip file.');
            }

            files.forEach((entry) => {
                if (entry.path === 'package.json') {
                packageJsonContent = '';
                entry.on('data', (data) => (packageJsonContent += data.toString()));
                }
            });
        
            await new Promise((resolve) => {
                readableStream.on('end', resolve);
            });
        
            const packageJson = JSON.parse(packageJsonContent);
        
            // Now you can access key information about the package from package.json
            const packageName = packageJson.name;
            const packageVersion = packageJson.version;
            const packageID = packageName.concat(packageVersion);

            console.log(`Package Name: ${packageName}`);
            console.log(`Package Version: ${packageVersion}`);
            console.log(`Package ID: ${packageID}`);
        }catch(err){
            console.log("content parse error: ", err)
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'content parse error' }),
            };
        }
    }else{
        //process URL field
    }





    //all checks and functions passed, return success
    return {
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Upload package successful' }),
    };
}