import React, { useState, useRef, useEffect } from 'react'
import { BrowserChrome, Sidebar, MascotBadge } from '../components/ui.jsx'
import Icon from '../icons.jsx'
import Home from '../screens/Home.jsx'
import Searching from '../screens/Searching.jsx'
import RouteResults from '../screens/RouteResults.jsx'
import HeatMap, { Head } from '../screens/HeatMap.jsx'
import CoolSpots from '../screens/CoolSpots.jsx'
import Impact from '../screens/Impact.jsx'
import { conditions as C } from '../data.js'

/* Browser-framed desktop prototype with sidebar nav. */
export default function DesktopApp() {
  const [view, setView] = useState('home') // home|searching|routes|heatmap|coolspots|impact
  const [route, setRoute] = useState('coolest')
  const [radius, setRadius] = useState(1)
  const timer = useRef(null)

  const go = (v) => setView(v)
  const search = () => {
    setView('searching')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setView('routes'), 1700)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const dark = view === 'heatmap' || view === 'impact'
  const navActive = view === 'searching' ? 'home' : view
  const path = view === 'home' ? '' : (view === 'routes' || view === 'searching') ? '/routes' : `/${view}`

  return (
    <div className="browser">
      <BrowserChrome path={path} />
      <div className="browser-body">
        <Sidebar active={navActive} onNav={go} />
        <div className={`view${dark ? ' dark' : ''}`}>

          {view === 'home' && (
            <>
              <div className="view-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="pin" size={17} stroke="#1C7C4A" width={2.2} />
                  <span style={{ font: "700 16px 'Bricolage Grotesque'" }}>{C.location}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>· {C.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button onClick={search} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 14px', width: 300, textAlign: 'left' }}>
                    <Icon name="search" size={17} stroke="#6B7A70" />
                    <span style={{ color: '#9aa89d', fontSize: 14 }}>Search a destination…</span>
                  </button>
                  <MascotBadge state="blink" size={42} />
                </div>
              </div>
              <Home layout="desktop" onSearch={search} onCoolspots={() => go('coolspots')} />
            </>
          )}

          {view === 'searching' && <Searching layout="desktop" />}

          {view === 'routes' && (
            <RouteResults layout="desktop" selected={route} onSelect={setRoute} onBack={() => go('home')} onStart={() => go('impact')} />
          )}

          {view === 'heatmap' && <HeatMap layout="desktop" onPlan={() => go('home')} />}

          {view === 'coolspots' && (
            <>
              <div className="view-head">
                <div style={{ font: "700 18px 'Bricolage Grotesque'" }}>Cool spots near you</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: 100, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#445349' }}>Radius: {radius >= 3 ? '3 km' : '1 km'}</div>
              </div>
              <CoolSpots layout="desktop" radius={radius} onWiden={() => setRadius(3)} onHome={() => go('home')} />
            </>
          )}

          {view === 'impact' && (
            <>
              <Head dark title="Your impact" badge={<MascotBadge state="blink" size={42} variant="dark" />} />
              <Impact layout="desktop" />
            </>
          )}

        </div>
      </div>
    </div>
  )
}
