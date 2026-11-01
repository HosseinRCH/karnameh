import { useTranslation } from 'react-i18next';
import type { TaskList, Workspace } from '@karnameh/shared';
import type { SpaceWithLists } from '../types';

export default function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  spaces,
  activeListId,
  onSelectList,
  onCreateSpace,
  onCreateList,
  onCreateFolder,
  onOpenManage,
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  spaces: SpaceWithLists[];
  activeListId: string | null;
  onSelectList: (id: string) => void;
  onCreateSpace: () => void;
  onCreateList: (spaceId: string, folderId?: string) => void;
  onCreateFolder: (spaceId: string) => void;
  onOpenManage: () => void;
}) {
  const { t } = useTranslation();

  const listButton = (list: TaskList) => (
    <li key={list.id}>
      <button
        type="button"
        onClick={() => onSelectList(list.id)}
        className={`block w-full rounded-md px-3 py-1.5 text-start text-sm ${
          activeListId === list.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {list.name}
      </button>
    </li>
  );

  const iconBtn = 'rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700';

  return (
    <aside className="flex w-64 shrink-0 flex-col border-e border-slate-200 bg-white/70">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-2">
        <select
          value={activeWorkspaceId ?? ''}
          onChange={(e) => onSelectWorkspace(e.target.value)}
          className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1 text-sm"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={onCreateWorkspace} title={t('manage.newWorkspace')} className={iconBtn}>
          ＋
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('nav.spaces')}</span>
        <button type="button" onClick={onCreateSpace} title={t('manage.newSpace')} className={iconBtn}>
          ＋
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {spaces.map((space) => (
          <div key={space.id}>
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: space.color ?? '#94a3b8' }}
                />
                <span className="truncate">{space.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onCreateFolder(space.id)}
                  title={t('manage.newFolder')}
                  className={iconBtn}
                >
                  🗀
                </button>
                <button
                  type="button"
                  onClick={() => onCreateList(space.id)}
                  title={t('manage.newList')}
                  className={iconBtn}
                >
                  ＋
                </button>
              </div>
            </div>

            {(space.folders ?? []).map((folder) => (
              <div key={folder.id}>
                <div className="flex items-center justify-between gap-2 px-3 py-1">
                  <span className="truncate text-xs font-medium text-slate-400">{folder.name}</span>
                  <button
                    type="button"
                    onClick={() => onCreateList(space.id, folder.id)}
                    title={t('manage.newList')}
                    className={iconBtn}
                  >
                    ＋
                  </button>
                </div>
                <ul className="ms-2">
                  {(space.lists ?? []).filter((l) => l.folderId === folder.id).map(listButton)}
                </ul>
              </div>
            ))}

            <ul className="mt-1">{(space.lists ?? []).filter((l) => !l.folderId).map(listButton)}</ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-2">
        <button
          type="button"
          onClick={onOpenManage}
          className="w-full rounded-md px-3 py-2 text-start text-sm text-slate-600 hover:bg-slate-100"
        >
          ⚙ {t('manage.title')}
        </button>
      </div>
    </aside>
  );
}
