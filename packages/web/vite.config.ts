import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

const resolveBuildSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return process.env.GIT_SHA ?? process.env.BUILD_SHA ?? 'dev'
  }
}

const buildSha = resolveBuildSha()
const buildTime = process.env.BUILD_TIME?.trim() || new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],
  define: {
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(buildSha),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  },
})
