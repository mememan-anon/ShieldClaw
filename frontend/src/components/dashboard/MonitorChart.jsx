import { startMonitor, stopMonitor } from '../../api/client';

export default function MonitorChart({ health }) {
  const running = health?.monitor?.running;
  const stats = health?.monitor?.stats;
  const current = stats?.current;

  const handleToggle = async () => {
    try {
      if (running) await stopMonitor();
      else await startMonitor();
    } catch {}
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Runtime Monitor</h3>
        <button onClick={handleToggle}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
            running
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}>
          {running ? 'Stop' : 'Start'}
        </button>
      </div>

      {current ? (
        <div className="space-y-4">
          <MetricBar label="CPU" value={current.cpu || 0} max={100} unit="%" color="bg-blue-500" />
          <MetricBar label="Memory" value={current.memory || 0} max={100} unit="%" color="bg-purple-500" />
          <MetricBar
            label="Net In"
            value={(current.network?.in || 0) / 1024}
            max={1024}
            unit="KB/s"
            color="bg-emerald-500"
          />
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-800">
            <Stat label="Alerts" value={stats.alerts || 0} />
            <Stat label="Checks" value={stats.checks || 0} />
            <Stat label="Baseline CPU" value={stats.baseline?.cpu?.toFixed(1) || 'N/A'} />
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 text-sm">Monitor is not running.</p>
          <p className="text-gray-700 text-xs mt-1">Click Start to begin tracking CPU, memory, and network usage.</p>
        </div>
      )}
    </div>
  );
}

function MetricBar({ label, value, max, unit, color }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const isHigh = pct > 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={isHigh ? 'text-red-400' : 'text-gray-400'}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`${isHigh ? 'bg-red-500' : color} rounded-full h-2 transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-300">{value}</div>
    </div>
  );
}
