const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB();
const s3 = new AWS.S3();
const userTable = 'phase2users';
const authTable = 'AuthTokens';
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const secret_name = "JWT_SECRET_KEY";

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
        const dynamoResult = await dynamoDb.updateItem(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);

        return [isAdmin, dbUsername];

    } catch (err) {
        console.error('validation error: ', err);
        throw new Error('Failed to validate token');
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

    let isAdmin, tokenUser;
    try{
        [isAdmin, tokenUser] = await validateToken(auth_token, secretKey);
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

    //this is just to handle AWS console test formatting
    if (typeof event.body !== 'string') {
        event.body = JSON.stringify(event.body);
    }

    // Try to parse the event.body
    let body, username;
    try {
        body = JSON.parse(event.body);
        console.log(body);
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

    //retrieve username and password
    try{
        username = body.User.name;

        if(!isAdmin && (username !== tokenUser)){
            console.log("Error: Invalid permissions to delete user");
            return {
                statusCode: 401,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid permissions to delete user' }),
            };
        }
    }catch(err){
        console.log("Error: Invalid Input Structure error: ", err);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid Input Structure' }),
        };
    }

    try{
        // Check if the user exists before attempting to delete
        const queryParams = {
            TableName: userTable,
            Key: {
                "username": { S: username }
            }
        };

        const queryResult = await dynamoDb.getItem(queryParams).promise();
        if (!queryResult.Item) {
            console.log("User Not Found");
            return {
                statusCode: 409,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'User Not Found' }),
            };
        }

        //assign user parameters for deletion
        const deleteParams = {
            TableName: userTable,
            Key: {
                "username": {S: username}
            }
        };
        // Perform the update operation
        const dynamoResult = await dynamoDb.deleteItem(deleteParams).promise();
        console.log('Delete User successful', dynamoResult);

        //all checks and functions passed, return success
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'User Successfully Deleted' }),
        };

    }catch(err){
        console.log("Error: could not delete user: ", err);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Error deleting user' }),
        };
    }
};