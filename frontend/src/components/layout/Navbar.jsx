export default function Navbar({ activePage, onNavigate }) {
  const linkClass = (page) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
      activePage === page
        ? 'bg-emerald-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">SC</div>
        <div>
          <span className="text-emerald-400 text-lg font-bold">ShieldClaw</span>
          <span className="text-gray-500 text-xs ml-2">AI Agent Security Framework</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button className={linkClass('dashboard')} onClick={() => onNavigate('dashboard')}>
          Dashboard
        </button>
        <button className={linkClass('demo')} onClick={() => onNavigate('demo')}>
          Interactive Demo
        </button>
      </div>
    </nav>
  );
}
