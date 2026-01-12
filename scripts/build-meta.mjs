import { execSync, spawnSync } from 'node:child_process'

const resolveSha = () => {
  if (process.env.BUILD_SHA) return process.env.BUILD_SHA
  if (process.env.GIT_SHA) return process.env.GIT_SHA
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const buildSha = resolveSha()
const buildTime = process.env.BUILD_TIME?.trim() || new Date().toISOString()

// Build shared first (other packages depend on its types)
const sharedResult = spawnSync('bun', ['run', '--filter', '@flux/shared', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BUILD_SHA: buildSha, BUILD_TIME: buildTime },
})

if (sharedResult.status !== 0) {
  process.exit(sharedResult.status ?? 1)
}

// Then build everything else
const result = spawnSync(
  'bun',
  ['run', '--filter', '!@flux/shared', 'build', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      BUILD_SHA: buildSha,
      BUILD_TIME: buildTime,
    },
  }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
