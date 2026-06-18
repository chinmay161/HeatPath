import React from 'react'
import Icon from './icons.jsx'
import { SEVERITY } from './data.js'

/* ============================================================
   Shared HeatPath components used by both mobile & desktop.
   ============================================================ */

export function Logo({ size = 32 }) {
  return (
    <span className="logo" style={{ width: size, height: size }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none"
        stroke="#A6DD3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v8M12 22v-4M5 10c0 4 3 6 7 6s7-2 7-6c0-3-2-5-2-5s-2 2-5 2-5-2-7 3z" />
      </svg>
    </span>
  )
}

export function SeverityTag({ level }) {
  return <span className={`sev ${level}`}>{level}</span>
}

export function Pill({ tone = 'green', icon, children }) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </span>
  )
}

export function IconChip({ name, bg, color, size = 44, radius = 13, iconSize }) {
  return (
    <span className="icon-chip" style={{ width: size, height: size, background: bg, color, borderRadius: radius }}>
      <Icon name={name} size={iconSize || Math.round(size * 0.5)} />
    </span>
  )
}

/* Exposure / severity timeline (shade↔sun) */
const SEG_COLOR = { shade: '#1C7C4A', sun: '#E8843A', ...SEVERITY }
export function Timeline({ segments, small }) {
  return (
    <div className={`timeline${small ? ' sm' : ''}`}>
      {segments.map(([flex, sev], i) => (
        <div key={i} style={{ flex, background: SEG_COLOR[sev] || sev }} />
      ))}
    </div>
  )
}

/* iOS-style status bar */
export function StatusBar({ dark }) {
  const c = dark ? '#E8F0EA' : '#15241C'
  return (
    <div className="statusbar">
      <span className="time" style={{ color: c }}>9:41</span>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <svg width="17" height="12" viewBox="0 0 18 12" fill={c}><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2" width="3" height="10" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke={c} strokeWidth="1.6"><path d="M1 4.5C3 2.5 5.3 1.5 8 1.5s5 1 7 3" /><path d="M3.5 7C5 5.7 6.4 5 8 5s3 .7 4.5 2" /><circle cx="8" cy="9.5" r="1.1" fill={c} stroke="none" /></svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke={c} strokeWidth="1.4" /><rect x="3" y="3" width="15" height="7" rx="1.5" fill={c} /><rect x="23" y="4" width="2.5" height="5" rx="1.25" fill={c} /></svg>
      </div>
    </div>
  )
}

/* The mascot — Patho. Plays the clip for a given emotional state.
   states: walking | excited | mvp | disappointed | blink | alert     */
export function Mascot({ state = 'blink', objectPosition = '50% 28%' }) {
  return (
    <video
      src={`/mascot/${state}.mp4`}
      muted loop playsInline autoPlay preload="auto"
      style={{ objectPosition }}
    />
  )
}

export function MascotBadge({ state = 'blink', size = 44, variant = '', alertDot }) {
  return (
    <span className={`mascot-badge ${variant}`} style={{ width: size, height: size }}>
      <Mascot state={state} objectPosition="50% 26%" />
      {alertDot && <span className="dot" />}
    </span>
  )
}

export function Button({ variant = '', block, children, ...rest }) {
  const cls = ['btn', variant && `btn-${variant}`, block && 'btn-block'].filter(Boolean).join(' ')
  return <button className={cls} {...rest}>{children}</button>
}

/* Route option card — selectable */
export function RouteCard({ route, active, onClick }) {
  return (
    <button className={`route-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <IconChip name={route.icon} bg={route.iconBg} color={route.iconColor} size={34} radius={11} iconSize={19} />
          <div>
            <div style={{ font: "700 16px 'Bricolage Grotesque'" }}>{route.title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{route.sub}</div>
          </div>
        </div>
        <SeverityTag level={route.severity} />
      </div>
      <div className="stats">
        <div><div className="big" style={{ color: '#102b1e' }}>{route.min}</div><small>walk time</small></div>
        <div><div className="big" style={{ color: route.feelsColor }}>{route.feels}</div><small>feels-like</small></div>
        <div><div className="big" style={{ color: 'var(--forest)' }}>{route.shade}</div><small>in shade</small></div>
      </div>
      <Timeline segments={route.bar} small />
    </button>
  )
}

/* Best-time-to-walk bar chart (dark card body) */
export function BestTimeChart({ bars }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, flex: 1, minHeight: 120 }}>
      {bars.map((b) => (
        <div key={b.h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', height: `${b.v}%`, background: SEVERITY[b.sev], borderRadius: 6 }} />
          <span style={{ font: "600 11px 'Space Grotesk'", color: b.best ? 'var(--lime)' : '#9fb7a6' }}>{b.h}</span>
        </div>
      ))}
    </div>
  )
}

/* Bottom tab bar (mobile) */
export function TabBar({ active, onNav, dark }) {
  const items = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'routes', label: 'Routes', icon: 'routes' },
    { key: 'map', label: 'Map', icon: 'map' },
    { key: 'impact', label: 'Impact', icon: 'chart' },
    { key: 'profile', label: 'Profile', icon: 'user' },
  ]
  return (
    <div className={`tabbar${dark ? ' dark' : ''}`}>
      {items.map((it) => (
        <button key={it.key} className={`tab${active === it.key ? ' on' : ''}`} onClick={() => onNav(it.key)}>
          <Icon name={it.icon} size={22} width={2.1} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

/* Sidebar (desktop) */
export function Sidebar({ active, onNav }) {
  const items = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'routes', label: 'Routes', icon: 'routes' },
    { key: 'heatmap', label: 'Heat map', icon: 'heatmap' },
    { key: 'coolspots', label: 'Cool spots', icon: 'park' },
    { key: 'impact', label: 'Impact', icon: 'chart' },
  ]
  return (
    <div className="sidebar">
      <div className="brand">
        <Logo />
        <span className="name">HeatPath</span>
      </div>
      <div className="nav">
        {items.map((it) => (
          <button key={it.key} className={active === it.key ? 'on' : ''} onClick={() => onNav(it.key)}>
            <Icon name={it.icon} size={19} width={2.1} />
            {it.label}
          </button>
        ))}
      </div>
      <div className="me">
        <span className="icon-chip" style={{ width: 36, height: 36, borderRadius: '50%', background: '#E6F4E2', color: 'var(--forest)' }}><Icon name="user" size={18} /></span>
        <div><div style={{ fontWeight: 700, fontSize: 13 }}>Aanya R.</div><div style={{ fontSize: 11, color: 'var(--muted-2)' }}>Heat-sensitive</div></div>
      </div>
    </div>
  )
}

export function BrowserChrome({ path = '' }) {
  return (
    <div className="browser-chrome">
      <div className="lights"><i style={{ background: '#e06c5e' }} /><i style={{ background: '#e6b34a' }} /><i style={{ background: '#5bb86a' }} /></div>
      <div className="url"><Icon name="lock" size={11} stroke="#1C7C4A" width={2.5} />app.heatpath.in{path}</div>
    </div>
  )
}
