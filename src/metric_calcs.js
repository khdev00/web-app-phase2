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
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNetScore = exports.calculateResponsiveMaintainer = exports.calculateCorrectness = exports.calculateBusFactor = exports.calculateRampUp = void 0;
const metric_calcs_helpers_1 = require("./metric_calcs_helpers");
// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf = 5;
function calculateRampUp(readmeLength) {
    let rampUpVal = 0;
    // Avg readme length is 5-8 (so ~6.5) paragraphs
    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    let targetReadmeLength = 6.5 * 150 * 5;
    let longestReadmeLength = 20 * 150 * 5;
    // 100 is perfect length
    // 0 is very long or very short
    let readmeDifference = Math.abs(targetReadmeLength - readmeLength);
    let readmeVal = 100 - Math.min(1, readmeDifference / longestReadmeLength) * 100;
    rampUpVal = readmeVal;
    rampUpVal /= 100;
    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    rampUpVal = Math.round(rampUpVal * (Math.pow(10, rf))) / (Math.pow(10, rf));
    console.log(`Calculated rampup value of: ${rampUpVal}`);
    return rampUpVal;
}
exports.calculateRampUp = calculateRampUp;
function calculateBusFactor(readmeLength, contributors) {
    let busFactorVal = 0;
    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    let longestReadmeLength = 15 * 150 * 5;
    // 100 is perfect length
    // 0 is too short
    let readmeVal = 0;
    if (readmeLength > longestReadmeLength) {
        readmeVal = 100;
    }
    else {
        let readmeDifference = longestReadmeLength - readmeLength;
        readmeVal = 100 - (readmeDifference / longestReadmeLength) * 100;
    }
    // Take distrubution of number of commits per contributor
    // If one contributor does a disproportionate number of the commits, it is a lower score
    // 2/3 of equation is based on distributed contributor commit #, 1/3 is number of contributors
    let totalCommits = 0;
    let contributorsNum = 0;
    let contributorsVal = 0;
    contributors.forEach((value, key) => {
        totalCommits += value;
        contributorsNum++;
    });
    contributors.forEach((value, key) => {
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
    console.log(`Calculated bus factor of: ${busFactorVal}`);
    return busFactorVal;
}
exports.calculateBusFactor = calculateBusFactor;
function calculateCorrectness(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let stars = yield (0, metric_calcs_helpers_1.getUserStars)(owner, packageName, token);
            stars = Math.min(1000, stars) / 1000;
            const openIssues = yield (0, metric_calcs_helpers_1.getOpenIssuesCount)(owner, packageName, token);
            const starsWeight = 0.4;
            const issuesWeight = 0.6;
            const correctnessScore = (stars * starsWeight) + (0.6 - (0.6 * openIssues * issuesWeight / 100));
            const correctness = Math.round(correctnessScore * (Math.pow(10, rf))) / (Math.pow(10, rf));
            console.log(`Calculated correctness value of: ${correctness}`);
            return correctness;
        }
        catch (error) {
            console.log(`Error calculating correctness metric: ${error}`);
            console.log(`Error calculating correctness metric: ${error}`);
            return -1;
        }
    });
}
exports.calculateCorrectness = calculateCorrectness;
function calculateResponsiveMaintainer(owner, packageName, token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const commitFrequency = yield (0, metric_calcs_helpers_1.getCommitFrequency)(owner, packageName, token);
            const issueResolutionTime = yield (0, metric_calcs_helpers_1.getIssueResolutionTime)(owner, packageName, token);
            //console.log(`commit freq: ${commitFrequency}`);
            //console.log(`issue resol: ${issueResolutionTime}`);
            const commitFrequencyWeight = 0.3;
            const issueResolutionWeight = 0.7;
            const responsiveMaintainerScore = commitFrequency * commitFrequencyWeight + issueResolutionTime * issueResolutionWeight;
            const score = Math.round(responsiveMaintainerScore * (Math.pow(10, rf))) / (Math.pow(10, rf));
            console.log(`Calculated responsive maintainer score of: ${score}`);
            return score;
        }
        catch (error) {
            console.log(`Error calculating responsive maintainer score: ${error}`);
            console.log(`Error calculating responsive maintainer score: ${error}`);
            return -1;
        }
    });
}
exports.calculateResponsiveMaintainer = calculateResponsiveMaintainer;
function calculateNetScore(packageObj) {
    let netScore = 0.4 * packageObj.responsiveMaintainer + 0.3 * packageObj.rampUp + 0.15 * packageObj.correctness + 0.1 * packageObj.busFactor + 0.05 * Number(packageObj.hasLicense);
    let roundedNetScore = Math.round(netScore * (Math.pow(10, rf))) / (Math.pow(10, rf));
    console.log(`Calculated net-score: ${roundedNetScore}, for package with URL: ${packageObj.url}`);
    return roundedNetScore;
}
exports.calculateNetScore = calculateNetScore;
