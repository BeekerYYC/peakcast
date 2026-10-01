// Peakcast widget loader for Scriptable.
// 1. Replace the URL below with your Peakcast address (no trailing slash).
// 2. Leave the rest as is: it downloads the latest widget code from your
//    Peakcast site each refresh and falls back to the last copy offline.
const BASE = 'https://YOUR-APP.vercel.app'

const fm = FileManager.local()
const file = fm.joinPath(fm.documentsDirectory(), 'peakcast-widget-code.js')
try {
  const req = new Request(BASE + '/widget.js')
  req.timeoutInterval = 15
  const code = await req.loadString()
  if (code.includes('PEAKCAST_WIDGET')) fm.writeString(file, code)
  else console.log('Downloaded something that is not the widget. Is BASE right? Got: ' + code.slice(0, 80))
} catch {
  console.log('Could not reach ' + BASE + '/widget.js, using saved copy')
  // offline: use the saved copy
}
if (!fm.fileExists(file)) throw new Error('Could not download the widget from ' + BASE + '/widget.js. Check BASE (currently ' + BASE + ') and your connection.')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
await new AsyncFunction('BASE', fm.readString(file))(BASE)
