export type WxIcon = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'mixed' | 'thunder'

/** WMO weather interpretation codes (as returned by Open-Meteo). */
export function wmo(code: number | null | undefined): { icon: WxIcon; label: string } {
  switch (code) {
    case 0:
      return { icon: 'clear', label: 'Clear' }
    case 1:
      return { icon: 'partly', label: 'Mostly clear' }
    case 2:
      return { icon: 'partly', label: 'Partly cloudy' }
    case 3:
      return { icon: 'cloudy', label: 'Overcast' }
    case 45:
    case 48:
      return { icon: 'fog', label: 'Fog' }
    case 51:
    case 53:
    case 55:
      return { icon: 'drizzle', label: 'Drizzle' }
    case 56:
    case 57:
    case 66:
    case 67:
      return { icon: 'mixed', label: 'Freezing rain' }
    case 61:
      return { icon: 'rain', label: 'Light rain' }
    case 63:
      return { icon: 'rain', label: 'Rain' }
    case 65:
      return { icon: 'rain', label: 'Heavy rain' }
    case 80:
    case 81:
    case 82:
      return { icon: 'rain', label: 'Showers' }
    case 71:
      return { icon: 'snow', label: 'Light snow' }
    case 73:
      return { icon: 'snow', label: 'Snow' }
    case 75:
      return { icon: 'snow', label: 'Heavy snow' }
    case 77:
      return { icon: 'snow', label: 'Snow grains' }
    case 85:
    case 86:
      return { icon: 'snow', label: 'Snow showers' }
    case 95:
      return { icon: 'thunder', label: 'Thunderstorm' }
    case 96:
    case 99:
      return { icon: 'thunder', label: 'Thunderstorm, hail' }
    default:
      return { icon: 'cloudy', label: '—' }
  }
}

/** A representative daily code: the 75th-percentile code of daytime hours. */
export function dailyCode(codes: (number | null)[]): number | null {
  const v = codes.filter((c): c is number => c != null).sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.min(v.length - 1, Math.floor(v.length * 0.75))]
}
