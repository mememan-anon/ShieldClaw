export default function StatsGrid({ health }) {
  const stats = [
    {
      label: 'Blockchain',
      value: health?.sui?.initialized ? 'Connected' : 'Offline',
      color: health?.sui?.initialized ? 'text-emerald-400' : 'text-red-400',
      sub: health?.sui?.network || 'devnet'
    },
    {
      label: 'Threats Detected',
      value: health?.detector?.detections ?? 0,
      color: (health?.detector?.detections ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400',
      sub: `${health?.detector?.totalChecks ?? 0} total scans`
    },
    {
      label: 'Events Logged',
      value: health?.events?.total ?? 0,
      color: 'text-blue-400',
      sub: 'on-chain + local'
    },
    {
      label: 'Monitor',
      value: health?.monitor?.running ? 'Active' : 'Idle',
      color: health?.monitor?.running ? 'text-emerald-400' : 'text-gray-500',
      sub: health?.monitor?.running ? `${health.monitor.stats?.alerts ?? 0} alerts` : 'Click Start to begin'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{s.label}</div>
          <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          <div className="text-xs text-gray-600 mt-1">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
