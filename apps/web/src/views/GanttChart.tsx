import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Status } from '@karnameh/shared';
import type { TaskListItem } from '../types';

const LABEL_W = 190;
const DAY_W = 22;
const ROW_H = 30;
const HEADER_H = 26;
const DAY_MS = 86_400_000;

const offsetDays = (iso: string, rangeStart: number) =>
  Math.floor(new Date(iso).getTime() / DAY_MS) - rangeStart;

type Row = { kind: 'group'; label: string } | { kind: 'task'; task: TaskListItem };

/**
 * SVG Gantt/Timeline chart. `groupByStatus` adds status section headers;
 * `showDependencies` draws dependency elbows.
 */
export default function GanttChart({
  tasks,
  statuses,
  locale,
  groupByStatus = false,
  showDependencies = false,
  onOpenTask,
}: {
  tasks: TaskListItem[];
  statuses: Status[];
  locale: string;
  groupByStatus?: boolean;
  showDependencies?: boolean;
  onOpenTask: (id: string) => void;
}) {
  const { t } = useTranslation();

  const rows = useMemo<Row[]>(() => {
    const scheduled = tasks.filter((x) => x.startDate || x.dueDate);
    if (!groupByStatus) return scheduled.map((task) => ({ kind: 'task' as const, task }));
    const out: Row[] = [];
    for (const status of statuses) {
      const group = scheduled.filter((x) => x.statusId === status.id);
      if (group.length === 0) continue;
      out.push({ kind: 'group', label: status.name });
      for (const task of group) out.push({ kind: 'task', task });
    }
    return out;
  }, [tasks, statuses, groupByStatus]);

  const { rangeStart, totalDays } = useMemo(() => {
    const sched = rows.filter((r): r is Extract<Row, { kind: 'task' }> => r.kind === 'task');
    if (sched.length === 0) {
      return { rangeStart: Math.floor(Date.now() / DAY_MS), totalDays: 30 };
    }
    const starts = sched.map((r) => Math.floor(new Date(r.task.startDate ?? r.task.dueDate!).getTime() / DAY_MS));
    const ends = sched.map((r) => Math.floor(new Date(r.task.dueDate ?? r.task.startDate!).getTime() / DAY_MS));
    const min = Math.min(...starts) - 2;
    const max = Math.max(...ends) + 3;
    return { rangeStart: min, totalDays: Math.max(14, max - min) };
  }, [rows]);

  const barFor = useMemo(() => {
    const map = new Map<string, { x1: number; x2: number; rowIndex: number }>();
    rows.forEach((row, i) => {
      if (row.kind !== 'task') return;
      const s = row.task.startDate ?? row.task.dueDate!;
      const e = row.task.dueDate ?? row.task.startDate!;
      const x1 = LABEL_W + offsetDays(s, rangeStart) * DAY_W;
      const x2 = LABEL_W + (offsetDays(e, rangeStart) + 1) * DAY_W;
      map.set(row.task.id, { x1, x2, rowIndex: i });
    });
    return map;
  }, [rows, rangeStart]);

  if (rows.every((r) => r.kind === 'group') || rows.length === 0) {
    return <div className="p-8 text-center text-slate-400">{t('gantt.empty')}</div>;
  }

  const chartW = LABEL_W + totalDays * DAY_W;
  const chartH = HEADER_H + rows.length * ROW_H + 8;
  const rowY = (i: number) => HEADER_H + i * ROW_H;

  return (
    <div className="overflow-auto p-4">
      <svg width={chartW} height={chartH} role="img" aria-label="gantt">
        {Array.from({ length: totalDays }).map((_, i) => {
          const ms = (rangeStart + i) * DAY_MS;
          const weekend = new Date(ms).getUTCDay() === 5; // Friday
          return (
            <g key={i}>
              <line
                x1={LABEL_W + i * DAY_W}
                y1={HEADER_H}
                x2={LABEL_W + i * DAY_W}
                y2={chartH}
                stroke={weekend ? '#e2e8f0' : '#f1f5f9'}
              />
              {i % 7 === 0 && (
                <text x={LABEL_W + i * DAY_W + 2} y={16} fontSize={10} fill="#94a3b8">
                  {new Intl.DateTimeFormat(locale, {
                    calendar: locale === 'fa' ? 'persian' : 'gregory',
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(ms))}
                </text>
              )}
            </g>
          );
        })}

        {rows.map((row, i) =>
          row.kind === 'group' ? (
            <text
              key={`g${i}`}
              x={4}
              y={rowY(i) + ROW_H - 10}
              fontSize={11}
              fontWeight={600}
              fill="#64748b"
            >
              {row.label}
            </text>
          ) : (
            <text key={`l${row.task.id}`} x={4} y={rowY(i) + ROW_H - 10} fontSize={11} fill="#334155">
              {row.task.title.length > 26 ? `${row.task.title.slice(0, 26)}…` : row.task.title}
            </text>
          ),
        )}

        {rows.map((row, i) => {
          if (row.kind !== 'task') return null;
          const bar = barFor.get(row.task.id)!;
          return (
            <rect
              key={row.task.id}
              x={bar.x1}
              y={rowY(i) + 6}
              width={Math.max(DAY_W, bar.x2 - bar.x1)}
              height={ROW_H - 12}
              rx={4}
              fill="#6366f1"
              className="cursor-pointer"
              onClick={() => onOpenTask(row.task.id)}
            />
          );
        })}

        {showDependencies &&
          rows.map((row) => {
            if (row.kind !== 'task') return null;
            const target = barFor.get(row.task.id)!;
            return row.task.dependencies.map((dep) => {
              const source = barFor.get(dep.dependsOnTaskId);
              if (!source) return null;
              const y1 = rowY(source.rowIndex) + ROW_H / 2;
              const y2 = rowY(target.rowIndex) + ROW_H / 2;
              const midX = source.x2 + 6;
              return (
                <polyline
                  key={dep.id}
                  points={`${source.x2},${y1} ${midX},${y1} ${midX},${y2} ${target.x1},${y2}`}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1}
                />
              );
            });
          })}
      </svg>
    </div>
  );
}
