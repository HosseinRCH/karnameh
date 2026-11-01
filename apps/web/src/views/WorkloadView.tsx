import { useTranslation } from 'react-i18next';
import type { Status } from '@karnameh/shared';
import type { Member, TaskListItem } from '../types';

const CAPACITY_HOURS = 40; // 8h/day × 5 days

export default function WorkloadView({
  tasks,
  members,
  statuses,
}: {
  tasks: TaskListItem[];
  members: Member[];
  statuses: Status[];
}) {
  const { t } = useTranslation();
  const doneIds = new Set(statuses.filter((s) => s.type === 'done' || s.type === 'closed').map((s) => s.id));

  const rows = members.map((member) => {
    const assigned = tasks.filter(
      (task) => !doneIds.has(task.statusId) && task.assignees.some((a) => a.userId === member.id),
    );
    const hours = assigned.reduce((sum, task) => sum + (task.estimateMs ?? 0) / 3_600_000, 0);
    return { member, count: assigned.length, hours };
  });

  return (
    <div className="space-y-3 p-4">
      {rows.length === 0 && <p className="text-center text-slate-400">{t('workload.empty')}</p>}
      {rows.map(({ member, count, hours }) => {
        const pct = Math.min(100, Math.round((hours / CAPACITY_HOURS) * 100));
        const over = hours > CAPACITY_HOURS;
        return (
          <div key={member.id} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{member.name}</span>
              <span className={over ? 'text-rose-600' : 'text-slate-500'}>
                {hours.toFixed(1)}h / {CAPACITY_HOURS}h · {count} {t('workload.tasks')}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${over ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
