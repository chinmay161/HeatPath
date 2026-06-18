import React from 'react'
import Icon from '../icons.jsx'
import { Mascot, MascotBadge, Button } from '../components/ui.jsx'
import { heatGrid, SEVERITY } from '../data.js'

/* CITY HEAT MAP — dark theme, Patho alert. */
export default function HeatMap({ layout = 'mobile', onPlan }) {
  const desktop = layout === 'desktop'

  const Advisory = (
    <div style={{ display: 'flex', alignItems: 'center', gap: desktop ? 14 : 12, background: 'linear-gradient(120deg,#2a120e,#3a1813)', border: '1px solid #6e2a20', borderRadius: 18, padding: desktop ? '14px 16px' : '12px 13px' }}>
      <div className="mascot-tile" style={{ width: desktop ? 54 : 50, height: desktop ? 54 : 50, borderRadius: 14, background: 'radial-gradient(120% 120% at 50% 20%,#fcebd9,#e9b48c)', border: 'none' }}>
        <Mascot state="alert" objectPosition="50% 24%" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff8d6b', font: `700 ${desktop ? 15 : 13}px 'Bricolage Grotesque'` }}>
          <Icon name="warn" size={desktop ? 16 : 15} width={2.2} />Heatwave advisory{desktop ? ' in effect' : ''}
        </div>
        <div style={{ fontSize: desktop ? 13 : 12, color: '#d9b3a8', marginTop: 2, lineHeight: 1.4 }}>
          Feels-like {desktop ? 'temperatures reach ' : ''}<b style={{ color: '#fff' }}>47°</b>{desktop ? '' : ' by 3 PM'}. Avoid open{desktop ? '-sun' : ''} walks {desktop ? 'between ' : ''}12–4 PM.
        </div>
      </div>
    </div>
  )

  const stats = [
    { v: '42°', c: 'var(--high)', l: desktop ? 'city average feels-like' : 'city average' },
    { v: '7', c: 'var(--extreme)', l: 'active hotspots' },
    { v: '12', c: 'var(--lime)', l: desktop ? 'cool refuges open' : 'cool zones' },
  ]
  const Stats = (
    <div style={{ display: 'flex', gap: desktop ? 14 : 10 }}>
      {stats.map((s) => (
        <div key={s.l} className="dcard" style={{ flex: 1, padding: desktop ? 16 : 14 }}>
          <div className="big" style={{ color: s.c, fontSize: desktop ? 30 : 26 }}>{s.v}</div>
          <small style={{ marginTop: 2, display: 'block', fontSize: 11 }}>{s.l}</small>
        </div>
      ))}
    </div>
  )

  const Grid = (
    <div style={{ borderRadius: 20, overflow: 'hidden', position: 'relative', border: '1px solid var(--slate-line)', background: '#0b1512', minHeight: desktop ? 300 : 0, height: desktop ? undefined : 300, flex: desktop ? 1 : undefined }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${desktop ? 10 : 6},1fr)`, gridTemplateRows: 'repeat(7,1fr)', gap: 3, padding: 3 }}>
        {heatGrid.slice(0, desktop ? 70 : 42).map((sev, i) => (
          <div key={i} style={{ background: SEVERITY[sev], borderRadius: 4, opacity: sev === 'safe' ? 0.82 : 1 }} />
        ))}
      </div>
      <span style={{ position: 'absolute', top: desktop ? '33%' : 80, left: desktop ? '62%' : '54%', width: desktop ? 16 : 14, height: desktop ? 16 : 14, borderRadius: '50%', background: '#fff', border: '3px solid var(--extreme)', boxShadow: `0 0 0 ${desktop ? 5 : 4}px rgba(200,50,42,.3)` }} />
      <span style={{ position: 'absolute', bottom: 12, left: 12, padding: '6px 11px', borderRadius: 8, background: 'rgba(14,26,22,.85)', font: "700 12px 'Space Grotesk'", color: '#cfe0d6' }}>MG Road · 47° hotspot</span>
    </div>
  )

  const Legend = (
    <div className="dcard" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--slate-muted)', fontWeight: 700, letterSpacing: '.04em' }}>SEVERITY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
        {[['Safe', SEVERITY.safe, '<35°'], ['Caution', SEVERITY.caution, '35–40°'], ['High', SEVERITY.high, '40–45°'], ['Extreme', SEVERITY.extreme, '>45°']].map(([n, c, r]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: c }} />
            <span style={{ fontSize: 13, color: '#cfe0d6', flex: 1 }}>{n}</span>
            <span style={{ font: "600 12px 'Space Grotesk'", color: 'var(--slate-muted)' }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const header = (
    <Head dark
      title="City heat map"
      kicker="Bengaluru · live"
      badge={<MascotBadge state="alert" size={desktop ? 42 : 44} variant="alert" alertDot />}
    />
  )

  if (desktop) {
    return (
      <>
        {header}
        <div className="scroll" style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Advisory}{Stats}
          <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
            {Grid}
            <div style={{ width: 260, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Legend}
              <Button onClick={onPlan} style={{ border: '1px solid #2c5a3d', background: 'rgba(166,221,58,.12)', color: 'var(--lime)', boxShadow: 'none' }}>Plan around hotspots</Button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // mobile (header rendered by frame; this is just body)
  return (
    <div className="scroll" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      {Advisory}{Stats}{Grid}
      <div className="dcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--slate-muted)', fontWeight: 600 }}>Cooler</span>
        <div style={{ flex: 1, margin: '0 12px', height: 8, borderRadius: 100, background: 'linear-gradient(90deg,#29A35A,#E5B23C,#E8843A,#C8322A)' }} />
        <span style={{ fontSize: 11, color: 'var(--slate-muted)', fontWeight: 600 }}>Hotter</span>
      </div>
    </div>
  )
}

/* shared desktop view header (also exported for other dark screens) */
export function Head({ title, kicker, badge, dark }) {
  return (
    <div className="view-head">
      <div>
        {kicker && <div style={{ fontSize: 12, color: dark ? 'var(--slate-muted)' : 'var(--muted)', fontWeight: 600 }}>{kicker}</div>}
        <div style={{ font: "700 18px 'Bricolage Grotesque'", color: dark ? 'var(--slate-text)' : 'var(--ink)' }}>{title}</div>
      </div>
      {badge}
    </div>
  )
}
