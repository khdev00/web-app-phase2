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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContributors = exports.getIssueResolutionTime = exports.getCommitFrequency = exports.getOpenIssuesCount = exports.getUserStars = exports.getDependencies = exports.calculateReviewedCodeFraction = exports.readReadmeFile = void 0;
var fs = require("fs");
var path = require("path");
var axios = require("axios");
var winston = require("winston");
var Logform = require("winston").Logform;
var core_1 = require("@octokit/core"); // Make sure to install @octokit/core via npm
function readReadmeFile(cloneDir) {
    return __awaiter(this, void 0, void 0, function () {
        var readmePath, readmeContent;
        return __generator(this, function (_a) {
            try {
                readmePath = path.join(cloneDir, 'README.md');
                if (fs.existsSync(readmePath)) {
                    readmeContent = fs.readFileSync(readmePath, 'utf-8');
                    //console.log(`README Content:\n${readmeContent}`);
                    return [2 /*return*/, readmeContent];
                }
                else {
                    //console.log('README file not found in the repository.');
                    return [2 /*return*/, ''];
                }
            }
            catch (error) {
                //console.error('Error reading README file:', error);
                return [2 /*return*/, ''];
            }
            return [2 /*return*/];
        });
    });
}
exports.readReadmeFile = readReadmeFile;
function calculateReviewedCodeFraction(owner, repo, token) {
    return __awaiter(this, void 0, void 0, function () {
        var octokit, searchQuery, searchUrl, prData, reviewedLOC, totalLOC, _i, prData_1, pr, prNumber, reviewResponse, fileResponse, reviews, files, prAdditions, _a, files_1, file, error_1, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    octokit = new core_1.Octokit({ auth: token });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 10, , 11]);
                    searchQuery = "repo:".concat(owner, "/").concat(repo, " is:pr is:merged");
                    searchUrl = "https://api.github.com/search/issues?q=".concat(encodeURIComponent(searchQuery), "&per_page=25");
                    return [4 /*yield*/, getAllPages(searchUrl, { Authorization: "Bearer ".concat(token) })];
                case 2:
                    prData = _b.sent();
                    console.log("Found ".concat(prData.length, " merged PRs for ").concat(owner, "/").concat(repo));
                    reviewedLOC = 0;
                    totalLOC = 0;
                    _i = 0, prData_1 = prData;
                    _b.label = 3;
                case 3:
                    if (!(_i < prData_1.length)) return [3 /*break*/, 9];
                    pr = prData_1[_i];
                    prNumber = pr.number;
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 7, , 8]);
                    return [4 /*yield*/, octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
                            owner: owner,
                            repo: repo,
                            pull_number: prNumber,
                            headers: {
                                'X-GitHub-Api-Version': '2022-11-28'
                            }
                        })];
                case 5:
                    reviewResponse = _b.sent();
                    return [4 /*yield*/, octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
                            owner: owner,
                            repo: repo,
                            pull_number: prNumber,
                            headers: {
                                'X-GitHub-Api-Version': '2022-11-28'
                            }
                        })];
                case 6:
                    fileResponse = _b.sent();
                    reviews = reviewResponse.data;
                    files = fileResponse.data;
                    prAdditions = 0;
                    for (_a = 0, files_1 = files; _a < files_1.length; _a++) {
                        file = files_1[_a];
                        prAdditions += file.additions; // sum up the additions for all files in the PR
                        //console.log(`File: ${file.filename} has ${file.additions} additions`);
                    }
                    totalLOC += prAdditions; // accumulate total lines of code
                    if (reviews.length > 0) {
                        //console.log(`PR #${prNumber} has ${reviews.length} reviews and ${files.length} files`);
                        reviewedLOC += prAdditions; // accumulate reviewed lines of code
                        //console.log(`PR #${prNumber} has ${reviews.length} reviews and ${files.length} files`);
                    }
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _b.sent();
                    console.error("Error processing PR #".concat(prNumber, ": ").concat(error_1.message));
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9:
                    console.log("Total LOC: ".concat(totalLOC, ", reviewed LOC: ").concat(reviewedLOC));
                    return [2 /*return*/, (totalLOC === 0) ? 0 : reviewedLOC / totalLOC];
                case 10:
                    error_2 = _b.sent();
                    console.error("Error calculating reviewed code fraction: ".concat(error_2.message));
                    return [2 /*return*/, 0];
                case 11: return [2 /*return*/];
            }
        });
    });
}
exports.calculateReviewedCodeFraction = calculateReviewedCodeFraction;
function getAllPages(url, headers) {
    return __awaiter(this, void 0, void 0, function () {
        var responseData, page, totalPages, timeoutReached, response, linkHeader_1, lastPageMatch, linkHeader;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    responseData = [];
                    page = 1;
                    totalPages = 0;
                    timeoutReached = false;
                    _a.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 3];
                    return [4 /*yield*/, axios.get("".concat(url, "&page=").concat(page), { headers: headers })];
                case 2:
                    response = _a.sent();
                    if (page === 1) {
                        linkHeader_1 = response.headers.link;
                        if (linkHeader_1) {
                            lastPageMatch = linkHeader_1.match(/&page=(\d+)>; rel="last"/);
                            if (lastPageMatch) {
                                totalPages = parseInt(lastPageMatch[1]);
                            }
                        }
                    }
                    responseData = responseData.concat(response.data.items); // ensure to extract the items property
                    linkHeader = response.headers.link;
                    if (linkHeader && linkHeader.includes('rel="next"')) {
                        page++;
                        console.log("Processing page ".concat(page, " of ").concat(totalPages));
                        if (page === 2) {
                            timeoutReached = true;
                        }
                        if (timeoutReached) {
                            return [3 /*break*/, 3];
                        }
                    }
                    else {
                        return [3 /*break*/, 3];
                    }
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/, responseData];
            }
        });
    });
}
function getDependencies(owner, repo, token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, url, response, packageJsonObj, dependencies, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: "Bearer ".concat(token),
                        Accept: 'application/vnd.github.v3.raw', // This header is used to get the raw content of the file
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    url = "https://api.github.com/repos/".concat(owner, "/").concat(repo, "/contents/package.json");
                    return [4 /*yield*/, axios.get(url, { headers: headers })];
                case 2:
                    response = _a.sent();
                    packageJsonObj = response.data;
                    dependencies = packageJsonObj.dependencies || {};
                    //console.log(`Dependencies: ${JSON.stringify(dependencies)}`);
                    return [2 /*return*/, dependencies];
                case 3:
                    error_3 = _a.sent();
                    console.error("Error fetching package.json file from GitHub: ".concat(error_3.message));
                    return [2 /*return*/, {}];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.getDependencies = getDependencies;
function getUserStars(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, stars, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: "Bearer ".concat(token),
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios.get("https://api.github.com/repos/".concat(owner, "/").concat(packageName), { headers: headers })];
                case 2:
                    response = _a.sent();
                    stars = response.data.stargazers_count || 0;
                    console.log("Obtained user stars: ".concat(stars, " stars"));
                    return [2 /*return*/, stars];
                case 3:
                    error_4 = _a.sent();
                    console.log("Error fetching star count: ".concat(error_4));
                    console.log("Error fetching star count: ".concat(error_4));
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.getUserStars = getUserStars;
function getOpenIssuesCount(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, openIssuesCount, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: "Bearer ".concat(token),
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios.get("https://api.github.com/repos/".concat(owner, "/").concat(packageName, "/issues?state=open"), { headers: headers })];
                case 2:
                    response = _a.sent();
                    openIssuesCount = response.data.length || 0;
                    return [2 /*return*/, openIssuesCount];
                case 3:
                    error_5 = _a.sent();
                    console.log("Error fetching open issues count: ".concat(error_5));
                    console.log("Error fetching open issues count: ".concat(error_5));
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.getOpenIssuesCount = getOpenIssuesCount;
function getCommitFrequency(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, commitData, totalTimeInterval, i, commitDate, prevCommitDate, timeInterval, averageTimeInterval, frequency, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: "Bearer ".concat(token),
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios.get("https://api.github.com/repos/".concat(owner, "/").concat(packageName, "/commits"), { headers: headers })];
                case 2:
                    response = _a.sent();
                    commitData = response.data;
                    if (commitData.length < 2) {
                        //not enough commits for frequency calculation
                        return [2 /*return*/, 0];
                    }
                    //sort commitData by commit timestamp in ascending order
                    commitData.sort(function (a, b) {
                        var timestampA = new Date(a.commit.author.date).getTime();
                        var timestampB = new Date(b.commit.author.date).getTime();
                        return timestampA - timestampB;
                    });
                    totalTimeInterval = 0;
                    for (i = 1; i < commitData.length; i++) {
                        commitDate = new Date(commitData[i].commit.author.date);
                        prevCommitDate = new Date(commitData[i - 1].commit.author.date);
                        timeInterval = commitDate.getTime() - prevCommitDate.getTime();
                        totalTimeInterval += timeInterval;
                    }
                    averageTimeInterval = totalTimeInterval / (commitData.length - 1);
                    frequency = ((1000 * 60 * 60 * 24 * 365) - averageTimeInterval) / (1000 * 60 * 60 * 24 * 365);
                    console.log("Calculated commit frequency of: ".concat(frequency));
                    return [2 /*return*/, frequency];
                case 3:
                    error_6 = _a.sent();
                    console.log("Error fetching commit frequency: ".concat(error_6));
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.getCommitFrequency = getCommitFrequency;
function getIssueResolutionTime(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, issueData, totalTimeInterval, resolvedIssueCount, _i, issueData_1, issue, createDate, resolveDate, timeInterval, averageTimeInterval, frequency, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: "Bearer ".concat(token),
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios.get("https://api.github.com/repos/".concat(owner, "/").concat(packageName, "/issues?state=closed"), { headers: headers })];
                case 2:
                    response = _a.sent();
                    issueData = response.data;
                    if (issueData.length === 0) {
                        return [2 /*return*/, 0];
                    }
                    totalTimeInterval = 0;
                    resolvedIssueCount = 0;
                    for (_i = 0, issueData_1 = issueData; _i < issueData_1.length; _i++) {
                        issue = issueData_1[_i];
                        if (issue.state === 'closed' && issue.created_at && issue.closed_at) {
                            createDate = new Date(issue.created_at);
                            resolveDate = new Date(issue.closed_at);
                            timeInterval = resolveDate.getTime() - createDate.getTime();
                            totalTimeInterval += timeInterval;
                            resolvedIssueCount++;
                        }
                    }
                    console.log("issues: ".concat(resolvedIssueCount));
                    if (resolvedIssueCount === 0) {
                        return [2 /*return*/, 0];
                    }
                    averageTimeInterval = totalTimeInterval / resolvedIssueCount;
                    frequency = ((1000 * 60 * 60 * 24 * 365) - averageTimeInterval) / (1000 * 60 * 60 * 24 * 365);
                    console.log("Calculated user resolution time of: ".concat(frequency));
                    return [2 /*return*/, frequency];
                case 3:
                    error_7 = _a.sent();
                    console.log("Error fetching issue resolution time: ".concat(error_7));
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.getIssueResolutionTime = getIssueResolutionTime;
function getContributors(packageObj, headers, owner, packageName) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, axios.get("https://api.github.com/repos/".concat(owner, "/").concat(packageName, "/contributors"), { headers: headers })
                        .then(function (response) {
                        var contributorsData = response.data;
                        var contributorsMap = new Map();
                        contributorsData.forEach(function (contributor) {
                            var username = contributor.login;
                            var contributions = contributor.contributions;
                            contributorsMap.set(username, contributions);
                        });
                        packageObj.setContributors(contributorsMap);
                        return packageObj;
                    })
                        .catch(function (err) {
                        console.log("Error on axios.get: ".concat(err));
                        console.log("Error on axios.get: ".concat(err));
                        packageObj.setContributors(new Map());
                        return packageObj;
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, packageObj];
            }
        });
    });
}
exports.getContributors = getContributors;
