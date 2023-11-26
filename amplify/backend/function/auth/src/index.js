const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'phase2users';
const authTable = 'AuthTokens';
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const secret_name = "JWT_SECRET_KEY";


function generateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}

function generateToken(username, secret) {
    const token = jwt.sign({ username: username }, secret, { expiresIn: '10h' });
    return token;
}

const setTokenInDB = async (username, auth_token) => {
    try {
        const queryParams = {
            TableName: authTable,
            IndexName: "username-index",
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: {
              ':username': username,
            },
        };
        
        let updateParams;
        const data = await dynamoDb.query(queryParams).promise();
        console.log('Query succeeded:', JSON.stringify(data, null, 2));
        
        // Process the retrieved items here
        if (data.Items && data.Items.length > 0) {
            data.Items.forEach(item => {
                updateParams = {
                    TableName: authTable,
                    Key: {
                        "authToken": item.authToken,
                    },
                    UpdateExpression: "SET authToken = :authToken, usages = :maxUsage",
                    ExpressionAttributeValues: {
                        ":authToken": auth_token,
                        ":maxUsage": 1000,
                    },
                };
            });
        }
        else{
            updateParams = {
                TableName: authTable,
                Key: {
                    "authToken": auth_token,
                },
                UpdateExpression: "SET username = :username, usages = :maxUsage",
                ExpressionAttributeValues: {
                    ":username": username,
                    ":maxUsage": 1000,
                },
            };
        }

        // Perform the update operation
        const dynamoResult = await dynamoDb.update(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);

    } catch (dbError) {
        console.error('DynamoDB Update Error:', dbError);
        throw new Error('Failed to set auth token in DB');
    }
};

exports.handler = async (event) => {
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
    let body, username, password;
    try {
        body = JSON.parse(event.body);
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
    }catch{
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid Input Structure' }),
        };
    }


    if (!username || !password) {
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
                "username": username
            }
        };
        const data = await dynamoDb.get(params).promise();
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

    const storedHash = packageMetadata.passHash;
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

    const auth_token = generateToken(username, secretKey);

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