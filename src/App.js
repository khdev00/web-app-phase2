import React, { useRef, useState } from 'react';
import './App.css';
import { Amplify, API } from 'aws-amplify';
import awsconfig from './aws-exports';
Amplify.configure(awsconfig);

function App() {
  // Refs and state variables
  const [authToken, setAuthToken] = useState('');
  const packageIdInput = useRef(null);
  const packageNameInput = useRef(null);
  const packageVersionInput = useRef(null);
  const packageContentInput = useRef(null);
  const packageURLInput = useRef(null);
  const packageRatingInput = useRef(null);
  const usernameInput = useRef(null);
  const passwordInput = useRef(null);

  // Function to create an authentication token
  const createAuthToken = async () => {
    const username = usernameInput.current.value;
    const password = passwordInput.current.value;

    try {
      const response = await API.put('phase2api', '/authenticate', {
        body: {
          User: {
            name: username,
            isAdmin: true // Assuming admin user for simplicity
          },
          Secret: {
            password: password
          }
        }
      });
      setAuthToken(response);
      alert('Authentication token created successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to create authentication token.');
    }
  };

  // Function to retrieve a package by ID
  const retrievePackageById = async () => {
    const packageId = packageIdInput.current.value;

    try {
      const response = await API.get('phase2api', `/package/${packageId}`, {
        headers: {
          'X-Authorization': authToken
        }
      });
      console.log(response);
      alert('Package retrieved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve package.');
    }
  };

  // Function to update a package version
  const updatePackageVersion = async () => {
    const packageId = packageIdInput.current.value;
    const packageContent = packageContentInput.current.value;
    const packageURL = packageURLInput.current.value;

    try {
      const response = await API.put('phase2api', `/package/${packageId}`, {
        headers: {
          'X-Authorization': authToken
        },
        body: {
          Content: packageContent,
          URL: packageURL
        }
      });
      console.log(response);
      alert('Package version updated successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to update package version.');
    }
  };

  // Function to rate a package
  const ratePackage = async () => {
    const packageId = packageIdInput.current.value;
    const packageRating = packageRatingInput.current.value;

    try {
      const response = await API.post('phase2api', `/package/${packageId}/rate`, {
        headers: {
          'X-Authorization': authToken
        },
        body: {
          Rating: packageRating
        }
      });
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

    try {
      const response = await API.post('phase2api', '/package', {
        headers: {
          'X-Authorization': authToken
        },
        body: {
          Content: packageContent,
          URL: packageURL
        }
      });
      console.log(response);
      alert('Package ingested successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to ingest package.');
    }
  };

  // Function to create a package
  const createPackage = async () => {
    const packageName = packageNameInput.current.value;
    const packageVersion = packageVersionInput.current.value;
    const packageContent = packageContentInput.current.value;
    const packageURL = packageURLInput.current.value;

    try {
      const response = await API.post('phase2api', '/package', {
        headers: {
          'X-Authorization': authToken
        },
        body: {
          metadata: {
            Name: packageName,
            Version: packageVersion
          },
          data: {
            Content: packageContent,
            URL: packageURL
          }
        }
      });
      console.log(response);
      alert('Package created successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to create package.');
    }
  };

  // Function to retrieve a package by name
  const retrievePackageByName = async () => {
    const packageName = packageNameInput.current.value;

    try {
      const response = await API.get('phase2api', `/package/byName/${packageName}`, {
        headers: {
          'X-Authorization': authToken
        }
      });
      console.log(response);
      alert('Package retrieved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve package.');
    }
  };

  // Function to delete a specific version of a package
  const deletePackageVersion = async () => {
    const packageId = packageIdInput.current.value;

    try {
      const response = await API.del('phase2api', `/package/${packageId}`, {
        headers: {
          'X-Authorization': authToken
        }
      });
      console.log(response);
      alert('Package version deleted successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to delete package version.');
    }
  };

  // Function to delete all versions of a package by name
  const deleteAllVersionsOfPackage = async () => {
    const packageName = packageNameInput.current.value;

    try {
      const response = await API.del('phase2api', `/package/byName/${packageName}`, {
        headers: {
          'X-Authorization': authToken
        }
      });
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
      const response = await API.del('phase2api', '/reset', {
        headers: {
          'X-Authorization': authToken
        }
      });
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
        <input type="text" ref={packageIdInput} placeholder="Package ID" />
        <button onClick={retrievePackageById}>Retrieve Package</button>
      </div>

      {/* Package version update */}
      <div>
        <h2>Update Package Version</h2>
        <input type="text" ref={packageIdInput} placeholder="Package ID" />
        <input type="text" ref={packageContentInput} placeholder="Package Content" />
        <input type="text" ref={packageURLInput} placeholder="Package URL" />
        <button onClick={updatePackageVersion}>Update Package Version</button>
      </div>

      {/* Package rating */}
      <div>
        <h2>Rate Package</h2>
        <input type="text" ref={packageIdInput} placeholder="Package ID" />
        <input type="text" ref={packageRatingInput} placeholder="Package Rating" />
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
        <input type="text" ref={packageNameInput} placeholder="Package Name" />
        <input type="text" ref={packageVersionInput} placeholder="Package Version" />
        <input type="text" ref={packageContentInput} placeholder="Package Content" />
        <input type="text" ref={packageURLInput} placeholder="Package URL" />
        <button onClick={createPackage}>Create Package</button>
      </div>

      {/* Package retrieval by name */}
      <div>
        <h2>Retrieve Package by Name</h2>
        <input type="text" ref={packageNameInput} placeholder="Package Name" />
        <button onClick={retrievePackageByName}>Retrieve Package</button>
      </div>

      {/* Delete a specific version of a package */}
      <div>
        <h2>Delete a Specific Version of a Package</h2>
        <input type="text" ref={packageIdInput} placeholder="Package ID" />
        <button onClick={deletePackageVersion}>Delete Package Version</button>
      </div>

      {/* Delete all versions of a package by name */}
      <div>
        <h2>Delete All Versions of a Package by Name</h2>
        <input type="text" ref={packageNameInput} placeholder="Package Name" />
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
