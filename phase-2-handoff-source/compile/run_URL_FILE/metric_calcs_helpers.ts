import fs from 'fs'; // Node.js file system module for cloning repos  
import path from 'path';
import winston, { Logform } from 'winston'; //Logging library
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import { Package } from './fetch_url'
import { type } from 'os';
import { Octokit } from "@octokit/core";  // Make sure to install @octokit/core via npm

export async function readReadmeFile(cloneDir: string) {
    try {
        // Check if the README file exists in the cloned repository
        const readmePath = path.join(cloneDir, 'README.md');

        if (fs.existsSync(readmePath)) {
            // Read the README file content
            const readmeContent = fs.readFileSync(readmePath, 'utf-8');
            //console.log(`README Content:\n${readmeContent}`);
            return readmeContent;
        } else {
            //console.log('README file not found in the repository.');
            return '';
        }
    } catch (error) {
        //console.error('Error reading README file:', error);
        return '';
    }
}

export async function calculateReviewedCodeFraction(owner: string, repo: string, token: string): Promise<number> {
    const octokit = new Octokit({ auth: token });  
    try {
        const searchQuery = `repo:${owner}/${repo} is:pr is:merged`;
        const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=100`;
        const prData = await getAllPages(searchUrl, { Authorization: `Bearer ${token}` });
        let reviewedLOC = 0;
        let totalLOC = 0;
        for (const pr of prData) {
            const prNumber = pr.number; // PR number
            try {
                const reviewResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
                    owner,
                    repo,
                    pull_number: prNumber,
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
                const fileResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
                    owner,
                    repo,
                    pull_number: prNumber,
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
                const reviews = reviewResponse.data;
                const files = fileResponse.data;
                
                let prAdditions = 0;
                for (const file of files) {
                    prAdditions += file.additions;  // sum up the additions for all files in the PR
                }
                totalLOC += prAdditions;  // accumulate total lines of code
                if (reviews.length > 0) {
                    //console.log(`PR #${prNumber} has ${reviews.length} reviews and ${files.length} files`);
                    reviewedLOC += prAdditions;  // accumulate reviewed lines of code
                }
            } catch (error: any) {
                console.error(`Error processing PR #${prNumber}: ${error.message}`);
            }
        }

        return (totalLOC === 0) ? 0 : reviewedLOC / totalLOC;
    } catch (error: any) {
        console.error(`Error calculating reviewed code fraction: ${error.message}`);
        return 0;
    }
}

async function getAllPages(url: string, headers: any): Promise<any[]> {
    let responseData: any[] | PromiseLike<any[]> = [];
    let page = 1;
    while (true) {
        const response = await axios.get(`${url}&page=${page}`, { headers });
        responseData = responseData.concat(response.data.items);  // ensure to extract the items property
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
            page++;
        } else {
            break;
        }
    }
    return responseData;
}
export async function getDependencies(owner: string, repo: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3.raw',  // This header is used to get the raw content of the file
    };

    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/package.json`;
        const response = await axios.get(url, { headers });
        const packageJsonObj = response.data;

        const dependencies = packageJsonObj.dependencies || {};
        //console.log(`Dependencies: ${JSON.stringify(dependencies)}`);
        return dependencies;
    } catch (error: any) {
        console.error(`Error fetching package.json file from GitHub: ${error.message}`);
        return {};
    }
}


export async function getUserStars(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}`, { headers });
        const stars = response.data.stargazers_count || 0; 
        console.log(`Obtained user stars: ${stars} stars`)
        return stars;
    } catch (error) {
        console.log(`Error fetching star count: ${error}`);
        console.log(`Error fetching star count: ${error}`);
        return 0; 
    }
}

export async function getOpenIssuesCount(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=open`, { headers });
        const openIssuesCount = response.data.length || 0; 
        return openIssuesCount;
    } catch (error) {
        console.log(`Error fetching open issues count: ${error}`);
        console.log(`Error fetching open issues count: ${error}`);
        return 0; 
    }
}

export async function getCommitFrequency(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/commits`, { headers });

        const commitData = response.data;
        if (commitData.length < 2) {
            //not enough commits for frequency calculation
            return 0;
        }

        //sort commitData by commit timestamp in ascending order
        commitData.sort((a: any, b: any) => {
            const timestampA = new Date(a.commit.author.date).getTime();
            const timestampB = new Date(b.commit.author.date).getTime();
            return timestampA - timestampB;
        });

        //calculate the average time between commits in milliseconds
        let totalTimeInterval = 0;
        for (let i = 1; i < commitData.length; i++) {
            const commitDate = new Date(commitData[i].commit.author.date);
            const prevCommitDate = new Date(commitData[i - 1].commit.author.date);
            const timeInterval = commitDate.getTime() - prevCommitDate.getTime();
            totalTimeInterval += timeInterval;
        }

        const averageTimeInterval = totalTimeInterval / (commitData.length - 1);
        const frequency = ((1000 * 60 * 60 * 24 * 365) - averageTimeInterval) / (1000 * 60 * 60 * 24 * 365);

        console.log(`Calculated commit frequency of: ${frequency}`)

        return frequency;
    } catch (error) {
        console.log(`Error fetching commit frequency: ${error}`);
        console.log(`Error fetching commit frequency: ${error}`);
        return 0; 
    }
}

export async function getIssueResolutionTime(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=closed`, { headers });

        const issueData = response.data;
        if (issueData.length === 0) {
            return 0;
        }

        //calculate the average time between issue creation and resolution in milliseconds
        let totalTimeInterval = 0;
        let resolvedIssueCount = 0;
        for (const issue of issueData) {
            if (issue.state === 'closed' && issue.created_at && issue.closed_at) {
                const createDate = new Date(issue.created_at);
                const resolveDate = new Date(issue.closed_at);
                const timeInterval = resolveDate.getTime() - createDate.getTime();
                totalTimeInterval += timeInterval;
                resolvedIssueCount++;
            }
        }
        console.log(`issues: ${resolvedIssueCount}`);
        if (resolvedIssueCount === 0) {
            return 0;
        }

        const averageTimeInterval = totalTimeInterval / resolvedIssueCount;
        const frequency = ((1000 * 60 * 60 * 24 * 365) - averageTimeInterval) / (1000 * 60 * 60 * 24 * 365);

        console.log(`Calculated user resolution time of: ${frequency}`)

        return frequency;
    } catch (error) {
        console.log(`Error fetching issue resolution time: ${error}`);
        console.log(`Error fetching issue resolution time: ${error}`);
        return 0;
    }
}



export async function getContributors(packageObj: Package, headers: any, owner: string, packageName: string): Promise<Package> {
    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/contributors`, { headers })
    .then((response) => {
        const contributorsData = response.data;
        const contributorsMap = new Map<string, number>();

        contributorsData.forEach((contributor: any) => {
            const username = contributor.login;
            const contributions = contributor.contributions; 
            contributorsMap.set(username, contributions);
        });

        packageObj.setContributors(contributorsMap);
        return packageObj;
    })
    .catch((err) => {
        console.log(`Error on axios.get: ${err}`);
        console.log(`Error on axios.get: ${err}`);
        packageObj.setContributors(new Map()); 
        return packageObj;
    });
    return packageObj;
}