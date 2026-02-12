const PACKAGE_ID = '0x5921b2d8e7a8da8d84dda83682fadf130cf7195691109020bcad5e9983f94dcf';

export default function SuiInfoCard({ sui }) {
  if (!sui) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-800 rounded w-full" />)}
        </div>
      </div>
    );
  }

  const addr = sui.address || '';
  const truncated = addr ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : 'N/A';
  const balance = sui.balance ? (parseInt(sui.balance) / 1e9).toFixed(4) : '0.0000';
  const explorerUrl = `https://suiscan.xyz/devnet/object/${PACKAGE_ID}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Sui Blockchain</h3>
      <div className="space-y-3 text-sm">
        <Row label="Network">
          <span className="text-emerald-400 font-mono text-xs bg-emerald-950/50 px-2 py-0.5 rounded">
            {sui.network || 'devnet'}
          </span>
        </Row>
        <Row label="Address">
          <span className="text-gray-200 font-mono text-xs">{truncated}</span>
        </Row>
        <Row label="Balance">
          <span className="text-gray-200">{balance} SUI</span>
        </Row>
        <Row label="Package">
          <a href={explorerUrl} target="_blank" rel="noreferrer"
            className="text-blue-400 hover:underline font-mono text-[10px]">
            {PACKAGE_ID.slice(0, 10)}...{PACKAGE_ID.slice(-6)}
          </a>
        </Row>
        <Row label="Chain ID">
          <span className="text-gray-300 font-mono text-xs">{sui.chainId || 'N/A'}</span>
        </Row>
        {sui.bufferedEvents > 0 && (
          <Row label="Buffered">
            <span className="text-amber-400 text-xs">{sui.bufferedEvents} events</span>
          </Row>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      {children}
    </div>
  );
}
