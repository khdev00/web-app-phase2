const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB();
const s3 = new AWS.S3();
const userTable = 'phase2users';
const authTable = 'AuthTokens';
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");
const { error } = require('console');

const secret_name = "JWT_SECRET_KEY";

async function generateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}

//make sure the boolean input is either a boolean or string
async function validateType(varToCheck) {
    if (typeof varToCheck === 'boolean') {
        return varToCheck;
    } else if (typeof varToCheck === 'string') {
        const lowerCaseVar = varToCheck.toLowerCase();
        if (lowerCaseVar === 'true' || lowerCaseVar === 'false') {
            return (varToCheck.toLowerCase() === 'true') 
        } else {
            throw new Error('Invalid isAdminInput word');
        }
    } else {
        throw new Error('Invalid isAdminInput type');
    }
}

async function isStrongPassword(password) {
    // Check if the password is at least 8 characters long
    if (password.length < 8) {
      return false;
    }
  
    // Check if the password contains at least one capital letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }
  
    // Check if the password contains at least one special character or number
    if (!/[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]|[0-9]/.test(password)) {
        return false;
    }
  
    // If all criteria are met, return true
    return true;
  }

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

    try{
        const isAdmin = await validateToken(auth_token, secretKey);
        if(isAdmin === false){
            console.log('Invalid permissions to create user');
            return {
                statusCode: 401,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid Permissions for user creation: requires admin' }),
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

    //this is just to handle AWS console test formatting
    if (typeof event.body !== 'string') {
        event.body = JSON.stringify(event.body);
    }

    // Try to parse the event.body
    let body, username, password, strongPassword;
    let isAdmin, uploadAllow, downloadAllow, searchAllow = null;
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

        isAdmin = await validateType(body.User.isAdmin);
        uploadAllow = await validateType(body.Permissions.upload);
        downloadAllow = await validateType(body.Permissions.download);
        searchAllow = await validateType(body.Permissions.search);

        if(username === '' || password === ''){
            throw new Error("username or password fields empty");
        }

        //if the password is not strong, return "invalid" password
        strongPassword = await isStrongPassword(password);
        if(!strongPassword){
            console.log("Error: password is not strong enough, must be 8+ characters, contain a capital letter, and a special character/number");
            return {
                statusCode: 402,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'password is not strong enough, must be 8+ characters, contain a capital letter, and a special character/number' }),
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
        //get a hashed value for password
        const passwordHash = await generateHash(password);

        // Check if the user exists before attempting to create
        const queryParams = {
            TableName: userTable,
            Key: {
                "username": { S: username }
            }
        };

        const queryResult = await dynamoDb.getItem(queryParams).promise();
        if (queryResult.Item) {
            console.log("User already exists!");
            return {
                statusCode: 409,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'User already exists' }),
            };
        }

        //assign user parameters to upload
        const userParams = {
            TableName: userTable,
            Item: {
                "username": {S: username},
                "passHash": {S: passwordHash},
                "isAdmin": {BOOL: isAdmin},
                "uploadAllow": {BOOL: uploadAllow},
                "downloadAllow": {BOOL: downloadAllow},
                "searchAllow": {BOOL: searchAllow},
            },
        };
        // Perform the update operation
        const dynamoResult = await dynamoDb.putItem(userParams).promise();
        console.log('Create User successful', dynamoResult);

        //all checks and functions passed, return success
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'User Successfully Created' }),
        };

    }catch(err){
        console.log("Error: could not upload user: ", err);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Error uploading user' }),
        };
    }
};