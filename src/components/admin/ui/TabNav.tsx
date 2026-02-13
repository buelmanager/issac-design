interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <nav className="admin-tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`admin-tab ${tab.key === activeTab ? 'admin-tab-active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="admin-tab-count">{tab.count}</span>}
        </button>
      ))}
    </nav>
  );
}
