import type { JSX } from 'preact'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { route, type RoutableProps } from 'preact-router'
import { ThemeToggle } from '../components'
import { WebhooksPanel } from '../components/WebhooksPanel'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Webhooks(_props?: RoutableProps): JSX.Element {
  return (
    <div class="min-h-screen bg-base-200">
      <div class="navbar bg-base-100 shadow-lg">
        <div class="flex-1">
          <button class="btn btn-ghost btn-sm" onClick={() => route('/')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <span class="text-xl font-bold px-4">Webhooks</span>
        </div>
        <div class="flex-none flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <div class="p-6">
        <div class="max-w-4xl mx-auto">
          <WebhooksPanel />
        </div>
      </div>
    </div>
  )
}
