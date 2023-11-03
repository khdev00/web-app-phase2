/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

exports.handler = async (event) => {
    try {
        console.log('Lambda function invoked successfully.');  // Logs a message to CloudWatch
        console.log('Received event:', JSON.stringify(event, null, 2));  // Logs the event to CloudWatch

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Lambda function invoked successfully.' }),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};
