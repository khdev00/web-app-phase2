const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const unzipper = require('unzipper'); // npm package needed for extraction
AWS.config.update({ region: 'us-east-2' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDBNotClient = new AWS.DynamoDB();
const s3 = new AWS.S3();

const {fetchUrlData, calculateAllMetrics} = require("./fetch_url")
const axios = require('axios');
const { Octokit } = require('@octokit/rest');

const { SecretsManagerClient, GetSecretValueCommand, } = require("@aws-sdk/client-secrets-manager");

const tableName = 'pkgmetadata';
const userTable = 'phase2users';
const authTable = 'AuthTokens';
const bucketName = 'packageregistry';
const folderName = 'nongradedpackages';
const secret_name = "GITHUB_TOKEN";
const jwt_secret = "JWT_SECRET_KEY";
const contentfoldername = 'packagecontent'; //folder name for content, to avoid dynamo size limit. 

const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => {
      console.log(`Received chunk:`, chunk.toString('utf8'));
      chunks.push(chunk);
    });
    stream.on('error', (err) => {
      console.error('Stream Error:', err);
      reject(err);
    });
    stream.on('end', () => {
      const concatenatedChunks = Buffer.concat(chunks).toString('utf8');
      console.log(`Final concatenated content:`, concatenatedChunks);
      resolve(concatenatedChunks);
    });
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
            console.log('packageJson before parse:', packageJSONContent);

            const packageData = JSON.parse(packageJSONContent);
            if (!packageData.name || !packageData.version) {
                console.error('Invalid package.json file');
                return null;
            }
            console.log("package.json: ",packageData)
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

    // now we need to rate the package to see if it passes our checks.
    // we need to get the package data from the url, and then calculate the metrics.
    // we then need to update the dynamoDB with the metrics.
    let urldata = await fetchUrlData(githubURL);
    console.log("URL Data: ", urldata);

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

async function validateToken(auth_token, secret) {
    try{
        if(auth_token && auth_token.includes('"')){
            auth_token = auth_token.replace(/"/g, '');
        }
        console.log("Token: ", auth_token)
        const payload = jwt.verify(auth_token, secret);
        const {username, isAdmin} = payload;

        const params = {
            TableName: authTable,
            Key: {
                "authToken": {S: auth_token}
            }
        };

        //attempt to find token in database
        let authData;
        const data = await dynamoDBNotClient.getItem(params).promise();
        if(data.Item){
            authData = data.Item;
        }
        else {
            console.error('token not found');
            return false;
        }

        //make sure the token is valid for the user
        const dbUsername = authData.username.S;
        if(dbUsername !== username){
            console.error('no user match');
            return false;
        }

        //make sure the token has usages left
        let usageLeft = authData.usages.N;
        if(usageLeft > 0){
            usageLeft -= 1;
        }
        else {
            console.error('no API usage left');
            return false;
        }

        const updateParams = {
            TableName: authTable,
            Key: {
                "authToken": {S: auth_token}
            },
            UpdateExpression: "SET usages = :newUsage",
            ExpressionAttributeValues: {
                ":newUsage": {N: usageLeft.toString()}
            },
        };
        // Perform the update operation
        const dynamoResult = await dynamoDBNotClient.updateItem(updateParams).promise();
        console.log('Update DynamoDB successful', dynamoResult);

        return [isAdmin, username];

    } catch (err) {
        console.error('validation error: ', err);
        throw new Error('Failed to validate token');
    }
}
  
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
function isValidBase64(str) {
    try {
        const decodedContent = Buffer.from(str, 'base64');
        // print first 4 bytes of decoded content
        console.log('First 4 bytes of decoded content:', decodedContent.slice(0, 5));
        // Additional check: validate if decoded content is a ZIP file (optional)
        return decodedContent.length >= 4 && decodedContent[0] === 0x50 && decodedContent[1] === 0x4B && 
               decodedContent[2] === 0x03 && decodedContent[3] === 0x04; // PK 0x03 0x04 
    } catch (e) {
        return false;
    }
}

  
async function downloadAndEncodeRepoZip(repoUrlObj, secret) {
    try {
        const octokit = new Octokit({
            auth: `token ${secret}`, // Replace with your GitHub token
        });

        // Determine the default branch dynamically
        //const defaultBranch = await getDefaultBranch(repoUrl, secret);

        // Make an HTTP GET request to the GitHub repository's zip URL using the default branch
        console.log("URL: ", repoUrlObj.url);
        //const response = await axios.get(`${repoUrl}/archive/master.zip`, { responseType: 'arraybuffer' , headers: {Authorization: `Bearer ${secret}`}});
        const owner = repoUrlObj.packageOwner;
        const repo = repoUrlObj.packageName;
        const response = await octokit.request('GET /repos/{owner}/{repo}/zipball', {
            owner: owner,
            repo: repo,
            mediaType: {
                format: 'zipball',
            },
        });
    
        const zipData = response.data;

        // Convert the response data to a Buffer
        const zipBuffer = Buffer.from(zipData);

        // Encode the Buffer to base64
        const base64Encoded = zipBuffer.toString('base64');

        if (!isValidBase64(base64Encoded)) {
            console.error('Invalid base64 content');
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid base64 content' }),
            };
        }

        return base64Encoded;
    } catch (error) {
        console.error("DownloadEncodeError: ",error);
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
    if (!isValidBase64(packageContent)) {
        console.error('Invalid base64 content');
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid base64 content' }),
        };
    }
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
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Could not find package metadata, no package.json exists or it is a bad package.json' }),
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
    if(typeof event.body !== 'string'){
        event.body = JSON.stringify(event.body);
    }
    let body = JSON.parse(event.body);
    const packageURL = body.URL;

    let urlData, pkgName, finalURL, packageContent, decodedContent;
    //retrieve a package data object for the input URL
    try{
        urlData = await fetchUrlData(packageURL);
        pkgName = urlData[0].packageName;
        finalURL = urlData[0].url;

        packageContent = await downloadAndEncodeRepoZip(urlData[0], secret);
        decodedContent = Buffer.from(packageContent, 'base64');
    }catch(err){
        console.log("Error retrieving url data: ", err);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'URL Data Retrieval Failed' }),
        };
    }

    try {
        packageData = await calculateAllMetrics(urlData, secret);
    } catch (error) {
        console.error("Error calculating metrics:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to calculate metrics' })
        };
    }

    //set all metric scores
    const metricScores = [
        { busFactor: packageData[0].busFactor },
        { correctness: packageData[0].correctness },
        { rampUp: packageData[0].rampUp },
        { responsiveMaintainer: packageData[0].responsiveMaintainer },
        { licenseScore: +packageData[0].hasLicense },
    ];
    
    try{
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
    }catch(err){
        console.log("Metric update error: ", err)
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: `Score ${key} is less than 0.5.`}),
        };
    }

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
                statusCode: 400,
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
            statusCode: 400,
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

    //get JWT secret
    try {
        response = await client.send(
            new GetSecretValueCommand({
                SecretId: jwt_secret
            })
        );
    } catch (error) {
        console.error('Secrets Error:', error);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Failed to retrieve JWT key' }),
        };
    }

    const jwtString = response.SecretString;
    const jwtObject = JSON.parse(jwtString);
    const jwt_token = jwtObject.JWT_SECRET_KEY;

    let auth_token;
    console.log("Headers: ", event.headers);
    //retrieve authentication token
    try{
        if(event.headers['X-Authorization']){
            auth_token = event.headers['X-Authorization'];
        }
        else if(event.headers['x-authorization']){
            auth_token = event.headers['x-authorization'];
        }
    }catch(err){
        console.error("Error: ", err)
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Invalid Authentication Token' }),
        };
    }

    if (auth_token === '' || auth_token === null) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Authentication Token not provided' }),
        };
    }

    let isAdmin, username;
    try{
        [isAdmin, username] = await validateToken(auth_token, jwt_token);

        const params = {
            TableName: userTable,
            Key: {
                "username": username
            }
        };

        const data = await dynamoDb.get(params).promise();
        if(isAdmin === false && data.Item.uploadAllow === false){
            console.log('Invalid permissions to create user');
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
                body: JSON.stringify({ message: 'Invalid Permissions for upload' }),
            };
        }
    }catch(authErr){
        console.error("Auth Error: ", authErr);
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify({ message: 'Validation of token failed' }),
        };
    }

    let body;
    try {
        console.log("Body: ", event.body);

        if (typeof event.body !== 'string') {
            event.body = JSON.stringify(event.body); // stringified twice
        }

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

    const packageContent = body.Content;
    const packageURL = body.URL;
    const JSProgram = body.JSProgram;
    

    // Process the request based on the content
    try {
        if (packageContent && (!packageURL || packageURL === '')) { // no url, just content
            // Handle JS Program upload with package content
            return await exports.uploadHandler(event, secret);
        } else if (packageURL && (!packageContent || packageContent === '')) { // no content, just url
            // Handle JS Program ingestion with package URL
            return await exports.ingestHandler(event, secret);
        } else if (JSProgram && (!packageContent || packageContent === '') && (!packageURL || packageURL === '')) { // no content, no url just JSProgram
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