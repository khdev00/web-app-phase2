"use strict";
// How to run this file
// 1. Run ./run install
// 2. You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
//    Make sure your .env is in .gitignore
// 3. Run ./run *path to your url file*
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGithubDetailsFromNpm = exports.fetchUrlData = exports.fetchUrlsFromFile = exports.Url = exports.Package = void 0;
var dotenv = require('dotenv'); // For retrieving env variables
var axios = require('axios'); // Library to conveniently send HTTP requests to interact with REST API
var ndjson = require('ndjson');
var fs = require('fs'); // Node.js file system module for cloning repos
var path = require('path');
var Octokit = require("@octokit/rest").Octokit; // Make sure to install @octokit/core via npm
// For cloning repo
var BlueBirdPromise = require('bluebird');
var tar = require('tar');
var packageObjs = [];
var metric_calcs_1 = require("./metric_calcs");
var metric_calcs_helpers_1 = require("./metric_calcs_helpers");
dotenv.config();
// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
var rf = 5;
//Logger initialization
//export const logger = getLogger();
var Package = /** @class */ (function () {
    function Package() {
        this.url = "";
        this.contributors = new Map();
        this.readmeLength = -1;
        this.rampUp = -1;
        this.hasLicense = false;
        this.busFactor = -1;
        this.correctness = -1;
        this.responsiveMaintainer = -1;
        this.netScore = -1;
        this.codeReview = -1;
        this.dependencies = -1;
    }
    Package.prototype.setContributors = function (contributors) {
        this.contributors = contributors;
    };
    Package.prototype.setCodeReview = function (codeReview) {
        this.codeReview = codeReview;
    };
    Package.prototype.setReadmeLength = function (readmeLength) {
        this.readmeLength = readmeLength;
    };
    Package.prototype.setDependencies = function (dependencies) {
        this.dependencies = dependencies;
    };
    Package.prototype.setRampUp = function (rampUp) {
        this.rampUp = rampUp;
    };
    Package.prototype.setHasLicense = function (hasLicense) {
        this.hasLicense = hasLicense;
    };
    Package.prototype.setBusFactor = function (busFactor) {
        this.busFactor = busFactor;
    };
    Package.prototype.setURL = function (url) {
        this.url = url;
    };
    Package.prototype.setCorrectness = function (correctness) {
        this.correctness = correctness;
    };
    Package.prototype.setResponsiveMaintainer = function (responsiveMaintainer) {
        this.responsiveMaintainer = responsiveMaintainer;
    };
    Package.prototype.setNetScore = function (netScore) {
        this.netScore = netScore;
    };
    Package.prototype.printMetrics = function () {
        var output = {
            URL: this.url,
            NET_SCORE: this.netScore,
            RAMP_UP_SCORE: this.rampUp,
            CORRECTNESS_SCORE: this.correctness,
            BUS_FACTOR_SCORE: this.busFactor,
            RESPONSIVE_MAINTAINER_SCORE: this.responsiveMaintainer,
            DEPENDENCY_SCORE: Number((this.dependencies).toFixed(5)),
            CODE_REVIEW_SCORE: Number((this.codeReview).toFixed(5)),
            LICENSE_SCORE: Number(this.hasLicense)
        };
        console.log("README Length: ".concat(this.readmeLength));
        console.log('Contributors:');
        this.contributors.forEach(function (contributions, contributor) {
            console.log("".concat(contributor, ": ").concat(contributions));
        });
        var stringify = ndjson.stringify();
        stringify.write(output);
        stringify.end(); // Close the NDJSON serialization
        stringify.on('data', function (line) {
            process.stdout.write(line);
        });
        console.log("URL: ".concat(this.url));
        console.log("NET_SCORE: ".concat(this.netScore));
        console.log("RAMP_UP_SCORE: ".concat(this.rampUp));
        console.log("CORRECTNESS_SCORE: ".concat(this.correctness));
        console.log("BUS_FACTOR_SCORE: ".concat(this.busFactor));
        console.log("RESPONSIVE_MAINTAINER_SCORE: ".concat(this.responsiveMaintainer));
        console.log("LICENSE_SCORE: ".concat(Number(this.hasLicense)));
        console.log("DEPENDENCY_SCORE: ".concat(Number(this.dependencies).toFixed(5)));
        console.log("CODE_REVIEW_SCORE: ".concat(Number(this.codeReview).toFixed(5)));
        console.log("Metrics score outputted to stdout, URL: ".concat(this.url));
    };
    return Package;
}());
exports.Package = Package;
var Url = /** @class */ (function () {
    function Url(url, packageName, packageOwner) {
        this.url = url;
        this.packageName = packageName;
        this.packageOwner = packageOwner;
    }
    Url.prototype.getPackageOwner = function () {
        if (this.packageOwner) {
            return this.packageOwner;
        }
        return "";
    };
    Url.prototype.getPackageName = function () {
        return this.packageName;
    };
    return Url;
}());
exports.Url = Url;
function retrieveGithubKey() {
    var githubApiKey = "";
    if (!githubApiKey) {
        var error = new Error("GitHub API key not found in environment variables.");
        console.log(error);
        throw error;
    }
    else {
        console.log("Found github API key");
        return githubApiKey;
    }
}
// Useful for looking at which data you can access:
// https://docs.github.com/en/rest/overview/endpoints-available-for-github-app-installation-access-tokens?apiVersion=2022-11-28
function getPackageObject(owner, packageName, token, packageObj) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, responsiveMaintainer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: "Bearer ".concat(token),
                    };
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.getContributors)(packageObj, headers, owner, packageName)];
                case 1:
                    packageObj = _a.sent();
                    return [4 /*yield*/, axios.get("https://api.github.com/repos/".concat(owner, "/").concat(packageName, "/license"), { headers: headers, })
                            .then(function (response) {
                            if (response.status == 200) {
                                packageObj.setHasLicense(true);
                            }
                        })
                            .catch(function (err) {
                            console.log("Failed to get license status: ".concat(err));
                            packageObj.setHasLicense(false);
                        })];
                case 2:
                    _a.sent();
                    if (packageObj.contributors) {
                        console.log("Contributors retrieved for ".concat(owner, "/").concat(packageName));
                    }
                    else {
                        console.log("Failed to retrieve contributors for ".concat(owner, "/").concat(packageName));
                        console.log("Failed to retrieve contributors for ".concat(owner, "/").concat(packageName));
                    }
                    return [4 /*yield*/, (0, metric_calcs_1.calculateCorrectness)(owner, packageName, token).then(function (correctness) {
                            packageObj.setCorrectness(correctness);
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, metric_calcs_1.calculateResponsiveMaintainer)(owner, packageName, token)];
                case 4:
                    responsiveMaintainer = _a.sent();
                    packageObj.setResponsiveMaintainer(responsiveMaintainer);
                    return [2 /*return*/, packageObj];
            }
        });
    });
}
function extractTarball(tarballPath, targetDir) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    fs.createReadStream(tarballPath)
                        .pipe(tar.extract({ cwd: targetDir, strip: 1 }))
                        .on('error', reject)
                        .on('end', resolve);
                })];
        });
    });
}
function cloneRepository(repoUrl, packageObj, secret, repo, owner) {
    return __awaiter(this, void 0, void 0, function () {
        var octokit, response, characterLength, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    packageObj.setURL(repoUrl);
                    octokit = new Octokit({
                        auth: "token ".concat(secret), // Replace with your GitHub token
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, octokit.repos.getContent({
                            owner: owner,
                            repo: repo,
                            path: 'README.md',
                            headers: {
                                accept: 'application/vnd.github.v3.raw', // request raw content
                            },
                        })];
                case 2:
                    response = _a.sent();
                    characterLength = response.data.length;
                    packageObj.readmeLength = characterLength;
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.log("README Error: ", err_1);
                    return [3 /*break*/, 4];
                case 4:
                    /*try {
                        // Create a directory to clone the repository into
                        const cloneDir = path.join(__dirname, 'temp');
                        if (!fs.existsSync(cloneDir)) {
                            fs.mkdirSync(cloneDir);
                        }
                    
                        // Fetch the GitHub repository's tarball URL
                        const tarballUrl = `${repoUrl}/archive/master.tar.gz`;
                    
                        // Download the tarball to a temporary file
                        const tarballPath = path.join(__dirname, 'temp.tar.gz');
                        const response = await axios.get(tarballUrl, { responseType: 'stream' });
                        response.data.pipe(fs.createWriteStream(tarballPath));
                    
                        await new Promise((resolve, reject) => {
                            response.data.on('end', resolve);
                            response.data.on('error', reject);
                        });
                    
                        // Extract the tarball using the tar library
                        await extractTarball(tarballPath, cloneDir);
                    
                
                        // Read and display the README file
                        // Get readme length
                        await readReadmeFile(cloneDir).then ((response) => {
                            packageObj.setReadmeLength(String(response).length);
                        });
                    
                        // Clean up the temporary tarball file
                        fs.unlinkSync(tarballPath);
                
                        await fsExtra.remove(cloneDir);
                    
                    } catch (error) {
                        //console.error('Error cloning repository:', error);
                    }*/
                    packageObj.setBusFactor((0, metric_calcs_1.calculateBusFactor)(packageObj.readmeLength, packageObj.contributors));
                    packageObj.setRampUp((0, metric_calcs_1.calculateRampUp)(packageObj.readmeLength));
                    packageObj.setNetScore((0, metric_calcs_1.calculateNetScore)(packageObj));
                    return [2 /*return*/, packageObj];
            }
        });
    });
}
function calculateAllMetrics(urlObjs, secret) {
    var _a, urlObjs_1, urlObjs_1_1;
    var _b, e_1, _c, _d;
    return __awaiter(this, void 0, void 0, function () {
        var _loop_1, e_1_1, idx;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 6, 7, 12]);
                    _loop_1 = function () {
                        var url, packageObj;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    _d = urlObjs_1_1.value;
                                    _a = false;
                                    url = _d;
                                    packageObj = new Package;
                                    return [4 /*yield*/, getPackageObject(url.getPackageOwner(), url.packageName, secret, packageObj)
                                            .then(function (returnedPackageObject) {
                                            packageObj = returnedPackageObject;
                                        })];
                                case 1:
                                    _f.sent();
                                    packageObjs.push(packageObj);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _a = true, urlObjs_1 = __asyncValues(urlObjs);
                    _e.label = 1;
                case 1: return [4 /*yield*/, urlObjs_1.next()];
                case 2:
                    if (!(urlObjs_1_1 = _e.sent(), _b = urlObjs_1_1.done, !_b)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1()];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 1];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = urlObjs_1.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(urlObjs_1)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12:
                    idx = 0;
                    return [2 /*return*/, BlueBirdPromise.map(urlObjs, function (url) {
                            var repoUrl = "https://github.com/".concat(url.getPackageOwner(), "/").concat(url.packageName);
                            var packageObj = packageObjs[idx++];
                            return new Promise(function (resolve) {
                                cloneRepository(repoUrl, packageObj, secret, url.getPackageName(), url.getPackageOwner())
                                    .then(function (response) {
                                    resolve(response);
                                });
                            });
                        }, { concurrency: 1 })];
            }
        });
    });
}
// Asynchronous function to fetch URLs from a given file path.
function fetchUrlsFromFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var data, lines, urls, _i, lines_1, line, packageName, packageOwner, parts, githubDetails, parts, urlObj, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    return [4 /*yield*/, fs.promises.readFile(filePath, 'utf-8')];
                case 1:
                    data = _a.sent();
                    lines = data.split('\n');
                    urls = [];
                    _i = 0, lines_1 = lines;
                    _a.label = 2;
                case 2:
                    if (!(_i < lines_1.length)) return [3 /*break*/, 8];
                    line = lines_1[_i];
                    line = line.trim();
                    if (!(line.startsWith('http') && (line.includes('npmjs.com') || line.includes('github.com')))) return [3 /*break*/, 6];
                    packageName = '';
                    packageOwner = '';
                    if (!line.includes('npmjs.com')) return [3 /*break*/, 4];
                    parts = line.split('/');
                    packageName = parts[parts.length - 1];
                    packageOwner = null;
                    return [4 /*yield*/, getGithubDetailsFromNpm(line)];
                case 3:
                    githubDetails = _a.sent();
                    if (githubDetails) {
                        packageOwner = githubDetails.owner;
                        packageName = githubDetails.name;
                    }
                    return [3 /*break*/, 5];
                case 4:
                    if (line.includes('github.com')) {
                        parts = line.split('/');
                        packageName = parts[parts.length - 1];
                        packageOwner = parts[parts.length - 2];
                    }
                    _a.label = 5;
                case 5:
                    urlObj = new Url(line, packageName, packageOwner);
                    urls.push(urlObj);
                    return [3 /*break*/, 7];
                case 6:
                    console.log("Invalid URL format: ".concat(line));
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/, urls];
                case 9:
                    error_1 = _a.sent();
                    console.log('Error reading file:', error_1);
                    return [2 /*return*/, []];
                case 10: return [2 /*return*/];
            }
        });
    });
}
exports.fetchUrlsFromFile = fetchUrlsFromFile;
function fetchUrlData(url) {
    return __awaiter(this, void 0, void 0, function () {
        var urls, line, packageName, packageOwner, parts, githubDetails, parts, urlObj, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    urls = [];
                    line = url.trim();
                    if (!((line.startsWith('http') || line.startsWith('www')) && (line.includes('npmjs.com') || line.includes('github.com')))) return [3 /*break*/, 4];
                    packageName = '';
                    packageOwner = '';
                    if (!line.includes('npmjs.com')) return [3 /*break*/, 2];
                    parts = line.split('/');
                    packageName = parts[parts.length - 1];
                    packageOwner = null;
                    return [4 /*yield*/, getGithubDetailsFromNpm(line)];
                case 1:
                    githubDetails = _a.sent();
                    if (githubDetails) {
                        packageOwner = githubDetails.owner;
                        packageName = githubDetails.name;
                        line = githubDetails.repositoryUrl;
                    }
                    return [3 /*break*/, 3];
                case 2:
                    if (line.includes('github.com')) {
                        parts = line.split('/');
                        console.log("Parts: ", parts);
                        packageName = parts[parts.length - 1];
                        packageOwner = parts[parts.length - 2];
                    }
                    _a.label = 3;
                case 3:
                    urlObj = new Url(line, packageName, packageOwner);
                    urls.push(urlObj);
                    return [3 /*break*/, 5];
                case 4:
                    console.error("Invalid URL format: ".concat(line));
                    _a.label = 5;
                case 5: return [2 /*return*/, urls];
                case 6:
                    error_2 = _a.sent();
                    console.log('Error reading file:', error_2);
                    return [2 /*return*/, []];
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.fetchUrlData = fetchUrlData;
function getGithubDetailsFromNpm(npmUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var packageName, res, repositoryUrl, parts, name_1, owner, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    packageName = npmUrl.split('/').pop();
                    return [4 /*yield*/, axios.get("https://registry.npmjs.org/".concat(packageName))];
                case 1:
                    res = _a.sent();
                    repositoryUrl = res.data.repository && res.data.repository.url;
                    if (repositoryUrl && repositoryUrl.includes('github.com')) {
                        parts = repositoryUrl.split('/');
                        name_1 = parts[parts.length - 1].replace('.git', '');
                        owner = parts[parts.length - 2];
                        return [2 /*return*/, { name: name_1, owner: owner, repositoryUrl: repositoryUrl }];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.log('Error fetching npm package data:', error_3);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.getGithubDetailsFromNpm = getGithubDetailsFromNpm;
module.exports = {
    retrieveGithubKey: retrieveGithubKey,
    getPackageObject: getPackageObject,
    cloneRepository: cloneRepository,
    //logger,
    Package: Package,
    Url: Url,
    getGithubDetailsFromNpm: getGithubDetailsFromNpm,
    calculateAllMetrics: calculateAllMetrics,
    fetchUrlsFromFile: fetchUrlsFromFile,
    fetchUrlData: fetchUrlData
};
