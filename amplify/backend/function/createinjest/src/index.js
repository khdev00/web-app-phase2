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

exports.uploadHandler = async (event) => {
    console.log('Event Body:', event.body);
    let body = JSON.parse(event.body);

    
    const packageContent = body.packageContent; // This is base64-encoded
    const decodedContent = Buffer.from(packageContent, 'base64');

    // Use a timestamp to create a unique file name
    const fileName = `package_${new Date().getTime()}.zip`;

    const uploadParams = {
        Bucket: bucketName,
        Key: `${folderName}/${fileName}`,
        Body: decodedContent,
        ContentType: 'application/zip'
    };

    try {
        await s3.putObject(uploadParams).promise();
        console.log(`File uploaded successfully at ${folderName}/${fileName}`);

        // Return a success response
        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'File uploaded successfully', fileName: fileName }),
        };

    } catch (error) {
        console.error("Error uploading to S3:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to upload file to S3' }),
        };
    }

};

exports.ingestHandler = async (event) => {
    // ingest just returns url to console. 
    // the event body for this looks like: 
    // Event Body: {"packageContent": "", "packageURL": "www.google.com"}
     
    console.log('Event Body:', event.body);
    let body = JSON.parse(event.body);
    const packageURL = body.packageURL;

    
    return {
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'URL passed', packageURL: packageURL }),
    };

}
exports.handler = async (event) => {
    console.log('Event Body:', event.body);

    // Auth handling would go here

    if (typeof event.body !== 'string') {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid request body' }),
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }

    const packageContent = body.packageContent;
    const packageURL = body.packageURL;

    try {
        if (packageContent && !packageURL) {
            return await exports.uploadHandler(event);
        } else if (packageURL && !packageContent) {
            return await exports.ingestHandler(event);
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid request. Please provide either packageContent (Base 64 Encoded .zip) or packageURL, not both.' }),
            };
        }
    } catch (error) {
        console.error("Error in processing:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    }
};

