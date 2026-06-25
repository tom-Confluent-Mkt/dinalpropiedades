# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # Production build
npm run preview        # Preview the production build locally
npm run lint           # ESLint over the repo

npm run sync           # Pull Dinal Tokko data → public/data/*.json (auto-runs enhance.js at the end)
npm run enhance        # Re-run AI description enhancement only (cached, skips unchanged)
npm run enhance:force  # Force re-enhance every description, ignoring the cache
npm run cron           # Long-running scheduler: syncs Dinal + Obras de Mar now, then daily at 03:00
```

There is no test suite.

### Two Tokko accounts → two datasets

The site serves **two brands** from **two separate Tokko API keys**:

- **Dinal Propiedades** (main site) — `VITE_TOKKO_API_KEY`, written by `scripts/sync-tokko.js` to `public/data/properties.json` + `developments.json`.
- **Obras de Mar** (ODM, `/obras-de-mar/*`) — `VITE_ODM_TOKKO_API_KEY`, written by `scripts/sync-odm.js` to `public/data/odm-properties.json` + `odm-developments.json`.

`scripts/cron.js` runs both syncs. Each sync script calls its enhance counterpart (`enhance.js` / `enhance-odm.js`) as a final step via `execFileSync`.

### Required environment variables (`.env`, gitignored)

- `VITE_TOKKO_API_KEY` — Dinal Tokko account
- `VITE_ODM_TOKKO_API_KEY` — Obras de Mar Tokko account
- `ANTHROPIC_API_KEY` — used by the enhance scripts only

## Architecture

**React 19 + Vite SPA**, **React Router v7** for client-side routing. **All UI lives in one file: `src/App.jsx`** (~2,600 lines) — every page and component is defined there; `main.jsx` is just the mount. There are no separate component files.

### Data pipeline (build-time cache, not runtime API)

The site does **not** call Tokko from the browser by default. Instead:

1. `sync-tokko.js` / `sync-odm.js` page through the Tokko REST API (`/property/`, `/development/`) and write `{ meta, objects }` JSON into `public/data/`.
2. `enhance.js` / `enhance-odm.js` post-process each listing: they send the raw `description` to **Claude Haiku** (`claude-haiku-4-5-20251001`) with a Spanish real-estate copywriter system prompt, and store clean HTML on each object as `enhanced_description`. Results are cached in `public/data/desc-cache.json` (Dinal) / `desc-cache-odm.json` (ODM), keyed by listing id + a sha256 hash of the raw description — unchanged descriptions are skipped, so re-running is cheap. `--force` bypasses the cache.
3. In the browser, `fetchWithCache(cacheUrl, apiUrl)` (top of `App.jsx`) reads the local JSON first and only falls back to the live Tokko API if the cache is missing/empty.

When listing data looks stale or wrong, regenerate it with `npm run sync` rather than editing the JSON by hand — the JSON files are committed and tracked.

### Tokko data conventions

- `CONSTRUCTION_STATUS` map + `constructionLabel()` translate Tokko's numeric `construction_status` into Spanish labels. This mapping has been corrected multiple times to match Tokko's exact wording — verify against live data before changing it.
- `TAG_TYPE_LABELS` / `TAG_ICONS` map Tokko tag type ids to section labels and Lucide icons.
- `propSlug()` / `slugify()` build URL slugs from listings.

### Styling

- **Tailwind** with custom theme in `tailwind.config.js`: `primary` #0A162D (dark navy), `accent` #A3FF86 (lime), `background` #FFFFFF, `dark` #000000. Font family is **Raleway** under three aliases (`font-heading`, `font-drama`, `font-data`).
- **GSAP + ScrollTrigger** drive animations. Every page uses `useLayoutEffect` with `gsap.context()` for scoped cleanup, plus a `useEffect` that does `window.scrollTo(0,0)`. Use a unique class prefix per page (e.g. `suc-hero`, `suc-scroll`) so GSAP selectors don't collide.
- Icons: **Lucide React**.

### Routes (defined in the `App` component, bottom of `App.jsx`)

`/` `/contacto` `/emprendimientos` `/alquiler` `/venta` `/sucursales` `/nosotros` `/propiedad/:id`, plus the ODM pages `/obras-de-mar` and `/obras-de-mar/propiedad/:id`.

`vercel.json` rewrites all paths to `/index.html` so a direct-URL load or refresh on these client routes doesn't 404.

> The "Obras de Mar" navbar link is currently commented out in both the desktop and mobile navs (page is reachable by URL but hidden until ready).

### Adding a new page

1. **Component** — add to `App.jsx` with `useRef` + `useLayoutEffect` (GSAP) and a `useEffect` scroll-reset. Use a unique CSS class prefix for GSAP targeting. Data-driven pages call `fetchWithCache('/data/<file>.json', '<tokko url>')`.
2. **Route** — add a `<Route>` inside `<Routes>` in the `App` component.
3. **Navbar** — add `<Link>` to both the desktop nav (~line 213) and mobile nav (~line 237), and add the path to the `isDarkNav` check (~line 188) if the page has a dark hero.

### Hero pattern

Interior pages use a `h-[60vh]` rounded card: absolute-positioned image + `bg-primary/70` overlay, centered text, `.page-hero` elements animated with `gsap.from`. The home hero is full-height (`h-[100dvh]`) with a bottom-aligned layout.

### Images

All in `public/images/Size Optimized/`, referenced with URL-encoded paths (`/images/Size%20Optimized/filename.jpg`).
