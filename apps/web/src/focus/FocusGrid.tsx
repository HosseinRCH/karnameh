import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { FocusNode, NodeStatus } from './types';

const CELL = 64;

/** Minimalist architectural grid: buildings, blueprints and ruins. */
export default function FocusGrid({
  width,
  height,
  nodes,
  onClearRuin,
}: {
  width: number;
  height: number;
  nodes: FocusNode[];
  onClearRuin: (nodeId: string) => void;
}) {
  const { t } = useTranslation();
  const w = width * CELL;
  const h = height * CELL;

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full rounded-xl bg-slate-900"
        role="img"
        aria-label={t('focus.gridLabel')}
      >
        <defs>
          <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>

        {Array.from({ length: width + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={h} stroke="#1e293b" />
        ))}
        {Array.from({ length: height + 1 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * CELL} x2={w} y2={i * CELL} stroke="#1e293b" />
        ))}

        {nodes.map((node) => (
          <Node key={node.id} node={node} onClearRuin={onClearRuin} />
        ))}
      </svg>

      <Legend />
    </div>
  );
}

function Node({ node, onClearRuin }: { node: FocusNode; onClearRuin: (id: string) => void }) {
  const { t } = useTranslation();
  const cx = node.x * CELL + CELL / 2;
  const cy = node.y * CELL + CELL / 2;
  const label = t(`focus.legend.${node.status === 'constructed' ? node.type : node.status}`);

  return (
    <g>
      <title>{label}</title>
      {renderShape(node.status, node.type, cx, cy, onClearRuin, node.id)}
    </g>
  );
}

function renderShape(
  status: NodeStatus,
  type: FocusNode['type'],
  cx: number,
  cy: number,
  onClearRuin: (id: string) => void,
  id: string,
) {
  if (status === 'blueprint') {
    return (
      <g opacity={0.9}>
        <rect x={cx - 18} y={cy - 8} width={36} height={26} rx={4} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" />
        <polygon
          points={`${cx - 22},${cy - 8} ${cx},${cy - 28} ${cx + 22},${cy - 8}`}
          fill="none"
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </g>
    );
  }

  if (status === 'ruin') {
    return (
      <g className="cursor-pointer hover:opacity-80" onClick={() => onClearRuin(id)} role="button">
        <polygon
          points={`${cx - 20},${cy + 16} ${cx - 20},${cy - 2} ${cx - 10},${cy - 12} ${cx - 3},${cy - 2} ${cx + 4},${cy - 10} ${cx + 13},${cy + 2} ${cx + 20},${cy + 16}`}
          fill="#57534e"
        />
        <line x1={cx - 4} y1={cy - 2} x2={cx + 2} y2={cy + 8} stroke="#292524" strokeWidth={1.5} />
        <rect x={cx - 26} y={cy + 12} width={10} height={6} rx={1} fill="#44403c" />
        <rect x={cx + 16} y={cy + 10} width={8} height={8} rx={1} fill="#44403c" />
      </g>
    );
  }

  // constructed
  if (type === 'landmark') {
    return (
      <g>
        <rect x={cx - 9} y={cy - 20} width={18} height={38} rx={2} fill="url(#wall)" stroke="#94a3b8" />
        <polygon points={`${cx - 14},${cy - 20} ${cx},${cy - 34} ${cx + 14},${cy - 20}`} fill="#f59e0b" />
        <rect x={cx - 4} y={cy - 12} width={8} height={7} fill="#94a3b8" />
        <rect x={cx - 4} y={cy - 1} width={8} height={7} fill="#94a3b8" />
        <rect x={cx - 4} y={cy + 10} width={8} height={7} fill="#94a3b8" />
      </g>
    );
  }

  if (type === 'park') {
    return (
      <g>
        <rect x={cx - 3} y={cy + 2} width={6} height={16} fill="#78716c" />
        <circle cx={cx} cy={cy - 3} r={14} fill="#16a34a" />
        <circle cx={cx - 4} cy={cy - 7} r={6} fill="#22c55e" />
      </g>
    );
  }

  // residential
  return (
    <g>
      <rect x={cx - 16} y={cy - 6} width={32} height={22} rx={3} fill="url(#wall)" stroke="#94a3b8" />
      <polygon points={`${cx - 21},${cy - 6} ${cx},${cy - 26} ${cx + 21},${cy - 6}`} fill="url(#roof)" />
      <rect x={cx - 4} y={cy + 4} width={8} height={12} rx={1} fill="#64748b" />
      <rect x={cx - 13} y={cy - 1} width={7} height={7} rx={1} fill="#e0f2fe" stroke="#94a3b8" />
      <rect x={cx + 6} y={cy - 1} width={7} height={7} rx={1} fill="#e0f2fe" stroke="#94a3b8" />
    </g>
  );
}

function Legend() {
  const { t } = useTranslation();
  const items: Array<{ key: string; swatch: ReactNode }> = [
    { key: 'residential', swatch: <span className="inline-block h-3 w-3 rounded-sm bg-slate-300" /> },
    { key: 'landmark', swatch: <span className="inline-block h-3 w-3 rounded-sm bg-amber-400" /> },
    { key: 'park', swatch: <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> },
    {
      key: 'blueprint',
      swatch: <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-slate-400" />,
    },
    { key: 'ruin', swatch: <span className="inline-block h-3 w-3 rounded-sm bg-stone-500" /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          {item.swatch}
          {t(`focus.legend.${item.key}`)}
        </span>
      ))}
    </div>
  );
}
