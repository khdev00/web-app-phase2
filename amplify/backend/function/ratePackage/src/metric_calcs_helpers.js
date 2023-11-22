"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContributors = exports.getIssueResolutionTime = exports.getCommitFrequency = exports.getOpenIssuesCount = exports.getUserStars = exports.getDependencies = exports.calculateReviewedCodeFraction = exports.readReadmeFile = void 0;
const fs_1 = __importDefault(require("fs")); // Node.js file system module for cloning repos  
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios")); // Library to conveniantly send HTTP requests to interact with REST API
const core_1 = require("@octokit/core"); // Make sure to install @octokit/core via npm
function readReadmeFile(cloneDir) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check if the README file exists in the cloned repository
            const readmePath = path_1.default.join(cloneDir, 'README.md');
            if (fs_1.default.existsSync(readmePath)) {
                // Read the README file content
                const readmeContent = fs_1.default.readFileSync(readmePath, 'utf-8');
                //console.log(`README Content:\n${readmeContent}`);
                return readmeContent;
            }
            else {
                //console.log('README file not found in the repository.');
                return '';
            }
        }
        catch (error) {
            //console.error('Error reading README file:', error);
            return '';
        }
    });
}
exports.readReadmeFile = readReadmeFile;
function calculateReviewedCodeFraction(owner, repo, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = new core_1.Octokit({ auth: token });
        try {
            const searchQuery = `repo:${owner}/${repo} is:pr is:merged`;
            const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=25`;
            const prData = yield getAllPages(searchUrl, { Authorization: `Bearer ${token}` });
            console.log(`Found ${prData.length} merged PRs for ${owner}/${repo}`);
            let reviewedLOC = 0;
            let totalLOC = 0;
            for (const pr of prData) {
                const prNumber = pr.number; // PR number
                try {
                    const reviewResponse = yield octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
                        owner,
                        repo,
                        pull_number: prNumber,
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    });
                    const fileResponse = yield octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
                        owner,
                        repo,
                        pull_number: prNumber,
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    });
                    const reviews = reviewResponse.data;
                    const files = fileResponse.data;
                    //console.log(`PR #${prNumber} has ${reviews.length} reviews and ${files.length} files`);
                    let prAdditions = 0;
                    for (const file of files) {
                        prAdditions += file.additions; // sum up the additions for all files in the PR
                        //console.log(`File: ${file.filename} has ${file.additions} additions`);
                    }
                    totalLOC += prAdditions; // accumulate total lines of code
                    if (reviews.length > 0) {
                        //console.log(`PR #${prNumber} has ${reviews.length} reviews and ${files.length} files`);
                        reviewedLOC += prAdditions; // accumulate reviewed lines of code
                        //console.log(`PR #${prNumber} has ${reviews.length} reviews and ${files.length} files`);
                    }
                }
                catch (error) {
                    console.error(`Error processing PR #${prNumber}: ${error.message}`);
                }
            }
            console.log(`Total LOC: ${totalLOC}, reviewed LOC: ${reviewedLOC}`);
            return (totalLOC === 0) ? 0 : reviewedLOC / totalLOC;
        }
        catch (error) {
            console.error(`Error calculating reviewed code fraction: ${error.message}`);
            return 0;
        }
    });
}
exports.calculateReviewedCodeFraction = calculateReviewedCodeFraction;
function getAllPages(url, headers) {
    return __awaiter(this, void 0, void 0, function* () {
        let responseData = [];
        let page = 1;
        let totalPages = 0;
        let timeoutReached = false;
        while (true) {
            const response = yield axios_1.default.get(`${url}&page=${page}`, { headers });
            if (page === 1) {
                // Extract total number of pages from the Link header
                const linkHeader = response.headers.link;
                if (linkHeader) {
                    const lastPageMatch = linkHeader.match(/&page=(\d+)>; rel="last"/);
                    if (lastPageMatch) {
                        totalPages = parseInt(lastPageMatch[1]);
                    }
                }
            }
            responseData = responseData.concat(response.data.items); // ensure to extract the items property
            const linkHeader = response.headers.link;
            if (linkHeader && linkHeader.includes('rel="next"')) {
                page++;
                console.log(`Processing page ${page} of ${totalPages}`);
                if (page === 2) {
                    timeoutReached = true;
                }
                if (timeoutReached) {
                    break;
                }
            }
            else {
                break;
            }
        }
        return responseData;
    });
}
function getDependencies(owner, repo, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3.raw', // This header is used to get the raw content of the file
        };
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/package.json`;
            const response = yield axios_1.default.get(url, { headers });
            const packageJsonObj = response.data;
            const dependencies = packageJsonObj.dependencies || {};
            //console.log(`Dependencies: ${JSON.stringify(dependencies)}`);
            return dependencies;
        }
        catch (error) {
            console.error(`Error fetching package.json file from GitHub: ${error.message}`);
            return {};
        }
    });
}
exports.getDependencies = getDependencies;
function getUserStars(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        try {
            const response = yield axios_1.default.get(`https://api.github.com/repos/${owner}/${packageName}`, { headers });
            const stars = response.data.stargazers_count || 0;
            console.log(`Obtained user stars: ${stars} stars`);
            return stars;
        }
        catch (error) {
            console.log(`Error fetching star count: ${error}`);
            console.log(`Error fetching star count: ${error}`);
            return 0;
        }
    });
}
exports.getUserStars = getUserStars;
function getOpenIssuesCount(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        try {
            const response = yield axios_1.default.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=open`, { headers });
            const openIssuesCount = response.data.length || 0;
            return openIssuesCount;
        }
        catch (error) {
            console.log(`Error fetching open issues count: ${error}`);
            console.log(`Error fetching open issues count: ${error}`);
            return 0;
        }
    });
}
exports.getOpenIssuesCount = getOpenIssuesCount;
function getCommitFrequency(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        try {
            const response = yield axios_1.default.get(`https://api.github.com/repos/${owner}/${packageName}/commits`, { headers });
            const commitData = response.data;
            if (commitData.length < 2) {
                //not enough commits for frequency calculation
                return 0;
            }
            //sort commitData by commit timestamp in ascending order
            commitData.sort((a, b) => {
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
            console.log(`Calculated commit frequency of: ${frequency}`);
            return frequency;
        }
        catch (error) {
            console.log(`Error fetching commit frequency: ${error}`);
            console.log(`Error fetching commit frequency: ${error}`);
            return 0;
        }
    });
}
exports.getCommitFrequency = getCommitFrequency;
function getIssueResolutionTime(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        try {
            const response = yield axios_1.default.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=closed`, { headers });
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
            console.log(`Calculated user resolution time of: ${frequency}`);
            return frequency;
        }
        catch (error) {
            console.log(`Error fetching issue resolution time: ${error}`);
            console.log(`Error fetching issue resolution time: ${error}`);
            return 0;
        }
    });
}
exports.getIssueResolutionTime = getIssueResolutionTime;
function getContributors(packageObj, headers, owner, packageName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield axios_1.default.get(`https://api.github.com/repos/${owner}/${packageName}/contributors`, { headers })
            .then((response) => {
            const contributorsData = response.data;
            const contributorsMap = new Map();
            contributorsData.forEach((contributor) => {
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
    });
}
exports.getContributors = getContributors;