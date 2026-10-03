import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import HealthPage from './pages/HealthPage'
import HotspotsPage from './pages/HotspotsPage'
import ChangesPage from './pages/ChangesPage'
import PullRequestsPage from './pages/PullRequestsPage'
import ModulesPage from './pages/ModulesPage'

export default function App() {
  return (
    <div className="flex h-screen bg-dark-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HealthPage />} />
            <Route path="/hotspots" element={<HotspotsPage />} />
            <Route path="/changes" element={<ChangesPage />} />
            <Route path="/pull-requests" element={<PullRequestsPage />} />
            <Route path="/modules" element={<ModulesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}