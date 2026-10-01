import { MODELS } from '../config/models'

/** Model colours as CSS variables (--m-<id>), generated from the registry. */
export function injectModelColors(): void {
  if (document.getElementById('model-colors')) return
  const light = MODELS.map((m) => `--m-${m.id}: ${m.color.light};`).join('')
  const dark = MODELS.map((m) => `--m-${m.id}: ${m.color.dark};`).join('')
  const css = `:root{${light}}
@media (prefers-color-scheme: dark){:root:where(:not([data-theme='light'])){${dark}}}
:root[data-theme='dark']{${dark}}`
  const el = document.createElement('style')
  el.id = 'model-colors'
  el.textContent = css
  document.head.appendChild(el)
}
