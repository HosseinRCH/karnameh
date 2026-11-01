import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ViewKind } from '../types';

/** Bell with unread count and a dropdown of in-app notifications. */
export default function NotificationsBell({ onOpenView }: { onOpenView: (view: ViewKind) => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['notifications'] });
  const readOne = useMutation({ mutationFn: (id: string) => api.markNotificationRead(id), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => api.markAllNotificationsRead(), onSuccess: invalidate });

  const unread = (list.data ?? []).filter((n) => !n.read).length;
  const fmt = new Intl.DateTimeFormat(i18n.language, {
    calendar: i18n.language === 'fa' ? 'persian' : 'gregory',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={t('notifications.title')}
        aria-label={t('notifications.title')}
        className="relative rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500">{t('notifications.title')}</span>
            <button type="button" onClick={() => readAll.mutate()} className="text-xs text-indigo-600 hover:underline">
              {t('notifications.readAll')}
            </button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {(list.data ?? []).length === 0 && (
              <li className="px-1 py-2 text-xs text-slate-400">{t('notifications.empty')}</li>
            )}
            {(list.data ?? []).map((n) => (
              <li key={n.id} className={`rounded-md ${n.read ? 'text-slate-400' : 'bg-indigo-50 text-slate-700'}`}>
                <button
                  type="button"
                  onClick={() => {
                    readOne.mutate(n.id);
                    if (n.view) onOpenView(n.view as ViewKind);
                    setOpen(false);
                  }}
                  className="w-full px-2 py-1.5 text-start text-xs"
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-[10px] opacity-70">{fmt.format(new Date(n.createdAt))}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
