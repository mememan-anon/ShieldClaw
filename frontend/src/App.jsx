import { useState } from 'react'
import Navbar from './components/layout/Navbar'
import Dashboard from './pages/Dashboard'
import InteractiveDemo from './pages/InteractiveDemo'

export default function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar activePage={page} onNavigate={setPage} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {page === 'dashboard' ? <Dashboard /> : <InteractiveDemo />}
      </main>
    </div>
  )
}
