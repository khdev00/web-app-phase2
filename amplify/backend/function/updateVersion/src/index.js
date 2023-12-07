const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const tableName = 'pkgmetadata';
const bucketName = 'packageregistry'; 
const packageContentFolderName = 'packagecontent';

exports.handler = async (event) => {
    console.log('Event Body:', event.body);
    

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

    let body;
    try {
        body = JSON.parse(event.body);
        console.log('Parsed body:', body);
        if (typeof body === 'string') {
            body = JSON.parse(body); // Second parse if needed
            console.log('Second parsed body:', body);
        }
    } catch (error) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }

    const packageID = body.metadata.ID;
    const newContent = body.data.Content; // This is base64-encoded
    console.log('Package ID:', packageID);
    console.log('New content:', newContent);

    const getParams = {
        TableName: tableName,
        Key: { "pkgID": packageID }
    };

    try {
        const { Item: existingPackage } = await dynamoDb.get(getParams).promise();
        if (!existingPackage) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package not found' }),
            };
        }

        const decodedContent = Buffer.from(newContent, 'base64');
        const contentKey = `${packageContentFolderName}/${existingPackage.pkgName}_${existingPackage.pkgVersion}_content.txt`;

        // Upload new package content
        const contentUploadResult = await s3.upload({
            Bucket: bucketName,
            Key: contentKey,
            Body: newContent
        }).promise();

        // Update the zip file
        const zipKey = new URL(existingPackage.packageS3Url).pathname.substring(1); // Extract the key from the URL
        const zipUploadResult = await s3.upload({
            Bucket: bucketName,
            Key: zipKey,
            Body: decodedContent,
            ContentType: 'application/zip'
        }).promise();

        // Update DynamoDB record
        const updateParams = {
            TableName: tableName,
            Key: { "pkgID": packageID },
            UpdateExpression: 'set contentS3Url = :c, packageS3Url = :z',
            ExpressionAttributeValues: {
                ':c': contentUploadResult.Location,
                ':z': zipUploadResult.Location
            },
            ReturnValues: 'UPDATED_NEW'
        };

        await dynamoDb.update(updateParams).promise();

    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to update package info and content' }),
        };
    }

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package content updated successfully' }),
    };
};
