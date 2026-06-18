import React from 'react'
import Icon from '../icons.jsx'
import { Button, MascotBadge, BestTimeChart, IconChip, Pill } from '../components/ui.jsx'
import { conditions as C, bestTime, coolSpots } from '../data.js'

/* HOME — light theme. `layout` = 'mobile' | 'desktop' */
export default function Home({ layout = 'mobile', onSearch, onCoolspots, onHeatmap }) {
  const desktop = layout === 'desktop'

  const ConditionsHero = desktop ? (
    <div style={{ display: 'flex', gap: 18, borderRadius: 24, padding: '22px 24px', background: 'linear-gradient(120deg,#FFF6EC,#FDE6Cf)', border: '1px solid #F6DCC2', alignItems: 'center' }}>
      <div style={{ flex: '0 0 auto' }}>
        <div style={{ fontSize: 12.5, color: '#9a6a3c', fontWeight: 700, letterSpacing: '.04em' }}>FEELS LIKE NOW</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 2 }}>
          <span style={{ font: "700 64px/1 'Space Grotesk'", color: '#b5560f' }}>{C.feelsLike}°</span>
          <span style={{ marginTop: 8, padding: '6px 12px', borderRadius: 9, background: 'var(--high)', color: '#fff', font: "700 12px 'Space Grotesk'" }}>HIGH STRESS</span>
        </div>
      </div>
      <div style={{ width: 1, height: 64, background: '#f0cba6' }} />
      <div style={{ display: 'flex', gap: 26, flex: 1 }}>
        <Metric v={`${C.real}°`} l="real temp" />
        <Metric v={`${C.humidity}%`} l="humidity" />
        <Metric v={`UV ${C.uv}`} l="very high" />
        <Metric v={`${C.peak}°`} l={`peak ${C.peakTime}`} color="var(--extreme)" />
      </div>
      <Button onClick={onSearch} style={{ flex: '0 0 auto' }}>Start a cool walk</Button>
    </div>
  ) : (
    <div style={{ borderRadius: 24, padding: 18, background: 'linear-gradient(155deg,#FFF6EC,#FDEAD7)', border: '1px solid #F6DCC2', boxShadow: '0 14px 28px -20px rgba(232,132,58,.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12.5, color: '#9a6a3c', fontWeight: 700, letterSpacing: '.04em' }}>FEELS LIKE NOW</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
            <span style={{ font: "700 56px/1 'Space Grotesk'", color: '#b5560f' }}>{C.feelsLike}°</span>
            <span style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--high)', color: '#fff', font: "700 11px 'Space Grotesk'" }}>{C.severity}</span>
          </div>
          <div style={{ fontSize: 13, color: '#9a6a3c', marginTop: 6, fontWeight: 600 }}>Real {C.real}° · peaks {C.peak}° at {C.peakTime}</div>
        </div>
        <span className="icon-chip" style={{ width: 52, height: 52, borderRadius: 16, background: '#fff', color: 'var(--high)', boxShadow: '0 6px 14px -8px rgba(232,132,58,.7)' }}><Icon name="sun" size={28} /></span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <MiniStat v={`${C.humidity}%`} l="humidity" />
        <MiniStat v={`UV ${C.uv}`} l="very high" />
        <MiniStat v={`${C.wind}km/h`} l="breeze" />
      </div>
    </div>
  )

  const SearchBar = (
    <button onClick={onSearch} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 15px', boxShadow: '0 10px 22px -18px rgba(20,40,30,.4)', textAlign: 'left', width: '100%' }}>
      <Icon name="search" size={20} stroke="#6B7A70" />
      <span style={{ color: '#9aa89d', fontSize: 15, flex: 1 }}>Where do you want to walk?</span>
      <span className="icon-chip" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--forest)', color: '#fff' }}><Icon name="gps" size={17} /></span>
    </button>
  )

  const BestTime = (
    <div style={{ background: '#102b1e', borderRadius: 22, padding: desktop ? 20 : '17px 18px', color: '#fff', boxShadow: '0 18px 34px -24px rgba(20,40,30,.6)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ font: "700 17px 'Bricolage Grotesque'", color: '#fff' }}>Best time to walk</h4>
        <span style={{ fontSize: 12, color: '#9fb7a6' }}>today</span>
      </div>
      <div style={{ marginTop: 16 }}><BestTimeChart bars={bestTime} /></div>
      <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(166,221,58,.16)', color: 'var(--lime)', padding: '8px 13px', borderRadius: 100, fontSize: 13, fontWeight: 700, alignSelf: 'flex-start' }}>
        <Icon name="check" size={14} width={2.4} />Best window — 7:00 AM
      </div>
    </div>
  )

  if (desktop) {
    return (
      <div className="scroll" style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {ConditionsHero}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ font: "700 17px 'Bricolage Grotesque'" }}>Plan a cool walk</h4>
            <div style={{ marginTop: 14 }}>{SearchBar}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, letterSpacing: '.05em', margin: '18px 0 10px' }}>RECENT</div>
            <RecentRow onClick={onSearch} icon="park" bg="#E6F4E2" color="#1C7C4A" title="Cubbon Park" meta="1.4 km · 71% shade route" sev="SAFE" sevTone="green" />
            <RecentRow onClick={onSearch} icon="scan" bg="#E1ECFB" color="#2563C9" title="Metro · MG Road" meta="0.9 km · shaded arcade" sev="HIGH" sevTone="warm" />
          </div>
          {BestTime}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ font: "700 17px 'Bricolage Grotesque'" }}>Cool spots near you</h4>
            <button onClick={onCoolspots} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--forest)', fontWeight: 700 }}>View all →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {coolSpots.map((s) => <CoolSpotCard key={s.name} spot={s} />)}
          </div>
        </div>
      </div>
    )
  }

  // mobile
  return (
    <div className="scroll" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      {ConditionsHero}
      {SearchBar}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9 }}>
        <QuickLink onClick={onCoolspots} icon="park" bg="#E6F4E2" color="#1C7C4A" label="Cool spots" />
        <QuickLink icon="clock" bg="#E1ECFB" color="#2563C9" label="Best time" />
        <QuickLink onClick={onHeatmap} icon="heatmap" bg="#FCEEDD" color="#E8843A" label="Heat map" />
        <QuickLink onClick={onSearch} icon="routes" bg="#E6F4E2" color="#1C7C4A" label="Routes" />
      </div>
      {BestTime}
    </div>
  )
}

