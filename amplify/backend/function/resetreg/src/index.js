const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB();
const userTable = 'phase2users';
const pkgTable = 'pkgmetadata';
const authTable = 'AuthTokens';
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const secret_name = "JWT_SECRET_KEY";

async function validateToken(auth_token, secret) {
    try{
        const payload = jwt.verify(auth_token, secret);
        const {username, isAdmin} = payload;
        
        const params = {
            TableName: authTable,
            Key: {
                "authToken": auth_token
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
        const dbUsername = authData.username;
        if(dbUsername != username){
            console.error('no user match');
            return false;
        }

        //make sure the token has usages left
        let usageLeft = authData.usages;
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
                "authToken": auth_token,
            },
            UpdateExpression: "SET usages = :newUsage",
            ExpressionAttributeValues: {
                ":newUsage": usageLeft,
            },
        };
        // Perform the update operation
        const dynamoResult = await dynamoDb.update(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);

        console.log("isAdmin: ", isAdmin);
        return isAdmin;

    } catch (err) {
        console.error('validation error: ', err);
        throw new Error('Failed to validate token');
        return;
    }
}

const deleteTable = async (tableName) => {
    try {
        await dynamoDb.deleteTable({ TableName: tableName }).promise();
        console.log(`Table ${tableName} deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting table: ${error.message}`);
    }
};
  
const createTable = async (tableName, keyName) => {
    let tableExists = true;

    // Check if the table still exists
    while (tableExists) {
        try {
            const describeParams = {
                TableName: tableName,
            };

            await dynamoDb.describeTable(describeParams).promise();

            // If describeTable succeeds, the table still exists
            console.log(`Table ${tableName} still exists. Waiting for deletion...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay (adjust as needed)
        } catch (error) {
            // If describeTable fails, the table doesn't exist
            if (error.code === 'ResourceNotFoundException') {
                console.log(`Table ${tableName} does not exist.`);
                tableExists = false;
            } else {
                throw error;
            }
        }
    }

    const params = {
        AttributeDefinitions: [
            {
                AttributeName: keyName,
                AttributeType: 'S', // Assuming a string key, adjust if needed
            },
        ],
        KeySchema: [
            {
                AttributeName: keyName,
                KeyType: 'HASH', // Partition key
            },
        ],
        ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
        },
        TableName: tableName,
    };

    try {
        await dynamoDb.createTable(params).promise();
        console.log(`Table ${tableName} created successfully.`);
    } catch (error) {
        console.error(`Error creating table: ${error.message}`);
    }
};

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

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

    let auth_token;
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

    try{
        const isAdmin = await validateToken(auth_token, secretKey);
        if(isAdmin == false){
            console.log('Invalid permissions');
            return {
                statusCode: 401,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid Permissions: requires admin' }),
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

    //reset all tables
    try{
        //reset auth table
        await deleteTable(authTable);
        await createTable(authTable, 'AuthToken');
        //reset user table
        await deleteTable(userTable);
        await createTable(userTable, 'username');
        //reset package table
        await deleteTable(pkgTable);
        await createTable(pkgTable, 'pkgID');
    }catch(err){
        console.log("Error: ", err);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to delete tables' }),
        };
    }

    //all checks and functions passed, return success
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Database Successfully Reset' }),
    };
};
