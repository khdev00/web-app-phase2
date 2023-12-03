const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

exports.handler = async (event) => {
    try {
        const regexPattern = event.queryStringParameters?.regex;
        const nextToken = event.queryStringParameters?.nextToken; // Parse nextToken if it exists

        if (!regexPattern) {
            return {
                statusCode: 400,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'Regex pattern is required' })
            };
        }

        const regex = new RegExp(regexPattern, 'i');
        let matchedPackages = [];
        let params = {
            TableName: tableName,
            ExclusiveStartKey: nextToken ? JSON.parse(decodeURIComponent(nextToken)) : undefined
        };

        do {
            const data = await dynamoDb.scan(params).promise();
            const filteredPackages = data.Items.filter(pkg => pkg.packageName && regex.test(pkg.packageName))
                                               .map(pkg => ({ Name: pkg.packageName, Version: pkg.Version, ID: pkg.pkgID }));

            matchedPackages = matchedPackages.concat(filteredPackages);
            if (matchedPackages.length >= 10 || !data.LastEvaluatedKey) {
                break; // Exit if 10 items are found or no more items to scan
            }
            params.ExclusiveStartKey = data.LastEvaluatedKey; // Update for next scan
        } while (true);

        const response = {
            items: matchedPackages.slice(0, 10), // Return only the first 10 matches
            nextToken: params.ExclusiveStartKey ? encodeURIComponent(JSON.stringify(params.ExclusiveStartKey)) : null
        };

        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify(response)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify({ error: error.message })
        };
    }
};
