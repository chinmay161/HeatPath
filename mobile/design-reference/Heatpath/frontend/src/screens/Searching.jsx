import React from 'react'
import { Mascot } from '../components/ui.jsx'

/* SEARCHING — Patho walking. Shown while routing. */
export default function Searching({ layout = 'mobile', onCancel }) {
  const desktop = layout === 'desktop'
  const size = desktop ? 240 : 226
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', background: 'linear-gradient(180deg,#F4F8EF,#E7F2DE)' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div className="ring" />
        <div className="ring delay" />
        <div className="mascot-stage" style={{ position: 'absolute', inset: 0 }}>
          <Mascot state="walking" objectPosition="50% 44%" />
        </div>
      </div>
      <h3 style={{ margin: '36px 0 0', font: `700 ${desktop ? 30 : 26}px 'Bricolage Grotesque'`, color: '#102b1e' }}>Finding your coolest path…</h3>
      <p style={{ margin: '12px 0 0', fontSize: desktop ? 16 : 15, color: '#5d6f62', maxWidth: desktop ? 340 : 260, lineHeight: 1.5 }}>
        Patho's checking shade cover, surface heat and crowd levels along every route.
      </p>
      <div className="progress" style={{ width: desktop ? 300 : 240, marginTop: 28 }}><i /></div>
      {!desktop && onCancel && (
        <button onClick={onCancel} style={{ marginTop: 26, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>Cancel</button>
      )}
    </div>
  )
}
