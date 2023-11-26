const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'phase2users';
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const secret_name = "JWT_SECRET_KEY";


function generateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}

function generateToken(expirationTimeMinutes, maxUsage, secret) {
    const expirationTime = Math.floor(Date.now() / 1000) + expirationTimeMinutes * 60;
    const payload = {
      exp: expirationTime,
      maxUsage: maxUsage,
      currentUsage: 0,
    };
    const token = jwt.sign(payload, secret);
    return token;
}

exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
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
    const secret = secretObject.JWT_SECRET_KEY;

    let username, password;
    try{
        username = event.User.name;
        password = event.Secret.password;
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

    const auth_token = generateToken(600, 1000, secret);

};
