const AWS = require('aws-sdk');
const unzipper = require('unzipper'); // npm package needed for extraction
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();


const tableName = 'pkgmetadata';
const bucketName = 'packageregistry';
const folderName = 'nongradedpackages';

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

exports.processZipFile = async (fileName) => {
  const s3Stream = s3.getObject({ Bucket: bucketName, Key: `${folderName}/${fileName}` }).createReadStream();
  const zip = s3Stream.pipe(unzipper.Parse({ forceStream: true }));

  let foundReadme = false; // Flag to indicate if README has been found
  const readmeRegex = /\/readme\.(md|txt|markdown)$/i;
  const npmjsURLRegex = /https?:\/\/(www\.)?npmjs\.(com|org)\/package\/[a-zA-Z0-9-_]+/g;


  for await (const entry of zip) {
    const fullPath = entry.path;
    console.log('fullPath:', fullPath);

    if (readmeRegex.test(fullPath.toLowerCase())) {
      // Extract the README file content
      const readmeContent = await streamToString(entry);
      // Extract the npmjs URL from README content (if needed)
      const urlMatches = readmeContent.match(npmjsURLRegex);
      const npmjsURL = urlMatches ? urlMatches[0] : null;
      //console.log('readmeContent:', readmeContent);
      console.log('npmjsURL:', npmjsURL);
      
      // Now we will get package metadata from npmjs api and store it in dynamodb
      

      foundReadme = true;
      break; // README found, stop searching
    }

    entry.autodrain();
  }

  if (!foundReadme) {
    console.log('README file not found in the ZIP archive.');
  }
};



exports.uploadHandler = async (event) => {
    
    let body = JSON.parse(event.body);

    
    const packageContent = body.packageContent; // This is base64-encoded
    const decodedContent = Buffer.from(packageContent, 'base64');

    // Use a timestamp to create a unique file name
    const fileName = `package_${new Date().getTime()}.zip`;

    const uploadParams = {
        Bucket: bucketName,
        Key: `${folderName}/${fileName}`,
        Body: decodedContent,
        ContentType: 'application/zip'
    };

    try {
        await s3.putObject(uploadParams).promise();
        console.log(`File uploaded successfully at ${folderName}/${fileName}`);
        await exports.processZipFile(fileName);



        // Return a success response
        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'File uploaded successfully', fileName: fileName }),
        };

    } catch (error) {
        console.error("Error uploading to S3:", error);
        return {
            statusCode: 500, // should not happen
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to upload file to S3' }),
        };
    }

};

exports.ingestHandler = async (event) => {
    // ingest just returns url to console. 
    // the event body for this looks like: 
    // Event Body: {"packageContent": "", "packageURL": "www.google.com"}
     
    console.log('Event Body:', event.body);
    let body = JSON.parse(event.body);
    const packageURL = body.packageURL;

    
    return {
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'URL passed', packageURL: packageURL }),
    };

}
exports.handler = async (event) => {
    

    // Auth handling would go here

    if (typeof event.body !== 'string') {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid request body' }),
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Failed to parse JSON body' }),
        };
    }

    const packageContent = body.packageContent;
    const packageURL = body.packageURL;

    try {
        if (packageContent && !packageURL) {
            return await exports.uploadHandler(event);
        } else if (packageURL && !packageContent) {
            return await exports.ingestHandler(event);
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid request. Please provide either packageContent (Base 64 Encoded .zip) or packageURL, not both.' }),
            };
        }
    } catch (error) {
        console.error("Error in processing:", error);
        return {
            statusCode: 500, // should not happen
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    }
};

