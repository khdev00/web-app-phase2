const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'PackageMetadata';
const bucketName = 'packageregistry'; // Replace with your S3 bucket name
const folderName = 'nongradedpackages';
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event));

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

    // Assuming packageMetadata.S3Location contains the full S3 URL
    const s3Url = packageMetadata.S3Location;
    const urlParts = new URL(s3Url);
    const key = urlParts.pathname.substring(1); // Remove the leading '/' from the pathname to get the key
    const filename = key.split('/').pop(); // Get the filename from the key
    // Generate a presigned URL for the package file
    const s3Params = {
        Bucket: bucketName,
        Key: key,
        Expires: 60, // The URL will expire in 60 seconds
        ResponseContentDisposition: `attachment; filename="${filename}"` 
    };
    const presignedUrl = s3.getSignedUrl('getObject', s3Params);

    // Return the presigned URL
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ downloadUrl: presignedUrl })
    };
};
