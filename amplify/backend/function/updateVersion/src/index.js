const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
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
    const packageID = body.packageId;
    const packageContent = body.packageContent; // This is base64-encoded
    
    // Decode the base64-encoded content
    const decodedContent = Buffer.from(packageContent, 'base64');

    // Fetch existing package info from DynamoDB
    const getParams = {
        TableName: tableName,
        Key: {
            "pkgID": packageID // Adjust based on your table's primary key
        }
    };

    try {
        const { Item: existingPackage } = await dynamoDb.get(getParams).promise();

        if (!existingPackage) {
            console.error('Package not found');
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package not found' }),
            };
        }

        // Define S3 upload parameters
        const uploadParams = {
            Bucket: bucketName,
            Key: `${folderName}/${existingPackage.packageName}/${existingPackage.Version}/${existingPackage.packageName}-${existingPackage.Version}.zip`,
            Body: decodedContent,
            ContentType: 'application/zip'
        };

        // Upload updated content to S3
        const s3Result = await s3.upload(uploadParams).promise();
        console.log('Upload to S3 successful', s3Result);

        // Update DynamoDB record
        const updateParams = {
            TableName: tableName,
            Key: {
                "pkgID": packageID
            },
            UpdateExpression: 'set S3Location = :s',
            ExpressionAttributeValues: {
                ':s': s3Result.Location
            },
            ReturnValues: 'UPDATED_NEW'
        };

        const dynamoResult = await dynamoDb.update(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);
    } catch (error) {
        console.error('Error', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to update package info and content' }),
        };
    }

    // Return a success response
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package info and content updated successfully' }),
    };
};
