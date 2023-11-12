const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'PackageMetadata';

exports.handler = async (event) => {
    try {
        const regexPattern = event.queryStringParameters?.regex;
        if (!regexPattern) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*'
                },
                body: JSON.stringify({ message: 'Regex pattern is required' })
            };
        }
        const regex = new RegExp(regexPattern, 'i');

        let matchedPackages = [];
        let lastEvaluatedKey = null;
        const limit = 10; // You can also make this a parameter from the event

        do {
            const params = {
                TableName: tableName,
                Limit: limit,
                ExclusiveStartKey: lastEvaluatedKey
            };

            const data = await dynamoDb.scan(params).promise();

            for (const pkg of data.Items) {
                // Apply regex to package properties (modify as per your requirement)
                if (regex.test(pkg.packageName)) {
                    matchedPackages.push(pkg);
                }
            }

            lastEvaluatedKey = data.LastEvaluatedKey;

            // Continue fetching pages until you have enough matched items
        } while (matchedPackages.length < limit && lastEvaluatedKey);

        const response = {
            items: matchedPackages.slice(0, limit), // Ensure only 'limit' items are returned
            nextToken: lastEvaluatedKey ? encodeURIComponent(JSON.stringify(lastEvaluatedKey)) : null
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
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
