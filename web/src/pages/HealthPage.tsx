import { Activity, AlertTriangle, GitCommit, Bot, Users, ArrowUpRight } from 'lucide-react'
import StatCard from '../components/StatCard'
import TrendChart from '../components/TrendChart'
import HotspotCard from '../components/HotspotCard'
import SignalCard from '../components/SignalCard'

const churnData = [2.1, 2.4, 2.2, 2.8, 3.1, 3.4, 3.2, 3.8, 4.2, 4.5, 4.8, 5.7]
const reworkData = [12, 14, 13, 16, 18, 21, 20, 24, 27, 29, 31, 34]
const labels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

const hotspots = [
  {
    path: 'src/billing/',
    factors: [
      { label: 'Frequency', value: 0.92 },
      { label: 'Volatility', value: 0.78 },
      { label: 'Rework', value: 0.82 },
      { label: 'Authors', value: 0.6 },
    ],
  },
  {
    path: 'src/payments/webhooks.ts',
    factors: [
      { label: 'Frequency', value: 0.81 },
      { label: 'Volatility', value: 0.72 },
      { label: 'Rework', value: 0.75 },
      { label: 'Authors', value: 0.5 },
    ],
  },
  {
    path: 'src/auth/session.ts',
    factors: [
      { label: 'Frequency', value: 0.68 },
      { label: 'Volatility', value: 0.64 },
      { label: 'Rework', value: 0.71 },
      { label: 'Authors', value: 0.4 },
    ],
  },
]

const signals = [
  {
    severity: 'action' as const,
    kind: 'unstable_hotspot',
    summary: 'src/billing/ has top-quartile rework (82%) for 3 consecutive months with 9 contributors.',
    confidence: 0.91,
    evidenceCount: 14,
  },
  {
    severity: 'watch' as const,
    kind: 'agent_concentration',
    summary: 'Agent-attributed changes in src/payments are 2.3× the org baseline, with 34% rework within 14 days.',
    confidence: 0.78,
    evidenceCount: 8,
  },
  {
    severity: 'watch' as const,
    kind: 'coupling_growth',
    summary: 'src/billing and src/payments now co-change 3.4× above their trailing baseline.',
    confidence: 0.82,
    evidenceCount: 11,
  },
]

export default function HealthPage() {
  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold mb-1">Repository Health</h1>
        <p className="text-sm text-text-muted">
          Deterministic facts over the last 52 weeks · engine v2026.10.1
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Stability Index"
          value="0.71"
          change="−8.2%"
          trend="down"
          hint="Composite of rework + reversion"
        />
        <StatCard
          icon={GitCommit}
          label="Churn Rate (30d)"
          value="5.7%"
          change="+39%"
          trend="down"
          hint="Lines rewritten within 14d"
        />
        <StatCard
          icon={Bot}
          label="Agent Share"
          value="23%"
          change="coverage 71%"
          trend="neutral"
          hint="Tier-0 attribution only"
        />
        <StatCard
          icon={Users}
          label="Active Hotspots"
          value="7"
          change="+2"
          trend="down"
          hint="Across 3 modules"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart title="Churn Rate" data={churnData} labels={labels} unit="%" color="#417BFF" />
        <TrendChart title="Rework Ratio" data={reworkData} labels={labels} unit="%" color="#B4C6EE" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Hotspots</h2>
            <button className="text-xs text-blue-accent hover:text-blue-hover flex items-center gap-1">
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          {hotspots.map((h, i) => (
            <HotspotCard key={h.path} rank={i + 1} path={h.path} factors={h.factors} onExplain={() => {}} />
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Signals</h2>
            <span className="text-xs text-text-muted">{signals.length} findings</span>
          </div>
          {signals.map((s, i) => (
            <SignalCard key={i} {...s} />
          ))}
        </div>
      </div>
    </div>
  )
}