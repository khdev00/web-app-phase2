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

  const [popularityData, setPopularityData] = useState({
    weeklyDownloads: 0,
    githubStars: 0,
    popularityScore: "TBD" // Placeholder for now
  });
  const [isPopularityDataAvailable, setIsPopularityDataAvailable] = useState(false);

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
  const packageURLInputPopularity = useRef(null);
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

    try{
      const response = await API.put('phase2api', '/authenticate', {
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      });
      
      globalAuth = response;
      alert("Token Generated!");
    }catch(err){
      console.error(err);
      alert("Authentication Failed");
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

  function calculatePopularityRating(weeklyDownloads, githubStars) {
    // Define the maximum expected values for normalization
    const maxDownloads = 500000000; // 500 million for downloads
    const maxStars = 500000; // Max stars
  
    // Normalize the metrics to a 0-1 scale
    const normalizedDownloads = Math.log10(weeklyDownloads + 1) / Math.log10(maxDownloads + 1);
    const normalizedStars = Math.log10(githubStars + 1) / Math.log10(maxStars + 1);
  
    // Average the normalized values
    const combinedScore = (normalizedDownloads + normalizedStars) / 2;
  
    // Scale to 0-5 range
    const score = combinedScore * 5;
    return parseFloat(score.toFixed(2));
  }
  
  
  // Function to retrieve popularity rating
  const retrievePopularityRating = async () => {
    const packageURL = packageURLInputPopularity.current.value;
  
    if (!packageURL) {
      alert('Please enter the npmjs package URL.');
      return;
    }
  
    try {
      const queryParams = { url: packageURL }; 
      const response = await API.get('phase2api', '/popularity', {
        queryStringParameters: queryParams
      });
   
      // Directly access response data without JSON.parse
      console.log('Response:', response);
      const responseData = response;
      const weeklyDownloads = responseData.popularityRating.weeklyDownloads;
      const githubStars = responseData.popularityRating.githubStars;
    
      setPopularityData({
        weeklyDownloads: weeklyDownloads.toLocaleString(),
        githubStars: githubStars.toLocaleString(),
        popularityScore: calculatePopularityRating(weeklyDownloads, githubStars)
      });
      setIsPopularityDataAvailable(true);
      alert('Popularity rating retrieved successfully!');
  
    } catch (error) {
      console.error('Error retrieving popularity rating:', error);
      alert('Failed to retrieve popularity rating.');
    }
  };
  

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

const createingest = async () => {
  const packageContent = packageContentInputCreate.current.value;
  const packageURL = packageURLInputCreate.current.value;

  if ((packageContent && packageURL) || (!packageContent && !packageURL)) {
    alert('Please provide either package content or a package URL, but not both.');
    return;
  }

  let body = {};
  let action = '';

  if (packageContent) {
    body = { packageContent };
    action = 'Creating Package';
  } else if (packageURL) {
    body = { packageURL };
    action = 'Ingesting Package';
  }

  alert(action);

  try {
    console.log('Request Body:', body);
    const response = await API.post('phase2api', `/package`, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth token here if required
      },
      body: JSON.stringify(body)
    });

    console.log(response);
    alert(`${action} successful!`);
  } catch (error) {
    console.error(error);
    alert(`Failed to ${action.toLowerCase()}.`);
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
  
    if (!token) {
        setCurrentRegex(regexPattern);
        setPackagesRegex([]); // Reset the list if it's a new search
    }
  
    try {
        const queryParams = { regex: regexPattern };
        if (token) {
            queryParams.nextToken = token;
        }
  
        const response = await API.get('phase2api', `/package/byRegEx`, {
            queryStringParameters: queryParams
        });
        const data = response; 
        const newPackages = data.items || []; // Extract items from the response
        
        // Append only new packages to the existing list
        setPackagesRegex(prevPackages => {
            const existingPackageIds = new Set(prevPackages.map(pkg => pkg.ID));
            const uniqueNewPackages = newPackages.filter(pkg => !existingPackageIds.has(pkg.ID));
            return [...prevPackages, ...uniqueNewPackages];
        });

        // Update nextToken for pagination
        setNextTokenRegex(data.nextToken);
        console.log('nextToken:', data.nextToken);
    } catch (error) {
        console.error(error);
        alert('Failed to retrieve packages. Error: ' + error.response);
    }
};


  
  


  // Load more button handler
  const handleLoadMoreRegexPackages = () => {
    retrievePackageByRegex(nextTokenRegex);
  };

  // Function to view packages in the registry 
  const viewPackages = async (token = null) => {
    // Check if the token is provided, if not, reset packages array
    if (token === null) {
      setPackages([]);
    }
  
    try {
      const response = await API.get('phase2api', '/view', {
        queryStringParameters: { nextToken: token }
      });
      const data = JSON.parse(response.body);
      const packagesData = Array.isArray(data) ? data : data.items;
      const newNextToken = data.nextToken;
      console.log('Packages:', packagesData);
      console.log('Next Token:', newNextToken);
  
      // Append new data to existing packages
      setPackages(prevPackages => [...prevPackages, ...packagesData]);
      // Update the nextToken
      setNextToken(newNextToken);
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
    alert('Resetting registry.')
    try {
      const response = await API.del('phase2api', '/reset', {
        headers: {
          'X-Authorization': globalAuth
        },
      });
      console.log(response);
      alert('Registry reset success!')
    } catch (error) {
      console.error(error);
      alert('Registry reset failed.');
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
            <h2 id="auth-token-section">Create Authentication Token</h2>
            <fieldset>
              <legend>Authentication Token</legend>
              <label htmlFor="username">Username: </label>
              <input type="text" ref={usernameInput} id="username" placeholder="Username" />
        
              <label htmlFor="password">Password: </label>
              <input type="password" ref={passwordInput} id="password" placeholder="Password" />
        
              <label htmlFor="isAdmin">Admin Status (true/false): </label>
              <input className="textbox-width-medium" type="text" ref={isAdminInput} id="isAdmin" placeholder="Admin Status - true or false" />

              <button onClick={createAuthToken}>Create Auth Token</button>
            </fieldset>
          </section> 
        

        {/* Popularity Rating Section */}
        <section aria-labelledby="popularity-rating-section">
          <fieldset>
            <legend>Retrieve Popularity Rating</legend>
            <h2 id="popularity-rating-section">Retrieve Popularity Rating</h2>
            <label htmlFor="packageURL">npmjs Package URL: </label>
            <input type="text" ref={packageURLInputPopularity} id="packageURL" placeholder="npmjs Package URL" />
            <button onClick={retrievePopularityRating}>Get Popularity Rating</button>
          </fieldset>
        </section>

         {/* Popularity Rating Display Section */}
      {isPopularityDataAvailable && (
        <section aria-labelledby="popularity-display-section">
          <fieldset>
            <legend>Popularity Rating Results</legend>
            <h2 id="popularity-display-section">Popularity Rating</h2>
            <p>Weekly Downloads: {popularityData.weeklyDownloads}</p>
            <p>GitHub Stars: {popularityData.githubStars}</p>
            <p>Popularity Score: {popularityData.popularityScore}/5</p>
          </fieldset>
        </section>
      )}


        {/* Package retrieval by ID */}
        <section aria-labelledby="retrieve-by-id-section"> 
        <fieldset> 
            <legend>Retrieve Package by ID</legend>
            <h2 id="retrieve-by-id-section">Retrieve Package by ID</h2>
            <label htmlFor="retrievePackageId">Package ID: </label>
            <input type="text" ref={packageIdInputForRetrieval} id="retrievePackageId" placeholder="Package ID" />
            <button onClick={retrievePackageById}>Retrieve Package</button>
        </fieldset>
        </section> 
    
        {/* Download Button */}
        {downloadUrl && (
          <section aria-labelledby="download-package-section">
          <fieldset>
            <legend>Download Package</legend>
            <h2 id="download-package-section">Download Package</h2>
            <a href={downloadUrl} download>
              <button>Download</button>
            </a>
          </fieldset>
          </section>
        )}
    
        {/* Button to open the modal */}
        <section aria-labelledby="view-registry-section">
        <fieldset>
          <legend>View Registry</legend>
          <h2 id="view-registry-section">View Registry</h2>
          <button ref={modalOpenerRef} onClick={toggleModal}>View Registry</button>

            {/* Modal for viewing packages */}
            <Modal isOpen={isModalOpen} onClose={toggleModal} openerRef={modalOpenerRef}>
            <h2>Registry</h2>
            <button onClick={() => viewPackages()}>Load Packages</button>
            <div className="package-grid-container">
            {packages.map((pkg, index) => (
              <section className="package-section" key={index}>
                <h3 className="package-section-header">Package Name: {pkg.Name}</h3>
                <p className="package-details">Package ID: {pkg.ID}</p>
                <p className="package-details">Version: {pkg.Version}</p>
              </section>
            ))}
            </div>
            {nextToken && (
              <button onClick={() => viewPackages(nextToken)}>Load More</button>
            )}
          </Modal>
        </fieldset>
        </section>
    
        {/* Package version update */}
        <section aria-labelledby='update-package-section'>
          <fieldset>
            <legend>Update Package</legend>
            <h2 id="update-package-section">Update Package</h2>
            <label htmlFor="updatePackageId">Package ID: </label>
            <input type="text" ref={packageIdInputForUpdate} id="updatePackageId" placeholder="Package ID" />
      
            <label htmlFor="updatePackageContent">Package Content: </label>
            <input type="text" ref={packageContentInputUpdate} id="updatePackageContent" placeholder="Package Content" />
      
            <button onClick={updatePackageVersion}>Update Package Content</button>
          </fieldset>
        </section>
    
        {/* Package rating */}
        <section aria-labelledby="package-rating-section">
          <fieldset>
            <legend>Rate Package</legend>
            <h2 id="package-rating-section">Rate Package</h2>
            <label htmlFor="ratePackageId">Package ID: </label>
            <input type="text" ref={packageIdInputForRating} id="ratePackageId" placeholder="Package ID" />
            <button onClick={ratePackage}>Rate Package</button>
          </fieldset>
        </section>
    
        {/* Package ingestion */}
        {/*
        <section aria-labelledby="package-ingestion-section">
          <fieldset>
            <legend>Ingest Package</legend>
            <h2 id="package-ingestion-section">Ingest Package</h2>
            <label htmlFor="ingestPackageContent">Package Content: </label>
            <input type="text" ref={packageContentInputIngest} id="ingestPackageContent" placeholder="Package Content" />
      
            <label htmlFor="ingestPackageURL">Package URL: </label>
            <input type="text" ref={packageURLInputIngest} id="ingestPackageURL" placeholder="Package URL" />
            <button onClick={ingestPackage}>Ingest Package</button>
          </fieldset>
        </section>
            */}
        {/* Package creation */}
        <section aria-labelledby="package-creation-ingest-section">
          <fieldset>
            <legend>Upload/Ingest Package</legend>
            <h2 id="package-creation-section">Upload Package</h2>
            
            <label htmlFor="createPackageContent">Package Content: </label>
            <input type="text" ref={packageContentInputCreate} id="createPackageContent" placeholder="Package Content" />
      
            <label htmlFor="createPackageURL">Package URL: </label>
            <input type="text" ref={packageURLInputCreate} id="createPackageURL" placeholder="Package URL" />
      
            <button onClick={createingest}>Create/Ingest Package</button>
          </fieldset>
        </section>
    
        {/* Package retrieval by name */}
        <section aria-labelledby="retrieve-by-name-section">
          <fieldset> 
            <legend>Retrieve Package by Name</legend>
            <h2 id="retrieve-by-name-section">Retrieve Package by Name</h2>
            <label htmlFor="retrieveByName">Package Name: </label>
            <input type="text" ref={packageNameInputForRetrieval} id="retrieveByName" placeholder="Package Name" />
            <button onClick={retrievePackageByName}>Retrieve Package</button>
          </fieldset>
        </section>
    
        {/* Package retrieval by Regex */}
        <section aria-labelledby="retrieve-by-regex">
          <fieldset>
            <legend>Retrieve Package by Regex</legend>
            <h2 id="retrieve-by-regex">Retrieve Package by Regex</h2>
            <label htmlFor="retrieveByRegex">Package Name Regex: </label>
            <input type="text" ref={packageNameRegexInputForRetrieval} id="retrieveByRegex" placeholder="Package Name Regex" />
            <button onClick={() => retrievePackageByRegex()}>Retrieve Package</button>
          </fieldset>
        </section>
    
        {/* Display Regex Search Results */}
        <section aria-labelledby="regex-search-result-section">
          <fieldset>
            <legend>Regex Search Results</legend>
            <h2 id="regex-search-result-section">Regex Search Results</h2>
            {packagesRegex.map((pkg, index) => (
              <section key={index}>
                <p>Package Name: {pkg.Name}</p>
                <p>Version: {pkg.Version}</p>
              </section>
            ))}
            {nextTokenRegex && (
            <button onClick={() => retrievePackageByRegex(nextTokenRegex)}>Load More</button>
            )}
          </fieldset>
        </section>

    
        {/* Delete a specific version of a package */}
        <section aria-labelledby="delete-version-section">
          <fieldset>
            <legend>Delete a Specific Version of a Package</legend>
            <h2 id="delete-version-section">Delete a Specific Version of a Package</h2>
            <label htmlFor="deletePackageId">Package ID: </label>
            <input type="text" ref={packageIdInputForDeletion} id="deletePackageId" placeholder="Package ID" />
            <button onClick={deletePackageVersion}>Delete Package Version</button>
          </fieldset>
        </section>
    
        {/* Delete all versions of a package by name */}
        <section aria-labelledby="delete-all-section">
          <fieldset>
            <legend>Delete All Versions of a Package by Name</legend>
            <h2 id="delete-all-section">Delete All Versions of a Package by Name</h2>
            <label htmlFor="deleteAllByName">Package Name: </label>
            <input type="text" ref={packageNameInputForDeletion} id="deleteAllByName" placeholder="Package Name" />
            <button onClick={deleteAllVersionsOfPackage}>Delete All Versions</button>
          </fieldset>
        </section>
    
        {/* Registry reset */}
        <section aria-labelledby="reset-section">
          <fieldset> 
            <legend>Reset Registry</legend>
            <h2 id="reset-section">Reset Registry</h2>
            <button onClick={resetRegistry}>Reset Registry</button>
          </fieldset>
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
