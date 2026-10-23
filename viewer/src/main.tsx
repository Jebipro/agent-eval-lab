import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './style.css';
createRoot(document.getElementById('root')!, {
  // The result boundary renders a static recovery message. Never log caught report errors.
  onCaughtError: () => {}
}).render(<StrictMode><App /></StrictMode>);
