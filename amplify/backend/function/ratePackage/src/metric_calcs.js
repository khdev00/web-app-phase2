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
exports.calculateNetScore = exports.calculateResponsiveMaintainer = exports.calculateCorrectness = exports.calculateBusFactor = exports.calculateRampUp = exports.calculateDependency = exports.calculateCodeReviewMetric = void 0;
var axios = require("axios");
var winston = require("winston");
var Logform = require("winston").Logform;
var metric_calcs_helpers_1 = require("./metric_calcs_helpers");
// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
var rf = 5;
function calculateCodeReviewMetric(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var codeReviewFraction, score, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.calculateReviewedCodeFraction)(owner, packageName, token)];
                case 1:
                    codeReviewFraction = _a.sent();
                    score = codeReviewFraction;
                    console.log("Calculated code review metric: ".concat(score));
                    return [2 /*return*/, score];
                case 2:
                    error_1 = _a.sent();
                    console.log("Error calculating code review metric: ".concat(error_1));
                    return [2 /*return*/, -1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.calculateCodeReviewMetric = calculateCodeReviewMetric;
function calculateDependency(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        function isNumeric(str) {
            return !isNaN(Number(str)) && !isNaN(parseFloat(str));
        }
        var dependencies, error_2, count, dependency, version, parts, score, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.getDependencies)(owner, packageName, token)];
                case 2:
                    dependencies = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.log("Error getting dependencies: ".concat(error_2));
                    return [2 /*return*/, 1.0]; // error getting dependencies
                case 4:
                    //console.log(`Dependencies: ${JSON.stringify(dependencies)}`);
                    if (Object.keys(dependencies).length === 0) {
                        console.log('No dependencies found.');
                        return [2 /*return*/, 1.0]; // No dependencies
                    }
                    count = 0;
                    //(isNumeric(parts[1]))
                    for (dependency in dependencies) {
                        version = dependencies[dependency];
                        version = version.replace(/^[\~\^]/, '');
                        parts = version.split('.');
                        if ((isNumeric(parts[0])) && (isNumeric(parts[1]))) { // major and minor version are numeric
                            if ((parts[0] > 0) && (parts[1] > 0)) {
                                count++;
                            }
                        }
                    }
                    score = count / Object.keys(dependencies).length;
                    return [2 /*return*/, score];
                case 5:
                    error_3 = _a.sent();
                    console.log("Error calculating dependency score: ".concat(error_3));
                    return [2 /*return*/, -1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
exports.calculateDependency = calculateDependency;
function calculateRampUp(readmeLength) {
    var rampUpVal = 0;
    // Avg readme length is 5-8 (so ~6.5) paragraphs
    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    var targetReadmeLength = 6.5 * 150 * 5;
    var longestReadmeLength = 20 * 150 * 5;
    // 100 is perfect length
    // 0 is very long or very short
    var readmeDifference = Math.abs(targetReadmeLength - readmeLength);
    var readmeVal = 100 - Math.min(1, readmeDifference / longestReadmeLength) * 100;
    rampUpVal = readmeVal;
    rampUpVal /= 100;
    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    rampUpVal = Math.round(rampUpVal * (Math.pow(10, rf))) / (Math.pow(10, rf));
    console.log("Calculated rampup value of: ".concat(rampUpVal));
    return rampUpVal;
}
exports.calculateRampUp = calculateRampUp;
function calculateBusFactor(readmeLength, contributors) {
    var busFactorVal = 0;
    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    var longestReadmeLength = 15 * 150 * 5;
    // 100 is perfect length
    // 0 is too short
    var readmeVal = 0;
    if (readmeLength > longestReadmeLength) {
        readmeVal = 100;
    }
    else {
        var readmeDifference = longestReadmeLength - readmeLength;
        readmeVal = 100 - (readmeDifference / longestReadmeLength) * 100;
    }
    // Take distrubution of number of commits per contributor
    // If one contributor does a disproportionate number of the commits, it is a lower score
    // 2/3 of equation is based on distributed contributor commit #, 1/3 is number of contributors
    var totalCommits = 0;
    var contributorsNum = 0;
    var contributorsVal = 0;
    contributors.forEach(function (value, key) {
        totalCommits += value;
        contributorsNum++;
    });
    contributors.forEach(function (value, key) {
        contributorsVal += 100 - ((value / totalCommits) * 100);
    });
    contributorsVal /= contributorsNum;
    if (contributorsNum > 20) {
        contributorsNum = 20;
    }
    contributorsVal = (contributorsNum / 20 * 100) / 3 + 2 * contributorsVal / 3;
    // Bus factor is average of readmeVal and contributorVal
    busFactorVal = ((readmeVal + contributorsVal) / 2) / 100;
    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    busFactorVal = Math.round(busFactorVal * (Math.pow(10, rf))) / (Math.pow(10, rf));
    console.log("Calculated bus factor of: ".concat(busFactorVal));
    return busFactorVal;
}
exports.calculateBusFactor = calculateBusFactor;
function calculateCorrectness(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var stars, openIssues, starsWeight, issuesWeight, correctnessScore, correctness, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.getUserStars)(owner, packageName, token)];
                case 1:
                    stars = _a.sent();
                    stars = Math.min(1000, stars) / 1000;
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.getOpenIssuesCount)(owner, packageName, token)];
                case 2:
                    openIssues = _a.sent();
                    starsWeight = 0.4;
                    issuesWeight = 0.6;
                    correctnessScore = (stars * starsWeight) + (0.6 - (0.6 * openIssues * issuesWeight / 100));
                    correctness = Math.round(correctnessScore * (Math.pow(10, rf))) / (Math.pow(10, rf));
                    console.log("Calculated correctness value of: ".concat(correctness));
                    return [2 /*return*/, correctness];
                case 3:
                    error_4 = _a.sent();
                    console.log("Error calculating correctness metric: ".concat(error_4));
                    return [2 /*return*/, -1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.calculateCorrectness = calculateCorrectness;
function calculateResponsiveMaintainer(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function () {
        var commitFrequency, issueResolutionTime, commitFrequencyWeight, issueResolutionWeight, responsiveMaintainerScore, score, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.getCommitFrequency)(owner, packageName, token)];
                case 1:
                    commitFrequency = _a.sent();
                    return [4 /*yield*/, (0, metric_calcs_helpers_1.getIssueResolutionTime)(owner, packageName, token)];
                case 2:
                    issueResolutionTime = _a.sent();
                    commitFrequencyWeight = 0.3;
                    issueResolutionWeight = 0.7;
                    responsiveMaintainerScore = commitFrequency * commitFrequencyWeight + issueResolutionTime * issueResolutionWeight;
                    score = Math.round(responsiveMaintainerScore * (Math.pow(10, rf))) / (Math.pow(10, rf));
                    console.log("Calculated responsive maintainer score of: ".concat(score));
                    return [2 /*return*/, score];
                case 3:
                    error_5 = _a.sent();
                    console.log("Error calculating responsive maintainer score: ".concat(error_5));
                    return [2 /*return*/, -1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.calculateResponsiveMaintainer = calculateResponsiveMaintainer;
function calculateNetScore(packageObj) {
    var netScore = (0.4 * packageObj.responsiveMaintainer + 0.3 * packageObj.rampUp + 0.15 * packageObj.correctness + 0.1 * packageObj.busFactor + (0.025 * Number((packageObj.dependencies).toFixed(5))) + (0.025 * Number((packageObj.codeReview).toFixed(5)))) * Number(packageObj.hasLicense);
    var roundedNetScore = Math.round(netScore * (Math.pow(10, rf))) / (Math.pow(10, rf));
    console.log("Calculated net-score: ".concat(roundedNetScore, ", for package with URL: ").concat(packageObj.url));
    return roundedNetScore;
}
exports.calculateNetScore = calculateNetScore;
