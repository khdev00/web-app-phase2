const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

exports.handler = async (event) => {
    try {
        const params = {
            TableName: tableName,
            Limit: 10 // Set the number of items per page
        };

        // Check for the existence of a pagination token in the request
        if (event.queryStringParameters && event.queryStringParameters.nextToken) {
            params.ExclusiveStartKey = JSON.parse(decodeURIComponent(event.queryStringParameters.nextToken));
        }

        const data = await dynamoDb.scan(params).promise();

        const response = {
            items: data.Items,
            nextToken: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null
        };

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
