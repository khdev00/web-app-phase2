const { Octokit } = require("@octokit/core");
const https = require('https');
const fs = require('fs');

const octokit = new Octokit({ auth: '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' });

function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(filePath);
            reject(err);
        });
    });
}

async function downloadRepoZip(owner, repo) {
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/zipball', {
            owner: owner,
            repo: repo
        });

        const url = response.url;
        const filePath = `${repo}.zip`;

        await downloadFile(url, filePath);

        console.log(`Downloaded ${repo}.zip successfully.`);
    } catch (error) {
        console.error(`Error downloading repository: ${error}`);
    }
}

downloadRepoZip('jashkenas', 'underscore');
