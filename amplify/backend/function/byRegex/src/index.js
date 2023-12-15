const AWS = require('aws-sdk');
const { type } = require('os');
AWS.config.update({ region: 'us-east-2' });
const util = require('util');
const vm = require('vm');


const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event)); 


    try {
        let body; 
        if (typeof event.body === 'string') { 
            body = JSON.parse(event.body); 
        } else {
            body = event.body;
        }
        const regexPattern = body.RegEx;
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

        if (regexPattern.length < 3) { 
            console.log('Regex pattern is too short.');
            return {
                statusCode: 500,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'Regex pattern is too short' })
            };
        }

        // adapted from https://www.josephkirwin.com/2016/03/12/nodejs_redos_mitigation/

        var sandbox = {
            result: null
        };
        const regexscript = `new RegExp("${regexPattern}", "i")`; 

        var context = new vm.createContext(sandbox);
        console.log('Evaluating regex pattern:', regexPattern);
        var script = new vm.Script(regexscript);  
        try { 
            script.runInContext(context, { timeout: 1000 });
        } catch (error) {
            console.log('Regex pattern is invalid:', error);
            return {
                statusCode: 500,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'Regex pattern is invalid' })
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
                                               .map(pkg => ({ Name: pkg.pkgName, Version: pkg.pkgVersion }));

            matchedPackages = matchedPackages.concat(filteredPackages);
            console.log('Matched packages so far:', JSON.stringify(matchedPackages));

            if (matchedPackages.length >= 10 || !data.LastEvaluatedKey) {
                console.log('Breaking out of the loop:', matchedPackages.length, data.LastEvaluatedKey);
                break;
            }
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (true);
        const transformedresponse = matchedPackages.map(pkg => ({ Name: pkg.Name, Version: pkg.Version }));
        if (transformedresponse.length === 0) {
            return {
                statusCode: 404,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'No packages found' })
            };
        }
        console.log('Transformed response:', JSON.stringify(transformedresponse));
        /*
        const response = {
            items: matchedPackages.slice(0, 10),
            nextToken: params.ExclusiveStartKey ? encodeURIComponent(JSON.stringify(params.ExclusiveStartKey)) : null
        };

        if (matchedPackages.length === 0) {
            return {
                statusCode: 404,
                headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                body: JSON.stringify({ message: 'No packages found' })
            };
        }

        console.log('Response:', JSON.stringify(response));
        */
        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            body: JSON.stringify(transformedresponse)
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
