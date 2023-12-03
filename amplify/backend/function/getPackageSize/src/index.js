const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const s3 = new AWS.S3();
const bucketName = 'packageregistry';
const folderName = 'nongradedpackages';

exports.handler = async (event) => {
    if (!event.body || typeof event.body !== 'string') {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Invalid or missing request body' }),
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }

    const packageName = body.packageName;
    const packageVersion = body.packageVersion;
    const packageID = packageName + packageVersion;
    const s3ObjectKey = `${folderName}/${packageName}/${packageVersion}/${packageName}-${packageVersion}.zip`;

    try {
        const s3HeadObject = await s3.headObject({ Bucket: bucketName, Key: s3ObjectKey }).promise();
        const packageSize = s3HeadObject.ContentLength;

        console.log('Package Size:', packageSize);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ packageSize }),
        };
    } catch (error) {
        console.error('Error:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Failed to retrieve package size' }),
        };
    }
};