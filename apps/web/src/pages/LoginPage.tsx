import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, apiBase, tokenStore } from '../api/client';
import LanguageSwitch from '../components/LanguageSwitch';

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('demo@karnameh.local');
  const [password, setPassword] = useState('demo12345');
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const providers = useQuery({ queryKey: ['oauth-providers'], queryFn: api.oauthProviders });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      if ('twoFactorRequired' in res) {
        setPendingToken(res.pendingToken);
      } else {
        tokenStore.set(res.token);
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.login2fa(pendingToken, code);
      tokenStore.set(res.token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setLoading(false);
    }
  };

  const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400';

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('app.name')}</h1>
          <LanguageSwitch />
        </div>

        {pendingToken ? (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-sm text-slate-500">{t('auth.twoFactorPrompt')}</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className={input}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? t('loading') : t('auth.verify')}
            </button>
          </form>
        ) : (
          <>
            <p className="text-sm text-slate-500">{t('auth.subtitle')}</p>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('auth.email')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('auth.password')}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              </label>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? t('loading') : t('auth.signIn')}
              </button>
            </form>

            {(providers.data ?? []).length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                {(providers.data ?? []).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      window.location.href = `${apiBase}/auth/oauth/${p}/start`;
                    }}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm capitalize text-slate-700 hover:bg-slate-50"
                  >
                    {t('auth.continueWith')} {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
