const AWS = require('aws-sdk');
const unzipper = require('unzipper'); // npm package needed for extraction
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const {fetchUrlData, calculateAllMetrics} = require("./fetch_url")
const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const tableName = 'pkgmetadata';
const bucketName = 'packageregistry';
const folderName = 'nongradedpackages';
const secret_name = "GITHUB_TOKEN";
const contentfoldername = 'packagecontent'; //folder name for content, to avoid dynamo size limit. 


const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

exports.processZipFile = async (fileName, packageContent, packageS3Url, JSProgram) => {
    const s3Stream = s3.getObject({ Bucket: bucketName, Key: `${folderName}/${fileName}` }).createReadStream();
    const zip = s3Stream.pipe(unzipper.Parse({ forceStream: true }));

    let foundPackageJSON = false;
    let packageName, packageVersion, packageID, githubURL;
    const packageJSONRegex = /\/package\.json$/i;

    for await (const entry of zip) {
        // find package.json for metadata extraction
        const fullPath = entry.path;
        //console.log('fullPath:', fullPath);

        if (packageJSONRegex.test(fullPath.toLowerCase())) {
            const packageJSONContent = await streamToString(entry);
            //console.log('packageJson:', packageJSONContent);

            const packageData = JSON.parse(packageJSONContent);
            packageName = packageData.name;
            packageVersion = packageData.version;
            packageID = `${packageName}_${packageVersion}`;
            githubURL = extractGitHubURL(packageData.repository);

            console.log('packageName:', packageName);
            console.log('packageVersion:', packageVersion);
            console.log('packageID:', packageID);
            console.log('GitHub URL:', githubURL);

            foundPackageJSON = true;
            break; // package.json found, stop searching
        }

        entry.autodrain();
    }

    if (!foundPackageJSON) {
        console.log('package.json file not found in the ZIP archive.');
        return null;
    }

    // Check if the package already exists in DynamoDB
    const checkParams = {
        TableName: tableName,
        Key: {
            'pkgID': packageID
        }
    };

    try {
        const checkResult = await dynamoDb.get(checkParams).promise();
        if (checkResult.Item) {
            console.log(`Package with ID ${packageID} already exists.`);
            // delete the uploaded file from S3
            const deleteParams = {
                Bucket: bucketName,
                Key: `${folderName}/${fileName}`
            };
            await s3.deleteObject(deleteParams).promise();
            console.log(`Deleted file ${fileName} from S3.`);
            
            return {
                statusCode: 409,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Package with same package ID already exists' })
            };
        }
    } catch (error) {
        console.error("Error checking DynamoDB for existing package:", error);
        return null;
    }

    // Upload the package content to S3
    const contentFileName = `${packageID}_content.txt`;
    const contentUploadParams = {
        Bucket: bucketName,
        Key: `${contentfoldername}/${contentFileName}`,
        Body: packageContent,
        ContentType: 'text/plain'
    };

    let contentS3Url;
    try {
        const contentUploadResult = await s3.upload(contentUploadParams).promise();
        console.log(`Content file uploaded successfully at ${contentUploadResult.Location}`);
        contentS3Url = contentUploadResult.Location;
    } catch (error) {
        console.error("Error uploading content to S3:", error);
        return null;
    }

    // Store the S3 URLs in DynamoDB
    const dynamoParams = {
        TableName: tableName,
        Item: {
            pkgID: packageID,
            pkgName: packageName,
            pkgVersion: packageVersion,
            pkgURL: githubURL,
            packageS3Url: packageS3Url,
            contentS3Url: contentS3Url,
            JSProgram: JSProgram
        },
    };

    try {
        await dynamoDb.put(dynamoParams).promise();
        console.log('DynamoDB update successful');
    } catch (error) {
        console.error('DynamoDB Error:', error);
        return null;
    }

    return {
        metadata: {
            Name: packageName,
            Version: packageVersion,
            ID: packageID,
        },
        data: {
            Content: packageContent,
            JSProgram: JSProgram
        }
        
    };
};


  
function extractGitHubURL(repository) {
    if (!repository) {
      return null;
    }
  
    if (typeof repository === 'string') {
      // Format "username/repository"
      return `https://github.com/${repository}`;
    } else if (typeof repository === 'object' && repository.url) {
      // Format { "type": "git", "url": "https://github.com/username/repository.git" }
      const match = repository.url.match(/github\.com\/([^\/]+\/[^\/]+?)(\.git)?$/i);
      if (match && match[1]) {
        return `https://github.com/${match[1]}`;
      }
    }
  
    return null;
}

const updateDynamoDBRating = async (packageId, metricScores) => {
    //Update MetricScore with net score
    try {
        //destructure metricScores array
        const [
            { netScore },
            { busFactor },
            { correctness },
            { goodPinningPractice },
            { licenseScore },
            { pullRequest },
            { rampUp },
            { responsiveMaintainer }
        ] = metricScores;

        const updateParams = {
            TableName: tableName,
            Key: {
                "pkgID": packageId,
            },
            UpdateExpression: "SET NetScore = :netScore, BusFactor = :busFactor, Correctness = :correctness, GoodPinningPractice = :goodPinningPractice, \
            LicenseScore = :licenseScore, PullRequest = :pullRequest, RampUp = :rampUp, ResponsiveMaintainer = :responsiveMaintainer",
            ExpressionAttributeValues: {
                ":netScore": netScore,
                ":busFactor": busFactor,
                ":correctness": correctness,
                ":goodPinningPractice": goodPinningPractice,
                ":licenseScore": licenseScore,
                ":pullRequest": pullRequest,
                ":rampUp": rampUp,
                ":responsiveMaintainer": responsiveMaintainer,
            },
        };
        const dynamoResult = await dynamoDb.update(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);
    } catch (dbError) {
        console.error('DynamoDB Update Error:', dbError);
        throw new Error('Failed to update package metadata');
    }
};

