import React from 'react';
import ReactDOM from 'react-dom/client';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import { App } from './App';
import './index.css';

// Initialize Norigin Spatial Navigation for LG webOS D-Pad / Magic Remote
init({
  debug: false,
  visualDebug: false,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
