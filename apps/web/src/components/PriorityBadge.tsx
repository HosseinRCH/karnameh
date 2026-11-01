import { useTranslation } from 'react-i18next';
import type { Priority } from '@karnameh/shared';

const COLORS: Record<Priority, string> = {
  none: 'bg-slate-100 text-slate-500',
  low: 'bg-sky-100 text-sky-700',
  normal: 'bg-emerald-100 text-emerald-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-rose-100 text-rose-700',
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useTranslation();
  return <span className={`rounded px-2 py-0.5 text-xs ${COLORS[priority]}`}>{t(`priority.${priority}`)}</span>;
}
