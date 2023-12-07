import { Package } from './fetch_url'

import { 
    getUserStars,
    getOpenIssuesCount, 
    getCommitFrequency,
    getIssueResolutionTime,
    getDependencies,
    calculateReviewedCodeFraction
    
} from './metric_calcs_helpers';

// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf: number = 5;

export async function calculateCodeReviewMetric(owner: string, packageName: string, token: string) {
    try {
        const codeReviewFraction = await calculateReviewedCodeFraction(owner, packageName, token);
        const score = codeReviewFraction; 
        console.log(`Calculated code review metric: ${score}`);
        return score;
    } catch (error) {
        console.log(`Error calculating code review metric: ${error}`);
        return -1;
    }
}

export async function calculateDependency(owner: string, packageName: string, token: string) {

    function isNumeric(str: string) {
        return !isNaN(Number(str)) && !isNaN(parseFloat(str));
    }
    try {
        // Get the dependencies from the package.json file
        try { 
            var dependencies = await getDependencies(owner, packageName, token);
        } catch (error) {
            console.log(`Error getting dependencies: ${error}`);
            return 1.0; // error getting dependencies
        }
        //console.log(`Dependencies: ${JSON.stringify(dependencies)}`);
        if (Object.keys(dependencies).length === 0) {
            console.log('No dependencies found.');
            return 1.0; // No dependencies
        }
        let count = 0;
        //(isNumeric(parts[1]))
        for (let dependency in dependencies) {
            let version = dependencies[dependency];
            version = version.replace(/^[\~\^]/, '');
            let parts = version.split('.');
            if ((isNumeric(parts[0])) && (isNumeric(parts[1]))) { // major and minor version are numeric
                if ((parts[0] > 0) && (parts[1] > 0)) {
                    count++;
                }
            }
        }
        let score = count / Object.keys(dependencies).length;
        return score;
    } catch (error) {
        console.log(`Error calculating dependency score: ${error}`);
        return -1;
    }
}

export function calculateRampUp(readmeLength: number) {
    let rampUpVal = 0;

    // Avg readme length is 5-8 (so ~6.5) paragraphs
    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    let targetReadmeLength = 6.5 * 150 * 5; 
    let longestReadmeLength = 20 * 150 * 5; 

    // 100 is perfect length
    // 0 is very long or very short
    let readmeDifference = Math.abs(targetReadmeLength -  readmeLength);
    let readmeVal = 100 - Math.min(1, readmeDifference / longestReadmeLength) * 100;
    rampUpVal = readmeVal;
    rampUpVal /= 100;

    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    rampUpVal = Math.round(rampUpVal * (10 ** rf)) / (10 ** rf);

    console.log(`Calculated rampup value of: ${rampUpVal}`);

    return rampUpVal;
}

export function calculateBusFactor(readmeLength: number, contributors: Map<string, number>) {
    let busFactorVal = 0;

    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    let longestReadmeLength = 15 * 150 * 5; 
    // 100 is perfect length
    // 0 is too short
    let readmeVal = 0;
    if(readmeLength > longestReadmeLength) {
        readmeVal = 100;
    } else {
        let readmeDifference = longestReadmeLength -  readmeLength;
        readmeVal = 100 - (readmeDifference / longestReadmeLength) * 100;
    }

    // Take distrubution of number of commits per contributor
    // If one contributor does a disproportionate number of the commits, it is a lower score
    // 2/3 of equation is based on distributed contributor commit #, 1/3 is number of contributors
    let totalCommits = 0;
    let contributorsNum = 0;
    let contributorsVal = 0;
    contributors.forEach((value: number, key: string) => {
        totalCommits += value;
        contributorsNum++;
    });
    contributors.forEach((value: number, key: string) => {
        contributorsVal += 100 - ((value/totalCommits) * 100);
    });
    contributorsVal /= contributorsNum;
    if(contributorsNum > 20) {
        contributorsNum = 20;
    }
    contributorsVal = (contributorsNum/20 * 100) / 3 + 2 * contributorsVal / 3;

    // Bus factor is average of readmeVal and contributorVal
    busFactorVal = ((readmeVal + contributorsVal) / 2)/100;
    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    busFactorVal = Math.round(busFactorVal * (10 ** rf)) / (10 ** rf);

    console.log(`Calculated bus factor of: ${busFactorVal}`);

    return busFactorVal
}

export async function calculateCorrectness(owner: string, packageName: string, token: string) {
    try {
        let stars = await getUserStars(owner, packageName, token);
        stars = Math.min(1000, stars) / 1000;
        const openIssues = await getOpenIssuesCount(owner, packageName, token);

        const starsWeight = 0.4;
        const issuesWeight = 0.6;
        const correctnessScore = (stars * starsWeight) + (0.6 - (0.6 * openIssues * issuesWeight / 100));

        const correctness = Math.round(correctnessScore * (10 ** rf)) / (10 ** rf);
        console.log(`Calculated correctness value of: ${correctness}`);

        return correctness
      
    } catch (error) {
        console.log(`Error calculating correctness metric: ${error}`);
        console.log(`Error calculating correctness metric: ${error}`);
        return -1; 
    }
}

export async function calculateResponsiveMaintainer(owner: string, packageName: string, token: string) {
    try {
        const commitFrequency = await getCommitFrequency(owner, packageName, token);
        const issueResolutionTime = await getIssueResolutionTime(owner, packageName, token);
        //console.log(`commit freq: ${commitFrequency}`);
        //console.log(`issue resol: ${issueResolutionTime}`);

        const commitFrequencyWeight = 0.3;
        const issueResolutionWeight = 0.7;
        const responsiveMaintainerScore = commitFrequency * commitFrequencyWeight + issueResolutionTime * issueResolutionWeight;

        const score = Math.round(responsiveMaintainerScore * (10 ** rf)) / (10 ** rf);

        console.log(`Calculated responsive maintainer score of: ${score}`)

        return score;
    } catch (error) {
        console.log(`Error calculating responsive maintainer score: ${error}`);
        console.log(`Error calculating responsive maintainer score: ${error}`);
        return -1; 
    }
}

export function calculateNetScore(packageObj: Package) {
    let netScore = (0.4 * packageObj.responsiveMaintainer + 0.3 * packageObj.rampUp + 0.15 * packageObj.correctness + 0.1 * packageObj.busFactor + (0.025 * Number((packageObj.dependencies).toFixed(5))) + (0.025 * Number((packageObj.codeReview).toFixed(5)))) * Number(packageObj.hasLicense);
    let roundedNetScore = Math.round(netScore * (10 ** rf)) / (10 ** rf);

    console.log(`Calculated net-score: ${roundedNetScore}, for package with URL: ${packageObj.url}`)

    return roundedNetScore;
}
