const AWS = require('aws-sdk');
const { url } = require('inspector');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
const bucketName = 'packageregistry'; // Replace with your S3 bucket name

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event));

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

    let packageMetadata;
    try {
        const params = {
            TableName: tableName,
            Key: { "pkgID": packageId }
        };
        const data = await dynamoDb.get(params).promise();
        packageMetadata = data.Item;
        console.log('Package metadata:', packageMetadata);
        if (!packageMetadata) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package metadata does not exist' }),
            };
        }

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

    if (!packageMetadata.contentS3Url) {
        console.error('Content URL not found in package metadata:', packageMetadata);
        return {
            statusCode: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Package content does not exist' }),
        };
    }

    // Fetch the base64 encoded content from the S3 URL
    let encodedContent;
    try {
        const urlParts = new URL(packageMetadata.contentS3Url);
        const s3Key = urlParts.pathname.substring(1); // Remove leading '/'
        const s3ContentParams = {
            Bucket: bucketName,
            Key: s3Key
        };
        const contentObject = await s3.getObject(s3ContentParams).promise();
        encodedContent = contentObject.Body.toString('utf-8');
    } catch (s3Error) {
        console.error('S3 Error:', s3Error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve package content from S3' }),
        };
    }

    /*
    const s3Url = packageMetadata.packageS3Url;
    const urlPartsS3 = new URL(s3Url); 
    const key = urlPartsS3.pathname.substring(1); // Remove leading '/'
    const filename = key.split('/').pop();
    const s3Params = {
        Bucket: bucketName,
        Key: key,
        Expires: 60,
        ResponseContentDisposition: `attachment; filename="${filename}"`
    };
    const signedUrl = s3.getSignedUrl('getObject', s3Params);
    console.log('Signed URL:', signedUrl);
    */

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Content-Type": "application/json"
            
        },
        body: JSON.stringify({
            metadata: {
                Name: packageMetadata.pkgName,
                Version: packageMetadata.pkgVersion,
                ID: packageMetadata.pkgID
            },
            data: {
                Content: encodedContent, // This is the base64 encoded string from the text file
                JSProgram: packageMetadata.JSProgram
            }
        })
    };
};
