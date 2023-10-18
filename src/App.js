import React, { useRef } from 'react';
import './App.css';

function App() {
  const urlInput = useRef(null);
  const packageLinkInput = useRef(null);
  const updateUrlInput = useRef(null);

  // Package processing functions
  const downloadPackages = () => {
    const urls = urlInput.current.value.split('\n').filter(url => url.trim());
    if (!urls.length) {
      alert("Please enter valid URLs.");
      return;
    }
    
  };

  const updatePackage = () => {
    const urls = updateUrlInput.current.value.split('\n').filter(url => url.trim());
    if (!urls.length) {
      alert("Please enter valid URLs.");
      return;
    }
    
  };

  const gradePackages = () => {
   
  };

  const addPackageToRegistry = () => {
    const packageLink = packageLinkInput.current.value.trim();
    if (!packageLink) {
      alert("Please provide the npm/github link for your package.");
      return;
    }

    const confirmation = window.confirm("The package must first be graded and receive a score higher than 0.5 before it is allowed to be added to the package registry. Do you want to proceed?");
    if (confirmation) {
     
    }
  };

  // Registry management functions
  const viewRegistry = () => {
    console.log("Fetching and displaying the package registry...");
   
  };

  const deleteRegistry = () => {
    const confirmation = window.confirm("Are you sure you want to delete the package registry?");
    if (confirmation) {
      console.log("Deleting the package registry...");
      
    }
  };

  const deletePackage = () => { 
    const packageLink = packageLinkInput.current.value.trim();
    if (!packageLink) {
      alert("Please provide the npm/github link for the package you want to delete.");
      return;
    }

    const confirmation = window.confirm("Are you sure you want to delete this package?");
    if (confirmation) {
      console.log("Deleting the package from the registry...");
    }
  };
  
  // JSX rendering
  return (
    <div className="App">
        <h2>Process NPM Packages</h2>
        <label htmlFor="urlInput">Enter valid NPM/GITHUB url(s) separated by newline</label><br />
        <textarea className="left textbox-width-large" ref={urlInput} id="urlInput" rows="5"></textarea><br />
        <button className="button-spacing" onClick={downloadPackages}>Download Packages</button>
        <button className="button-spacing" onClick={gradePackages}>Grade Packages</button>

        <h2>Add Package to Registry</h2>
        <label htmlFor="packageLinkAdd">Enter NPM/GITHUB url for your package</label><br />
        <input className="textbox-width-large" type="text" ref={packageLinkInput} id="packageLinkAdd" placeholder="Enter npm/github link for your package" /><br />
        <button className="left" onClick={addPackageToRegistry}>Add to Registry</button>

        <h2>Package Registry Settings</h2>
        <button className="button-spacing" onClick={viewRegistry}>View Registry</button>
        <button className="button-spacing" onClick={deleteRegistry}>Delete Registry</button>

        <div>
          <h3>Update Package</h3>
          <label htmlFor="urlInputUpdate">Enter package NPM/GITHUB url to update</label><br />
          <textarea className="left textbox-width-large" ref={updateUrlInput} id="urlInputUpdate" rows="1"></textarea><br />
          <button onClick={updatePackage}>Update Package</button>
        </div> 

        <h4>Delete Package in Registry</h4>
        <label htmlFor="packageLinkDelete">Enter package NPM/GITHUB url to delete</label><br />
        <input className="textbox-width-medium" type="text" ref={packageLinkInput} id="packageLinkDelete" placeholder="Enter npm/github link for your package" /><br />
        <button className="left" onClick={deletePackage}>Delete Package</button>
    </div>
  );
}

export default App;
