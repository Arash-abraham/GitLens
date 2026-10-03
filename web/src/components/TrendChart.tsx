interface Props {
    title: string
    data: number[]
    labels: string[]
    color?: string
    unit?: string
  }
  
  export default function TrendChart({ title, data, labels, color = '#417BFF', unit = '' }: Props) {
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const w = 800
    const h = 200
    const pad = 20
    const step = (w - pad * 2) / (data.length - 1)
  
    const points = data
      .map((d, i) => `${pad + i * step},${h - pad - ((d - min) / range) * (h - pad * 2)}`)
      .join(' ')
  
    const areaPoints = `${pad},${h - pad} ${points} ${pad + (data.length - 1) * step},${h - pad}`
  
    return (
      <div className="bg-dark-200 border border-dark-300 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="text-xs text-text-muted">
            {data[data.length - 1]}{unit} latest
          </span>
        </div>
  
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
  
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={pad}
              x2={w - pad}
              y1={pad + p * (h - pad * 2)}
              y2={pad + p * (h - pad * 2)}
              stroke="#1A2B4A"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}
  
          <polygon points={areaPoints} fill="url(#trendGrad)" />
          <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
  
        <div className="flex justify-between mt-3 text-xs text-text-muted">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      </div>
    )
  }