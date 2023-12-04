/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-escape */
const axios = require('axios');


exports.handler = async (event) => {
  try {
    const npmjsUrl = event.queryStringParameters.url;
    const packageName = extractPackageName(npmjsUrl);
    console.log(`Extracted package name: ${packageName}`);

    if (!packageName) {
      throw new Error('Invalid npmjs URL');
    }

    const npmData = await fetchNpmData(packageName);
    const githubStars = npmData.repositoryUrl ? await fetchGitHubStars(npmData.repositoryUrl) : 0;

    const popularityRating = {
      weeklyDownloads: npmData.weeklyDownloads,
      githubStars: githubStars
    };

    return successResponse(popularityRating);
  } catch (error) {
    console.error('Error:', error.message);
    return errorResponse(error.message);
  }
};

function extractPackageName(npmjsUrl) {
  // Logic to extract package name from npmjs URL
  // Example: https://www.npmjs.com/package/express -> express
  const regex = /npmjs\.com\/package\/([^\/]+)/;
  const match = npmjsUrl.match(regex);
  return match ? match[1] : null;
}

async function fetchNpmData(packageName) {
    const registryUrl = `https://registry.npmjs.org/${packageName}`;
    const response = await axios.get(registryUrl);
    const data = response.data;
  
    const repositoryUrl = data.repository ? data.repository.url : null;
    console.log(`Repository URL: ${repositoryUrl}`);
    // Fetch weekly downloads from npmjs API
    const downloadsUrl = `https://api.npmjs.org/downloads/point/last-week/${packageName}`;
    const downloadsResponse = await axios.get(downloadsUrl);
    const weeklyDownloads = downloadsResponse.data.downloads;
  
    return { weeklyDownloads, repositoryUrl };
  }
  

  async function fetchGitHubStars(repositoryUrl) {
    try {
      // Transform the repository URL to a standard https:// format
      let transformedUrl = repositoryUrl.replace(/^git:\/\/github\.com\//, "https://github.com/");
      transformedUrl = transformedUrl.replace(/\.git$/, ""); // Remove .git at the end if present
  
      // Extract user and repo from the transformed GitHub URL
      const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
      const match = transformedUrl.match(regex);
      if (!match) {
        console.log('Invalid GitHub URL:', transformedUrl);
        return 0;
      }
  
      const [_, user, repo] = match;
  
      const apiUrl = `https://api.github.com/repos/${user}/${repo}`;
      const response = await axios.get(apiUrl);
      return response.data.stargazers_count;
    } catch (error) {
      console.error(`Error fetching GitHub stars for ${repositoryUrl}:`, error.message);
      return 0; // Return 0 stars if there's an error
    }
  }
  
  
  
  


function successResponse(data) {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    },
    body: JSON.stringify({ message: 'Success', popularityRating: data }),
  };
}

function errorResponse(errorMessage) {
  return {
    statusCode: 500,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    },
    body: JSON.stringify({ message: errorMessage }),
  };
}