# Peakcast

Personal, mobile-first weather forecast PWA for mountain activities around
Calgary and the Canadian Rockies (backcountry camping, skiing, trail running,
cycling, everyday local weather). Replaces how the owner uses SpotWx.com.
Personal, non-commercial use only (Open-Meteo free tier terms).

**Hard rule:** never fetch, scrape or copy anything from spotwx.com. The only
weather data source is the Open-Meteo API.

## Problems being solved (priority order)

1. Switching between locations is cumbersome. **Top priority.**
2. Too many steps. Opening the app must land directly on a forecast (last
   viewed spot), zero taps to see data.
3. Comparing 2–3 models for the same horizon takes many clicks. Models are
   **overlaid on the same charts by default**.
4. SpotWx looks dated. Smooth, modern, polished UI, good motion, dark mode.

## Feature spec (MVP)

- **Saved spots**: add via geocoding search, current location, or long-press on
  a map to drop a pin. Name, reorder, delete. Optional **elevation override**
  per spot (summit vs trailhead) passed as Open-Meteo `elevation=`.
- **Fast switching**: swipe left/right between saved spots + a spot picker
  sheet. App reopens on the last viewed spot and last horizon tab.
- **Deep links**: `/?spot=<slug>` opens a saved spot. Usable for iOS home
  screen icons and Shortcuts.
- **Share a spot with friends**: the iOS share sheet (`navigator.share`) sends a
  self-contained link
  `/?spot=<slug>&name=<name>&lat=<lat>&lon=<lon>[&elev=<m>]`. When the slug
  isn't saved locally, the app shows the forecast as a temporary spot with a
  "Save spot" button. The same URL format serves as both deep link and share link.
- **Horizon tabs**: 48h / 3.5d / 10d / 16d. Each tab overlays that horizon's
  models on the same charts. Per-model toggle chips show/hide them. Models from
  longer horizons can be toggled on (off by default) so the 3.5d tab can still
  compare. Each model has one colour everywhere in the app.
- **Charts** (stacked vertically, scrollable, shared time axis): temperature;
  precip (rain vs snow) + snowfall; wind speed + gusts (+ direction); cloud
  cover; freezing level. One scrubber shared across all charts: tap/drag shows
  every visible model's value at that hour.
- **At-a-glance row** at the top: per day hi/lo, precip total, max gust.
- **Model freshness**: show each model's run/init time (e.g. "HRDPS 12Z · 3h ago").
- **Offline**: cache the last fetched forecast per spot+horizon. With no
  signal, show it clearly labelled "Fetched <time>".
