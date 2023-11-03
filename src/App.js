import React, { useRef, useState } from 'react';
import './App.css';
import { Amplify, API, Storage } from 'aws-amplify';
import awsconfig from './aws-exports';
Amplify.configure(awsconfig);

function App() {
  const urlInput = useRef(null);
  const packageLinkDeleteInput = useRef(null);
  const updateUrlInput = useRef(null);
  const tokenInput = useRef(null);
  const [fileContent, setFileContent] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [uploadedPackage, setUploadedPackage] = useState(null);

  const handleTokenChange = () => {
    setGithubToken(tokenInput.current.value);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent(e.target.result);
    };
    reader.readAsText(file);
  };

  const handlePackageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedPackage(file);
    } else {
      alert("Please upload a valid zip file.");
    }
  };

  const uploadPackage = async () => {
    if (!uploadedPackage) {
      alert("Please upload a package first.");
      return;
    }

    try {
      const response = await Storage.put(uploadedPackage.name, uploadedPackage, {
        contentType: 'application/zip' // Set the content type to zip
      });

      console.log(response); // This should log the response from S3
      alert("Package uploaded successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to upload package.");
    }
  };

  // Package processing functions
  const downloadPackages = () => {
    const urls = urlInput.current.value.split('\n').filter(url => url.trim());
    if (!urls.length) {
      alert("Please enter valid URLs.");
      return;
    }
    // Implement your download logic here
  };

  const updatePackage = () => {
    const urls = updateUrlInput.current.value.split('\n').filter(url => url.trim());
    if (!urls.length) {
      alert("Please enter valid URLs.");
      return;
    }
    // Implement your update logic here
  };

  const gradePackages = async () => {
    const apiName = 'gradeAPII';
    const path = '/grade';
    try {
      const response = await API.post(apiName, path, {
        body: {}  // No need to send any body for now since we're not grading anything yet
      });
      console.log(response);  // This should log the response from Lambda
    } catch (error) {
      console.error(error);
    }
  };

  // Registry management functions
  const viewRegistry = () => {
    console.log("Fetching and displaying the package registry...");
    // Implement your view logic here
  };

  const deleteRegistry = () => {
    const confirmation = window.confirm("Are you sure you want to delete the package registry?");
    if (confirmation) {
      console.log("Deleting the package registry...");
      // Implement your delete logic here
    }
  };

  const deletePackage = () => {
    const packageLink = packageLinkDeleteInput.current.value.trim();
    if (!packageLink) {
      alert("Please provide the NPM/GitHub link for the package you want to delete.");
      return;
    }

    const confirmation = window.confirm("Are you sure you want to delete this package?");
    if (confirmation) {
      console.log("Deleting the package from the registry...");
      // Implement your delete logic here
    }
  };

  // JSX rendering
  return (
    <div className="App">
      <div className="github-token-section">
        <h2>GitHub Token</h2>
        <p>A valid GitHub token must be entered to access features.</p>
        <label htmlFor="githubTokenInput">Enter your GitHub token:</label><br />
        <input 
            type="password" 
            id="githubTokenInput" 
            placeholder="Enter GitHub token"
            ref={tokenInput}
            onChange={handleTokenChange}
        /><br />
      </div>

      <h2>Process NPM Packages</h2>
      <label htmlFor="urlInput">Enter valid NPM/GITHUB url(s) .txt file separated by newline</label><br />
      <input type="file" onChange={handleFileChange} /><br />
      <button className="button-spacing" onClick={downloadPackages}>Download Packages</button>
      <button className="button-spacing" onClick={gradePackages}>Grade Packages</button>

      <h2>Upload Package</h2>
      <input type="file" accept=".zip" onChange={handlePackageUpload} /><br />
      <button className="left" onClick={uploadPackage}>Upload Package</button>

      <h2>Package Registry Settings</h2>
      <button className="button-spacing" onClick={viewRegistry}>View Registry</button>
      <button className="button-spacing" onClick={deleteRegistry}>Delete Registry</button>

      <div>
        <h3>Update Package</h3>
        <label htmlFor="urlInputUpdate">Enter NPM/GITHUB package url to update</label><br />
        <textarea className="left textbox-width-large" ref={updateUrlInput} id="urlInputUpdate" rows="1"></textarea><br />
        <button onClick={updatePackage}>Update Package</button>
      </div> 

      <h4>Delete Package in Registry</h4>
      <label htmlFor="packageLinkDelete">Enter NPM/GITHUB package url to delete</label><br />
      <input className="textbox-width-medium" type="text" ref={packageLinkDeleteInput} id="packageLinkDelete" placeholder="Enter npm/github link for your package" /><br />
      <button className="left" onClick={deletePackage}>Delete Package</button>
    </div>
  );
}

export default App;
