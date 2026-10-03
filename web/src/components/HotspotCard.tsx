interface Props {
    rank: number
    path: string
    factors: { label: string; value: number }[]
    onExplain?: () => void
  }
  
  export default function HotspotCard({ rank, path, factors, onExplain }: Props) {
    return (
      <div className="bg-dark-200 border border-dark-300 rounded-xl p-5 hover:border-blue-accent/40 transition-all group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-accent/10 border border-blue-accent/30 flex items-center justify-center text-sm font-bold text-blue-light">
              {rank}
            </div>
            <code className="text-sm font-medium font-mono text-white">{path}</code>
          </div>
          {onExplain && (
            <button
              onClick={onExplain}
              className="text-xs text-blue-accent hover:text-blue-hover opacity-0 group-hover:opacity-100 transition"
            >
              Explain →
            </button>
          )}
        </div>
  
        <div className="grid grid-cols-4 gap-3">
          {factors.map((f) => (
            <div key={f.label}>
              <div className="text-xs text-text-muted mb-1.5">{f.label}</div>
              <div className="h-1.5 bg-dark-400 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-accent to-blue-hover rounded-full transition-all"
                  style={{ width: `${Math.round(f.value * 100)}%` }}
                />
              </div>
              <div className="text-xs text-white mt-1 font-mono">{Math.round(f.value * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    )
  }