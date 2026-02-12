import { useState, useEffect } from 'react';
import { fetchHealth } from '../api/client';
import { useSSE } from '../hooks/useSSE';
import StatsGrid from '../components/dashboard/StatsGrid';
import HealthCard from '../components/dashboard/HealthCard';
import SuiInfoCard from '../components/dashboard/SuiInfoCard';
import EventFeed from '../components/dashboard/EventFeed';
import MonitorChart from '../components/dashboard/MonitorChart';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const { events, connected } = useSSE();

  useEffect(() => {
    const poll = async () => {
      try {
        setHealth(await fetchHealth());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-400">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <StatsGrid health={health} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthCard health={health} />
        <SuiInfoCard sui={health?.sui} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonitorChart health={health} />
        <EventFeed events={events} />
      </div>
    </div>
  );
}
