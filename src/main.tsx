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

// Note: Do not wrap in React.StrictMode so VideoPlayer does not open
// duplicate simultaneous stream connections to Xtream Codes servers (max_connections=1).
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
