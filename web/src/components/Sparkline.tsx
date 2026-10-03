interface Props {
    data: number[]
    color?: string
    height?: number
  }
  
  export default function Sparkline({ data, color = '#417BFF', height = 40 }: Props) {
    if (data.length === 0) return null
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const width = 100
    const step = width / (data.length - 1)
  
    const points = data
      .map((d, i) => `${i * step},${height - ((d - min) / range) * height}`)
      .join(' ')
  
    const areaPoints = `0,${height} ${points} ${width},${height}`
  
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${color})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }