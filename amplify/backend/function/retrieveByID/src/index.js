const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'PackageMetadata';
const bucketName = 'packageregistry'; // Replace with your S3 bucket name
const folderName = 'nongradedpackages';

exports.handler = async (event) => {
    console.log('Event Body:', event.body);

    // Similar input validation as the create function...


    // Check if event.body is defined
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

    // Check if event.body is a string
    if (typeof event.body !== 'string') {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid request body' }),
        };
    }

    // Try to parse the event.body
    let body;
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

    // Access the properties
    const packageName = body.packageId;
    console.log('Package Name:', packageName);
    
    // Return a success response
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package Downloaded' }),
    };
};
