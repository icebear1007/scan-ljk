import { FileText, Home, Settings } from 'lucide-react';
import type { MainTab } from '../types/navigation';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

const NAV_ITEMS: Array<{
  id: MainTab;
  label: string;
  Icon: typeof Home;
}> = [
  { id: 'beranda', label: 'Beranda', Icon: Home },
  { id: 'template', label: 'Template', Icon: FileText },
  { id: 'pengaturan', label: 'Pengaturan', Icon: Settings },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav
      aria-label="Utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(15,23,42,0.06)] safe-bottom-nav pt-1.5"
    >
      <ul className="mx-auto grid w-full max-w-xl grid-cols-3 gap-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 font-bold text-blue-900'
                    : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-1 w-10 rounded-full bg-blue-900"
                  />
                ) : null}
                <Icon
                  className="h-6 w-6 shrink-0"
                  strokeWidth={isActive ? 2.4 : 1.9}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
