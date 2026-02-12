const TYPE_STYLES = {
  prompt_analysis: { color: 'text-amber-400', label: 'prompt' },
  skill_verification: { color: 'text-blue-400', label: 'verify' },
  blockchain_log: { color: 'text-emerald-400', label: 'chain' },
  attestation: { color: 'text-purple-400', label: 'attest' },
  monitor_alert: { color: 'text-red-400', label: 'alert' },
  monitor_metrics: { color: 'text-gray-600', label: 'metric' },
  connected: { color: 'text-gray-600', label: 'system' }
};

function formatDetail(event) {
  if (event.digest) return `tx: ${event.digest.slice(0, 20)}...`;
  if (event.detected !== undefined) return event.detected ? 'THREAT DETECTED' : 'clean';
  if (event.eventHash) return `hash: ${event.eventHash.slice(0, 16)}...`;
  if (event.hash) return `hash: ${event.hash}...`;
  if (event.patternsFound !== undefined) return `${event.patternsFound} patterns, ${event.allowed ? 'approved' : 'blocked'}`;
  if (event.type === 'connected') return 'Event stream connected';
  if (event.cpu !== undefined) return `cpu: ${event.cpu?.toFixed(1)}%`;
  return '';
}

export default function EventFeed({ events }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Live Events</h3>
        <span className="text-xs text-gray-500">{events.length} events</span>
      </div>
      <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
        {events.length === 0 && (
          <p className="text-gray-600 text-sm py-4 text-center">
            No events yet. Try the Interactive Demo to generate events.
          </p>
        )}
        {events.map((e, i) => {
          const style = TYPE_STYLES[e.type] || { color: 'text-gray-500', label: e.type };
          return (
            <div key={i} className="flex items-start gap-2 text-xs font-mono py-1.5 border-b border-gray-800/50">
              <span className="text-gray-600 shrink-0 w-16">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <span className={`${style.color} shrink-0 w-14`}>[{style.label}]</span>
              <span className="text-gray-400 truncate">{formatDetail(e)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
