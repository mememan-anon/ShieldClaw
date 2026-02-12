import { useState } from 'react';
import { logBlockchainEvent, createAttestation } from '../../api/client';

export default function BlockchainLogger() {
  const [title, setTitle] = useState('Prompt Injection Detected');
  const [description, setDescription] = useState('Suspicious input blocked by ShieldClaw defense system');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLog = async () => {
    setLoading(true);
    try {
      setResult(await logBlockchainEvent({ title, description, severity: 2, eventType: 4 }));
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const handleAttest = async () => {
    setLoading(true);
    try {
      setResult(await createAttestation('demo-skill', 'a1b2c3d4e5f6'));
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const explorerLink = result?.digest
    ? `https://suiscan.xyz/devnet/tx/${result.digest}`
    : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">Blockchain Event Logger</h3>
      <p className="text-gray-500 text-xs mb-4">Log a security event to Sui devnet. Real transactions, real on-chain digests.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
          placeholder="Event title" />
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
          placeholder="Description" />
      </div>

      <div className="flex gap-3">
        <button onClick={handleLog} disabled={loading}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">
          {loading ? 'Submitting...' : 'Log Security Event On-Chain'}
        </button>
        <button onClick={handleAttest} disabled={loading}
          className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">
          {loading ? 'Creating...' : 'Create Skill Attestation'}
        </button>
      </div>

      {result?.error && (
        <div className="mt-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm">{result.error}</div>
      )}

      {result && !result.error && (
        <div className="mt-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${result.onChain ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-sm text-gray-300">
              {result.onChain ? 'Recorded on Sui Devnet' : 'Hashed locally (on-chain fallback)'}
            </span>
          </div>

          {result.digest && (
            <div className="text-sm">
              <span className="text-gray-500">TX Digest: </span>
              <a href={explorerLink} target="_blank" rel="noreferrer"
                className="text-blue-400 hover:underline font-mono text-xs break-all">
                {result.digest}
              </a>
            </div>
          )}

          {result.eventHash && (
            <div className="text-sm">
              <span className="text-gray-500">Event Hash: </span>
              <span className="text-gray-300 font-mono text-xs">{result.eventHash}</span>
            </div>
          )}

          {result.signature && (
            <div className="text-sm">
              <span className="text-gray-500">Signature: </span>
              <span className="text-gray-300 font-mono text-xs">{result.signature.slice(0, 40)}...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
