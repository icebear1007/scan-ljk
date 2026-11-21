import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function AppHeader({ title, subtitle, onBack }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-blue-900 text-white shadow-sm safe-top-header pb-3">
      <div className="mx-auto flex w-full max-w-xl items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white transition-colors hover:bg-blue-700 active:bg-blue-950"
          >
            <ArrowLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight leading-snug">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-blue-100 leading-snug">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
