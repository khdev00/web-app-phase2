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
 


function Modal({ isOpen, onClose, children, openerRef }) {
  useEffect(() => {
    if (isOpen) {
      // Set focus to the first focusable element in the modal
      document.querySelector(".modal-content button").focus();
    } else {
      // Return focus to the element that opened the modal
      if (openerRef && openerRef.current) {
        openerRef.current.focus();
      }
    }
  }, [isOpen, openerRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);

    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  

  return (
    <section className="modal">
      <section className="modal-content">
        <button onClick={onClose}>Close</button>
        {children}
      </section>
    </section>
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
  const modalOpenerRef = useRef(null); // Define the ref
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
  const isAdminInput = useRef(null);
  const [currentRegex, setCurrentRegex] = useState('');

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  let globalAuth = null;
  // Function to create an authentication token
  const createAuthToken = async () => {
    const username = usernameInput.current.value;
    const password = passwordInput.current.value;
    const isAdmin = isAdminInput.current.value;
    if (!username || !password || !isAdmin) {
      alert('Please enter a username, password, and admin status');
      return;
    }

    if(isAdmin.toLowerCase() !== "true" && isAdmin.toLowerCase() !== "false"){
      alert('Please enter valid admin status: true or false');
      return;
    }

    const body = {
      User: {
        name: username,
        isAdmin: isAdmin
      },
      Secret: {
        password: password
      }
    }

    console.log('Request Body:', body);
    const response = await API.put('phase2api', '/authenticate', {
      headers: {
        'Content-Type': 'application/json'
        },
      body: JSON.stringify(body)
    }); 
    console.log(response);

    if(response.statusCode === 200){
      const responseBody = JSON.parse(response.body);
      if(responseBody){
        globalAuth = responseBody;
      }
      else{
        console.error('Authentication token not found in the response body.');
      }
    }

  };

  // Function to retrieve a package by ID
  const retrievePackageById = async () => {
    const packageId = packageIdInputForRetrieval.current.value;
    
    if (!packageId) {
      alert('Please enter a Package ID.');
      return;
    }
    console.log(packageId);

    if (packageId.length > 50) {
      alert('Entered ID is too large. Please view the registry to find the package ID.');
      return;
    }

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
      if (response.statusCode === 200) {
        alert('Package retrieved successfully!');
        setDownloadUrlTimeout(timeout);
      } else if (response.statusCode === 404) {
        alert('Package does not exist.');
      } else if (response.statusCode === 500) {
        alert('Failed to retrieve package in database');
      } else if (response.statusCode === 400) {
        alert('There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.');
      }
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
   
  
    if (!packageId || !packageContent ) {
      alert('Please enter all fields.');
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
      <header> 
        <h1>Package Management System</h1>
      </header>
      
      <main>
          {/* Authentication token creation */}
          <section aria-labelledby="auth-token-section">
            <h2>Create Authentication Token</h2>
            <label htmlFor="username">Username: </label>
            <input type="text" ref={usernameInput} id="username" placeholder="Username" />
      
            <label htmlFor="password">Password: </label>
            <input type="password" ref={passwordInput} id="password" placeholder="Password" />
      
            <label htmlFor="isAdmin">Admin Status (true/false): </label>
            <input className="textbox-width-medium" type="text" ref={isAdminInput} id="isAdmin" placeholder="Admin Status - true or false" />
      
            <button onClick={createAuthToken}>Create Auth Token</button>
          </section> 
        
    
        {/* Package retrieval by ID */}
        <section aria-labelledby='retrieve-by-id-section'> 
          <h2>Retrieve Package by ID</h2>
          <label htmlFor="retrievePackageId">Package ID: </label>
          <input type="text" ref={packageIdInputForRetrieval} id="retrievePackageId" placeholder="Package ID" />
          <button onClick={retrievePackageById}>Retrieve Package</button>
        </section> 
    
        {/* Download Button */}
        {downloadUrl && (
          <section aria-labelledby="download-package-section">
            <h2>Download Package</h2>
            <a href={downloadUrl} download>
              <button>Download</button>
            </a>
          </section>
        )}
    
        {/* Button to open the modal */}
        <section aria-labelledby="view-registry-section">
          <h2>View Registry</h2>
          <button ref={modalOpenerRef} onClick={toggleModal}>View Registry</button>
      
          {/* Modal for viewing packages */}
          <Modal isOpen={isModalOpen} onClose={toggleModal} openerRef={modalOpenerRef}>
            <h2>Registry</h2>
            <button onClick={() => viewPackages()}>Load Packages</button>
            <section> 
              {packages.map((pkg, index) => (
                <section key={index}>
                  {/* Render package details */}
                  <p>Package Name: {pkg.packageName}</p>
                  <p>Package ID: {pkg.pkgID}</p>
                  <p>Version: {pkg.Version}</p>
                  <p>URL: {pkg.URL}</p>
                  <p>Metric Score: {pkg.MetricScore}</p>
                </section>
              ))}
              {nextToken && (
                <button onClick={() => viewPackages(nextToken)}>Load More</button>
              )}
            </section>
          </Modal>
        </section>
    
        {/* Package version update */}
        <section>
          <h2>Update Package</h2>
          <label htmlFor="updatePackageId">Package ID: </label>
          <input type="text" ref={packageIdInputForUpdate} id="updatePackageId" placeholder="Package ID" />
    
          <label htmlFor="updatePackageContent">Package Content: </label>
          <input type="text" ref={packageContentInputUpdate} id="updatePackageContent" placeholder="Package Content" />
    
          <button onClick={updatePackageVersion}>Update Package Content</button>
        </section>
    
        {/* Package rating */}
        <section>
          <h2>Rate Package</h2>
          <label htmlFor="ratePackageId">Package ID: </label>
          <input type="text" ref={packageIdInputForRating} id="ratePackageId" placeholder="Package ID" />
          <button onClick={ratePackage}>Rate Package</button>
        </section>
    
        {/* Package ingestion */}
        <section>
          <h2>Ingest Package</h2>
          <label htmlFor="ingestPackageContent">Package Content: </label>
          <input type="text" ref={packageContentInputIngest} id="ingestPackageContent" placeholder="Package Content" />
    
          <label htmlFor="ingestPackageURL">Package URL: </label>
          <input type="text" ref={packageURLInputIngest} id="ingestPackageURL" placeholder="Package URL" />
          <button onClick={ingestPackage}>Ingest Package</button>
        </section>
    
        {/* Package creation */}
        <section>
          <h2>Create Package</h2>
          <label htmlFor="createPackageName">Package Name: </label>
          <input type="text" ref={packageIdInputForCreation} id="createPackageName" placeholder="Package Name" />
    
          <label htmlFor="createPackageVersion">Package Version: </label>
          <input type="text" ref={packageVersionInput} id="createPackageVersion" placeholder="Package Version" />
    
          <label htmlFor="createPackageContent">Package Content: </label>
          <input type="text" ref={packageContentInputCreate} id="createPackageContent" placeholder="Package Content" />
    
          <label htmlFor="createPackageURL">Package URL: </label>
          <input type="text" ref={packageURLInputCreate} id="createPackageURL" placeholder="Package URL" />
    
          <button onClick={createPackage}>Create Package</button>
        </section>
    
        {/* Package retrieval by name */}
        <section>
          <h2>Retrieve Package by Name</h2>
          <label htmlFor="retrieveByName">Package Name: </label>
          <input type="text" ref={packageNameInputForRetrieval} id="retrieveByName" placeholder="Package Name" />
          <button onClick={retrievePackageByName}>Retrieve Package</button>
        </section>
    
        {/* Package retrieval by Regex */}
        <section>
          <h2>Retrieve Package by Regex</h2>
          <label htmlFor="retrieveByRegex">Package Name Regex: </label>
          <input type="text" ref={packageNameRegexInputForRetrieval} id="retrieveByRegex" placeholder="Package Name Regex" />
          <button onClick={() => retrievePackageByRegex()}>Retrieve Package</button>
        </section>
    
        {/* Display Regex Search Results */}
        <section>
          <h2>Regex Search Results</h2>
          {packagesRegex.map((pkg, index) => (
            <section key={index}>
              <p>Package Name: {pkg.packageName}</p>
              <p>Package ID: {pkg.pkgID}</p>
              <p>Version: {pkg.Version}</p>
              <p>URL: {pkg.URL}</p>
              <p>Metric Score: {pkg.MetricScore}</p>
            </section>
          ))}
          {nextTokenRegex && (
            <button onClick={() => retrievePackageByRegex(nextTokenRegex)}>Load More</button>
          )}
        </section>
    
        {/* Delete a specific version of a package */}
        <section>
          <h2>Delete a Specific Version of a Package</h2>
          <label htmlFor="deletePackageId">Package ID: </label>
          <input type="text" ref={packageIdInputForDeletion} id="deletePackageId" placeholder="Package ID" />
          <button onClick={deletePackageVersion}>Delete Package Version</button>
        </section>
    
        {/* Delete all versions of a package by name */}
        <section>
          <h2>Delete All Versions of a Package by Name</h2>
          <label htmlFor="deleteAllByName">Package Name: </label>
          <input type="text" ref={packageNameInputForDeletion} id="deleteAllByName" placeholder="Package Name" />
          <button onClick={deleteAllVersionsOfPackage}>Delete All Versions</button>
        </section>
    
        {/* Registry reset */}
        <section>
          <h2>Reset Registry</h2>
          <button onClick={resetRegistry}>Reset Registry</button>
        </section>
      </main>
      
      <footer>
        <p>2023 Package Management System</p>
      </footer> 

      <noscript>
        <p>This page requires JavaScript to be enabled.</p>
      </noscript>
    </div>
  );
}

export default App;
