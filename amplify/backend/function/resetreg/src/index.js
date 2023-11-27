const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
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

        let authData;
        const data = await dynamoDb.get(params).promise();
        if(data.Item){
            authData = data.Item;
        }
        else {
            console.error('token not found');
            return;
        }

        const dbUsername = authData.username;
        if(dbUsername != username){
            console.error('no user match');
            return;
        }

        let usageLeft = authData.usages;
        if(usageLeft > 0){
            usageLeft -= 1;
        }
        else {
            console.error('no API usage left');
            return;
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

        return isAdmin;

    } catch (err) {
        console.error('validation error', err);
        throw new Error('Failed to validate token');
        return;
    }
}

async function resetTables(){
    //reset user table, but keep default user
    const defaultUser = "defaultAdmin";

    const scanParams = {
        TableName: userTable,
    };

    dynamoDb.scan(scanParams, (scanErr, scanData) => {
        if (scanErr) {
          console.error('Error scanning user table:', scanErr);
        } else {
          // Step 2: Delete items except for the ones with the specified ID
          const deletePromises = [];
      
          scanData.Items.forEach(item => {
            const username = item.username; // Assuming the ID attribute is of type String
            if (username !== defaultUser) {
              const deleteParams = {
                TableName: userTable,
                Key: {
                  username: { S: username },
                },
              };
      
              const deletePromise = dynamoDb.deleteItem(deleteParams).promise();
              deletePromises.push(deletePromise);
            }
          });
      
          // Step 3: Wait for all delete operations to complete
          Promise.all(deletePromises)
            .then(() => {
              console.log('Items deleted successfully.');
            })
            .catch(deleteErr => {
              console.error('Error deleting items:', deleteErr);
            });
        }
    });

    //reset package table entirely
    const packageScanParams = {
        TableName: pkgTable,
    };

    dynamoDb.scan(packageScanParams, (scanErr, scanData) => {
        if (scanErr) {
          console.error('Error scanning package table:', scanErr);
        } else {
          // Step 2: Delete items
          const deletePromises = [];
      
          scanData.Items.forEach(item => {
            const pkgID = item.pkgID;
              const deleteParams = {
                TableName: pkgTable,
                Key: {
                    pkgID: { S: pkgID },
                },
              };
      
              const deletePromise = dynamoDb.deleteItem(deleteParams).promise();
              deletePromises.push(deletePromise); 
          });
      
          // Step 3: Wait for all delete operations to complete
          Promise.all(deletePromises)
            .then(() => {
              console.log('Items deleted successfully.');
            })
            .catch(deleteErr => {
              console.error('Error deleting items:', deleteErr);
            });
        }
    });

}

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

    //this is just to handle AWS console test formatting
    if (typeof event !== 'string') {
        event = JSON.stringify(event);
    }

    // Try to parse the event.body
    let body, auth_token;
    try {
        body = JSON.parse(event);
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

    //retrieve authentication token
    try{
        auth_token = body.auth_token;
    }catch{
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
        const isAdmin = validateToken(auth_token, secretKey);
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

        await resetTables().promise();

        console.log('Register Reset')

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Register Successfully Reset' }),
        };
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
};
