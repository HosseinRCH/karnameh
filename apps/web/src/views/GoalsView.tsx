import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { jalaaliToIso, toJalaali } from '@karnameh/shared';
import { api } from '../api/client';
import type { Goal, Target, TaskListItem } from '../types';

const TYPES = ['number', 'currency', 'task_completion', 'boolean'] as const;

function periodPreset(kind: 'month' | 'quarter'): { start: string; end: string } {
  const n = new Date();
  const j = toJalaali(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate());
  const startMonth = kind === 'month' ? j.jm : Math.floor((j.jm - 1) / 3) * 3 + 1;
  const spanMonths = kind === 'month' ? 1 : 3;
  let endMonth = startMonth + spanMonths;
  let endYear = j.jy;
  if (endMonth > 12) {
    endMonth -= 12;
    endYear += 1;
  }
  return { start: jalaaliToIso(j.jy, startMonth, 1), end: jalaaliToIso(endYear, endMonth, 1) };
}

/** Goals & targets with live progress. */
export default function GoalsView({
  workspaceId,
  tasks,
}: {
  workspaceId: string;
  tasks: TaskListItem[];
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['goals', workspaceId], queryFn: () => api.goals(workspaceId) });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['goals', workspaceId] });

  const [gName, setGName] = useState('');
  const [gFolder, setGFolder] = useState('');
  const [gPeriod, setGPeriod] = useState<'month' | 'quarter'>('quarter');
  const createGoal = useMutation({
    mutationFn: () => {
      const { start, end } = periodPreset(gPeriod);
      return api.createGoal({
        workspaceId,
        name: gName,
        folder: gFolder || undefined,
        periodType: gPeriod,
        periodStart: start,
        periodEnd: end,
      });
    },
    onSuccess: () => {
      setGName('');
      setGFolder('');
      invalidate();
    },
  });
  const removeGoal = useMutation({ mutationFn: (id: string) => api.deleteGoal(id), onSuccess: invalidate });
  const addTarget = useMutation({
    mutationFn: (v: { goalId: string; name: string; type: string; targetValue: number }) =>
      api.createTarget(v.goalId, { name: v.name, type: v.type, targetValue: v.targetValue }),
    onSuccess: invalidate,
  });
  const updateTarget = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) => api.updateTarget(v.id, v.patch),
    onSuccess: invalidate,
  });
  const removeTarget = useMutation({ mutationFn: (id: string) => api.deleteTarget(id), onSuccess: invalidate });
  const linkTask = useMutation({
    mutationFn: (v: { targetId: string; taskId: string }) => api.linkTargetTask(v.targetId, v.taskId),
    onSuccess: invalidate,
  });
  const unlinkTask = useMutation({
    mutationFn: (v: { targetId: string; taskId: string }) => api.unlinkTargetTask(v.targetId, v.taskId),
    onSuccess: invalidate,
  });

  const periodLabel = (goal: Goal) => {
    const fmt = new Intl.DateTimeFormat(i18n.language, {
      calendar: 'persian', // Jalali period label in both languages
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${fmt.format(new Date(goal.periodStart))} → ${fmt.format(new Date(goal.periodEnd))}`;
  };

  const data = goals.data ?? [];
  const folders = [...new Set(data.map((g) => g.folder ?? ''))];

  return (
    <div className="space-y-5 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (gName.trim()) createGoal.mutate();
        }}
        className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"
      >
        <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder={t('goal.name')} className="w-48 rounded-md border border-slate-200 px-2 py-1 text-sm" />
        <input value={gFolder} onChange={(e) => setGFolder(e.target.value)} placeholder={t('goal.folder')} className="w-32 rounded-md border border-slate-200 px-2 py-1 text-sm" />
        <select value={gPeriod} onChange={(e) => setGPeriod(e.target.value as 'month' | 'quarter')} className="rounded-md border border-slate-200 px-2 py-1 text-sm">
          <option value="month">{t('goal.thisMonth')}</option>
          <option value="quarter">{t('goal.thisQuarter')}</option>
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white">
          {t('goal.new')}
        </button>
      </form>

      {data.length === 0 && <p className="text-center text-slate-400">{t('goal.empty')}</p>}

      {folders.map((folder) => (
        <section key={folder || '_'} className="space-y-3">
          {folder && <h3 className="text-xs font-semibold uppercase text-slate-400">{folder}</h3>}
          {data
            .filter((g) => (g.folder ?? '') === folder)
            .map((goal) => (
              <div key={goal.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{goal.name}</div>
                    <div className="text-[11px] text-slate-400">{periodLabel(goal)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-indigo-600">{Math.round(goal.progress * 100)}%</span>
                    <button type="button" onClick={() => removeGoal.mutate(goal.id)} className="text-slate-300 hover:text-rose-500">
                      ✕
                    </button>
                  </div>
                </div>
                <Progress value={goal.progress} />

                <div className="mt-3 space-y-2">
                  {goal.targets.map((target) => (
                    <TargetRow
                      key={target.id}
                      target={target}
                      tasks={tasks}
                      onUpdate={(patch) => updateTarget.mutate({ id: target.id, patch })}
                      onRemove={() => removeTarget.mutate(target.id)}
                      onLink={(taskId) => linkTask.mutate({ targetId: target.id, taskId })}
                      onUnlink={(taskId) => unlinkTask.mutate({ targetId: target.id, taskId })}
                    />
                  ))}
                </div>

                <AddTarget onAdd={(v) => addTarget.mutate({ goalId: goal.id, ...v })} />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

function TargetRow({
  target,
  tasks,
  onUpdate,
  onRemove,
  onLink,
  onUnlink,
}: {
  target: Target;
  tasks: TaskListItem[];
  onUpdate: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onLink: (taskId: string) => void;
  onUnlink: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const isCount = target.type === 'task_completion';

  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-slate-700">
          {target.name} <span className="text-[10px] text-slate-400">{target.type}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {target.type === 'boolean' ? (
            <input
              type="checkbox"
              defaultChecked={target.currentValue >= 1}
              onChange={(e) => onUpdate({ currentValue: e.target.checked ? 1 : 0 })}
            />
          ) : isCount ? (
            <span className="text-xs text-slate-500">
              {target.done ?? 0}/{target.total ?? 0}
            </span>
          ) : (
            <input
              type="number"
              defaultValue={target.currentValue}
              onBlur={(e) => onUpdate({ currentValue: Number(e.target.value) || 0 })}
              className="w-20 rounded border border-slate-200 px-1 py-0.5 text-xs"
              title={t('goal.current')}
            />
          )}
          <span className="w-10 text-end text-xs text-indigo-600">{Math.round(target.progress * 100)}%</span>
          <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-500">
            ✕
          </button>
        </span>
      </div>
      <Progress value={target.progress} small />

      {isCount && (
        <div className="mt-1.5 space-y-1">
          {target.tasks.map((tt) => (
            <div key={tt.taskId} className="flex items-center justify-between text-xs text-slate-600">
              <span className="truncate">
                {tt.statusType === 'done' || tt.statusType === 'closed' ? '✅ ' : '○ '}
                {tt.title}
              </span>
              <button type="button" onClick={() => onUnlink(tt.taskId)} className="text-slate-300 hover:text-rose-500">
                ✕
              </button>
            </div>
          ))}
          <select
            value=""
            onChange={(e) => e.target.value && onLink(e.target.value)}
            className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
          >
            <option value="">{t('goal.linkTask')}</option>
            {tasks
              .filter((x) => !target.tasks.some((tt) => tt.taskId === x.id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

function AddTarget({ onAdd }: { onAdd: (v: { name: string; type: string; targetValue: number }) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('number');
  const [value, setValue] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          onAdd({ name, type, targetValue: Number(value) || 0 });
          setName('');
          setValue('');
        }
      }}
      className="mt-2 flex flex-wrap items-center gap-2"
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('goal.targetName')} className="w-40 rounded-md border border-slate-200 px-2 py-1 text-sm" />
      <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm">
        {TYPES.map((ty) => (
          <option key={ty} value={ty}>
            {ty}
          </option>
        ))}
      </select>
      {type !== 'task_completion' && type !== 'boolean' && (
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder={t('goal.target')} className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm" />
      )}
      <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white">
        {t('manage.add')}
      </button>
    </form>
  );
}

function Progress({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${small ? 'h-1.5' : 'h-2.5'}`}>
      <div className="h-full bg-indigo-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
