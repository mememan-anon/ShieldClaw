export default function HealthCard({ health }) {
  if (!health) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-gray-800 rounded w-full" />)}
        </div>
      </div>
    );
  }

  const checks = [
    { label: 'API Server', ok: health.status === 'ok' },
    { label: 'Sui Blockchain', ok: health.sui?.initialized },
    { label: 'Prompt Detector', ok: true },
    { label: 'Input Sanitizer', ok: true },
    { label: 'Skill Verifier', ok: true },
    { label: 'LLM Analyzer', ok: health.llm?.enabled },
    { label: 'Behavior Monitor', ok: health.monitor?.running }
  ];

  const onlineCount = checks.filter(c => c.ok).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">System Health</h3>
        <span className="text-xs text-gray-500">{onlineCount}/{checks.length} online</span>
      </div>
      <div className="space-y-2.5">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${c.ok ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              <span className="text-gray-400">{c.label}</span>
            </div>
            <span className={`text-xs font-medium ${c.ok ? 'text-emerald-400' : 'text-gray-600'}`}>
              {c.ok ? 'Online' : 'Offline'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
