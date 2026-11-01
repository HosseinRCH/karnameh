import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CustomField, Status, TaskList } from '@karnameh/shared';
import { api } from '../api/client';
import type { Folder, Member, Tag } from '../types';

type Tab = 'members' | 'tags' | 'fields' | 'statuses' | 'lists' | 'folders' | 'security' | 'data';

const FIELD_TYPES = [
  'text', 'long_text', 'number', 'currency', 'dropdown', 'labels',
  'checkbox', 'date', 'email', 'phone', 'url', 'rating',
] as const;
const STATUS_TYPES = ['open', 'custom', 'done', 'closed'] as const;
const ROLES = ['owner', 'admin', 'member', 'guest'] as const;

export default function ManagePanel({
  workspaceId,
  listId,
  members,
  tags,
  fields,
  statuses,
  lists,
  folders,
  onClose,
}: {
  workspaceId: string;
  listId: string | null;
  members: Member[];
  tags: Tag[];
  fields: CustomField[];
  statuses: Status[];
  lists: TaskList[];
  folders: Folder[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('members');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [mEmail, setMEmail] = useState('');
  const [mName, setMName] = useState('');
  const [mRole, setMRole] = useState('member');
  const [tagName, setTagName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<string>('text');
  const [statusName, setStatusName] = useState('');
  const [statusType, setStatusType] = useState<string>('custom');

  const invalidateMembers = () => void qc.invalidateQueries({ queryKey: ['members', workspaceId] });
  const invalidateTags = () => void qc.invalidateQueries({ queryKey: ['tags', workspaceId] });
  const invalidateList = () => void qc.invalidateQueries({ queryKey: ['list', listId] });
  const invalidateSpaces = () => void qc.invalidateQueries({ queryKey: ['spaces'] });

  const addMember = useMutation({
    mutationFn: () => api.addMember(workspaceId, { email: mEmail, name: mName || undefined, role: mRole }),
    onSuccess: (res) => {
      setMEmail('');
      setMName('');
      setTempPassword(res.temporaryPassword ?? null);
      invalidateMembers();
    },
  });
  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: string }) => api.updateMemberRole(workspaceId, v.userId, v.role),
    onSuccess: invalidateMembers,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeMember(workspaceId, userId),
    onSuccess: invalidateMembers,
  });
  const addTag = useMutation({
    mutationFn: () => api.createTag(workspaceId, tagName),
    onSuccess: () => {
      setTagName('');
      invalidateTags();
    },
  });
  const removeTag = useMutation({
    mutationFn: (tagId: string) => api.deleteTag(workspaceId, tagId),
    onSuccess: invalidateTags,
  });
  const addField = useMutation({
    mutationFn: () => api.createField(listId!, { name: fieldName, type: fieldType }),
    onSuccess: () => {
      setFieldName('');
      invalidateList();
    },
  });
  const removeField = useMutation({
    mutationFn: (fieldId: string) => api.deleteField(listId!, fieldId),
    onSuccess: invalidateList,
  });
  const addStatus = useMutation({
    mutationFn: () => api.createStatus(listId!, { name: statusName, type: statusType }),
    onSuccess: () => {
      setStatusName('');
      invalidateList();
    },
  });
  const removeStatus = useMutation({
    mutationFn: (statusId: string) => api.deleteStatus(listId!, statusId),
    onSuccess: invalidateList,
  });
  const renameList = useMutation({
    mutationFn: (v: { id: string; name: string }) => api.renameList(v.id, v.name),
    onSuccess: invalidateSpaces,
  });
  const removeList = useMutation({
    mutationFn: (id: string) => api.deleteList(id),
    onSuccess: invalidateSpaces,
  });
  const renameFolder = useMutation({
    mutationFn: (v: { id: string; name: string }) => api.renameFolder(v.id, v.name),
    onSuccess: invalidateSpaces,
  });
  const removeFolder = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: invalidateSpaces,
  });

  // 2FA / security
  const [code, setCode] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: api.account });
  const enable2fa = useMutation({
    mutationFn: (c: string) => api.twoFactorEnable(c),
    onSuccess: () => {
      setCode('');
      setTotpSetup(null);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const disable2fa = useMutation({
    mutationFn: (c: string) => api.twoFactorDisable(c),
    onSuccess: () => {
      setCode('');
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.reorderStatuses(listId!, ids),
    onSuccess: invalidateList,
  });
  const moveStatus = (index: number, dir: number) => {
    const ids = statuses.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate(ids);
  };

  // Export / import the whole workspace as a JSON bundle.
  const [dataMessage, setDataMessage] = useState('');
  const exportData = async () => {
    const bundle = await api.exportWorkspace(workspaceId);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karnameh-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = async (file: File) => {
    try {
      const bundle = JSON.parse(await file.text());
      const res = await api.importWorkspace(bundle);
      setDataMessage(`${t('data.imported')}: ${res.workspace.name}`);
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const tabBtn = (active: boolean) =>
    `-mb-px border-b-2 px-3 py-2 text-sm ${active ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500'}`;
  const input = 'rounded-md border border-slate-200 px-2 py-1.5 text-sm';
  const addBtn = 'rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white';
  const x = 'rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600';
  const confirmDelete = () => window.confirm(t('manage.deleteConfirm'));

  const tabLabels: Tab[] = ['members', 'tags', 'fields', 'statuses', 'lists', 'folders', 'security', 'data'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('manage.title')}</h2>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
          {tabLabels.map((x) => (
            <button key={x} type="button" onClick={() => setTab(x)} className={tabBtn(tab === x)}>
              {t(`manage.${x}`)}
            </button>
          ))}
        </div>

        {tab === 'members' && (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-800">
                    {m.name} <span className="text-slate-400">{m.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <select
                      value={m.role}
                      onChange={(e) => setRole.mutate({ userId: m.id, role: e.target.value })}
                      className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button type="button" className={x} onClick={() => confirmDelete() && removeMember.mutate(m.id)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mEmail.trim()) addMember.mutate();
              }}
              className="space-y-2 rounded-lg bg-slate-50 p-3"
            >
              <input value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder={t('manage.email')} className={`w-full ${input}`} />
              <div className="flex gap-2">
                <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder={t('manage.name')} className={`w-full ${input}`} />
                <select value={mRole} onChange={(e) => setMRole(e.target.value)} className={input}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button type="submit" className={addBtn}>
                  {t('manage.add')}
                </button>
              </div>
              {tempPassword && (
                <p className="text-xs text-emerald-700">
                  {t('manage.tempPassword')}: <code className="rounded bg-emerald-50 px-1">{tempPassword}</code>
                </p>
              )}
            </form>
          </div>
        )}

        {tab === 'tags' && (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100">
              {tags.map((tg) => (
                <li key={tg.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: tg.color }}>
                    {tg.name}
                  </span>
                  <button type="button" className={x} onClick={() => confirmDelete() && removeTag.mutate(tg.id)}>
                    ✕
                  </button>
                </li>
              ))}
              {tags.length === 0 && <li className="py-2 text-sm text-slate-400">{t('manage.empty')}</li>}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tagName.trim()) addTag.mutate();
              }}
              className="flex gap-2"
            >
              <input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder={t('manage.tagName')} className={`w-full ${input}`} />
              <button type="submit" className={addBtn}>
                {t('manage.add')}
              </button>
            </form>
          </div>
        )}

        {tab === 'fields' && (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100">
              {fields.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-800">
                    {f.name} <span className="text-xs text-slate-400">{f.type}</span>
                  </span>
                  <button type="button" className={x} onClick={() => confirmDelete() && removeField.mutate(f.id)}>
                    ✕
                  </button>
                </li>
              ))}
              {fields.length === 0 && <li className="py-2 text-sm text-slate-400">{t('manage.empty')}</li>}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (fieldName.trim()) addField.mutate();
              }}
              className="flex gap-2"
            >
              <input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder={t('manage.fieldName')} className={`w-full ${input}`} />
              <select value={fieldType} onChange={(e) => setFieldType(e.target.value)} className={input}>
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {ft}
                  </option>
                ))}
              </select>
              <button type="submit" className={addBtn}>
                {t('manage.add')}
              </button>
            </form>
          </div>
        )}

        {tab === 'statuses' && (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100">
              {statuses.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2 text-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} <span className="text-xs text-slate-400">{s.type}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className={x} onClick={() => moveStatus(i, -1)}>
                      ↑
                    </button>
                    <button type="button" className={x} onClick={() => moveStatus(i, 1)}>
                      ↓
                    </button>
                    <button type="button" className={x} onClick={() => confirmDelete() && removeStatus.mutate(s.id)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (statusName.trim()) addStatus.mutate();
              }}
              className="flex gap-2"
            >
              <input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder={t('manage.statusName')} className={`w-full ${input}`} />
              <select value={statusType} onChange={(e) => setStatusType(e.target.value)} className={input}>
                {STATUS_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <button type="submit" className={addBtn}>
                {t('manage.add')}
              </button>
            </form>
          </div>
        )}

        {tab === 'lists' && (
          <ul className="divide-y divide-slate-100">
            {lists.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-slate-800">{l.name}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={x}
                    onClick={() => {
                      const name = window.prompt(t('manage.rename'), l.name);
                      if (name) renameList.mutate({ id: l.id, name });
                    }}
                  >
                    ✎
                  </button>
                  <button type="button" className={x} onClick={() => confirmDelete() && removeList.mutate(l.id)}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {lists.length === 0 && <li className="py-2 text-sm text-slate-400">{t('manage.empty')}</li>}
          </ul>
        )}

        {tab === 'folders' && (
          <ul className="divide-y divide-slate-100">
            {folders.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-slate-800">{f.name}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={x}
                    onClick={() => {
                      const name = window.prompt(t('manage.rename'), f.name);
                      if (name) renameFolder.mutate({ id: f.id, name });
                    }}
                  >
                    ✎
                  </button>
                  <button type="button" className={x} onClick={() => confirmDelete() && removeFolder.mutate(f.id)}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {folders.length === 0 && <li className="py-2 text-sm text-slate-400">{t('manage.empty')}</li>}
          </ul>
        )}

        {tab === 'security' && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-700">
              {t('security.twoFactor')}:{' '}
              <b>{me.data?.twoFactorEnabled ? t('security.on') : t('security.off')}</b>
            </p>
            {!me.data?.twoFactorEnabled && (
              <>
                <button
                  type="button"
                  className={addBtn}
                  onClick={async () => setTotpSetup(await api.twoFactorSetup())}
                >
                  {t('security.enable')}
                </button>
                {totpSetup && (
                  <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">{t('security.scanHint')}</p>
                    <p className="break-all font-mono text-slate-700">{totpSetup.secret}</p>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code) enable2fa.mutate(code);
                  }}
                  className="flex gap-2"
                >
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={`w-full ${input}`} />
                  <button type="submit" className={addBtn}>
                    {t('security.verifyEnable')}
                  </button>
                </form>
              </>
            )}
            {me.data?.twoFactorEnabled && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code) disable2fa.mutate(code);
                }}
                className="flex gap-2"
              >
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={`w-full ${input}`} />
                <button type="submit" className="rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white">
                  {t('security.disable')}
                </button>
              </form>
            )}
          </div>
        )}
        {tab === 'data' && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <h4 className="font-medium text-slate-700">{t('data.export')}</h4>
              <p className="mb-2 text-xs text-slate-500">{t('data.exportHint')}</p>
              <button type="button" onClick={() => void exportData()} className={addBtn}>
                {t('data.export')}
              </button>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <h4 className="font-medium text-slate-700">{t('data.import')}</h4>
              <p className="mb-2 text-xs text-slate-500">{t('data.importHint')}</p>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importData(file);
                  e.target.value = '';
                }}
                className="block w-full text-xs"
              />
            </div>
            {dataMessage && <p className="text-xs text-emerald-600">{dataMessage}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
