import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

window.onerror = function(message, source, lineno, colno, error) {
  alert("JS Error: " + message + " at " + source + ":" + lineno);
  return false;
};

const rootElement = document.getElementById('root');
console.log("Mounting React app to root element", rootElement);
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);