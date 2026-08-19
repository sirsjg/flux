import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { route, RoutableProps } from 'preact-router'
import { ThemeToggle } from '../components'
import { WebhooksPanel } from '../components/WebhooksPanel'

export default function Webhooks(_props: RoutableProps) {
  return (
    <div class="app-shell">
      <div class="navbar glass-navbar">
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
