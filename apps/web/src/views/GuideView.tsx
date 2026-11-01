import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GUIDE } from '../guide/content';
import type { ViewKind } from '../types';

/** In-app guide that explains every part of the app. */
export default function GuideView({ onOpenView }: { onOpenView: (view: ViewKind) => void }) {
  const { t, i18n } = useTranslation();
  const fa = i18n.language === 'fa';
  const pick = (o: { en: string; fa: string }) => (fa ? o.fa : o.en);
  const [open, setOpen] = useState<string>(GUIDE[0]?.id ?? '');

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <header className="rounded-xl bg-indigo-50 p-4">
        <h2 className="text-lg font-semibold text-slate-800">{t('guide.title')}</h2>
        <p className="text-sm text-slate-600">{t('guide.subtitle')}</p>
      </header>

      {GUIDE.map((section) => {
        const isOpen = open === section.id;
        return (
          <section key={section.id} className="rounded-xl bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? '' : section.id)}
              className="flex w-full items-center justify-between text-start"
            >
              <span className="font-medium text-slate-800">{pick(section.title)}</span>
              <span className="text-slate-400">{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p>{pick(section.intro)}</p>
                <ol className="space-y-1.5">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-700">
                        {i + 1}
                      </span>
                      <span>{pick(step)}</span>
                    </li>
                  ))}
                </ol>
                {section.view && (
                  <button
                    type="button"
                    onClick={() => onOpenView(section.view as ViewKind)}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white"
                  >
                    {t('guide.open')} →
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
