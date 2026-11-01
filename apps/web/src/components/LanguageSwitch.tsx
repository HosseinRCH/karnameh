import { useTranslation } from 'react-i18next';
import { applyDirection } from '../i18n';

export default function LanguageSwitch() {
  const { i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  const change = () => {
    const next = isFa ? 'en' : 'fa';
    void i18n.changeLanguage(next);
    applyDirection(next);
  };

  return (
    <button
      type="button"
      onClick={change}
      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
    >
      {isFa ? 'English' : 'فارسی'}
    </button>
  );
}
