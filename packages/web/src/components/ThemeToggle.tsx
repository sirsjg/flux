import { MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <label class="swap swap-rotate btn btn-ghost btn-circle btn-sm">
      <input
        type="checkbox"
        checked={theme === 'dark'}
        onChange={toggleTheme}
        class="theme-controller"
        aria-label="Toggle dark mode"
      />
      {/* Sun icon */}
      <SunIcon className="swap-off h-5 w-5" />
      {/* Moon icon */}
      <MoonIcon className="swap-on h-5 w-5" />
    </label>
  )
}
