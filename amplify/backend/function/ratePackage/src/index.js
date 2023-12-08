const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

const {fetchUrlData, calculateAllMetrics} = require("./fetch_url")
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");
  
const secret_name = "GITHUB_TOKEN";

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
    
    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

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
            body: JSON.stringify({ message: 'Failed to retrieve Github Token' }),
        };
    }

    const secretString = response.SecretString;
    const secretObject = JSON.parse(secretString);
    const secret = secretObject.GITHUB_TOKEN;

    const packageId = event.id; // Access the 'id' parameter directly from the event

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