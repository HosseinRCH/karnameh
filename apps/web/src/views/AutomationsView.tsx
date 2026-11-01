import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Status } from '@karnameh/shared';
import { api } from '../api/client';
import type { Automation, Member, TaskListItem } from '../types';

const TRIGGERS = ['task.created', 'task.updated', 'task.status_changed'] as const;
const ACTION_TYPES = ['task.set_priority', 'task.set_status', 'task.assign', 'time.start'] as const;
const PRIORITIES = ['none', 'low', 'normal', 'high', 'urgent'];

function actionSummary(
  action: { type: string; params?: Record<string, unknown> },
  statuses: Status[],
  members: Member[],
): string {
  const p = action.params ?? {};
  switch (action.type) {
    case 'task.set_priority':
      return `priority → ${p.value}`;
    case 'task.set_status':
      return `status → ${statuses.find((s) => s.id === p.statusId)?.name ?? p.statusId}`;
    case 'task.assign':
      return `assign → ${members.find((m) => m.id === p.userId)?.name ?? p.userId}`;
    case 'time.start':
      return 'start timer';
    default:
      return action.type;
  }
}

/** Automations: trigger → conditions → actions, with a run log and dry-run. */
export default function AutomationsView({
  workspaceId,
  statuses,
  members,
  tasks,
}: {
  workspaceId: string;
  statuses: Status[];
  members: Member[];
  tasks: TaskListItem[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const automations = useQuery({
    queryKey: ['automations', workspaceId],
    queryFn: () => api.automations(workspaceId),
  });
  const runs = useQuery({
    queryKey: ['automation-runs', workspaceId],
    queryFn: () => api.automationRuns(workspaceId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['automations', workspaceId] });
    void qc.invalidateQueries({ queryKey: ['automation-runs', workspaceId] });
  };

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<string>('task.status_changed');
  const [triggerTo, setTriggerTo] = useState('');
  const [actions, setActions] = useState<Array<{ type: string; value: string }>>([
    { type: 'time.start', value: '' },
  ]);
  const [dryResult, setDryResult] = useState<Record<string, string>>({});

  const gql = 'rounded-md border border-slate-200 px-2 py-1 text-sm';

  const create = useMutation({
    mutationFn: () =>
      api.createAutomation({
        workspaceId,
        name,
        trigger: { type: triggerType, to: triggerTo || undefined },
        actions: actions.map((a) =>
          a.type === 'task.set_priority'
            ? { type: a.type, params: { value: a.value || 'high' } }
            : a.type === 'task.set_status'
              ? { type: a.type, params: { statusId: a.value } }
              : a.type === 'task.assign'
                ? { type: a.type, params: { userId: a.value } }
                : { type: a.type },
        ),
      }),
    onSuccess: () => {
      setName('');
      invalidate();
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => api.updateAutomation(v.id, { enabled: v.enabled }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteAutomation(id), onSuccess: invalidate });
  const dryRun = useMutation({
    mutationFn: (v: { id: string; taskId: string }) => api.dryRunAutomation(v.id, v.taskId),
    onSuccess: (res, vars) =>
      setDryResult((prev) => ({
        ...prev,
        [vars.id]: res.matches
          ? `${t('automation.wouldRun')}: ${res.projected.map((p) => p.action).join(', ')}`
          : t('automation.wouldSkip'),
      })),
  });

  const useExample = () => {
    const inProgress = statuses.find((s) => /progress/i.test(s.name)) ?? statuses[1];
    if (inProgress) setTriggerTo(inProgress.id);
    setTriggerType('task.status_changed');
    setName(t('automation.exampleName'));
    setActions([
      { type: 'time.start', value: '' },
      { type: 'task.set_priority', value: 'high' },
    ]);
  };

  const updateAction = (i: number, patch: Partial<{ type: string; value: string }>) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  return (
    <div className="space-y-5 p-4">
      <section className="space-y-2 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-600">{t('automation.new')}</h3>
          <button type="button" onClick={useExample} className="text-xs text-indigo-600 hover:underline">
            {t('automation.useExample')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('automation.name')} className={`w-44 ${gql}`} />
          <span className="text-xs text-slate-400">{t('automation.when')}</span>
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className={gql}>
            {TRIGGERS.map((tr) => (
              <option key={tr} value={tr}>
                {t(`automation.trigger.${tr}`)}
              </option>
            ))}
          </select>
          {triggerType === 'task.status_changed' && (
            <select value={triggerTo} onChange={(e) => setTriggerTo(e.target.value)} className={gql}>
              <option value="">{t('automation.anyStatus')}</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-xs text-slate-400">{t('automation.then')}</span>
          {actions.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={a.type} onChange={(e) => updateAction(i, { type: e.target.value, value: '' })} className={gql}>
                {ACTION_TYPES.map((at) => (
                  <option key={at} value={at}>
                    {t(`automation.action.${at}`)}
                  </option>
                ))}
              </select>
              {a.type === 'task.set_priority' && (
                <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className={gql}>
                  <option value="">high</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`)}
                    </option>
                  ))}
                </select>
              )}
              {a.type === 'task.set_status' && (
                <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className={gql}>
                  <option value="">—</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              {a.type === 'task.assign' && (
                <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className={gql}>
                  <option value="">—</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setActions((prev) => [...prev, { type: 'task.set_priority', value: 'high' }])} className="text-xs text-slate-500 hover:underline">
            + {t('automation.addAction')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => name.trim() && create.mutate()}
          className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white"
        >
          {t('automation.create')}
        </button>
      </section>

      {automations.data?.length === 0 && <p className="text-center text-slate-400">{t('automation.empty')}</p>}

      <div className="space-y-2">
        {(automations.data ?? []).map((a: Automation) => (
          <div key={a.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={a.enabled} onChange={(e) => toggle.mutate({ id: a.id, enabled: e.target.checked })} />
                {a.name}
              </label>
              <button type="button" onClick={() => remove.mutate(a.id)} className="text-slate-300 hover:text-rose-500">
                ✕
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <b>{t('automation.when')}</b> {t(`automation.trigger.${a.trigger.type}`)}
              {a.trigger.to ? ` (${statuses.find((s) => s.id === a.trigger.to)?.name ?? ''})` : ''} →{' '}
              <b>{t('automation.then')}</b> {a.actions.map((ac) => actionSummary(ac, statuses, members)).join(' + ')}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select value="" onChange={(e) => e.target.value && dryRun.mutate({ id: a.id, taskId: e.target.value })} className={gql}>
                <option value="">{t('automation.dryRun')}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              {dryResult[a.id] && <span className="text-xs text-slate-500">{dryResult[a.id]}</span>}
            </div>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-600">{t('automation.runLog')}</h3>
        <ul className="space-y-1">
          {(runs.data ?? []).map((run) => (
            <li key={run.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-xs shadow-sm">
              <span className="text-slate-600">
                {run.automation?.name} · {run.triggerType}
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 ${run.status === 'success' ? 'bg-emerald-100 text-emerald-700' : run.status === 'skipped' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                  {run.status}
                </span>
                <span className="text-slate-400">{new Date(run.createdAt).toLocaleTimeString()}</span>
              </span>
            </li>
          ))}
          {(runs.data ?? []).length === 0 && <li className="text-sm text-slate-400">{t('automation.noRuns')}</li>}
        </ul>
      </section>
    </div>
  );
}
