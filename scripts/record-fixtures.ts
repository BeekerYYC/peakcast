import { writeFileSync } from 'node:fs'
import { buildForecastUrl, buildEnsembleUrl } from '../src/data/openmeteo'
const kan = { lat: 50.91598, lon: -115.14156 }
const jobs: [string, string][] = [
  ['kananaskis-48h.json', buildForecastUrl(kan, ['cmc_gem_hrdps_west', 'cmc_gem_hrdps', 'ncep_hrrr_conus'])],
  ['kananaskis-10d.json', buildForecastUrl(kan, ['cmc_gem_gdps', 'ecmwf_ifs', 'ecmwf_aifs025_single'])],
  ['kananaskis-rdps-summit.json', buildForecastUrl({ ...kan, elevation: 2819 }, ['cmc_gem_rdps'])],
  ['jasper-48h.json', buildForecastUrl({ lat: 52.87, lon: -118.08 }, ['cmc_gem_hrdps', 'ncep_hrrr_conus'])],
  ['kananaskis-geps.json', buildEnsembleUrl(kan, 'gem_global_ensemble')],
]
const only = process.argv[2]
for (const [f, u] of jobs) {
  if (only && !f.includes(only)) continue
  console.log(f, u.length)
  let j: any
  let ok = false
  for (let i = 0; i < 5 && !ok; i++) {
    try {
      const r = await fetch(u)
      j = await r.json()
      ok = r.ok
      if (!ok) console.log(j)
    } catch {
      await new Promise((s) => setTimeout(s, 2000 * (i + 1)))
    }
  }
  if (!ok) continue
  writeFileSync('tests/fixtures/' + f, JSON.stringify(j))
  console.log(' keys', Object.keys(j), Object.keys(j.hourly).slice(0, 6), j.hourly.time.length, j.elevation, j.timezone)
}
