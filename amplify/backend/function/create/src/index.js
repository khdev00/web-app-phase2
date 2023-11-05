/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log('Event Body:', event.body);
    
    // Check if event.body is defined
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
    
    // Check if event.body is a string
    if (typeof event.body !== 'string') {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid request body' }),
        };
    }

    // Try to parse the event.body
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }
    
    // Access the properties
    const packageName = body.packageName;
    const packageVersion = body.packageVersion;
    const packageContent = body.packageContent; // This is base64-encoded
    const packageURL = body.packageURL;
    const packageScore = body.packageScore; 
        
    // Return a success response
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'Package info and content added successfully' }),
    };
};
