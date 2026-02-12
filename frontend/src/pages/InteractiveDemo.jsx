import PromptTester from '../components/demo/PromptTester';
import CodeScanner from '../components/demo/CodeScanner';
import BlockchainLogger from '../components/demo/BlockchainLogger';

export default function InteractiveDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Interactive Demo</h1>
        <p className="text-gray-400 text-sm mt-1">
          Try ShieldClaw's security features live. All actions use real modules and the Sui devnet blockchain.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PromptTester />
        <CodeScanner />
      </div>

      <BlockchainLogger />
    </div>
  );
}
