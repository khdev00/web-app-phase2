"use strict";
// How to run this file
// 1. Run ./run install
// 2. You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
//    Make sure your .env is in .gitignore
// 3. Run ./run *path to your url file*
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGithubDetailsFromNpm = exports.fetchUrlsFromFile = exports.Url = exports.Package = void 0;
const dotenv_1 = __importDefault(require("dotenv")); // For retrieving env variables
const axios_1 = __importDefault(require("axios")); // Library to conveniantly send HTTP requests to interact with REST API
//import { getLogger } from './logger';
//import * as ndjson from 'ndjson';
const ndjson_1 = __importDefault(require("ndjson"));
const fs_1 = __importDefault(require("fs")); // Node.js file system module for cloning repos  
const path_1 = __importDefault(require("path"));
const http = require("isomorphic-git/http/node");
// For cloning repo
const BlueBirdPromise = require('bluebird');
const tar = require('tar');
const fsExtra = __importStar(require("fs-extra"));
const packageObjs = [];
const metric_calcs_1 = require("./metric_calcs");
const metric_calcs_helpers_1 = require("./metric_calcs_helpers");
dotenv_1.default.config();
// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf = 5;
//Logger initialization
//export const logger = getLogger();
class Package {
    constructor() {
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
    setContributors(contributors) {
        this.contributors = contributors;
    }
    setCodeReview(codeReview) {
        this.codeReview = codeReview;
    }
    setReadmeLength(readmeLength) {
        this.readmeLength = readmeLength;
    }
    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }
    setRampUp(rampUp) {
        this.rampUp = rampUp;
    }
    setHasLicense(hasLicense) {
        this.hasLicense = hasLicense;
    }
    setBusFactor(busFactor) {
        this.busFactor = busFactor;
    }
    setURL(url) {
        this.url = url;
    }
    setCorrectness(correctness) {
        this.correctness = correctness;
    }
    setResponsiveMaintainer(responsiveMaintainer) {
        this.responsiveMaintainer = responsiveMaintainer;
    }
    setNetScore(netScore) {
        this.netScore = netScore;
    }
    printMetrics() {
        const output = {
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
        console.log(`README Length: ${this.readmeLength}`);
        console.log('Contributors:');
        this.contributors.forEach((contributions, contributor) => {
            console.log(`${contributor}: ${contributions}`);
        });
        const stringify = ndjson_1.default.stringify();
        stringify.write(output);
        stringify.end(); // Close the NDJSON serialization
        stringify.on('data', (line) => {
            process.stdout.write(line);
        });
        console.log(`URL: ${this.url}`);
        console.log(`NET_SCORE: ${this.netScore}`);
        console.log(`RAMP_UP_SCORE: ${this.rampUp}`);
        console.log(`CORRECTNESS_SCORE: ${this.correctness}`);
        console.log(`BUS_FACTOR_SCORE: ${this.busFactor}`);
        console.log(`RESPONSIVE_MAINTAINER_SCORE: ${this.responsiveMaintainer}`);
        console.log(`LICENSE_SCORE: ${Number(this.hasLicense)}`);
        console.log(`DEPENDENCY_SCORE: ${Number(this.dependencies).toFixed(5)}`);
        console.log(`CODE_REVIEW_SCORE: ${Number(this.codeReview).toFixed(5)}`);
        console.log(`Metrics score outputted to stdout, URL: ${this.url}`);
    }
}
exports.Package = Package;
class Url {
    constructor(url, packageName, packageOwner) {
        this.url = url;
        this.packageName = packageName;
        this.packageOwner = packageOwner;
    }
    getPackageOwner() {
        if (this.packageOwner) {
            return this.packageOwner;
        }
        return "";
    }
    getPackageName() {
        return this.packageName;
    }
}
exports.Url = Url;
function retrieveGithubKey() {
    const githubApiKey = "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";
    if (!githubApiKey) {
        const error = new Error("GitHub API key not found in environment variables.");
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
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        packageObj = yield (0, metric_calcs_helpers_1.getContributors)(packageObj, headers, owner, packageName);
        yield axios_1.default.get(`https://api.github.com/repos/${owner}/${packageName}/license`, { headers, })
            .then((response) => {
            if (response.status == 200) {
                packageObj.setHasLicense(true);
            }
        })
            .catch((err) => {
            console.log(`Failed to get license status: ${err}`);
            packageObj.setHasLicense(false);
        });
        if (packageObj.contributors) {
            console.log(`Contributors retrieved for ${owner}/${packageName}`);
        }
        else {
            console.log(`Failed to retrieve contributors for ${owner}/${packageName}`);
            console.log(`Failed to retrieve contributors for ${owner}/${packageName}`);
        }
        yield (0, metric_calcs_1.calculateCorrectness)(owner, packageName, token).then((correctness) => {
            packageObj.setCorrectness(correctness);
        });
        const responsiveMaintainer = yield (0, metric_calcs_1.calculateResponsiveMaintainer)(owner, packageName, token);
        packageObj.setResponsiveMaintainer(responsiveMaintainer);
        const dependencies = yield (0, metric_calcs_1.calculateDependency)(owner, packageName, token); // <-- Add this line
        packageObj.setDependencies(dependencies); // <-- Add this line
        const codeReview = yield (0, metric_calcs_1.calculateCodeReviewMetric)(owner, packageName, token);
        packageObj.setCodeReview(codeReview);
        return packageObj;
    });
}
function extractTarball(tarballPath, targetDir) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs_1.default.createReadStream(tarballPath)
                .pipe(tar.extract({ cwd: targetDir, strip: 1 }))
                .on('error', reject)
                .on('end', resolve);
        });
    });
}
function cloneRepository(repoUrl, packageObj) {
    return __awaiter(this, void 0, void 0, function* () {
        packageObj.setURL(repoUrl);
        try {
            // Create a directory to clone the repository into
            const cloneDir = path_1.default.join(__dirname, 'temp');
            if (!fs_1.default.existsSync(cloneDir)) {
                fs_1.default.mkdirSync(cloneDir);
            }
            // Fetch the GitHub repository's tarball URL
            const tarballUrl = `${repoUrl}/archive/master.tar.gz`;
            // Download the tarball to a temporary file
            const tarballPath = path_1.default.join(__dirname, 'temp.tar.gz');
            const response = yield axios_1.default.get(tarballUrl, { responseType: 'stream' });
            response.data.pipe(fs_1.default.createWriteStream(tarballPath));
            yield new Promise((resolve, reject) => {
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
            // Extract the tarball using the tar library
            yield extractTarball(tarballPath, cloneDir);
            // Read and display the README file
            // Get readme length
            yield (0, metric_calcs_helpers_1.readReadmeFile)(cloneDir).then((response) => {
                packageObj.setReadmeLength(String(response).length);
            });
            // Clean up the temporary tarball file
            fs_1.default.unlinkSync(tarballPath);
            yield fsExtra.remove(cloneDir);
        }
        catch (error) {
            //console.error('Error cloning repository:', error);
        }
        packageObj.setBusFactor((0, metric_calcs_1.calculateBusFactor)(packageObj.readmeLength, packageObj.contributors));
        packageObj.setRampUp((0, metric_calcs_1.calculateRampUp)(packageObj.readmeLength));
        packageObj.setNetScore((0, metric_calcs_1.calculateNetScore)(packageObj));
        return packageObj;
    });
}
function calculateAllMetrics(urlObjs) {
    var _a, urlObjs_1, urlObjs_1_1;
    var _b, e_1, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            for (_a = true, urlObjs_1 = __asyncValues(urlObjs); urlObjs_1_1 = yield urlObjs_1.next(), _b = urlObjs_1_1.done, !_b; _a = true) {
                _d = urlObjs_1_1.value;
                _a = false;
                let url = _d;
                let packageObj = new Package;
                yield getPackageObject(url.getPackageOwner(), url.packageName, githubToken, packageObj)
                    .then((returnedPackageObject) => {
                    packageObj = returnedPackageObject;
                });
                packageObjs.push(packageObj);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = urlObjs_1.return)) yield _c.call(urlObjs_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        let idx = 0;
        return BlueBirdPromise.map(urlObjs, (url) => {
            let repoUrl = `https://github.com/${url.getPackageOwner()}/${url.packageName}`;
            let packageObj = packageObjs[idx++];
            return new Promise(resolve => {
                cloneRepository(repoUrl, packageObj)
                    .then((response) => {
                    resolve(response);
                });
            });
        }, { concurrency: 1 });
    });
}
// Asynchronous function to fetch URLs from a given file path.
function fetchUrlsFromFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield fs_1.default.promises.readFile(filePath, 'utf-8');
            const lines = data.split('\n');
            const urls = [];
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('http') && (line.includes('npmjs.com') || line.includes('github.com'))) {
                    let packageName = '';
                    let packageOwner = '';
                    if (line.includes('npmjs.com')) {
                        const parts = line.split('/');
                        packageName = parts[parts.length - 1];
                        packageOwner = null;
                        // Try to get GitHub details from npm package URL.
                        const githubDetails = yield getGithubDetailsFromNpm(line);
                        if (githubDetails) {
                            packageOwner = githubDetails.owner;
                            packageName = githubDetails.name;
                        }
                    }
                    else if (line.includes('github.com')) {
                        const parts = line.split('/');
                        packageName = parts[parts.length - 1];
                        packageOwner = parts[parts.length - 2];
                    }
                    const urlObj = new Url(line, packageName, packageOwner);
                    urls.push(urlObj);
                }
                else {
                    console.log(`Invalid URL format: ${line}`);
                }
            }
            return urls;
        }
        catch (error) {
            console.log('Error reading file:', error);
            return [];
        }
    });
}
exports.fetchUrlsFromFile = fetchUrlsFromFile;
function getGithubDetailsFromNpm(npmUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Fetch package data from npm registry API.
            const packageName = npmUrl.split('/').pop();
            const res = yield axios_1.default.get(`https://registry.npmjs.org/${packageName}`);
            // Try to find GitHub repository URL from npm package data.
            const repositoryUrl = res.data.repository && res.data.repository.url;
            if (repositoryUrl && repositoryUrl.includes('github.com')) {
                // Extract and return repository owner and name from GitHub URL.
                const parts = repositoryUrl.split('/');
                const name = parts[parts.length - 1].replace('.git', '');
                const owner = parts[parts.length - 2];
                return { name, owner };
            }
        }
        catch (error) {
            console.log('Error fetching npm package data:', error);
            return null;
        }
    });
}
exports.getGithubDetailsFromNpm = getGithubDetailsFromNpm;
function printAllMetrics(packages) {
    for (const packageObj of packages) {
        packageObj.printMetrics();
    }
}
// Usage example
const githubToken = retrieveGithubKey();
// const exampleUrl = new Url("https://github.com/cloudinary/cloudinary_npm", "cloudinary_npm", "cloudinary");
// const exampleUrl = new Url("https://github.com/mghera02/461Group2", "461Group2", "mghera02");
// const exampleUrl = new Url("https://github.com/vishnumaiea/ptScheduler", "ptScheduler", "vishnumaiea");
// let urlsFile = "./run_URL_FILE/urls.txt";
let urlsFile = process.argv[2];
let urlObjs = [];
fetchUrlsFromFile(urlsFile).then((urls) => {
    urlObjs = urls;
    calculateAllMetrics(urlObjs).then(() => {
        printAllMetrics(packageObjs);
    });
});
module.exports = {
    retrieveGithubKey,
    getPackageObject,
    cloneRepository,
    //logger,
    Package,
    Url,
    getGithubDetailsFromNpm,
    calculateAllMetrics,
    fetchUrlsFromFile,
};
