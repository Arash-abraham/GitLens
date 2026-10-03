import { Search, Bell, GitBranch } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="h-16 shrink-0 bg-dark-200/80 backdrop-blur-sm border-b border-dark-300 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <GitBranch size={16} />
          <span className="hover:text-white cursor-pointer transition">acme-corp</span>
          <span>/</span>
          <span className="text-white font-medium">gitlens-app</span>
        </div>
        <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
          ready
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            placeholder="Search modules, files, commits..."
            className="w-72 bg-dark-300 border border-dark-400 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-blue-accent/60 focus:ring-2 focus:ring-blue-accent/20 transition"
          />
        </div>
        <button className="w-9 h-9 rounded-lg bg-dark-300 border border-dark-400 flex items-center justify-center hover:border-blue-accent/50 transition">
          <Bell size={16} className="text-text-muted" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-accent to-blue-hover flex items-center justify-center text-sm font-semibold">
          A
        </div>
      </div>
    </header>
  )
}