const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB();
const s3 = new AWS.S3();
const userTable = 'phase2users';
const pkgTable = 'pkgmetadata';
const authTable = 'AuthTokens';
const bucketName = 'packageregistry';
const folderNames = ['packagecontent', 'gradedpackages', 'nongradedpackages'];
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
        return isAdmin;

    } catch (err) {
        console.error('validation error: ', err);
        throw new Error('Failed to validate token');
    }
}

const deleteS3 = async () => {
    // List all objects in the subfolder
    for (let i = 0; i < 3; i++) {
        const listObjectsParams = {
            Bucket: bucketName,
            Prefix: folderNames[i],
        };
        
        const data = await s3.listObjectsV2(listObjectsParams).promise();
        console.log("S3 Data: ", data);
        // Check if there are any objects to delete
        if (data.Contents.length === 0) {
            console.log('Subfolder is already empty');
            continue;
        }
    
        // Prepare an array of objects to be deleted
        const objectsToDelete = data.Contents.map((obj) => ({
            Key: obj.Key,
        }));
    
        // Perform the deletion
        const deleteObjectsParams = {
            Bucket: bucketName,
            Delete: {
                Objects: objectsToDelete,
                Quiet: false,
            },
        };
    
        await s3.deleteObjects(deleteObjectsParams).promise();
    
        console.log(`All objects in subfolder ${i} deleted successfully`);
    }
    return;
}

const deleteTable = async (tableName) => {
    try {
        await dynamoDb.deleteTable({ TableName: tableName }).promise();
    } catch (error) {
        console.error(`Error deleting table: ${error.message}`);
    }

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
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            // If describeTable fails, the table doesn't exist
            if (error.code === 'ResourceNotFoundException') {
                console.log(`Table ${tableName} deleted`);
                tableExists = false;
            } else {
                throw error;
            }
        }
    }
};
  
const createTable = async (tableName, keyName) => {
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
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
        },
        TableName: tableName,
    };

    //create table with given parameters
    try {
        await dynamoDb.createTable(params).promise();
    } catch (error) {
        console.error(`Error creating table: ${error.message}`);
    }

    /*// Check if the table still exists
    while (true) {
        try {
          const response = await dynamoDb.describeTable({ TableName: tableName }).promise();
          console.log('Table status:', response.Table.TableStatus);
    
          if (response.Table.TableStatus === 'ACTIVE') {
            console.log(`Table ${tableName} has been created successfully.`);
            break;
          }
        } catch (error) {
          if (error.code !== 'ResourceNotFoundException') {
            console.error('Error:', error);
            throw error;
          }
        }
    
        console.log(`Table ${tableName} not yet created. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }*/
};

const createTableWithGSI = async (tableName, keyName, gsiIndexName, gsiAttributeName) => {
    const params = {
        AttributeDefinitions: [
            {
                AttributeName: keyName,
                AttributeType: 'S', // Assuming a string key, adjust if needed
            },
            {
                AttributeName: gsiAttributeName,
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
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
        },
        TableName: tableName,
        GlobalSecondaryIndexes: [
            {
              IndexName: gsiIndexName,
              KeySchema: [
                { AttributeName: gsiAttributeName, KeyType: 'HASH' }, // HASH type for the GSI key
              ],
              Projection: {
                ProjectionType: 'ALL', // adjust based on your projection needs
              },
              ProvisionedThroughput: {
                ReadCapacityUnits: 5, // adjust based on your GSI read capacity needs
                WriteCapacityUnits: 5, // adjust based on your GSI write capacity needs
              },
            },
          ],
    };

    //create table with given parameters
    try {
        await dynamoDb.createTable(params).promise();
    } catch (error) {
        console.error(`Error creating table: ${error.message}`);
    }

    // Check if the table still exists
    while (true) {
        try {
          const response = await dynamoDb.describeTable({ TableName: tableName }).promise();
          console.log('Table status:', response.Table.TableStatus);
    
          if (response.Table.TableStatus === 'ACTIVE') {
            console.log(`Table ${tableName} has been created successfully.`);
            break;
          }
        } catch (error) {
          if (error.code !== 'ResourceNotFoundException') {
            console.error('Error:', error);
            throw error;
          }
        }
    
        console.log(`Table ${tableName} not yet created. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

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
        if(isAdmin === false){
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
        //reset user table
        await deleteTable(userTable);
        await createTable(userTable, 'username');
        //reset package table
        await deleteTable(pkgTable);
        await createTableWithGSI(pkgTable, 'pkgID', 'pkgName-Index', 'pkgName');

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

    //retrieve the default user password hash
    try {
        response = await client.send(
            new GetSecretValueCommand({
                SecretId: "DEFAULT_USER_PASSWORD"
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
            body: JSON.stringify({ message: 'Failed to retrieve default user password' }),
        };
    }

    secretString = response.SecretString;
    secretObject = JSON.parse(secretString);
    secretKey = secretObject.DEFAULT_USER_PASSWORD;

    const defaultUsername = "ece30861defaultadminuser";
    const defaultIsAdmin = true;
    const defaultPasswordHash = secretKey;

    //recreate the default user
    try{
        const params = {
            TableName: userTable,
            Item: {
              'username': { S: defaultUsername },
              'isAdmin': { BOOL: defaultIsAdmin },
              'passHash': { S: defaultPasswordHash },
            }
        };

        await dynamoDb.putItem(params).promise();

        const params2 = {
            TableName: userTable,
            Item: {
              'username': { S: "TestUser1" },
              'isAdmin': { BOOL: true },
              'passHash': { S: "c669ebcc10ad2fdc08b5f688d0638f07905040d49e3fbfdc498775b3a2ea67f4" },
            }
        };

        await dynamoDb.putItem(params2).promise();

    }catch(err){
        console.log("Error adding default user: ", err);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to create default user' }),
        };
    }

    //delete all s3 content in package bucket
    try{
        await deleteS3();
    }catch(err){
        console.log("Error deleting s3 bucket: ", err);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to delete s3 bucket' }),
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