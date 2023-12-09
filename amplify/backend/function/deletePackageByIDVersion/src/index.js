const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
const bucketName = 'packageregistry';

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);

    const packageId = event.pathParameters?.id;

    if (!packageId) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'PackageID is required' }),
        };
    }

    // Retrieve the package metadata from DynamoDB
    let packageMetadata;
    try {
        const params = {
            TableName: tableName,
            Key: { "pkgID": packageId }
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
            body: JSON.stringify({ message: 'Failed to retrieve package metadata from database' }),
        };
    }

    if (!packageMetadata) {
        return {
            statusCode: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Package does not exist' }),
        };
    }

    // Delete the package content from S3
    if (packageMetadata.contentS3Url) {
        try {
            const contentUrlParts = new URL(packageMetadata.contentS3Url);
            const contentS3Key = contentUrlParts.pathname.substring(1); // Remove leading '/'
            const s3DeleteParams = {
                Bucket: bucketName,
                Key: contentS3Key
            };
            await s3.deleteObject(s3DeleteParams).promise();
        } catch (s3Error) {
            console.error('S3 Error:', s3Error);
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Failed to delete package content from S3' }),
            };
        }
    }

    // Delete the package zip file from S3
    if (packageMetadata.packageS3Url) {
        try {
            const packageUrlParts = new URL(packageMetadata.packageS3Url);
            const packageS3Key = packageUrlParts.pathname.substring(1); // Remove leading '/'
            const s3DeleteParams = {
                Bucket: bucketName,
                Key: packageS3Key
            };
            await s3.deleteObject(s3DeleteParams).promise();
        } catch (s3Error) {
            console.error('S3 Error:', s3Error);
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Failed to delete package zip file from S3' }),
            };
        }
    }

    // Delete the package metadata from DynamoDB
    try {
        const deleteParams = {
            TableName: tableName,
            Key: { "pkgID": packageId }
        };
        await dynamoDb.delete(deleteParams).promise();
    } catch (dbError) {
        console.error('DynamoDB Error:', dbError);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to delete package metadata from database' }),
        };
    }

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package successfully deleted' }),
    };
};