function Metric({ v, l, color = '#102b1e' }) {
  return <div><div style={{ font: "700 22px 'Space Grotesk'", color }}>{v}</div><div style={{ fontSize: 12, color: '#9a6a3c' }}>{l}</div></div>
}
function MiniStat({ v, l }) {
  return <div style={{ flex: 1, background: 'rgba(255,255,255,.7)', borderRadius: 12, padding: '9px 11px' }}><div style={{ font: "700 16px 'Space Grotesk'", color: '#102b1e' }}>{v}</div><div style={{ fontSize: 11, color: '#9a6a3c' }}>{l}</div></div>
}
function QuickLink({ icon, bg, color, label, onClick }) {
  return (
    <button onClick={onClick} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '13px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, boxShadow: '0 8px 18px -16px rgba(20,40,30,.4)' }}>
      <IconChip name={icon} bg={bg} color={color} size={38} radius={12} iconSize={20} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>{label}</span>
    </button>
  )
}
function RecentRow({ icon, bg, color, title, meta, sev, sevTone, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 13, border: '1px solid #EEF2EA', background: '#fff', textAlign: 'left', width: '100%', marginBottom: 9 }}>
      <IconChip name={icon} bg={bg} color={color} size={34} radius={10} iconSize={18} />
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{meta}</div></div>
      <Pill tone={sevTone}>{sev}</Pill>
    </button>
  )
}
function CoolSpotCard({ spot }) {
  const map = { green: ['#E6F4E2', '#1C7C4A'], blue: ['#E1ECFB', '#2563C9'] }
  const [bg, color] = map[spot.tone]
  return (
    <div className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
      <IconChip name={spot.icon} bg={bg} color={color} size={44} radius={13} iconSize={22} />
      <div><div style={{ fontWeight: 700, fontSize: 14 }}>{spot.name}</div><div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{spot.meta}</div></div>
    </div>
  )
}
