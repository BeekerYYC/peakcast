# Peakcast

A personal, mobile-first weather PWA for mountain days around Calgary and the
Rockies. It overlays forecast models on the same charts (HRDPS West/Continental,
HRRR, RDPS, GDPS, ECMWF IFS 9 km and AIFS, and GEPS mean ± spread) so you can
compare them without clicking around. Data comes from [Open-Meteo](https://open-meteo.com/)
(CC BY 4.0). Personal, non-commercial use only.

## Using it

- **Switch spots**: swipe the spot name (or the dots at the bottom) left or right,
  or tap the name for the list. The app reopens on the last spot you viewed.
- **Add spots**: search, use your current location, or long-press the map to drop
  a pin. Edit a spot to rename it or set an elevation override (summit vs trailhead).
- **Compare models**: each tab (48h / 3.5d / 10d / 16d) overlays its models.
  Toggle them with the chips, or tap **Compare** to add models from other tabs.
- **Scrub**: drag across any chart. All charts follow the same hour, and every
  model's value shows in the chart headers.
- **Offline**: the last forecast for each spot is kept on the device and labelled
  with when it was fetched.
- **Share with friends**: the share button sends a link that opens that spot's
  forecast directly, and they can tap *Save spot*. Settings → *Share Peakcast*
  sends the app itself.
- **Home-screen icon per spot (iOS)**: open the spot in Safari, then Share →
  *Add to Home Screen*.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests + production build
npm run shot -- "http://localhost:5173/?spot=calgary" out.png [--dark] [--viewport]
npm run fixtures   # re-record API fixtures used by the tests
```

See `CLAUDE.md` for the spec, architecture and the verified model registry
(`src/config/models.ts` is the single place to add or remove models).

## Deploy (Vercel)

Import this repository in Vercel (framework preset: Vite). `vercel.json` sets
the build, SPA rewrite and cache headers. Every push to the default branch
deploys, and each branch gets a preview URL.
