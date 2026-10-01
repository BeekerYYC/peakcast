export function Attribution() {
  return (
    <footer className="px-1 pt-4 pb-2 text-center text-[11px] leading-relaxed text-muted">
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Weather data by Open-Meteo.com
      </a>{' '}
      (
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        CC BY 4.0
      </a>
      ) · Models: ECCC (GEM), NOAA (HRRR), ECMWF
      <br />
      Freezing level for GEM/ECMWF is derived from pressure levels. Personal, non-commercial use.
    </footer>
  )
}
