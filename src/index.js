import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Amplify } from 'aws-amplify'; // Corrected import statement
import awsmobile from "./aws-exports";

// Configure Amplify with the settings from aws-exports.js
Amplify.configure({
  ...awsmobile,
  Storage: {
    region: awsmobile.aws_user_files_s3_bucket_region,
    bucket: awsmobile.aws_user_files_s3_bucket,
    identityPoolId: awsmobile.aws_cognito_identity_pool_id,
    level: "protected",
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
