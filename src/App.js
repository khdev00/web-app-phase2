import React, { useRef } from 'react';
import './App.css';

function App() {
  const urlFileInput = useRef(null);
  const packageLinkInput = useRef(null);
  const API_ENDPOINT = "https://your-api-id.execute-api.region.amazonaws.com/yourStage";

  // Lambda communication
  const sendToLambda = (data, path) => {
    fetch(`${API_ENDPOINT}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => console.log('Success:', data))
    .catch(error => console.error('Error:', error));
  };

  // Package processing functions
  const downloadPackages = () => {
    const file = urlFileInput.current.files[0];
    if (!file) {
      alert("Please upload a text file with URLs.");
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const urls = event.target.result.split('\n').filter(url => url.trim());
      sendToLambda({ urls }, "downloadPackages");
    };
    reader.readAsText(file);
  };

  const gradePackages = () => {
    // Similar logic to downloadPackages
  };

  const addPackageToRegistry = () => {
    const packageLink = packageLinkInput.current.value.trim();
    if (!packageLink) {
      alert("Please provide the npm/github link for your package.");
      return;
    }

    const confirmation = window.confirm("The package must first be graded and receive a score higher than 0.5 before it is allowed to be added to the package registry. Do you want to proceed?");
    if (confirmation) {
      sendToLambda({ packageLink }, "addPackageToRegistry");
    }
  };

  // Registry management functions
  const viewRegistry = () => {
    console.log("Fetching and displaying the package registry...");
    // TODO: Add your API call and display logic here
  };

  const deleteRegistry = () => {
    const confirmation = window.confirm("Are you sure you want to delete the package registry?");
    if (confirmation) {
      console.log("Deleting the package registry...");
      // TODO: Add your API call to delete the registry data here
    }
  };

  // JSX rendering
  return (
    <div className="App">
        <h2>Process NPM Packages</h2>
        
        <label htmlFor="urlFileInput">Upload a text file with valid npm/github links separated by newline:</label>
        
            <input className = "left" input type="file" ref={urlFileInput} id="urlFileInput" accept=".txt" />
        
        <div>
            <button className = "button-spacing" button onClick={downloadPackages}>Download Packages</button>
            <button className = "button-spacing" button onClick={gradePackages}>Grade Packages</button>
        </div>

        <h2>Add a Package to Registry</h2>
        
        <input className = "textbox-width" input type="text" ref={packageLinkInput} id="packageLink" placeholder="Enter npm/github link for your package" />
        <button className = "left" button onClick={addPackageToRegistry}>Add to Registry</button>
       

        <h2>Package Registry</h2>
        <button className = "button-spacing" button onClick={viewRegistry}>View Registry</button>
        <button className = "button-spacing" button onClick={deleteRegistry}>Delete Registry</button>
    </div>
  );
}

export default App;
