import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
  hint?: string
}

export default function StatCard({ label, value, change, trend = 'neutral', icon: Icon, hint }: Props) {
  const trendColor =
    trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-text-muted'

  return (
    <div className="bg-dark-200 border border-dark-300 rounded-xl p-5 hover:border-blue-accent/30 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-dark-300 border border-dark-400 flex items-center justify-center group-hover:border-blue-accent/40 transition">
          <Icon size={18} className="text-blue-accent" />
        </div>
        {change && <span className={`text-xs font-medium ${trendColor}`}>{change}</span>}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-text-muted">{label}</div>
      {hint && <div className="text-xs text-text-muted/70 mt-2">{hint}</div>}
    </div>
  )
}