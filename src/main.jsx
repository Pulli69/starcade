import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Web3Provider } from './context/Web3Context.jsx'

// Pre-check if local custom music assets exist
window.hasLocalMusic = false;

fetch('/assets/arcade_music.mp3', { method: 'HEAD' })
  .then(res => { window.hasLocalMusic = res.ok; })
  .catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>,
)
