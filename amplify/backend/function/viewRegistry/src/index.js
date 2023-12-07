const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = 'pkgmetadata';

function compareVersions(version1, version2) {
    const splitV1 = version1.split('.').map(Number);
    const splitV2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(splitV1.length, splitV2.length); i++) {
        const num1 = splitV1[i] || 0;
        const num2 = splitV2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

// Function to parse version range from carat or tilde
function parseVersionRange(version) {
    let minVersion = '';
    let maxVersion = '';

    if (version.includes('-')) {
        // For a bounded range like 1.4.0-1.6.0
        [minVersion, maxVersion] = version.split('-');
    } else if (version.startsWith('^')) {
        // For carat versions (^1.2.3)
        const baseVersion = version.substring(1).split('.').map(Number);
        minVersion = baseVersion.join('.');
        baseVersion[0] += 1; // Increment major version
        maxVersion = baseVersion[0] + '.0.0';
    } else if (version.startsWith('~')) {
        // For tilde versions (~1.2.3)
        const baseVersion = version.substring(1).split('.').map(Number);
        minVersion = baseVersion.join('.');
        baseVersion[1] += 1; // Increment minor version
        maxVersion = baseVersion[0] + '.' + baseVersion[1] + '.0';
    } else {
        // If no special character, treat it as a fixed version
        minVersion = maxVersion = version;
    }

    return { minVersion, maxVersion };
}


exports.handler = async (event) => {
    console.log('Event:', event);
    try {
        console.log('Request Body:', event.body);
        const requestBody = JSON.parse(event.body);
        console.log('Parsed Request Body:', requestBody);

        if (!Array.isArray(requestBody) || requestBody.length === 0) {
            console.log('Invalid request format');
            return generateErrorResponse(400, 'Invalid request format');
        }

        const query = requestBody[0];
        console.log('Query:', query);

        let filterExpression = '';
        let expressionAttributeValues = {};
        let expressionAttributeNames = {};
        let versionRange = { minVersion: '', maxVersion: '' }; // Declare versionRange here

        if (query.Name) {
            filterExpression += ' #name = :name';
            expressionAttributeValues[':name'] = query.Name;
            expressionAttributeNames['#name'] = 'pkgName';
        }
        if (query.Version) {
            versionRange = parseVersionRange(query.Version); // Assign versionRange here
            console.log(`Parsed Version Range: Min - ${versionRange.minVersion}, Max - ${versionRange.maxVersion}`);
        }

        const params = {
            TableName: tableName,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            Limit: 10,
        };

        console.log('DynamoDB Query Params:', params);
        const data = await dynamoDb.scan(params).promise();
        console.log('DynamoDB Response:', data);

        let filteredItems = data.Items;
        if (query.Version) {
            filteredItems = data.Items.filter(item => {
                const version = item.pkgVersion;
                const isWithinRange = compareVersions(version, versionRange.minVersion) >= 0 &&
                                      compareVersions(version, versionRange.maxVersion) <= 0;
                console.log(`Version ${version} within range: ${isWithinRange}`);
                return isWithinRange;
            });
        }

        const transformedItems = filteredItems.map(item => ({
            Version: item.pkgVersion,
            Name: item.pkgName,
            ID: item.pkgID
        }));

        console.log('Filtered and Transformed Items:', transformedItems);
        return generateSuccessResponse(transformedItems, data);
    } catch (error) {
        console.error('Error:', error);
        return generateErrorResponse(500, error.message);
    }
};

function generateSuccessResponse(items, data) {
    const response = {
        items: items,
        nextToken: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null
    };
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            ...(response.nextToken && { 'nextToken': response.nextToken })
        },
        body: JSON.stringify(response)
    };
}

function generateErrorResponse(statusCode, errorMessage) {
    return {
        statusCode: statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
        },
        body: JSON.stringify({ error: errorMessage })
    };
}
