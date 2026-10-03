import { AlertTriangle, Info, AlertCircle } from 'lucide-react'

interface Props {
  severity: 'info' | 'watch' | 'action'
  kind: string
  summary: string
  confidence: number
  evidenceCount: number
}

const severityConfig = {
  info: { icon: Info, color: 'text-blue-light', bg: 'bg-blue-accent/10', border: 'border-blue-accent/30' },
  watch: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  action: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
}

export default function SignalCard({ severity, kind, summary, confidence, evidenceCount }: Props) {
  const cfg = severityConfig[severity]
  const Icon = cfg.icon

  return (
    <div className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border} hover:brightness-110 transition cursor-pointer`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={cfg.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{severity}</span>
            <span className="text-xs text-text-muted">· {kind.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-sm text-white mb-2">{summary}</p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>Confidence: {Math.round(confidence * 100)}%</span>
            <span>{evidenceCount} evidence items</span>
          </div>
        </div>
      </div>
    </div>
  )
}