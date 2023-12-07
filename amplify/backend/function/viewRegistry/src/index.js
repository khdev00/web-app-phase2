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
    let isUpperBoundInclusive = false;

    if (version.includes('-')) {
        [minVersion, maxVersion] = version.split('-');
        isUpperBoundInclusive = true;
    } else if (version.startsWith('^')) {
        const baseVersion = version.substring(1).split('.').map(Number);

        // Special handling for versions starting with 0
        if (baseVersion[0] === 0) {
            minVersion = baseVersion.join('.');
            baseVersion[1] += 1; // Increment minor version
            maxVersion = baseVersion[0] + '.' + baseVersion[1] + '.0';
        } else {
            minVersion = baseVersion.join('.');
            baseVersion[0] += 1; // Increment major version
            maxVersion = baseVersion[0] + '.0.0';
        }
    } else if (version.startsWith('~')) {
        const baseVersion = version.substring(1).split('.').map(Number);
        minVersion = baseVersion.join('.');

        // Special handling for versions starting with 0
        if (baseVersion[0] === 0 && baseVersion[1] !== undefined) {
            baseVersion[2] = (baseVersion[2] || 0) + 1; // Increment patch version
            maxVersion = baseVersion[0] + '.' + baseVersion[1] + '.' + baseVersion[2];
        } else {
            baseVersion[1] = (baseVersion[1] || 0) + 1; // Increment minor version
            maxVersion = baseVersion[0] + '.' + baseVersion[1] + '.0';
        }
    } else {
        // Treat a specific version as a range
        const baseVersion = version.split('.').map(Number);
        minVersion = version;
        if (baseVersion.length === 3) {
            // Increment patch version for specific version
            baseVersion[2] += 1;
            maxVersion = baseVersion[0] + '.' + baseVersion[1] + '.' + baseVersion[2];
        } else {
            // If the specific version doesn't include patch version, add '.0' as the max version
            maxVersion = version + '.0';
        }
    }

    return { minVersion, maxVersion, isUpperBoundInclusive };
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

        // Apply name filter if name is provided and is not '*'
        if (query.Name && query.Name !== '*') {
            filterExpression += ' #name = :name';
            expressionAttributeValues[':name'] = query.Name;
            expressionAttributeNames['#name'] = 'pkgName';
        }

        let versionRange = { minVersion: '', maxVersion: '', isUpperBoundInclusive: false };
        if (query.Version && query.Version !== '') {
            versionRange = parseVersionRange(query.Version);
            console.log(`Parsed Version Range: Min - ${versionRange.minVersion}, Max - ${versionRange.maxVersion}, Inclusive - ${versionRange.isUpperBoundInclusive}`);
        }

        let params = {
            TableName: tableName,
            Limit: 10,
        };

        if (filterExpression) {
            params.FilterExpression = filterExpression;
            params.ExpressionAttributeValues = expressionAttributeValues;

            if (Object.keys(expressionAttributeNames).length > 0) {
                params.ExpressionAttributeNames = expressionAttributeNames;
            }
        }

        console.log('DynamoDB Query Params:', params);
        const data = await dynamoDb.scan(params).promise();
        console.log('DynamoDB Response:', data);

        let filteredItems = data.Items;

        // Apply version filter if version range is provided
        if (query.Version && query.Version !== '') {
            filteredItems = filteredItems.filter(item => {
                const version = item.pkgVersion;
                const isMinSatisfied = compareVersions(version, versionRange.minVersion) >= 0;
                const isMaxSatisfied = versionRange.isUpperBoundInclusive
                    ? compareVersions(version, versionRange.maxVersion) <= 0
                    : compareVersions(version, versionRange.maxVersion) < 0;

                return isMinSatisfied && isMaxSatisfied;
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

