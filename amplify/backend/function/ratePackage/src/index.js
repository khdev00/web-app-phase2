const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const tableName = 'PackageMetadata';

const {fetchUrlData, calculateAllMetrics} = require("./fetch_url")
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");
  
const secret_name = "GITHUB_TOKEN";

const updateDynamoDBItem = async (packageId, metricScore) => {
    //Update MetricScore with net score
    try {
        const updateParams = {
            TableName: tableName,
            Key: {
                "packageName": packageId,
            },
            UpdateExpression: "SET MetricScore = :metricScore",
            ExpressionAttributeValues: {
                ":metricScore": metricScore,
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
            body: JSON.stringify({ message: 'Failed to retrieve secret' }),
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
            body: JSON.stringify({ message: 'Package ID is required' }),
        };
    }

    // Retrieve the package metadata from DynamoDB
    let packageMetadata;
    try {
        const params = {
            TableName: tableName,
            Key: {
                "packageName": packageId
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

    if (!packageMetadata || !packageMetadata.S3Location) {
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

    const url = packageMetadata.URL;
    console.log("Url: ", url);
    let urlData = [];
    let packageData = [];

    try {
        urlData = await fetchUrlData(url);
        packageData = await calculateAllMetrics(urlData, secret);
        
    } catch (error) {
        console.error("Error calculating metrics:", error);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to calculate metrics' }),
        };
    }
    const netScore = packageData[0].netScore;

    // Update the DynamoDB item with the package rating
    try {
        await updateDynamoDBItem(packageId, netScore);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Package metric score updated successfully' }),
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