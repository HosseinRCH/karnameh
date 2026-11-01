import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Priority, Status } from '@karnameh/shared';
import { api } from '../api/client';
import type { Dashboard, Goal, Member, TaskListItem, Widget } from '../types';

const METRICS = ['total', 'open', 'done', 'overdue', 'completion', 'byStatus', 'byPriority', 'byAssignee', 'goals'] as const;
const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#14b8a6'];

function Pie({ data, size = 120 }: { data: Array<{ label: string; value: number }>; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let angle = -Math.PI / 2;
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="pie">
      {data.map((d, i) => {
        const slice = (d.value / total) * Math.PI * 2;
        const x1 = r + Math.cos(angle) * r;
        const y1 = r + Math.sin(angle) * r;
        angle += slice;
        const x2 = r + Math.cos(angle) * r;
        const y2 = r + Math.sin(angle) * r;
        if (d.value === 0) return null;
        return (
          <path
            key={d.label}
            d={`M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`}
            fill={PIE_COLORS[i % PIE_COLORS.length]}
          />
        );
      })}
    </svg>
  );
}

export default function DashboardView({
  workspaceId,
  tasks,
  statuses,
  members,
}: {
  workspaceId: string;
  tasks: TaskListItem[];
  statuses: Status[];
  members: Member[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const dashboards = useQuery({
    queryKey: ['dashboards', workspaceId],
    queryFn: () => api.dashboards(workspaceId),
  });
  const goals = useQuery<Goal[]>({
    queryKey: ['goals', workspaceId],
    queryFn: () => api.goals(workspaceId),
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [metric, setMetric] = useState<string>('total');
  const [kind, setKind] = useState<'number' | 'bar' | 'pie' | 'table'>('number');

  const active: Dashboard | undefined =
    (dashboards.data ?? []).find((d) => d.id === activeId) ?? dashboards.data?.[0];

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['dashboards', workspaceId] });

  const create = useMutation({
    mutationFn: (name: string) => api.createDashboard(workspaceId, name),
    onSuccess: (d) => {
      setActiveId(d.id);
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDashboard(id),
    onSuccess: () => {
      setActiveId(null);
      invalidate();
    },
  });
  const saveWidgets = useMutation({
    mutationFn: (widgets: Widget[]) => api.updateDashboard(active!.id, { config: { widgets } }),
    onSuccess: invalidate,
  });

  const doneIds = new Set(statuses.filter((s) => s.type === 'done' || s.type === 'closed').map((s) => s.id));
  const open = tasks.filter((x) => !doneIds.has(x.statusId));
  const overdue = open.filter((x) => x.dueDate && new Date(x.dueDate).getTime() < Date.now());
  const done = tasks.length - open.length;

  const numberValue = (m: string): string => {
    switch (m) {
      case 'total':
        return String(tasks.length);
      case 'open':
        return String(open.length);
      case 'done':
        return String(done);
      case 'overdue':
        return String(overdue.length);
      case 'completion':
        return tasks.length ? `${Math.round((done / tasks.length) * 100)}%` : '0%';
      default:
        return '—';
    }
  };

  const bars = (m: string): Array<{ label: string; value: number }> => {
    if (m === 'byStatus') return statuses.map((s) => ({ label: s.name, value: tasks.filter((x) => x.statusId === s.id).length }));
    if (m === 'byPriority')
      return PRIORITIES.map((p) => ({ label: t(`priority.${p}`), value: tasks.filter((x) => x.priority === p).length }));
    if (m === 'byAssignee')
      return members.map((u) => ({
        label: u.name,
        value: tasks.filter((x) => x.assignees.some((a) => a.userId === u.id)).length,
      }));
    if (m === 'goals')
      return (goals.data ?? []).map((g) => ({ label: g.name, value: Math.round(g.progress * 100) }));
    return [];
  };

  const widgets = active?.config?.widgets ?? [];
  const maxBar = Math.max(1, ...widgets.flatMap((w) => bars(w.metric).map((b) => b.value)));

  const addWidget = () => {
    const widget: Widget = { id: `${Date.now()}`, type: kind, metric };
    saveWidgets.mutate([...widgets, widget]);
  };
  const removeWidget = (id: string) => saveWidgets.mutate(widgets.filter((w) => w.id !== id));

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={active?.id ?? ''}
          onChange={(e) => setActiveId(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        >
          <option value="">{t('dashboard.none')}</option>
          {(dashboards.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt(t('dashboard.newName'));
            if (name) create.mutate(name);
          }}
          className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white"
        >
          {t('dashboard.new')}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => remove.mutate(active.id)}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600"
          >
            {t('filter.delete')}
          </button>
        )}
      </div>

      {!active ? (
        <p className="text-center text-slate-400">{t('dashboard.empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {widgets.map((w) => (
              <div key={w.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase text-slate-400">{w.metric}</span>
                  <button type="button" onClick={() => removeWidget(w.id)} className="text-slate-300 hover:text-rose-500">
                    ✕
                  </button>
                </div>
                {w.type === 'number' ? (
                  <div className="text-3xl font-semibold text-slate-800">{numberValue(w.metric)}</div>
                ) : w.type === 'pie' ? (
                  <Pie data={bars(w.metric)} />
                ) : w.type === 'table' ? (
                  <table className="w-full text-xs">
                    <tbody>
                      {bars(w.metric).map((b) => (
                        <tr key={b.label}>
                          <td className="py-0.5 text-slate-500">{b.label}</td>
                          <td className="py-0.5 text-end text-slate-700">{b.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-1">
                    {bars(w.metric).map((b) => (
                      <div key={b.label} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 truncate text-slate-500">{b.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-indigo-500" style={{ width: `${(b.value / maxBar) * 100}%` }} />
                        </div>
                        <span className="w-6 text-end text-slate-500">{b.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'number' | 'bar' | 'pie' | 'table')} className="rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="number">{t('dashboard.number')}</option>
              <option value="bar">{t('dashboard.bars')}</option>
              <option value="pie">{t('dashboard.pie')}</option>
              <option value="table">{t('dashboard.table')}</option>
            </select>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm">
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button type="button" onClick={addWidget} className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white">
              {t('dashboard.addWidget')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
