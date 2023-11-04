import React, { useRef, useState } from 'react';
import './App.css';
import { Amplify, API } from 'aws-amplify';
import awsconfig from './aws-exports';
import apiConfig from './apiconfig';
Amplify.configure({
  ...awsconfig,
  API: {
    endpoints: apiConfig.aws_cloud_logic_custom
  }
});

function App() {
  // Refs and state variables
  const [authToken, setAuthToken] = useState('');
  const packageIdInputForRetrieval = useRef(null);
  const packageIdInputForUpdate = useRef(null);
  const packageIdInputForRating = useRef(null);
  const packageIdInputForDeletion = useRef(null);
  const packageNameInputForRetrieval = useRef(null);
  const packageNameRegexInputForRetrieval = useRef(null);
  const packageNameInputForDeletion = useRef(null);
  const packageNameInputForCreation = useRef(null);
  const packageVersionInput = useRef(null);
  const packageContentInput = useRef(null);
  const packageURLInput = useRef(null);
  const usernameInput = useRef(null);
  const passwordInput = useRef(null);

  // Function to create an authentication token
  const createAuthToken = async () => {
    const username = usernameInput.current.value;
    const password = passwordInput.current.value;
    if (!username || !password) {
      alert('Please enter a username and password.');
      return;
    }
  
    const response = await API.put('phase2api', '/authenticate', {}); 
    console.log(response);

  };

  // Function to retrieve a package by ID
  const retrievePackageById = async () => {
    const packageId = packageIdInputForRetrieval.current.value;
    if (!packageId) {
      alert('Please enter a Package ID.');
      return;
    }
    console.log(packageId);

    try {
      const response = await API.get('phase2api', `/package/${packageId}`, {});
      console.log(response);
      alert('Package retrieved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve package.');
    }
  };

  // Function to update a package version
  const updatePackageVersion = async () => {
    const packageId = packageIdInputForUpdate.current.value;
    const packageContent = packageContentInput.current.value;
    const packageURL = packageURLInput.current.value;
    if (!packageId || !packageContent || !packageURL) {
      alert('Please enter all fields.');
      return;
    }

    try {
      const response = await API.put('phase2api', `/package/${packageId}`, {});
      console.log(response);
      alert('Package version updated successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to update package version.');
    }
  };

  // Function to rate a package
  const ratePackage = async () => {
    const packageId = packageIdInputForRating.current.value;
    if (!packageId) {
      alert('Please enter a Package ID.');
      return;
    }
    try {
      const response = await API.get('phase2api', `/package/${packageId}/rate`, {});
      console.log(response);
      alert('Package rated successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to rate package.');
    }
  };

  // Function to ingest a package
  const ingestPackage = async () => {
    const packageContent = packageContentInput.current.value;
    const packageURL = packageURLInput.current.value;
    if (!packageContent || !packageURL) {
      alert('Please enter all fields.');
      return;
    }

    try {
      const response = await API.post('phase2api', '/package', {});
      console.log(response);
      alert('Package ingested successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to ingest package.');
    }
  };

  // Function to create a package
  const createPackage = async () => {
    const packageName = packageNameInputForCreation.current.value;
    const packageVersion = packageVersionInput.current.value;
    const packageContent = packageContentInput.current.value;
    const packageURL = packageURLInput.current.value;
  
    if (!packageName || !packageVersion || !packageContent || !packageURL) {
      alert('Please enter all fields.');
      return;
    }
    console.log(packageName);
    try {
      const response = await API.get('phase2api', `/package/${packageNameInputForCreation.current.value}`, {});
      console.log(response);
      alert('Package created successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to create package.');
    }
  };

  // Function to retrieve a package by name
  const retrievePackageByName = async () => {
    const packageName = packageNameInputForRetrieval.current.value;
    if (!packageName) {
      alert('Please enter a Package Name.');
      return;
    }

    try {
      const response = await API.get('phase2api', `/package/byName/${packageName}`, {});
      console.log(response);
      alert('Package retrieved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve package.');
    }
  };

  const retrievePackageByRegex = async () => {
    const packageName = packageNameRegexInputForRetrieval.current.value;
    if (!packageName) {
      alert('Please enter a Package Name.');
      return;
    }

    try {
      const response = await API.get('phase2api', `/package/byRegex`, {});
      console.log(response);
      alert('Package retrieved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve package.');
    }
  };

  // Function to delete a specific version of a package
  const deletePackageVersion = async () => {
    const packageId = packageIdInputForDeletion.current.value;
    if (!packageId) {
      alert('Please enter a Package ID.');
      return;
    }

    try {
      const response = await API.del('phase2api', `/package/${packageId}`, {});
      console.log(response);
      alert('Package version deleted successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to delete package version.');
    }
  };

  // Function to delete all versions of a package by name
  const deleteAllVersionsOfPackage = async () => {
    const packageName = packageNameInputForDeletion.current.value;
    if (!packageName) {
      alert('Please enter a Package Name.');
      return;
    }

    try {
      const response = await API.del('phase2api', `/package/byName/${packageName}`, {});
      console.log(response);
      alert('All versions of the package deleted successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to delete all versions of the package.');
    }
  };

  // Function to reset the registry
  const resetRegistry = async () => {
    try {
      const response = await API.del('phase2api', '/reset', {});
      console.log(response);
      alert('Registry reset successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to reset registry.');
    }
  };

  // JSX rendering
  return (
    <div className="App">
      {/* Authentication token creation */}
      <div>
        <h2>Create Authentication Token</h2>
        <input type="text" ref={usernameInput} placeholder="Username" />
        <input type="password" ref={passwordInput} placeholder="Password" />
        <button onClick={createAuthToken}>Create Auth Token</button>
      </div>

       {/* Package retrieval by ID */}
       <div>
        <h2>Retrieve Package by ID</h2>
        <input type="text" ref={packageIdInputForRetrieval} placeholder="Package ID" />
        <button onClick={retrievePackageById}>Retrieve Package</button>
      </div>

      {/* Package version update */}
      <div>
        <h2>Update Package Version</h2>
        <input type="text" ref={packageIdInputForUpdate} placeholder="Package ID" />
        <input type="text" ref={packageContentInput} placeholder="Package Content" />
        <input type="text" ref={packageURLInput} placeholder="Package URL" />
        <button onClick={updatePackageVersion}>Update Package Version</button>
      </div>

      {/* Package rating */}
      <div>
        <h2>Rate Package</h2>
        <input type="text" ref={packageIdInputForRating} placeholder="Package ID" />
        <button onClick={ratePackage}>Rate Package</button>
      </div>

      {/* Package ingestion */}
      <div>
        <h2>Ingest Package</h2>
        <input type="text" ref={packageContentInput} placeholder="Package Content" />
        <input type="text" ref={packageURLInput} placeholder="Package URL" />
        <button onClick={ingestPackage}>Ingest Package</button>
      </div>

      {/* Package creation */}
      <div>
        <h2>Create Package</h2>
        <input type="text" ref={packageNameInputForCreation} placeholder="Package Name" />
        <input type="text" ref={packageVersionInput} placeholder="Package Version" />
        <input type="text" ref={packageContentInput} placeholder="Package Content" />
        <input type="text" ref={packageURLInput} placeholder="Package URL" />
        <button onClick={createPackage}>Create Package</button>
      </div>

      {/* Package retrieval by name */}
      <div>
        <h2>Retrieve Package by Name</h2>
        <input type="text" ref={packageNameInputForRetrieval} placeholder="Package Name" />
        <button onClick={retrievePackageByName}>Retrieve Package</button>
      </div>

      {/* Package retrieval by Regex */}
      <div>
        <h2>Retrieve Package by Regex</h2>
        <input type="text" ref={packageNameRegexInputForRetrieval} placeholder="Package Name Regex" />
        <button onClick={retrievePackageByRegex}>Retrieve Package</button>
      </div>

      {/* Delete a specific version of a package */}
      <div>
        <h2>Delete a Specific Version of a Package</h2>
        <input type="text" ref={packageIdInputForDeletion} placeholder="Package ID" />
        <button onClick={deletePackageVersion}>Delete Package Version</button>
      </div>

      {/* Delete all versions of a package by name */}
      <div>
        <h2>Delete All Versions of a Package by Name</h2>
        <input type="text" ref={packageNameInputForDeletion} placeholder="Package Name" />
        <button onClick={deleteAllVersionsOfPackage}>Delete All Versions</button>
      </div>

      {/* Registry reset */}
      <div>
        <h2>Reset Registry</h2>
        <button onClick={resetRegistry}>Reset Registry</button>
      </div>
    </div>
  );
}

export default App;
