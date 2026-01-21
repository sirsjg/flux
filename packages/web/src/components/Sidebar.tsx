import type { JSX } from 'preact'
import { route } from 'preact-router'
import { ComponentType } from 'preact'
import './Sidebar.css'

interface IconProps {
  className?: string
  style?: Record<string, string>
}

interface NavItem {
  label: string
  icon: ComponentType<IconProps>
  path: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Platform',
    items: [
      {
        label: 'Projects',
        path: '/',
        icon: (props: IconProps) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        )
      },
      {
        label: 'My Tasks',
        path: '/tasks',
        icon: (props: IconProps) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        )
      },
      {
        label: 'Inbox',
        path: '/inbox',
        icon: (props: IconProps) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )
      },
    ],
  },
  {
    title: 'Configuration',
    items: [
      {
        label: 'Team',
        path: '/team',
        icon: (props: IconProps) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path d="M17 21v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a2 2 0 0 0-2-2-3-3 0 0 0-3-3"></path>
            <circle cx="16" cy="3.13" r="4"></circle>
          </svg>
        )
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: (props: IconProps) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        )
      },
    ],
  },
]

interface SidebarProps {
  currentPath?: string
}

export function Sidebar({ currentPath = '/' }: SidebarProps): JSX.Element {
  const handleNavClick = (path: string): void => {
    route(path)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <svg className="sidebar-brand-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span className="sidebar-brand-text">Flux</span>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="sidebar-nav-group">
            <div className="sidebar-nav-group-title">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = currentPath === item.path
              return (
                <button
                  key={item.path}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.path)}
                  type="button"
                >
                  <Icon className="sidebar-nav-item-icon" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
