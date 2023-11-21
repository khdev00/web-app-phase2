const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();


const tableName = 'pkgmetadata';
const bucketName = 'packageregistry';
const folderName = 'nongradedpackages';
/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

exports.handler = async (event) => {
    console.log('Event Body:', event.body);

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
    const packageName = body.packageName;
    const packageVersion = body.packageVersion;
    const packageContent = body.packageContent; // This is base64-encoded
    const packageURL = body.packageURL;
    const packageScore = body.packageScore;
    let packageID = packageName + packageVersion; 
    console.log('packageID', packageID);

    // Decode the base64-encoded content
    const decodedContent = Buffer.from(packageContent, 'base64');

    // Define S3 upload parameters
    const uploadParams = {
        Bucket: bucketName,
        Key: `${folderName}/${packageName}/${packageVersion}/${packageName}-${packageVersion}.zip`,
        Body: decodedContent,
        ContentType: 'application/zip'
    };

    try {
        // Upload to S3
        const s3Result = await s3.upload(uploadParams).promise();
        console.log('Upload to S3 successful', s3Result);

        // Add to DynamoDB
        const dynamoParams = {
            TableName: tableName,
            Item: {
                packageName: packageName,
                Version: packageVersion,
                S3Location: s3Result.Location, // Use S3 file location for quick access
                URL: packageURL,
                MetricScore: packageScore,
                pkgID: packageID,
                Content: packageContent,
            },
        };

        const dynamoResult = await dynamoDb.put(dynamoParams).promise();
        console.log('Success', dynamoResult);
    } catch (error) {
        console.error('Error', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to add package info and content' }),
        };
    }

    // Return a success response
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package info and content added successfully' }),
    };
};
