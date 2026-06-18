import React from 'react'
import Icon from '../icons.jsx'
import { Mascot } from '../components/ui.jsx'

/* YOUR IMPACT — dark theme, Patho MVP. */
export default function Impact({ layout = 'mobile' }) {
  const desktop = layout === 'desktop'

  const Hero = (
    <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(135deg,#16331f,#0f5b34)', border: '1px solid #2c5a3d', padding: desktop ? 22 : 18, display: 'flex', alignItems: 'center', gap: desktop ? 18 : 14 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 10%,rgba(166,221,58,.28),transparent 55%)' }} />
      <div className="mascot-tile" style={{ position: 'relative', width: desktop ? 120 : 96, height: desktop ? 120 : 96, borderRadius: desktop ? 22 : 20, background: 'radial-gradient(120% 120% at 50% 18%,#f3ffe0,#cdeeb0)', border: '1px solid #bfe293', boxShadow: '0 12px 26px -14px rgba(0,0,0,.5)' }}>
        <Mascot state="mvp" objectPosition="50% 22%" />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: desktop ? '5px 12px' : '4px 10px', borderRadius: 100, background: 'rgba(166,221,58,.2)', color: 'var(--lime)', font: `700 ${desktop ? 11 : 10.5}px 'Space Grotesk'`, letterSpacing: '.08em' }}>MVP THIS WEEK</div>
        <div style={{ font: `700 ${desktop ? 26 : 21}px 'Bricolage Grotesque'`, color: '#fff', marginTop: desktop ? 9 : 7, lineHeight: 1.15 }}>
          You dodged the worst of<br />the heat 5 days running
        </div>
      </div>
    </div>
  )

  const BigStat = (
    <div className="dcard" style={{ padding: desktop ? 22 : 18, borderRadius: desktop ? 24 : 22, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--slate-muted)', fontWeight: 700, letterSpacing: '.04em' }}>CUMULATIVE HEAT AVOIDED</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
        <span style={{ font: `700 ${desktop ? 54 : 46}px/1 'Space Grotesk'`, color: 'var(--lime)' }}>12.6</span>
        <span style={{ fontSize: 16, color: 'var(--slate-muted)', marginBottom: desktop ? 8 : 6, fontWeight: 600 }}>°-hours{desktop ? ' / month' : ' this month'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: desktop ? 5 : 4, height: desktop ? 60 : 52, marginTop: desktop ? 16 : 14 }}>
        {[30, 44, 38, 62, 54, 78, 70, 100].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: h === 100 ? 'var(--lime)' : ['#1f4a30', '#256138', '#1f4a30', '#2f7a45', '#256138', '#3c9a55', '#2f7a45'][i], borderRadius: 4 }} />
        ))}
      </div>
    </div>
  )

  const tiles = desktop
    ? [['heat', '7', 'day cool streak', 'var(--high)'], [null, '31', 'cool walks taken'], [null, '5', 'badges earned'], [null, '−6°', 'avg route cooling']]
    : [['heat', '7', 'day streak', 'var(--high)'], [null, '31', 'cool walks'], [null, '5', 'badges']]

  const Tiles = (
    <div style={{ display: desktop ? 'grid' : 'flex', gridTemplateColumns: desktop ? 'repeat(4,1fr)' : undefined, gap: desktop ? 14 : 10 }}>
      {tiles.map(([icon, v, l, c], i) => (
        <div key={i} className="dcard" style={{ flex: desktop ? undefined : 1, padding: desktop ? 18 : 14 }}>
          {icon ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: desktop ? 7 : 6, color: c }}>
              <Icon name="heat" size={desktop ? 19 : 17} />
              <span style={{ font: `700 ${desktop ? 26 : 22}px 'Space Grotesk'`, color: 'var(--slate-text)' }}>{v}</span>
            </div>
          ) : (
            <div style={{ font: `700 ${desktop ? 26 : 22}px 'Space Grotesk'`, color: 'var(--slate-text)' }}>{v}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--slate-muted)', marginTop: desktop ? 4 : 3 }}>{l}</div>
        </div>
      ))}
    </div>
  )

  const badges = [
    ['trophy', 'rgba(166,221,58,.16)', '#A6DD3A', 'Shade Pro', '50 shaded km'],
    ['water', 'rgba(37,99,201,.18)', '#6ea2ff', 'Hydrated', 'refilled 20×'],
    ['clock', 'rgba(232,132,58,.16)', '#f0a064', 'Early Bird', '10 dawn walks'],
  ]
  const Badges = (
    <div style={{ display: 'flex', gap: desktop ? 12 : 10 }}>
      {badges.map(([icon, bg, color, name, meta]) => (
        <div key={name} className="dcard" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16 }}>
          <span className="icon-chip" style={{ width: 40, height: 40, borderRadius: 12, background: bg, color }}><Icon name={icon} size={20} /></span>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: '#cfe0d6' }}>{name}</div><div style={{ fontSize: 11, color: 'var(--slate-muted)' }}>{meta}</div></div>
        </div>
      ))}
    </div>
  )

  if (desktop) {
    return (
      <div className="scroll" style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>{Hero}{BigStat}</div>
        {Tiles}{Badges}
      </div>
    )
  }

  return (
    <div className="scroll" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      {Hero}{BigStat}{Tiles}
    </div>
  )
}