- **Storage**: spots + UI prefs in localStorage. Forecast cache in IndexedDB
  (payloads are too large for localStorage's ~5 MB).
- **Attribution**: "Weather data by Open-Meteo.com" (CC BY 4.0) visible in the
  UI. The map shows its tile attributions.
- **Seed spots**: Calgary (51.0447, -114.0719); Kananaskis Village
  (50.91598, -115.14156).

## Data layer: verified against the live API (probed 2026-10-01)

All IDs below were confirmed by real requests, not just docs. The docs now use
`cmc_gem_*` IDs. The old `gem_*` aliases (`gem_hrdps_west`, `gem_regional`, …)
still work, but we use the canonical ones.

### Endpoints
- Forecast: `https://api.open-meteo.com/v1/forecast`, with `models=` comma list.
  Response keys are suffixed per model (`temperature_2m_cmc_gem_hrdps`).
- Ensemble: `https://ensemble-api.open-meteo.com/v1/ensemble` with
  `models=gem_global_ensemble`. Keys are `var`, `var_member01..20` (21 members).
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=…`.
- Run metadata: `https://api.open-meteo.com/data/<metaDomain>/static/meta.json`
  gives `last_run_initialisation_time` and `last_run_availability_time` (unix s).
  CORS is `*` on all of these. **The meta domain differs from the model ID**,
  and the old `cmc_gem_rdps` / `cmc_gem_gdps` domains still exist but went
  stale in May 2026. Use the domains in the table.
- Common params: `timezone=auto`, `wind_speed_unit=kmh`, metric units, optional
  `elevation=<m>` (statistical downscaling; default is a 90 m DEM).

### Model registry (`src/config/models.ts`, the single source of truth)

| id (API) | Display | Horizon tab | Res | Native step | metaDomain | Notes |
|---|---|---|---|---|---|---|
| `cmc_gem_hrdps_west` | HRDPS West 1 km | 48h | 1 km | 1h | `cmc_gem_hrdps_west` | No `rain`/`showers` (derive rain = precip − snowfall/0.7). No pressure levels, so no freezing level. 12-hourly runs. |
| `cmc_gem_hrdps` | HRDPS Continental | 48h | 2.5 km | 1h | `cmc_gem_hrdps` | Full pressure levels (1000–500 hPa). |
| `ncep_hrrr_conus` | HRRR | 48h | 3 km | 1h | `ncep_hrrr_conus` | **Native `freezing_level_height`.** Coverage ends around 52°N here: OK for Calgary, Kananaskis, Lake Louise, Golden, Revelstoke, Whistler. **Nothing for Jasper, Valemount, Edmonton.** Hide when all values are null. |
| `cmc_gem_rdps` | RDPS | 3.5d | 10 km | 1h | `cmc_gem_rdps_10km` | Full pressure levels. 6-hourly runs, 84h. |
| `cmc_gem_gdps` | GDPS | 10d | 15 km | 3h | `cmc_gem_gdps_15km` | Full pressure levels. ~240h. |
| `ecmwf_ifs` | ECMWF IFS 9 km | 10d | 9 km | 1–3h | `ecmwf_ifs` | HRES. No pressure levels. **Freezing level comes from `ecmwf_ifs025`** (same run cycle), fetched as a hidden companion. |
| `ecmwf_aifs025_single` | ECMWF AIFS | 10d | 0.25° | 6h | `ecmwf_aifs025_single` | **No `wind_gusts_10m`, no `snow_depth`.** Pressure levels 1000/925/850/700/600/500. |
| `gem_global_ensemble` | GEPS (mean ± spread) | 16d | 0.35° | 3h | `cmc_gem_geps` | Ensemble API, 21 members. **No gusts, no freezing level** (only 850/500 hPa, too coarse to derive). Show mean line + P10–P90 band. |

Companion (not user-visible): `ecmwf_ifs025` (meta `ecmwf_ifs025`), whose pressure
levels 1000/925/850/700/600/500 supply derived freezing level for `ecmwf_ifs`.

Each registry entry carries: `id`, `api` ("forecast" | "ensemble"), `label`,
`shortLabel`, `color` (light + dark), `horizon`, `resolution`, `coverage`
(description + runtime null-detection), `metaDomain`, `variables` (which
canonical vars it supports), `freezingLevel` ("native" | "derived" |
{ from: companionId } | "none"). Adding or removing a model must only touch
this file.

### Hourly variables (canonical names, Open-Meteo names)
`temperature_2m`, `precipitation`, `rain`, `showers`, `snowfall` (cm),
`wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `cloud_cover`,
`freezing_level_height`, `relative_humidity_2m`, `pressure_msl`,
`weather_code`, plus `temperature_<L>hPa` and `geopotential_height_<L>hPa`
for freezing-level derivation.

### Derived freezing level
For models with `freezingLevel: "derived"`: per hour, walk the pressure-level
profile from the bottom up (surface 2 m temp at the grid elevation, then levels
whose geopotential height is above ground). Find the first level pair that
crosses 0 °C and linearly interpolate the height. Above-freezing up to 500 hPa
→ clamp/flag ">5.5 km". Below freezing at the surface → report the surface
elevation (FZL at ground). Derived series are marked "derived" in the legend/
tooltip. Covered by unit tests with synthetic profiles.

## Architecture

```
src/
  config/models.ts       model registry (single source of truth)
  config/horizons.ts     horizon tabs: id, label, hours, default models
  config/spots.ts        seed spots
  data/openmeteo.ts      request builders + fetchers (forecast, ensemble, meta)
  data/normalize.ts      raw response → ModelSeries {time[], vars{}} per model
  data/derive.ts         freezing level, rain-from-snowfall, ensemble stats, daily summary
  data/cache.ts          IndexedDB forecast cache (idb-keyval), fetchedAt stamps
  data/geocode.ts        Open-Meteo geocoding search
  state/                 zustand stores: spots (localStorage), ui prefs
  hooks/                 useForecast (cache-first, then network), useScrubber
  components/charts/     uPlot wrappers, synced cursor, legend/tooltip
  components/            SpotPager, SpotPicker, HorizonTabs, ModelChips, DailySummary,
                         MapPicker (MapLibre), SearchSheet, Freshness, Attribution
  routes/ (none)         single-page; URL state via query params
```

- **Fetch strategy**: per spot, *all* visible models are fetched at once in up
  to three requests: short-range forecast (≤96 h models), long-range forecast,
  and the GEPS ensemble. Tab switches are therefore instant and every horizon
  is available offline. Results are cached per (spot, model).
  Meta.json is fetched per model, cached ~10 min. Stale-while-revalidate: render
  the cached data instantly, refresh in the background, and show "Fetched X ago".
  Prefetch adjacent spots after the current one renders.
- **Time**: `timezone=auto` so the axis is the spot's local time. Nulls (model
  ran out of horizon) are gaps, not zeros.
- **Gestures**: horizontal swipe to change spot works on the header +
  at-a-glance area. On the charts, horizontal drag drives the scrubber (no
  conflict). Vertical scroll is native everywhere.
- **Map**: MapLibre GL. Base is OpenFreeMap (vector, no key). A toggle switches
  to OpenTopoMap raster (contours/hillshade, fair use) for terrain. Long-press
  drops a pin. Attribution: © OpenStreetMap contributors, OpenMapTiles,
  OpenFreeMap; OpenTopoMap (CC-BY-SA).
- **PWA**: vite-plugin-pwa (Workbox). Precached app shell, `display:
  standalone`, apple-touch-icons, `viewport-fit=cover`, safe-area insets.
  Forecast data is cached by the app (IndexedDB), not Workbox, so the
  "fetched at" label stays accurate. Map tiles use Workbox runtime cache
  (bounded).
- **iOS home-screen per spot**: the address bar always holds the full,
  self-contained spot link (`?spot=&name=&lat=&lon=[&elev=]`). On iOS
  (`navigator.standalone` defined) the manifest `<link>` is swapped for a
  data-URL manifest whose `start_url` is that link (`src/lib/pwa.ts`), so
  "Add to Home Screen" works whichever URL iOS uses. Each iOS home-screen app
  may get its own storage, so a launch in standalone mode auto-saves an
  unknown spot instead of showing the "Save spot" banner.
- **Startup link**: `applyStartupLink()` runs in `main.tsx` before the first
  render (React StrictMode double effects would otherwise let URL syncing
  clobber it).
- **MapLibre v6** has named exports only (`import * as maplibregl`) and needs
  `setWorkerUrl()` with Vite's `?worker&url` import of
  `maplibre-gl/dist/maplibre-gl-worker.mjs`.

### Charting library: uPlot
Chosen for dense multi-series time series on phones. ~50 KB and canvas
rendered, so 8 models × 384 hours × 5 charts stays at 60 fps where SVG libs
(Recharts, Nivo) bog down. It also has built-in cursor sync across charts
(`cursor.sync`), which gives the shared scrubber for free. It supports bands
(GEPS spread), bars (precip) and step/line series, and has a small, stable
API. Touch scrubbing is wired with pointer events into `setCursor`.
ECharts was rejected for size (~1 MB), Chart.js for perf with many points
and weaker cursor sync.

### Tech stack
Vite 8 + React 19 + TypeScript (strict) + Tailwind CSS 4 · uPlot · MapLibre GL 6 ·
zustand · idb-keyval · motion (framer-motion) for transitions ·
vite-plugin-pwa · Vitest (unit) · Playwright (smoke at iPhone viewport,
Chromium at `/opt/pw-browsers` in the cloud env) · deployed to Vercel.

## Conventions

- Mobile-first: design at 390×844 (iPhone 14/15) first; desktop is secondary.
- Dark mode follows the system by default, with a manual override. Colours are
  Tailwind theme tokens (CSS variables). Model colours live only in the registry.
- Units: metric (°C, mm, cm snow, km/h, m, hPa).
- No model IDs, colours or horizons hard-coded outside `src/config/`.
- Pure data functions (`src/data/`) have no React imports and are unit tested.
- Never treat missing values as 0. Use `null` → chart gaps.
- Keep requests polite: no polling, refresh on focus only if data > 15 min old.
- Before each commit: `npm run check` (typecheck, lint, tests, build).
- Visual check: `npm run dev`, then `npm run shot -- <url> <out.png> [--dark]
  [--viewport]` renders an iPhone 15 viewport via Playwright (API calls are
  proxied through Node). `SHOT_ACTIONS` env can script clicks before capture.
- Refresh API fixtures: `npm run fixtures`. App icons: `npx tsx scripts/icons.ts`.
- One commit (or a few) at the end of each milestone; message prefixed `M<n>:`.

## Milestones

0. **Spec**: this file. ✅
1. **Data layer + model registry**: ✅ Vite/TS/Tailwind scaffold, registry with
   verified IDs, request builders, normalizer, derived freezing level /
   rain / ensemble stats / daily summary, meta.json freshness, IndexedDB cache,
   unit tests against recorded fixtures.
2. **Single spot, 48h, multi-model charts**: ✅ uPlot chart stack, shared
   scrubber + tooltip, model chips, at-a-glance row, freshness labels.
3. **Saved spots + switching + deep links + sharing**: ✅ spot store, search, current
   location, MapLibre long-press pin, reorder/delete/rename, elevation override,
   swipe pager + picker, `?spot=` deep links, share links, last-viewed restore.
4. **Remaining horizons + GEPS**: ✅ 3.5d/10d/16d tabs, ECMWF IFS + companion FZL,
   GEPS mean + spread band, cross-horizon toggles.
5. **PWA / offline polish**: ✅ manifest, icons, service worker, offline labelling,
   safe areas, per-spot home-screen manifests, Vercel deploy.
6. **Visual design pass**: typography, motion, dark mode tuning, empty/error
   states, haptics-feel micro-interactions.
