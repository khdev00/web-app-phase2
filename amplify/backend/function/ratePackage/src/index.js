const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDBNotClient = new AWS.DynamoDB();
const tableName = 'pkgmetadata';

const {fetchUrlData, calculateAllMetrics} = require("./fetch_url")
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");
  
const secret_name = "GITHUB_TOKEN";
const jwt_secret = "JWT_SECRET_KEY";
const userTable = 'phase2users';
const authTable = 'AuthTokens';

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

const updateDynamoDBItem = async (packageId, netScore, busFactor, correctness, goodPinningPractice, licenseScore, pullRequest, rampUp, responsiveMaintainer) => {
    //Update MetricScore with net score
    try {
        const updateParams = {
            TableName: tableName,
            Key: {
                "pkgID": packageId,
            },
            UpdateExpression: "SET NetScore = :netScore, BusFactor = :busFactor, Correctness = :correctness, GoodPinningPractice = :goodPinningPractice, \
            LicenseScore = :licenseScore, PullRequest = :pullRequest, RampUp = :rampUp, ResponsiveMaintainer = :responsiveMaintainer",
            ExpressionAttributeValues: {
                ":netScore": netScore,
                ":busFactor": busFactor,
                ":correctness": correctness,
                ":goodPinningPractice": goodPinningPractice,
                ":licenseScore": licenseScore,
                ":pullRequest": pullRequest,
                ":rampUp": rampUp,
                ":responsiveMaintainer": responsiveMaintainer,
            },
        };
        const dynamoResult = await dynamoDb.update(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);
    } catch (dbError) {
        console.error('DynamoDB Update Error:', dbError);
        throw new Error('Failed to update package metadata');
    }
};

exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    //setup secret manager client
    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

    //attempt to retrieve github token
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
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve Github Token' }),
        };
    }

    const secretString = response.SecretString;
    const secretObject = JSON.parse(secretString);
    const secret = secretObject.GITHUB_TOKEN;

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

    try{
        await validateToken(auth_token, jwt_token);
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

    console.log('pathParameters:', event.pathParameters);
    
    const packageId = event.pathParameters.id; // Access the 'id' parameter directly from the event

    if (!packageId) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid Input Field/s' }),
        };
    }

    // Retrieve the package metadata from DynamoDB
    let packageMetadata;
    try {
        const params = {
            TableName: tableName,
            Key: {
                "pkgID": packageId
            }
        };
        const data = await dynamoDb.get(params).promise();
        packageMetadata = data.Item;
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

    if (!packageMetadata || !packageMetadata.packageS3Url) {
        console.error('S3 URL not found in package metadata:', packageMetadata);
        return {
            statusCode: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'S3 URL not found in package metadata' }),
        };
    }

    const url = packageMetadata.pkgURL;
    console.log("Url: ", url);
    let urlData = [];
    let packageData = [];

    try {
        urlData = await fetchUrlData(url);
        packageData = await calculateAllMetrics(urlData, secret);
        
    } catch (error) {
        console.error("Error calculating metrics:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to calculate metrics' }),
        };
    }

    const busFactor = packageData[0].busFactor;
    const correctness = packageData[0].correctness;
    const rampUp = packageData[0].rampUp;
    const responsiveMaintainer = packageData[0].responsiveMaintainer;
    const licenseScore = +packageData[0].hasLicense;
    const goodPinningPractice = packageData[0].dependencies;
    const pullRequest = packageData[0].codeReview;
    const netScore = packageData[0].netScore;

    const returnMetrics = {
        BusFactor: busFactor,
        Correctness: correctness,
        RampUp: rampUp,
        ResponsiveMaintainer: responsiveMaintainer,
        LicenseScore: licenseScore,
        GoodPinningPractice: goodPinningPractice,
        PullRequest: pullRequest,
        NetScore: netScore
    }

    // Update the DynamoDB item with the package rating
    try {
        await updateDynamoDBItem(packageId, netScore, busFactor, correctness, goodPinningPractice, licenseScore, pullRequest, rampUp, responsiveMaintainer);
        console.log('Package metric score updated successfully')

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify(returnMetrics),
        };
    } catch (updateError) {
        console.error('Update Error:', updateError);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to update package metadata' }),
        };
    }
};