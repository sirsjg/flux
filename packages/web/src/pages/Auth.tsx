import { useState, useEffect, useRef } from 'preact/hooks'
import { route, RoutableProps } from 'preact-router'
import { completeCliAuth, getAuthStatus, getProjects, type ProjectWithStats } from '../stores/api'
import { setToken, clearToken } from '../stores/auth'

interface AuthProps extends RoutableProps {
  token?: string
}

export function Auth({ token: urlToken }: AuthProps) {
  // Store token in ref to persist after URL clear
  const tokenRef = useRef(urlToken)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'server' | 'project'>('server')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Clear token from URL to prevent leakage via history/referrer
  useEffect(() => {
    if (urlToken && window.history.replaceState) {
      window.history.replaceState({}, '', '/auth')
    }
  }, [urlToken])

  useEffect(() => {
    checkAuth()
    loadProjects()
  }, [])

  const checkAuth = async () => {
    try {
      const status = await getAuthStatus()
      setAuthenticated(status.authenticated)
    } catch {
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      const p = await getProjects()
      setProjects(p)
    } catch {
      // Projects may not be accessible without auth
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    const token = tokenRef.current
    if (!token) {
      setError('No auth token provided')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const projectIds = scope === 'project' ? selectedProjects : undefined
      const result = await completeCliAuth(token, name.trim(), projectIds)
      if (result.success) {
        setSuccess(true)
      } else {
        setError('Failed to complete authentication')
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = (e: Event) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const tokenInput = form.elements.namedItem('apiKey') as HTMLInputElement
    if (tokenInput?.value) {
      setToken(tokenInput.value)
      setAuthenticated(true)
      if (tokenRef.current) {
        // CLI auth flow - refresh to re-check auth
        window.location.reload()
      } else {
        // Standalone login - go to dashboard
        route('/')
      }
    }
  }

  if (loading) {
    return (
      <div class="app-shell flex items-center justify-center p-4">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  // If not authenticated and this is CLI auth, show login prompt
  if (!authenticated && tokenRef.current) {
    return (
      <div class="app-shell flex items-center justify-center p-4">
        <div class="card glass-card w-96">
          <div class="card-body">
            <h2 class="card-title text-2xl mb-4">Login Required</h2>
            <p class="text-sm opacity-70 mb-4">
              Enter your API key to authorize this CLI session.
            </p>
            <form onSubmit={handleLogin}>
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">API Key</span>
                </label>
                <input
                  type="password"
                  name="apiKey"
                  placeholder="flx_..."
                  class="input input-bordered w-full"
                  required
                />
              </div>
              <button type="submit" class="btn btn-primary w-full">
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div class="app-shell flex items-center justify-center p-4">
        <div class="card glass-card w-96">
          <div class="card-body text-center">
            <div class="text-6xl mb-4">✓</div>
            <h2 class="card-title text-2xl justify-center mb-4">Authorized!</h2>
            <p class="opacity-70">
              The CLI has been authorized. You can close this window.
            </p>
            <div class="card-actions justify-center mt-4">
              <button class="btn btn-ghost" onClick={() => route('/')}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No token - show login form or auth info
  if (!tokenRef.current) {
    return (
      <div class="app-shell flex items-center justify-center p-4">
        <div class="card glass-card w-96">
          <div class="card-body">
            <h2 class="card-title text-2xl mb-4">Login</h2>

            {authenticated ? (
              <>
                <p class="text-sm opacity-70 mb-4">You are logged in.</p>
                <div class="card-actions justify-between">
                  <button class="btn btn-ghost" onClick={() => route('/')}>
                    Go to Dashboard
                  </button>
                  <button
                    class="btn btn-outline btn-error"
                    onClick={() => {
                      clearToken()
                      window.location.reload()
                    }}
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <p class="text-sm opacity-70 mb-4">
                  Enter your API key to access the dashboard.
                </p>
                <form onSubmit={handleLogin}>
                  <div class="form-control mb-4">
                    <input
                      type="password"
                      name="apiKey"
                      placeholder="flx_..."
                      class="input input-bordered w-full"
                      required
                    />
                  </div>
                  <button type="submit" class="btn btn-primary w-full">
                    Login
                  </button>
                </form>
                <div class="divider">OR</div>
                <p class="text-sm opacity-50 text-center">
                  Run <code class="bg-base-200 px-1 rounded">flux auth</code> from CLI
                </p>
                <div class="card-actions justify-center mt-2">
                  <button class="btn btn-ghost btn-sm" onClick={() => route('/')}>
                    Continue without login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // CLI auth form
  return (
    <div class="app-shell flex items-center justify-center p-4">
      <div class="card glass-card w-96">
        <div class="card-body">
          <h2 class="card-title text-2xl mb-4">Authorize CLI</h2>
          <p class="text-sm opacity-70 mb-4">
            Create an API key for the Flux CLI.
          </p>

          {error && (
            <div class="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">Key Name *</span>
              </label>
              <input
                type="text"
                placeholder="My CLI Key"
                class="input input-bordered w-full"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                required
              />
            </div>

            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">Access Scope</span>
              </label>
              <select
                class="select select-bordered w-full"
                value={scope}
                onChange={(e) => setScope((e.target as HTMLSelectElement).value as 'server' | 'project')}
              >
                <option value="server">Full Access (Server Key)</option>
                <option value="project">Limited to Specific Projects</option>
              </select>
            </div>

            {scope === 'project' && (
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">Select Projects</span>
                </label>
                <div class="max-h-40 overflow-y-auto border rounded-lg p-2">
                  {projects.length === 0 ? (
                    <p class="text-sm opacity-50 p-2">No projects available</p>
                  ) : (
                    projects.map((p) => (
                      <label key={p.id} class="flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm"
                          checked={selectedProjects.includes(p.id)}
                          onChange={(e) => {
                            const checked = (e.target as HTMLInputElement).checked
                            setSelectedProjects(
                              checked
                                ? [...selectedProjects, p.id]
                                : selectedProjects.filter((id) => id !== p.id)
                            )
                          }}
                        />
                        <span class="text-sm">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <div class="card-actions justify-end">
              <button type="button" class="btn btn-ghost" onClick={() => window.close()}>
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={!name.trim() || submitting || (scope === 'project' && selectedProjects.length === 0)}
              >
                {submitting ? <span class="loading loading-spinner loading-sm"></span> : 'Authorize'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
