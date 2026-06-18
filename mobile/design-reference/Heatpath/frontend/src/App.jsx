import React, { useState } from 'react'
import MobileApp from './apps/MobileApp.jsx'
import DesktopApp from './apps/DesktopApp.jsx'
import { Logo } from './components/ui.jsx'

/* Top-level: switch between the two prototypes.
   In a real product you'd route these (or render responsively);
   the switcher keeps both viewable from one entry point. */
export default function App() {
  const [mode, setMode] = useState('mobile')
  return (
    <div className="app-shell">
      <div className="mode-bar">
        <span className="brand"><Logo /> HeatPath</span>
        <div className="seg">
          <button className={mode === 'mobile' ? 'on' : ''} onClick={() => setMode('mobile')}>Mobile app</button>
          <button className={mode === 'desktop' ? 'on' : ''} onClick={() => setMode('desktop')}>Desktop web</button>
        </div>
      </div>
      {mode === 'mobile' ? <MobileApp /> : <DesktopApp />}
    </div>
  )
}
