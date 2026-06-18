import React from 'react'
import { Mascot, Button } from '../components/ui.jsx'

/* COOL SPOTS — empty state, Patho disappointed. */
export default function CoolSpots({ layout = 'mobile', radius, onWiden, onHome }) {
  const desktop = layout === 'desktop'
  const radiusLabel = radius >= 3 ? '3 km' : '1 km'
  const widenLabel = radius >= 3 ? 'Notify me when one opens' : 'Widen search to 3 km'
  const size = desktop ? 180 : 160

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: desktop ? 30 : '10px 34px' }}>
      <div className="mascot-stage" style={{ width: size, height: size, background: 'radial-gradient(120% 120% at 50% 20%,#F2F4EF,#DDE3D6)', border: '1px solid #E0E7DA', boxShadow: '0 18px 36px -22px rgba(20,40,30,.4)' }}>
        <Mascot state="disappointed" objectPosition="50% 26%" />
      </div>
      <h3 style={{ margin: `${desktop ? 24 : 22}px 0 0`, font: `700 ${desktop ? 26 : 22}px 'Bricolage Grotesque'`, color: '#102b1e' }}>No cool refuges within {radiusLabel}</h3>
      <p style={{ margin: '10px 0 0', fontSize: desktop ? 15 : 14, color: '#5d6f62', lineHeight: 1.5, maxWidth: desktop ? 420 : undefined }}>
        Everything nearby is in full sun right now. Patho suggests widening the search{desktop ? ' radius' : ''} or waiting for cooler hours.
      </p>
      <div style={{ display: 'flex', flexDirection: desktop ? 'row' : 'column', gap: 12, marginTop: 24, width: desktop ? 'auto' : '100%' }}>
        <Button onClick={onWiden}>{widenLabel}</Button>
        <Button variant="ghost" onClick={onHome}>Back to home</Button>
      </div>
    </div>
  )
}
