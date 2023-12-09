const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
const bucketName = 'packageregistry';
const indexName = 'pkgName-index';

exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);

    const packageName = event.pathParameters?.name;

    if (!packageName) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },

            body: JSON.stringify({ message: 'PackageName is required' }),
        };
    }

    let packageVersions;
    try {
        const queryParams = {
            TableName: tableName,
            IndexName: indexName,
            KeyConditionExpression: 'pkgName = :pkgName',
            ExpressionAttributeValues: {
                ':pkgName': packageName
            }
        };
        const data = await dynamoDb.query(queryParams).promise();
        packageVersions = data.Items;
    } catch (dbError) {
        console.error('DynamoDB Error:', dbError);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Failed to query package versions from database' }),
        };
    }

    if (!packageVersions || packageVersions.length === 0) {
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'No package versions found' }),
        };
    }

    for (const packageMetadata of packageVersions) {
        // Delete the package content from S3
        if (packageMetadata.contentS3Url) {
            try {
                const contentUrlParts = new URL(packageMetadata.contentS3Url);
                const contentS3Key = contentUrlParts.pathname.substring(1);
                await s3.deleteObject({
                    Bucket: bucketName,
                    Key: contentS3Key
                }).promise();
            } catch (s3Error) {
                console.error('S3 Error:', s3Error);
                // Continue to delete other items even if one fails
            }
        }

        // Delete the package zip file from S3
        if (packageMetadata.packageS3Url) {
            try {
                const packageUrlParts = new URL(packageMetadata.packageS3Url);
                const packageS3Key = packageUrlParts.pathname.substring(1);
                await s3.deleteObject({
                    Bucket: bucketName,
                    Key: packageS3Key
                }).promise();
            } catch (s3Error) {
                console.error('S3 Error:', s3Error);
                // Continue to delete other items even if one fails
            }
        }

        // Delete the package metadata from DynamoDB
        try {
            await dynamoDb.delete({
                TableName: tableName,
                Key: { "pkgID": packageMetadata.pkgID }
            }).promise();
        } catch (dbError) {
            console.error('DynamoDB Error:', dbError);
            // Continue to delete other items even if one fails
        }
    }

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({ message: 'All package versions successfully deleted' }),
    };
};
