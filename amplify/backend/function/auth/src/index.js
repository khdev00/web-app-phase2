const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB();
const tableName = 'phase2users';
const authTable = 'AuthTokens';
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const secret_name = "JWT_SECRET_KEY";

function generateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}

function generateToken(username, isAdmin, secret) {
    const token = jwt.sign({ username: username, isAdmin: isAdmin }, secret, { expiresIn: '10h' });
    return token;
}

const setTokenInDB = async (username, auth_token) => {
    try {
        const queryParams = {
            TableName: authTable,
            IndexName: "username-index",
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: {
              ':username': {S: username},
            },
        };
        
        let createParams, deleteParams;
        const data = await dynamoDb.query(queryParams).promise();
        console.log('Query succeeded:', JSON.stringify(data, null, 2));
    
        // Process the query
        if (data.Items && data.Items.length > 0) {
            const item = data.Items[0]; // Assuming at most one item

            deleteParams = {
                TableName: authTable,
                Key: {
                    "authToken": {S: item.authToken.S},
                },
            };
        }

        try{
            await dynamoDb.deleteItem(deleteParams).promise();
            console.log(`Token for ${username} deleted`);
        }catch(err){
            console.log("Error: ", err);
            console.log("no duplicate auth token!")
        }

        createParams = {
            TableName: authTable,
            Item: {
                'authToken': { S: auth_token },
                'username': { S: username },
                'usages': { N: '1000' },
            }
        };

        // Perform the creation operation
        await dynamoDb.putItem(createParams).promise();
        
    } catch (dbError) {
        console.error('DynamoDB Create Error:', dbError);
        throw new Error('Failed to set auth token in DB');
    }
};

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

    //retrieve the JWT secret key for use in generating token
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

    const secretString = response.SecretString;
    const secretObject = JSON.parse(secretString);
    const secretKey = secretObject.JWT_SECRET_KEY;

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
    let body, username, password, isAdminString;
    let isAdmin = null;
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
        password = body.Secret.password;
        isAdminString = body.User.isAdmin;

        if (isAdminString.toLowerCase() === 'true') {
            isAdmin = true;
        } else if (isAdminString.toLowerCase() === 'false') {
            isAdmin = false;
        }

    }catch(err){
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid Input Structure' }),
        };
    }


    if (!username || !password || isAdmin === null) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Missing Inputs' }),
        };
    }

    const passwordHash = generateHash(password);

    // Retrieve the package metadata from DynamoDB
    let packageMetadata;
    try {
        const params = {
            TableName: tableName,
            Key: {
                "username": {S: username}
            }
        };
        const data = await dynamoDb.getItem(params).promise();
        if(data.Item){
            packageMetadata = data.Item;
        }
        else{
            console.error('Username not found');
            return {
                statusCode: 401,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Failed to find user' }),
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
            body: JSON.stringify({ message: 'Failed to retrieve package metadata' }),
        };
    }

    const storedAdmin = packageMetadata.isAdmin;

    if(isAdmin && !storedAdmin){
        return {
            statusCode: 401,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Requested admin token for non-admin user' }),
        };
    }

    const storedHash = packageMetadata.passHash.S;

    if(storedHash != passwordHash){
        console.error('Incorrect password provided');
        return {
            statusCode: 401,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Incorrect password provided'}),
        };
    }

    const auth_token = generateToken(username, isAdmin, secretKey);
    //validateToken(auth_token, secretKey);
    
    // Update the DynamoDB item with the package rating
    try {
        await setTokenInDB(username, auth_token);
        console.log('AuthToken generated')

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify(auth_token),
        };
    } catch (updateError) {
        console.error('Update Error:', updateError);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to generate AuthToken' }),
        };
    }
};