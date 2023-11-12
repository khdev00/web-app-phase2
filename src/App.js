import React, { useRef, useState, useEffect } from 'react';
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

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    </div>
  );
}
function App() {
  // Refs and state variables
  const [authToken, setAuthToken] = useState('');
  const [packages, setPackages] = useState([]);
  const [packagesRegex, setPackagesRegex] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [nextTokenRegex, setNextTokenRegex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const packageIdInputForRetrieval = useRef(null);
  const packageIdInputForUpdate = useRef(null);
  const packageIdInputForRating = useRef(null);
  const packageIdInputForCreation = useRef(null);
  const packageIdInputForDeletion = useRef(null);
  const packageNameInputForRetrieval = useRef(null);
  const packageNameRegexInputForRetrieval = useRef(null);
  const packageNameInputForDeletion = useRef(null);
  const packageVersionInput = useRef(null);
  const packageContentInputCreate = useRef(null);
  const packageContentInputIngest = useRef(null);
  const packageContentInputUpdate = useRef(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadUrlTimeout, setDownloadUrlTimeout] = useState(null);
  const packageURLInputCreate = useRef(null);
  const packageURLInputIngest = useRef(null);
  const usernameInput = useRef(null);
  const passwordInput = useRef(null);
  const [currentRegex, setCurrentRegex] = useState('');

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

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
      const response = await API.get('phase2api', `/package/${packageId}`, {
        headers: {
          'Content-Type': 'application/json'
        },
      });
      const responseBody = JSON.parse(response.body);
      setDownloadUrl(responseBody.downloadUrl); // Set the download URL
      const timeout = setTimeout(() => {
        setDownloadUrl('');
      }, 60000); // Clear the download URL after 60 seconds
      console.log(response);
      alert('Package retrieved successfully!');
      setDownloadUrlTimeout(timeout);
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve package.');
    }
  };

  useEffect(() => {
    return () => {
      if (downloadUrlTimeout) {
        clearTimeout(downloadUrlTimeout);
      }
    };
  }, [downloadUrlTimeout]);


  

  // Function to update a package version
  const updatePackageVersion = async () => {
    const packageId = packageIdInputForUpdate.current.value;
    const packageContent = packageContentInputUpdate.current.value;
   
  
    if (!packageId || !packageContent) {
      alert('Please enter all fields.');
      return;
    }
  
    try {
      const body = {
        packageId: packageId,
        packageContent: packageContent
      };
  
      console.log('Request Body:', body);
      const response = await API.put('phase2api', `/package/${packageId}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
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
    const packageContent = packageContentInputIngest.current.value;
    const packageURL = packageURLInputIngest.current.value;
    console.log(packageContent);
    console.log(packageURL);
    if (!packageURL || !packageContent) {
      alert('Please enter all fields.');
      return;
    }

    try {
      const response = await API.put('phase2api', `/package/${packageURL}`, {});
      console.log(response);
      alert('Package ingested successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to ingest package.');
    }
  };

  
 // Function to create a package
const createPackage = async () => {
  const packageName = packageIdInputForCreation.current.value;
  const packageVersion = packageVersionInput.current.value;
  const packageContent = packageContentInputCreate.current.value;
  const packageURL = packageURLInputCreate.current.value;

  if (!packageName || !packageVersion || !packageContent || !packageURL) {
    alert('Please enter all fields.');
    return;
  }

  try {
    const body = {
      packageName: packageName,
      packageVersion: packageVersion,
      packageContent: packageContent,
      packageURL: packageURL,
      packageScore: "0"
    };

    console.log('Request Body:', body);
    const response = await API.post('phase2api', `/package/${packageName}`, {

      headers: {
        'Content-Type': 'application/json'
      },
      
      body: JSON.stringify(body)
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

  const retrievePackageByRegex = async (token = null) => {
    const regexPattern = packageNameRegexInputForRetrieval.current.value;
    if (!regexPattern) {
      alert('Please enter a regex pattern.');
      return;
    }
    
    // Store the current regex pattern
    if (!token) setCurrentRegex(regexPattern);

    try {
      const queryParams = { regex: regexPattern };
      if (token) {
        queryParams.nextToken = token;
      }

      const response = await API.get('phase2api', `/package/byRegEx`, {
        queryStringParameters: queryParams
      });
      const data = response;
      
      console.log(data.items);
      console.log(data.nextToken);

      setPackagesRegex(prevPackages => [...prevPackages, ...data.items]);
      setNextTokenRegex(data.nextToken);
    } catch (error) {
      console.error(error);
      alert('Failed to retrieve packages.');
    }
  };

  // Load more button handler
  const handleLoadMoreRegexPackages = () => {
    retrievePackageByRegex(nextTokenRegex);
  };

  // Function to view packages in the registry 
  const viewPackages = async (token = null) => {

    if (!token) {
      // Clear existing packages when loading packages initially
      setPackages([]);
    }
    try {
      const response = await API.get('phase2api', '/view', {
        queryStringParameters: { nextToken: token }
      });
      const data = JSON.parse(response.body);
      setPackages(prevPackages => [...prevPackages, ...data.items]);
      setNextToken(data.nextToken);
      console.log(data.nextToken);
    } catch (error) {
      console.error('Error fetching packages:', error);
      alert('Failed to retrieve packages.');
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

       {/* Download Button */}
       {downloadUrl && (
        <div>
          <h2>Download Package</h2>
          <a href={downloadUrl} download>
            <button>Download</button>
          </a>
        </div>
      )}

     
       {/* Button to open the modal */}
        <h2>View Registry</h2>
      <button onClick={toggleModal}>View Registry</button>

      {/* Modal for viewing packages */}
      <Modal isOpen={isModalOpen} onClose={toggleModal}>
        <h2>Registry</h2>
        <button onClick={() => viewPackages()}>Load Packages</button>
        <div>
          {packages.map((pkg, index) => (
            <div key={index}>
              {/* Render package details */}
              <p>Package ID: {pkg.packageName}</p>
              <p>Version: {pkg.Version}</p>
              <p>URL: {pkg.URL}</p>
              <p>Metric Score: {pkg.MetricScore}</p>
            </div>
          ))}
          {nextToken && (
            <button onClick={() => viewPackages(nextToken)}>Load More</button>
          )}
        </div>
      </Modal>


      {/* Package version update */}
      <div>
        <h2>Update Package</h2>
        <input type="text" ref={packageIdInputForUpdate} placeholder="Package ID" />
        <input type="text" ref={packageContentInputUpdate} placeholder="Package Content" />
        <button onClick={updatePackageVersion}>Update Package Content</button>
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
        <input type="text" ref={packageContentInputIngest} placeholder="Package Content" />
        <input type="text" ref={packageURLInputIngest} placeholder="Package URL" />
        <button onClick={ingestPackage}>Ingest Package</button>
      </div>

      {/* Package creation */}
      <div>
        <h2>Create Package</h2>
        <input type="text" ref={packageIdInputForCreation} placeholder="Package Name" />
        <input type="text" ref={packageVersionInput} placeholder="Package Version" />
        <input type="text" ref={packageContentInputCreate} placeholder="Package Content" />
        <input type="text" ref={packageURLInputCreate} placeholder="Package URL" />
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
        <button onClick={() => retrievePackageByRegex()}>Retrieve Package</button>
      </div>

      {/* Display Regex Search Results */}
      <div>
        <h2>Regex Search Results</h2>
        {packagesRegex.map((pkg, index) => (
          <div key={index}>
            <p>Package Name: {pkg.packageName}</p>
            <p>Version: {pkg.Version}</p>
            <p>URL: {pkg.URL}</p>
            <p>Metric Score: {pkg.MetricScore}</p>
          </div>
        ))}
        {nextTokenRegex && (
          <button onClick={() => retrievePackageByRegex(nextTokenRegex)}>Load More</button>
        )}
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
