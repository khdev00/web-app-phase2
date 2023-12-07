const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

exports.handler = async (event) => {
    console.log('Event:', event);
    try {
        console.log('Request Body:', event.body)
        const requestBody = JSON.parse(event.body);
        console.log('Request Body after parse:', requestBody);
    

        if (!Array.isArray(requestBody) || requestBody.length === 0) {
            console.log('request body length:',requestBody.length); 
            console.log('request body type:',typeof requestBody);
            console.log('request body isArray:',Array.isArray(requestBody)); 
            return { 
                statusCode: 400, 
                headers: { 
                    'Access-Control-Allow-Origin': '*', 
                    'Access-Control-Allow-Headers': '*' 
                },
                body: JSON.stringify({ error: 'Invalid request format' }) 
            };
        }

        const query = requestBody[0];
        console.log('Query:', query);

        let filterExpression = '';
        let expressionAttributeValues = {};
        let expressionAttributeNames = {};

        if (query.Name) {
            filterExpression += ' #name = :name';
            expressionAttributeValues[':name'] = query.Name;
            expressionAttributeNames['#name'] = 'pkgName'; 
        }
        if (query.Version) {
            filterExpression += (filterExpression ? ' and ' : '') + ' #version = :version';
            expressionAttributeValues[':version'] = query.Version;
            expressionAttributeNames['#version'] = 'pkgVersion';
        }

        const params = {
            TableName: tableName,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            Limit: 10,
        };

        if (event.queryStringParameters && event.queryStringParameters.nextToken) {
            params.ExclusiveStartKey = JSON.parse(decodeURIComponent(event.queryStringParameters.nextToken));
        }
        

        const data = await dynamoDb.scan(params).promise();
        console.log('DynamoDB Response:', data);

        const transformedItems = data.Items.map(item => ({
            Version: item.pkgVersion,
            Name: item.pkgName,
            ID: item.pkgID
        }));

        const response = {
            items: transformedItems,
            nextToken: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null
        };

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                ...(response.nextToken && { 'Next-Token': response.nextToken })
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
