import { useTranslation } from 'react-i18next';
import LanguageSwitch from './LanguageSwitch';
import NotificationsBell from './NotificationsBell';
import type { ViewKind } from '../types';

const VIEWS: ViewKind[] = [
  'list',
  'board',
  'calendar',
  'gantt',
  'timeline',
  'workload',
  'table',
  'activity',
  'time',
  'goals',
  'automations',
  'dashboard',
  'focus',
  'guide',
];

export default function Topbar({
  title,
  view,
  onViewChange,
  onSignOut,
}: {
  title: string;
  view: ViewKind;
  onViewChange: (view: ViewKind) => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <h1 className="truncate text-base font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-2">
        <select
          value={view}
          onChange={(e) => onViewChange(e.target.value as ViewKind)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          aria-label={t('view.label')}
        >
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {t(`view.${v}`)}
            </option>
          ))}
        </select>
        <NotificationsBell onOpenView={onViewChange} />
        <button
          type="button"
          onClick={() => onViewChange('guide')}
          title={t('guide.title')}
          aria-label={t('guide.title')}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          ?
        </button>
        <LanguageSwitch />
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        >
          {t('auth.signOut')}
        </button>
      </div>
    </header>
  );
}
