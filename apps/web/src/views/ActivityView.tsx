import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ActivityEntry } from '../types';

/** Workspace activity feed (real audit log). */
export default function ActivityView({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const activity = useQuery({ queryKey: ['activity', workspaceId], queryFn: () => api.activity(workspaceId) });
  const fmt = new Intl.DateTimeFormat(i18n.language, {
    calendar: i18n.language === 'fa' ? 'persian' : 'gregory',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-1 p-4">
      {(activity.data ?? []).length === 0 && <p className="text-center text-slate-400">{t('activity.empty')}</p>}
      {(activity.data ?? []).map((entry: ActivityEntry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
        >
          <span className="min-w-0 truncate text-slate-700">
            <b>{entry.actor?.name ?? '—'}</b> {t(`activity.action.${entry.action}`)}{' '}
            {t(`activity.entity.${entry.entityType}`)}
            {typeof entry.meta?.title === 'string' ? `: ${entry.meta.title}` : ''}
          </span>
          <span className="shrink-0 text-xs text-slate-400">{fmt.format(new Date(entry.createdAt))}</span>
        </div>
      ))}
    </div>
  );
}