exports.JSHandler = async (event, secret) => {
    
    let body = JSON.parse(event.body);
    const JSProgram = body.JSProgram;
    return { 
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
        body: JSON.stringify({ message: 'JS Program passed', JSProgram: JSProgram }),
    }
    
    

}
exports.uploadHandler = async (event, secret) => {
    console.log('Event Body from event:', event.body);
    let body = JSON.parse(event.body); 
    
    if (typeof body === 'string') {
        body = JSON.parse(body); // Second parse if needed
        console.log('Second parsed body:', body);
    }
    console.log('Body after JSON Parse:', body);
    console.log('Content straight from body:', body.Content);
    
    const packageContent = body.Content; // This is base64-encoded
    console.log('packageContent:', packageContent);
    const decodedContent = Buffer.from(packageContent, 'base64');
    const JSProgram = body.JSProgram;

    // Use a timestamp to create a unique file name
    const fileName = `package_${new Date().getTime()}.zip`;

    const uploadParams = {
        Bucket: bucketName,
        Key: `${folderName}/${fileName}`,
        Body: decodedContent,
        ContentType: 'application/zip'
    };

    try {
        const uploadResult = await s3.upload(uploadParams).promise();
        console.log(`Package file uploaded successfully at ${uploadResult.Location}`);
        const response = await exports.processZipFile(fileName, packageContent, uploadResult.Location, JSProgram);
        if (!response) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Could not find package metadata, no package.json exists' }),
            };
        }

        if (response && response.statusCode) { // will only happen if package already exists
            return {
                statusCode: response.statusCode,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: response.body
            };
        }

        // Return a success response with the metadata
        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({
                metadata: response.metadata,
                data: response.data
            }),
        };

    } catch (error) {
        console.error("Error uploading to S3:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to upload file to S3' }),
        };
    }
};

exports.ingestHandler = async (event, secret, JSProgram) => {
    // ingest just returns url to console. 
    // the event body for this looks like: 
    // Event Body: {"packageContent": "", "packageURL": "www.google.com"}
     
    console.log('Event Body:', event.body);
    let body = JSON.parse(event.body);
    const packageURL = body.packageURL;

    try {
        urlData = await fetchUrlData(packageURL);
        packageData = await calculateAllMetrics(urlData, secret);
    } catch (error) {
        console.error("Error calculating metrics:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to calculate metrics' }),
        };
    }

    //set all metric scores
    const metricScores = [
        { busFactor: packageData[0].busFactor },
        { correctness: packageData[0].correctness },
        { rampUp: packageData[0].rampUp },
        { responsiveMaintainer: packageData[0].responsiveMaintainer },
        { licenseScore: +packageData[0].hasLicense },
        { goodPinningPractice: packageData[0].dependencies },
        { pullRequest: packageData[0].codeReview },
        { netScore: packageData[0].netScore }
    ];
    
    // Iterate over the metric scores array
    for (const score of metricScores) {
        const key = Object.keys(score)[0]; // Extract the key from the object
        const value = score[key]; // Extract the value from the object
    
        console.log(`${key}: ${value}`)
        if (value < 0.5) {
            console.log(`Score ${key} is less than 0.5.`);
            return {
                statusCode: 424,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: `Score ${key} is less than 0.5.`}),
            };
        }
    }
    console.log("package passed scoring check");




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
    console.log('Event:', event);
    //auth handling goes first, if we dont see auth, nothing else should run. 

    //setup secret manager client
    const client = new SecretsManagerClient({
        region: "us-east-2",
    });

    //attempt to retrieve github token
    let response;
    try {
        response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name
            })
        );
    } catch (error) {
        console.error('Secrets Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve Github Token' }),
        };
    }

    const secretString = response.SecretString;
    const secretObject = JSON.parse(secretString);
    const secret = secretObject.GITHUB_TOKEN;

    

    

    let body;
    try {
        body = JSON.parse(event.body);
        if (typeof body === 'string') {
            body = JSON.parse(body); // stringified twice
        }
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

    const packageContent = body.Content;
    const packageURL = body.URL;
    const JSProgram = body.JSProgram;
    

    // Process the request based on the content
    try {
        if (packageContent && !packageURL) {
            // Handle JS Program upload with package content
            return await exports.uploadHandler(event, secret);
        } else if (packageURL && !packageContent) {
            // Handle JS Program ingestion with package URL
            return await exports.ingestHandler(event, secret);
        } else if (JSProgram) {
            return await exports.JSHandler(event, secret);
        } else {
            // Invalid request
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid request. Please provide either packageContent (Base 64 Encoded .zip) or packageURL, not both.' }),
            };
        }
    } catch (error) {
        console.error("Error in processing:", error);
        return {
            statusCode: 500,
            
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    }
};