const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { type } = require('os');
AWS.config.update({ region: 'us-east-2' });
const util = require('util');
const vm = require('vm');


const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDBNotClient = new AWS.DynamoDB();
const tableName = 'pkgmetadata';
const authTable = 'AuthTokens';
const userTable = 'phase2users';
const jwt_secret = "JWT_SECRET_KEY"

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
    console.log('Received event:', JSON.stringify(event));
    
    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

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
        if(isAdmin === false && data.Item.searchAllow === false){
            console.log('Invalid permissions to view registry');
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid Permissions to view registry' }),
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

    try {
        if(typeof event.body !== 'string'){
            event.body = JSON.stringify(event.body);
        }

        const body = JSON.parse(event.body); 
        const regexPattern = body.RegEx;
        const nextToken = event.queryStringParameters?.nextToken;
        console.log('Regex pattern:', regexPattern);
        console.log('Next token:', nextToken);

        if (!regexPattern) {
            console.log('Regex pattern is required but not provided.');
            return {
                statusCode: 400,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'Regex pattern is required' })
            };
        }

        if (regexPattern.length < 3) { 
            console.log('Regex pattern is too short.');
            return {
                statusCode: 500,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'Regex pattern is too short' })
            };
        }

        // adapted from https://www.josephkirwin.com/2016/03/12/nodejs_redos_mitigation/

        var sandbox = {
            result: null
        };
        const regexscript = `new RegExp("${regexPattern}", "i")`; 

        var context = new vm.createContext(sandbox);
        console.log('Evaluating regex pattern:', regexPattern);
        var script = new vm.Script(regexscript);  
        try { 
            script.runInContext(context, { timeout: 1000 });
        } catch (error) {
            console.log('Regex pattern is invalid:', error);
            return {
                statusCode: 500,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'Regex pattern is invalid' })
            };
        }
        const regex = new RegExp(regexPattern, 'i');
        let matchedPackages = [];
        let params = {
            TableName: tableName,
            ExclusiveStartKey: nextToken ? JSON.parse(decodeURIComponent(nextToken)) : undefined
        };

        do {
            console.log('Scanning DynamoDB with params:', JSON.stringify(params));
            const data = await dynamoDb.scan(params).promise();
            console.log('Received data:', JSON.stringify(data));

            const filteredPackages = data.Items.filter(pkg => pkg.pkgName && regex.test(pkg.pkgName))
                                               .map(pkg => ({ Name: pkg.pkgName, Version: pkg.pkgVersion }));

            matchedPackages = matchedPackages.concat(filteredPackages);
            console.log('Matched packages so far:', JSON.stringify(matchedPackages));

            if (matchedPackages.length >= 10 || !data.LastEvaluatedKey) {
                console.log('Breaking out of the loop:', matchedPackages.length, data.LastEvaluatedKey);
                break;
            }
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (true);
        const transformedresponse = matchedPackages.map(pkg => ({ Name: pkg.Name, Version: pkg.Version }));
        if (transformedresponse.length === 0) {
            return {
                statusCode: 404,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'No packages found' })
            };
        }
        console.log('Transformed response:', JSON.stringify(transformedresponse));
        /*
        const response = {
            items: matchedPackages.slice(0, 10),
            nextToken: params.ExclusiveStartKey ? encodeURIComponent(JSON.stringify(params.ExclusiveStartKey)) : null
        };

        if (matchedPackages.length === 0) {
            return {
                statusCode: 404,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'No packages found' })
            };
        }

        console.log('Response:', JSON.stringify(response));
        */
        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify(transformedresponse)
        };
    } catch (error) {
        console.error('Error occurred:', error);
        return {
            statusCode: 500,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify({ error: error.message })
        };
    }
};
