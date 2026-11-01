import { useTranslation } from 'react-i18next';
import type { Priority, Status } from '@karnameh/shared';
import type { TaskListItem } from '../types';

const PRIORITIES: Priority[] = ['none', 'low', 'normal', 'high', 'urgent'];

export default function TableView({
  tasks,
  statuses,
  onUpdate,
  onOpenTask,
}: {
  tasks: TaskListItem[];
  statuses: Status[];
  onUpdate: (taskId: string, patch: Record<string, unknown>) => void;
  onOpenTask: (id: string) => void;
}) {
  const { t } = useTranslation();
  const cell = 'border-b border-slate-100 px-2 py-1.5 text-sm';

  return (
    <div className="overflow-auto p-4">
      {tasks.length === 0 ? (
        <p className="text-center text-slate-400">{t('empty.tasks')}</p>
      ) : (
        <table className="w-full min-w-[720px] bg-white">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="px-2 py-2 text-start">{t('field.title')}</th>
              <th className="px-2 py-2 text-start">{t('field.status')}</th>
              <th className="px-2 py-2 text-start">{t('field.priority')}</th>
              <th className="px-2 py-2 text-start">{t('table.estimate')}</th>
              <th className="px-2 py-2 text-start">{t('field.due')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td className={cell}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="text-start text-slate-800 hover:text-indigo-700"
                  >
                    {task.title}
                  </button>
                </td>
                <td className={cell}>
                  <select
                    value={task.statusId}
                    onChange={(e) => onUpdate(task.id, { statusId: e.target.value })}
                    className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <select
                    value={task.priority}
                    onChange={(e) => onUpdate(task.id, { priority: e.target.value })}
                    className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {t(`priority.${p}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <input
                    type="number"
                    step="0.5"
                    defaultValue={task.estimateMs ? task.estimateMs / 3_600_000 : ''}
                    onBlur={(e) => {
                      const hours = Number(e.target.value);
                      onUpdate(task.id, { estimateMs: Number.isFinite(hours) && hours > 0 ? Math.round(hours * 3_600_000) : null });
                    }}
                    className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                  />
                </td>
                <td className={`${cell} text-slate-500`}>
                  {task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
