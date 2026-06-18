import React, { useState, useRef, useEffect } from 'react'
import { StatusBar, MascotBadge, TabBar } from '../components/ui.jsx'
import Icon from '../icons.jsx'
import Home from '../screens/Home.jsx'
import Searching from '../screens/Searching.jsx'
import RouteResults from '../screens/RouteResults.jsx'
import HeatMap from '../screens/HeatMap.jsx'
import CoolSpots from '../screens/CoolSpots.jsx'
import Impact from '../screens/Impact.jsx'
import { conditions as C } from '../data.js'

/* Phone-framed mobile prototype. Holds navigation state. */
export default function MobileApp() {
  const [screen, setScreen] = useState('home') // home|searching|results|coolspots|heatmap|impact
  const [route, setRoute] = useState('coolest')
  const [radius, setRadius] = useState(1)
  const timer = useRef(null)

  const go = (s) => setScreen(s)
  const search = () => {
    setScreen('searching')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setScreen('results'), 1700)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const dark = screen === 'heatmap' || screen === 'impact'
  const activeTab = ({ home: 'home', searching: 'home', coolspots: 'home', results: 'routes', heatmap: 'map', impact: 'impact' })[screen]

  const onNav = (key) => {
    if (key === 'home') go('home')
    else if (key === 'routes') go('results')
    else if (key === 'map') go('heatmap')
    else if (key === 'impact' || key === 'profile') go('impact')
  }

  return (
    <div className="phone-frame">
      <div className="phone-screen" style={{ background: dark ? 'var(--slate)' : 'var(--canvas)' }}>
        <StatusBar dark={dark} />

        {screen === 'home' && (
          <Body>
            <HeaderRow
              kicker="Good morning, Aanya"
              title={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pin" size={15} stroke="#1C7C4A" width={2.2} /><span style={{ font: "700 16px 'Bricolage Grotesque'" }}>{C.location}</span></span>}
              badge={<MascotBadge state="blink" size={44} />}
            />
            <Home layout="mobile" onSearch={search} onCoolspots={() => go('coolspots')} onHeatmap={() => go('heatmap')} />
          </Body>
        )}

        {screen === 'searching' && <Searching layout="mobile" onCancel={() => go('home')} />}

        {screen === 'results' && (
          <RouteResults layout="mobile" selected={route} onSelect={setRoute} onBack={() => go('home')} onStart={() => go('impact')} />
        )}

        {screen === 'coolspots' && (
          <Body>
            <HeaderRow title={<span style={{ font: "700 19px 'Bricolage Grotesque'" }}>Cool spots nearby</span>}
              back={() => go('home')} />
            <CoolSpots layout="mobile" radius={radius} onWiden={() => setRadius(3)} onHome={() => go('home')} />
          </Body>
        )}

        {screen === 'heatmap' && (
          <Body>
            <HeaderRow dark kicker="Bengaluru · live"
              title={<span style={{ font: "700 19px 'Bricolage Grotesque'", color: 'var(--slate-text)' }}>City heat map</span>}
              badge={<MascotBadge state="alert" size={44} variant="alert" alertDot />} />
            <HeatMap layout="mobile" />
          </Body>
        )}

        {screen === 'impact' && (
          <Body>
            <HeaderRow dark
              title={<span style={{ font: "700 19px 'Bricolage Grotesque'", color: 'var(--slate-text)' }}>Your impact</span>}
              badge={<MascotBadge state="blink" size={44} variant="dark" />} />
            <Impact layout="mobile" />
          </Body>
        )}

        <div style={{ flex: '0 0 auto', padding: '8px 18px 22px', zIndex: 5 }}>
          <TabBar active={activeTab} onNav={onNav} dark={dark} />
        </div>
      </div>
    </div>
  )
}

function Body({ children }) {
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
}
function HeaderRow({ kicker, title, badge, back, dark }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px 12px', flex: '0 0 auto', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        {back && (
          <button onClick={back} style={{ width: 38, height: 38, borderRadius: 12, background: '#fff', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={20} /></button>
        )}
        <div>
          {kicker && <div style={{ fontSize: 13, color: dark ? 'var(--slate-muted)' : 'var(--muted)', fontWeight: 600 }}>{kicker}</div>}
          {title}
        </div>
      </div>
      {badge}
    </div>
  )
}
