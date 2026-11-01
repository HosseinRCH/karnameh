import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Workspace } from '@karnameh/shared';
import { api } from '../api/client';
import type { TaskListItem } from '../types';

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Time tracking & reporting over completed focus sessions + manual entries. */
export default function TimeView({
  workspace,
  listId,
  tasks,
}: {
  workspace: Workspace;
  listId: string;
  tasks: TaskListItem[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const report = useQuery({ queryKey: ['time-report', listId], queryFn: () => api.timeReport(listId) });
  const entries = useQuery({ queryKey: ['time-entries', listId], queryFn: () => api.timeEntries(listId) });
  const sheets = useQuery({ queryKey: ['timesheets'], queryFn: () => api.timesheets() });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['time-report', listId] });
    void qc.invalidateQueries({ queryKey: ['time-entries', listId] });
    void qc.invalidateQueries({ queryKey: ['timesheets'] });
  };

  const [rate, setRate] = useState(workspace.hourlyRate ? String(workspace.hourlyRate) : '');
  const [currency, setCurrency] = useState(workspace.currency ?? 'IRR');
  const saveRate = useMutation({
    mutationFn: () =>
      api.updateWorkspaceSettings(workspace.id, {
        hourlyRate: rate.trim() === '' ? null : Number(rate),
        currency,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
      void qc.invalidateQueries({ queryKey: ['time-report', listId] });
    },
  });

  const [eTask, setETask] = useState('');
  const [eMinutes, setEMinutes] = useState('30');
  const [eBillable, setEBillable] = useState(true);
  const [eDesc, setEDesc] = useState('');
  const addEntry = useMutation({
    mutationFn: () =>
      api.createTimeEntry({
        taskId: eTask || undefined,
        durationMinutes: Number(eMinutes) || 0,
        billable: eBillable,
        description: eDesc || undefined,
      }),
    onSuccess: () => {
      setEDesc('');
      invalidate();
    },
  });
  const removeEntry = useMutation({ mutationFn: (id: string) => api.deleteTimeEntry(id), onSuccess: invalidate });
  const submit = useMutation({
    mutationFn: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 86_400_000);
      return api.submitTimesheet(start.toISOString(), end.toISOString());
    },
    onSuccess: invalidate,
  });
  const approve = useMutation({ mutationFn: (id: string) => api.approveTimesheet(id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: (id: string) => api.rejectTimesheet(id), onSuccess: invalidate });

  const h = (ms: number) => `${(ms / 3_600_000).toFixed(1)}h`;
  const money = (n: number) => `${new Intl.NumberFormat(undefined).format(n)} ${report.data?.currency ?? currency}`;
  const totals = report.data?.totals;
  const byTask = (report.data?.byTask ?? []).filter((r) => r.estimateMs > 0 || r.actualMs > 0);

  const exportCsv = () => {
    const rows: string[][] = [
      [t('field.title'), t('time.estimate'), t('time.actual')],
      ...byTask.map((r) => [r.title, h(r.estimateMs), h(r.actualMs)]),
      [],
      [t('manage.name'), t('time.total'), t('time.billable'), t('time.amount')],
      ...(report.data?.byUser ?? []).map((u) => [u.name, h(u.totalMs), h(u.billableMs), String(u.amount)]),
      [],
      [t('time.total'), h(totals?.totalMs ?? 0)],
      [t('time.billable'), h(totals?.billableMs ?? 0)],
      [t('time.amount'), String(totals?.billableAmount ?? 0)],
    ];
    downloadCsv(`time-report-${listId.slice(0, 8)}.csv`, rows);
  };

  return (
    <div className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label={t('time.total')} value={h(totals?.totalMs ?? 0)} />
        <Card label={t('time.billable')} value={h(totals?.billableMs ?? 0)} />
        <Card label={t('time.amount')} value={money(totals?.billableAmount ?? 0)} />
        <Card label={t('time.sessions')} value={String(totals?.sessions ?? 0)} />
      </div>

      <section className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
        <label className="text-xs text-slate-500">
          <span className="mb-1 block">{t('time.hourlyRate')}</span>
          <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block">{t('time.currency')}</span>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm" />
        </label>
        <button type="button" onClick={() => saveRate.mutate()} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
          {t('time.saveRate')}
        </button>
        <button type="button" onClick={exportCsv} className="ms-auto rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
          {t('time.exportCsv')}
        </button>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-600">{t('time.estimateVsActual')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-1 text-start">{t('field.title')}</th>
              <th className="py-1 text-end">{t('time.estimate')}</th>
              <th className="py-1 text-end">{t('time.actual')}</th>
            </tr>
          </thead>
          <tbody>
            {byTask.map((r) => (
              <tr key={r.taskId} className="border-t border-slate-100">
                <td className="py-1 text-slate-700">{r.title}</td>
                <td className="py-1 text-end text-slate-500">{h(r.estimateMs)}</td>
                <td className={`py-1 text-end ${r.estimateMs > 0 && r.actualMs > r.estimateMs ? 'text-rose-600' : 'text-slate-500'}`}>
                  {h(r.actualMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-600">{t('time.byUser')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-1 text-start">{t('manage.name')}</th>
              <th className="py-1 text-end">{t('time.total')}</th>
              <th className="py-1 text-end">{t('time.billable')}</th>
              <th className="py-1 text-end">{t('time.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {(report.data?.byUser ?? []).map((u) => (
              <tr key={u.userId} className="border-t border-slate-100">
                <td className="py-1 text-slate-700">{u.name}</td>
                <td className="py-1 text-end text-slate-500">{h(u.totalMs)}</td>
                <td className="py-1 text-end text-slate-500">{h(u.billableMs)}</td>
                <td className="py-1 text-end text-slate-500">{money(u.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-600">{t('time.manualEntries')}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if ((Number(eMinutes) || 0) > 0) addEntry.mutate();
          }}
          className="mb-2 flex flex-wrap items-center gap-2"
        >
          <select value={eTask} onChange={(e) => setETask(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm">
            <option value="">{t('focus.noTask')}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <input value={eMinutes} onChange={(e) => setEMinutes(e.target.value)} type="number" min={1} className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" />
          <input value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder={t('task.description')} className="w-40 rounded-md border border-slate-200 px-2 py-1 text-sm" />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" checked={eBillable} onChange={(e) => setEBillable(e.target.checked)} />
            {t('time.billable')}
          </label>
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white">
            {t('manage.add')}
          </button>
        </form>
        <ul className="space-y-1">
          {(entries.data ?? []).map((entry) => (
            <li key={entry.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm">
              <span className="min-w-0 truncate text-slate-700">
                {entry.task?.title ?? t('focus.noTask')} · {entry.description ?? ''}
              </span>
              <span className="flex items-center gap-2 text-slate-500">
                {entry.durationMinutes}m {entry.billable ? `· ${t('time.billable')}` : ''}
                <button type="button" onClick={() => removeEntry.mutate(entry.id)} className="text-slate-300 hover:text-rose-500">
                  ✕
                </button>
              </span>
            </li>
          ))}
          {(entries.data ?? []).length === 0 && <li className="text-sm text-slate-400">{t('time.noEntries')}</li>}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-600">{t('time.timesheets')}</h3>
          <button type="button" onClick={() => submit.mutate()} className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white">
            {t('time.submitWeek')}
          </button>
        </div>
        <ul className="space-y-1">
          {(sheets.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
              <span className="text-slate-700">
                {new Date(s.periodStart).toISOString().slice(0, 10)} → {new Date(s.periodEnd).toISOString().slice(0, 10)} · {h(s.totalMs)}{' '}
                <span className="text-slate-400">({h(s.billableMs)} {t('time.billable')})</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(s.status)}`}>{s.status}</span>
                {s.status === 'submitted' && (
                  <>
                    <button type="button" onClick={() => approve.mutate(s.id)} className="text-xs text-emerald-600 hover:underline">
                      {t('time.approve')}
                    </button>
                    <button type="button" onClick={() => reject.mutate(s.id)} className="text-xs text-rose-600 hover:underline">
                      {t('time.reject')}
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
          {(sheets.data ?? []).length === 0 && <li className="text-sm text-slate-400">{t('time.noTimesheets')}</li>}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function statusColor(status: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
}
