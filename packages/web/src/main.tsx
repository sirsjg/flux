import { render } from 'preact'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './styles/theme.css'
import './styles/typography.css'
import './index.css'
import './dev-error-handlers' // Install global error handlers in dev mode
import { App } from './app.tsx'

const appElement = document.getElementById('app')
if (appElement !== null) {
  render(<App />, appElement)
}
// Force Rebuild
