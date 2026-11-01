import { useTranslation } from 'react-i18next';
import type { Priority, Status } from '@karnameh/shared';
import type { Member, SavedView, Tag, SortBy, ViewConfig } from '../types';

const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];

export default function FilterBar({
  config,
  onConfigChange,
  search,
  onSearchChange,
  statuses,
  members,
  tags,
  views,
  activeViewId,
  onSelectView,
  onSaveView,
  onDeleteActive,
  onSetDefault,
}: {
  config: ViewConfig;
  onConfigChange: (config: ViewConfig) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statuses: Status[];
  members: Member[];
  tags: Tag[];
  views: SavedView[];
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
  onSaveView: () => void;
  onDeleteActive: () => void;
  onSetDefault: () => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<ViewConfig>) => onConfigChange({ ...config, ...patch });
  const one = (v: string) => (v ? [v] : undefined);
  const select = 'rounded-md border border-slate-200 px-2 py-1 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('filter.search')}
        className={`w-44 ${select}`}
      />
      <select value={config.statusIds?.[0] ?? ''} onChange={(e) => set({ statusIds: one(e.target.value) })} className={select}>
        <option value="">{t('filter.allStatuses')}</option>
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        value={config.priority?.[0] ?? ''}
        onChange={(e) => set({ priority: e.target.value ? [e.target.value as Priority] : undefined })}
        className={select}
      >
        <option value="">{t('filter.allPriorities')}</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {t(`priority.${p}`)}
          </option>
        ))}
      </select>
      <select value={config.assigneeIds?.[0] ?? ''} onChange={(e) => set({ assigneeIds: one(e.target.value) })} className={select}>
        <option value="">{t('filter.allAssignees')}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select value={config.tagIds?.[0] ?? ''} onChange={(e) => set({ tagIds: one(e.target.value) })} className={select}>
        <option value="">{t('filter.allTags')}</option>
        {tags.map((tg) => (
          <option key={tg.id} value={tg.id}>
            {tg.name}
          </option>
        ))}
      </select>
      <select
        value={config.sortBy ?? 'position'}
        onChange={(e) => set({ sortBy: e.target.value as SortBy })}
        className={select}
      >
        <option value="position">{t('filter.sort.position')}</option>
        <option value="priority">{t('filter.sort.priority')}</option>
        <option value="dueDate">{t('filter.sort.dueDate')}</option>
        <option value="title">{t('filter.sort.title')}</option>
      </select>

      <select
        value={config.groupBy ?? 'none'}
        onChange={(e) => set({ groupBy: e.target.value as ViewConfig['groupBy'] })}
        className={select}
      >
        <option value="none">{t('filter.group.none')}</option>
        <option value="status">{t('filter.group.status')}</option>
      </select>

      <div className="ms-auto flex items-center gap-2">
        <select value={activeViewId ?? ''} onChange={(e) => onSelectView(e.target.value)} className={select}>
          <option value="">{t('filter.noView')}</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSaveView}
          className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white"
        >
          {t('filter.save')}
        </button>
        {activeViewId && (
          <>
            <button
              type="button"
              onClick={onSetDefault}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600"
            >
              {t('filter.setDefault')}
            </button>
            <button
              type="button"
              onClick={onDeleteActive}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600"
            >
              {t('filter.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
