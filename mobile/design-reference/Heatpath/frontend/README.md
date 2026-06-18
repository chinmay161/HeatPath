# HeatPath — frontend

A heat-aware walking companion for Indian cities. Routes for **shade and thermal safety**, not just speed — with a living mascot, **Patho the route fox**, woven through every state.

This package contains **two prototypes sharing one component system**:

- **Mobile app** — phone-framed, bottom-tab navigation
- **Desktop web** — browser-framed, sidebar navigation

Both are fully clickable: search → searching → results, route selection (re-colors the map), tab/sidebar navigation, and an empty-state flow.

## Run it

```bash
npm install
npm run dev      # opens http://localhost:5173
```

```bash
npm run build    # production build → dist/
npm run preview  # preview the build
```

Requires Node 18+. Use the **Mobile app / Desktop web** toggle at the top to switch prototypes.

## Project structure

```
frontend/
├── index.html              # entry, loads Google Fonts
├── package.json
├── vite.config.js
├── public/
│   └── mascot/             # Patho clips — walking, excited, mvp,
│                           #   disappointed, blink, alert (.mp4)
└── src/
    ├── main.jsx            # React root
    ├── App.jsx             # mode switcher (mobile ↔ desktop)
    ├── styles.css          # design tokens + all component classes
    ├── data.js             # conditions, routes, cool spots, heat grid
    ├── icons.jsx           # <Icon name="…" /> line-icon set
    ├── components/
    │   └── ui.jsx          # shared: Button, Pill, SeverityTag, RouteCard,
    │                       #   MascotBadge, Mascot, TabBar, Sidebar,
    │                       #   StatusBar, BrowserChrome, BestTimeChart…
    ├── screens/            # one file per screen, takes layout="mobile|desktop"
    │   ├── Home.jsx
    │   ├── Searching.jsx
    │   ├── RouteResults.jsx
    │   ├── HeatMap.jsx
    │   ├── CoolSpots.jsx
    │   └── Impact.jsx
    └── apps/
        ├── MobileApp.jsx   # phone shell + navigation state
        └── DesktopApp.jsx  # browser shell + navigation state
```

## The mascot — Patho

Patho has **six states**, each a short looping video in `public/mascot/`:

| State | Used for |
|-------|----------|
| `blink` | idle / header badge |
| `walking` | loading & searching |
| `excited` | a great cool route, goal hit |
| `mvp` | milestones, streaks, impact |
| `disappointed` | empty & bad outcomes |
| `alert` | heatwave advisory, warnings |

Placement follows two fixed patterns: a **companion badge** (top-right of every header) and a **hero stage** (large, centered, for full moments). Render either with `<MascotBadge state="…" />` or `<Mascot state="…" />`.

> The clips are keyed onto colored backgrounds with `mix-blend-mode: multiply`. For the cleanest compositing, re-export them with a transparent alpha channel (WebM/ProRes) and drop the blend mode.

## Design system

- **Brand:** Forest `#1C7C4A`, Forest Deep `#0E4F2E`, Lime `#A6DD3A`
- **Cool / safe:** Blue `#2563C9`
- **Heat severity (used sparingly):** Safe `#29A35A` → Caution `#E5B23C` → High `#E8843A` → Extreme `#C8322A`
- **Type:** Bricolage Grotesque (display), Plus Jakarta Sans (UI/body), Space Grotesk (data/temps)

All tokens live as CSS variables at the top of `styles.css`.

## Swapping in real data

`src/data.js` is the single source for conditions, routes, cool spots and the heat grid. Replace those exports with live API responses and the screens update automatically.
