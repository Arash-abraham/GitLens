import { NavLink } from 'react-router-dom'
import { Activity, GitBranch, AlertTriangle, GitPullRequest, Settings, Boxes } from 'lucide-react'

const nav = [
  { to: '/', label: 'Health', icon: Activity },
  { to: '/hotspots', label: 'Hotspots', icon: AlertTriangle },
  { to: '/changes', label: 'Changes', icon: GitBranch },
  { to: '/pull-requests', label: 'Pull Requests', icon: GitPullRequest },
  { to: '/modules', label: 'Modules', icon: Boxes },
]

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-dark-200 border-r border-dark-300 flex flex-col">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-dark-300">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-accent to-blue-hover flex items-center justify-center glow-blue">
          <Activity size={18} className="text-white" />
        </div>
        <span className="font-bold text-lg gradient-text">GitLens</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-accent/10 text-blue-light border border-blue-accent/30'
                  : 'text-text-muted hover:text-white hover:bg-dark-300'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-dark-300">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:text-white hover:bg-dark-300 w-full transition-all">
          <Settings size={18} />
          Settings
        </button>
      </div>
    </aside>
  )
}