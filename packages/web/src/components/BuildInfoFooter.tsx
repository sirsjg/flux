import { useEffect, useState } from 'preact/hooks'

type VersionInfo = {
  sha: string
  time: string
}

const formatSha = (value: string) => {
  if (!value) return 'unknown'
  return value.length > 8 ? value.slice(0, 8) : value
}

const formatTime = (value: string) => {
  if (!value) return 'unknown time'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString().replace('T', ' ').replace('Z', ' UTC')
}

const uiInfo: VersionInfo = {
  sha: import.meta.env.VITE_BUILD_SHA || 'dev',
  time: import.meta.env.VITE_BUILD_TIME || '',
}

export function BuildInfoFooter() {
  const [apiInfo, setApiInfo] = useState<VersionInfo | null>(null)

  useEffect(() => {
    const apiBase = import.meta.env.DEV ? 'http://localhost:3000' : ''
    fetch(`${apiBase}/version`)
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (data?.sha) {
          setApiInfo({ sha: data.sha, time: data.time || '' })
        }
      })
      .catch(() => undefined)
  }, [])

  return (
    <footer class="glass-footer fixed bottom-0 left-0 right-0 z-40 text-base-content/70 text-xs px-3 py-2">
      <div class="mx-auto max-w-6xl flex flex-wrap items-center justify-center gap-3">
        <span>UI {formatSha(uiInfo.sha)} · {formatTime(uiInfo.time)}</span>
        {apiInfo && (
          <span>API {formatSha(apiInfo.sha)} · {formatTime(apiInfo.time)}</span>
        )}
      </div>
    </footer>
  )
}
