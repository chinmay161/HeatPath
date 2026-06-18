import React from 'react'
import Icon from '../icons.jsx'
import { Mascot, MascotBadge, RouteCard, Button } from '../components/ui.jsx'
import { routes, routeOrder } from '../data.js'

/* ROUTE RESULTS — Patho excited. Selectable route cards.
   Mobile = stacked list. Desktop = map + right rail. */
export default function RouteResults({ layout = 'mobile', selected, onSelect, onBack, onStart }) {
  const desktop = layout === 'desktop'
  const cur = routes[selected]

  const Coach = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'linear-gradient(120deg,#F2FBE6,#E2F3CC)', border: '1px solid #CDE89B', borderRadius: 20, padding: '12px 14px', boxShadow: '0 14px 28px -22px rgba(77,99,16,.6)' }}>
      <div className="mascot-tile" style={{ width: desktop ? 60 : 56, height: desktop ? 60 : 56, borderRadius: 16 }}>
        <Mascot state="excited" objectPosition="50% 24%" />
      </div>
      <div>
        <div style={{ font: "700 16px 'Bricolage Grotesque'", color: '#3c4f12' }}>Great find!</div>
        <div style={{ fontSize: 12.5, color: '#5d6f3a', lineHeight: 1.4 }}>
          {desktop ? 'Tap a route to preview it on the map.' : <>The coolest route keeps you in <b>71% shade</b> — 9° cooler than the fast one.</>}
        </div>
      </div>
    </div>
  )

  const cards = routeOrder.map((k) => (
    <RouteCard key={k} route={routes[k]} active={selected === k} onClick={() => onSelect(k)} />
  ))

  if (desktop) {
    return (
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <RouteMap route={cur} />
        <div style={{ width: 404, flex: '0 0 auto', borderLeft: '1px solid #EAEFE5', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #EEF2EA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={onBack} style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={18} /></button>
              <div><div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>3 routes to</div><div style={{ font: "700 18px 'Bricolage Grotesque'" }}>Cubbon Park</div></div>
            </div>
            <MascotBadge state="blink" size={42} />
          </div>
          <div className="scroll" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {Coach}
            {cards}
            <Button block onClick={onStart} style={{ marginTop: 4 }}>Start the {cur.title} route →</Button>
          </div>
        </div>
      </div>
    )
  }

  // mobile
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 12px', flex: '0 0 auto' }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 12, background: '#fff', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={20} /></button>
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>3 routes to</div><div style={{ font: "700 17px 'Bricolage Grotesque'" }}>Cubbon Park</div></div>
        <MascotBadge state="blink" size={44} />
      </div>
      <div className="scroll" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Coach}
        {cards}
      </div>
      <div style={{ flex: '0 0 auto', padding: '10px 16px 16px' }}>
        <Button block onClick={onStart} style={{ borderRadius: 16, padding: 15 }}>Start the {cur.title} route →</Button>
      </div>
    </div>
  )
}

/* Schematic map with the selected route highlighted */
function RouteMap({ route }) {
  const [a, b, c] = route.seg
  return (
    <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(135deg,#E9F0E1,#DDE8d2)', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '42px 42px' }} />
      <div style={{ position: 'absolute', top: 60, left: 80, width: 180, height: 150, background: '#cfe0bd', borderRadius: 18 }} />
      <div style={{ position: 'absolute', bottom: 80, right: 120, width: 240, height: 180, background: '#cfe0bd', borderRadius: 18 }} />
      <div style={{ position: 'absolute', top: 300, left: 300, width: 120, height: 120, background: '#cfe0bd', borderRadius: 18 }} />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 700 760" preserveAspectRatio="none" fill="none">
        <path d="M120 660 C 220 600, 200 460, 320 430 S 480 380, 540 220 L 600 120" stroke="#1C7C4A" strokeWidth="9" strokeLinecap="round" strokeDasharray="0.1 14" opacity=".35" />
        <path d="M120 660 C 220 600, 200 460, 320 430" stroke={a} strokeWidth="9" strokeLinecap="round" />
        <path d="M320 430 C 380 414, 430 400, 470 350" stroke={b} strokeWidth="9" strokeLinecap="round" />
        <path d="M470 350 C 510 300, 520 260, 540 220 L 600 120" stroke={c} strokeWidth="9" strokeLinecap="round" />
      </svg>
      <span style={{ position: 'absolute', left: 104, top: 644, width: 26, height: 26, borderRadius: '50%', background: '#2563C9', border: '4px solid #fff', boxShadow: '0 6px 14px -4px rgba(0,0,0,.4)' }} />
      <span style={{ position: 'absolute', left: 586, top: 104, width: 30, height: 30, borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)', background: '#1C7C4A', border: '4px solid #fff', boxShadow: '0 6px 14px -4px rgba(0,0,0,.4)' }} />
      <div style={{ position: 'absolute', top: 18, left: 18 }}>
        <span style={{ padding: '7px 13px', borderRadius: 100, background: '#fff', boxShadow: '0 6px 14px -8px rgba(0,0,0,.3)', font: "700 12px 'Space Grotesk'", color: '#102b1e' }}>{route.title} route · live</span>
      </div>
      <div style={{ position: 'absolute', bottom: 18, left: 18, display: 'flex', gap: 10, background: '#fff', borderRadius: 12, padding: '9px 13px', boxShadow: '0 6px 16px -8px rgba(0,0,0,.3)', fontSize: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#16633B' }}><span style={{ width: 14, height: 5, borderRadius: 3, background: '#1C7C4A' }} />Shade</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#b5560f' }}><span style={{ width: 14, height: 5, borderRadius: 3, background: '#E8843A' }} />Sun</span>
      </div>
    </div>
  )
}
