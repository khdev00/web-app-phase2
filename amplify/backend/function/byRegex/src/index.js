const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event)); 

    try {
        const regexPattern = event.queryStringParameters?.RegEx;
        const nextToken = event.queryStringParameters?.nextToken;
        console.log('Regex pattern:', regexPattern);
        console.log('Next token:', nextToken);

        if (!regexPattern) {
            console.log('Regex pattern is required but not provided.');
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
            console.log('Scanning DynamoDB with params:', JSON.stringify(params));
            const data = await dynamoDb.scan(params).promise();
            console.log('Received data:', JSON.stringify(data));

            const filteredPackages = data.Items.filter(pkg => pkg.pkgName && regex.test(pkg.pkgName))
                                               .map(pkg => ({ Name: pkg.pkgName, Version: pkg.pkgVersion, ID: pkg.pkgID }));

            matchedPackages = matchedPackages.concat(filteredPackages);
            console.log('Matched packages so far:', JSON.stringify(matchedPackages));

            if (matchedPackages.length >= 10 || !data.LastEvaluatedKey) {
                console.log('Breaking out of the loop:', matchedPackages.length, data.LastEvaluatedKey);
                break;
            }
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (true);

        const response = {
            items: matchedPackages.slice(0, 10),
            nextToken: params.ExclusiveStartKey ? encodeURIComponent(JSON.stringify(params.ExclusiveStartKey)) : null
        };

        console.log('Response:', JSON.stringify(response));
        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error occurred:', error);
        return {
            statusCode: 500,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify({ error: error.message })
        };
    }
};
