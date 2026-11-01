import type { ViewKind } from '../types';

export interface GuideSection {
  id: string;
  title: { en: string; fa: string };
  intro: { en: string; fa: string };
  steps: Array<{ en: string; fa: string }>;
  view?: ViewKind;
}

/** Bilingual in-app guide. `view` adds a "go there" button. */
export const GUIDE: GuideSection[] = [
  {
    id: 'start',
    title: { en: 'Getting started', fa: 'شروع سریع' },
    intro: {
      en: 'Your work lives in a hierarchy: Workspace → Space → (Folder) → List → Task.',
      fa: 'کار شما در یک سلسله‌مراتب است: ورک‌اسپیس ← فضا ← (فولدر) ← لیست ← تسک.',
    },
    steps: [
      { en: 'Switch workspace from the top of the sidebar, or create one with ＋.', fa: 'از بالای سایدبار ورک‌اسپیس را عوض کنید یا با ＋ بسازید.' },
      { en: 'Add a space (＋), a folder (🗀) or a list (＋) right in the sidebar.', fa: 'همان‌جا در سایدبار فضا (＋)، فولدر (🗀) یا لیست (＋) اضافه کنید.' },
      { en: 'In List view, type a task title and press Add.', fa: 'در نمای فهرست، عنوان تسک را بنویسید و «افزودن» را بزنید.' },
    ],
  },
  {
    id: 'views',
    title: { en: 'Views', fa: 'نماها' },
    intro: { en: 'Pick a view from the top-right selector. All views share one data set.', fa: 'از انتخابگر بالا-راست یک نما بردارید. همهٔ نماها یک دادهٔ مشترک دارند.' },
    steps: [
      { en: 'List & Board for day-to-day work; drag cards on the Board to change status.', fa: 'فهرست و تخته برای کار روزمره؛ در تخته کارت‌ها را بکشید تا وضعیت عوض شود.' },
      { en: 'Calendar (Jalali-first), Gantt (with dependency arrows), Timeline and Workload for planning.', fa: 'تقویم (پیش‌فرض شمسی)، گانت (با فلش وابستگی)، تایم‌لاین و بار کاری برای برنامه‌ریزی.' },
      { en: 'Table for inline editing, Activity for recent changes, Time for reports, Goals and Automations.', fa: 'جدول برای ویرایش سریع، فعالیت‌ها برای تغییرات اخیر، زمان برای گزارش‌ها، و اهداف و اتوماسیون.' },
    ],
  },
  {
    id: 'task',
    title: { en: 'Task details', fa: 'جزئیات تسک' },
    intro: { en: 'Click a task to open its detail drawer.', fa: 'روی یک تسک کلیک کنید تا کشوی جزئیات باز شود.' },
    steps: [
      { en: 'Set status, priority, start/due dates (Jalali picker in Persian) and estimate hours.', fa: 'وضعیت، اولویت، تاریخ شروع/سررسید (در فارسی با تقویم شمسی) و تخمین ساعتی را بگذارید.' },
      { en: 'Add assignees (with per-assignee estimate), tags, and custom-field values.', fa: 'مسئول (با تخمین هر نفر)، برچسب و مقدار فیلدهای سفارشی را اضافه کنید.' },
      { en: 'Break work into subtasks and link dependencies (“blocked by”).', fa: 'کار را به زیرکارها بشکنید و وابستگی («منتظرِ») وصل کنید.' },
    ],
  },
  {
    id: 'filter',
    title: { en: 'Filter, sort, group & save views', fa: 'فیلتر، مرتب‌سازی، گروه‌بندی و ذخیرهٔ نما' },
    intro: { en: 'The bar under the header filters the current list.', fa: 'نوار زیر هدر، لیست فعلی را فیلتر می‌کند.' },
    steps: [
      { en: 'Search, filter by status/priority/assignee/tag, choose a sort and optional grouping.', fa: 'جست‌وجو، فیلتر بر اساس وضعیت/اولویت/مسئول/برچسب، انتخاب مرتب‌سازی و گروه‌بندی.' },
      { en: '“Save view” stores the setup; “Set default” makes it load automatically.', fa: '«ذخیرهٔ نما» تنظیمات را نگه می‌دارد؛ «تعیین پیش‌فرض» آن را خودکار بارگذاری می‌کند.' },
    ],
  },
  {
    id: 'focus',
    title: { en: 'Focus timer', fa: 'تایمر تمرکز' },
    intro: { en: 'Time is tracked through gamified focus sessions.', fa: 'زمان از طریق جلسه‌های گیمیفای تمرکز ثبت می‌شود.' },
    steps: [
      { en: 'Pick 25/50 minutes, link a task, tick “Billable”, then Start Focus.', fa: '۲۵/۵۰ دقیقه را انتخاب کنید، تسک را وصل کنید، «قابل صورتحساب» را بزنید و شروع کنید.' },
      { en: 'Finish → a building is built and 1 point per minute is earned. Lose focus → a ruin appears.', fa: 'پایان ← ساختمان ساخته می‌شود و به‌ازای هر دقیقه ۱ امتیاز می‌گیرید. از دست دادن تمرکز ← ویرانه.' },
      { en: 'Click a ruin to clear it by spending 2× its duration in points.', fa: 'روی ویرانه کلیک کنید تا با پرداخت ۲ برابر مدت آن پاک شود.' },
    ],
    view: 'focus',
  },
  {
    id: 'time',
    title: { en: 'Time reports & timesheets', fa: 'گزارش زمان و تایم‌شیت' },
    intro: { en: 'The Time view rolls up focus sessions and manual entries.', fa: 'نمای زمان، جلسه‌های تمرکز و ورودهای دستی را جمع می‌زند.' },
    steps: [
      { en: 'See totals, estimate-vs-actual per task, and per-user time.', fa: 'مجموع، تخمین در برابر واقعی هر تسک، و زمان هر کاربر را ببینید.' },
      { en: 'Set an hourly rate + currency to get a billable amount, and export CSV.', fa: 'نرخ ساعتی و ارز را بگذارید تا مبلغ قابل صورتحساب به‌دست آید، و CSV بگیرید.' },
      { en: 'Add manual entries, then “Submit last 7 days” and approve/reject timesheets.', fa: 'ورود دستی اضافه کنید، سپس «ثبت ۷ روز اخیر» و تأیید/رد تایم‌شیت.' },
    ],
    view: 'time',
  },
  {
    id: 'goals',
    title: { en: 'Goals & targets', fa: 'اهداف و تارگت‌ها' },
    intro: { en: 'Define macro goals with measurable targets.', fa: 'اهداف کلان با تارگت‌های قابل‌اندازه‌گیری تعریف کنید.' },
    steps: [
      { en: 'Create a goal for “this month” or “this quarter” (Jalali periods).', fa: 'یک هدف برای «این ماه» یا «این فصل» (دوره‌های شمسی) بسازید.' },
      { en: 'Add targets: number, currency, boolean, or task-completion.', fa: 'تارگت اضافه کنید: عدد، ارز، بولی، یا تکمیل تسک.' },
      { en: 'Link tasks to a task-completion target — ticking them fills the goal bar live.', fa: 'تسک‌ها را به تارگت تکمیل وصل کنید — با تیک‌زدن، نوار هدف زنده پر می‌شود.' },
    ],
    view: 'goals',
  },
  {
    id: 'automations',
    title: { en: 'Automations', fa: 'اتوماسیون' },
    intro: { en: 'Rules that run themselves: when → then.', fa: 'قواعدی که خودکار اجرا می‌شوند: وقتی ← آنگاه.' },
    steps: [
      { en: 'Try “Use example recipe”: when a task goes In Progress → start timer + set priority High.', fa: '«دستور نمونه» را بزنید: وقتی تسک به In Progress رفت ← شروع تایمر + اولویت High.' },
      { en: 'Dry-run shows what would happen without changing anything; Run log records each run.', fa: 'اجرای آزمایشی نشان می‌دهد چه می‌شد؛ گزارش اجرا هر اجرا را ثبت می‌کند.' },
      { en: 'Loops are stopped automatically at a safe depth.', fa: 'حلقه‌ها به‌صورت خودکار در عمق امن متوقف می‌شوند.' },
    ],
    view: 'automations',
  },
  {
    id: 'dashboards',
    title: { en: 'Dashboards', fa: 'داشبوردها' },
    intro: { en: 'Build pages of widgets over your tasks and goals.', fa: 'صفحه‌هایی از ویجت‌ها روی تسک‌ها و اهداف بسازید.' },
    steps: [
      { en: 'Create a dashboard and add number / bar / pie / table widgets.', fa: 'یک داشبورد بسازید و ویجت عددی/میله‌ای/دایره‌ای/جدولی اضافه کنید.' },
      { en: 'Metrics include total, open, done, overdue, completion, by status/priority/assignee, and goals.', fa: 'متریک‌ها شامل کل، باز، انجام‌شده، عقب‌افتاده، درصد تکمیل، بر اساس وضعیت/اولویت/مسئول و اهداف است.' },
    ],
    view: 'dashboard',
  },
  {
    id: 'manage',
    title: { en: 'Manage & security', fa: 'مدیریت و امنیت' },
    intro: { en: 'The ⚙ Manage panel controls everything.', fa: 'پنل «⚙ مدیریت» همه‌چیز را کنترل می‌کند.' },
    steps: [
      { en: 'Members: add by email and change roles; Tags, Fields, Statuses, Lists, Folders: add/remove.', fa: 'اعضا: افزودن با ایمیل و تغییر نقش؛ برچسب‌ها، فیلدها، وضعیت‌ها، لیست‌ها و فولدرها: افزودن/حذف.' },
      { en: 'Security tab: enable TOTP two-factor authentication.', fa: 'تب امنیت: ورود دو مرحله‌ای (TOTP) را فعال کنید.' },
      { en: 'In the top bar: switch language and sign out.', fa: 'در نوار بالا: تغییر زبان و خروج.' },
    ],
  },
  {
    id: 'rtl',
    title: { en: 'Language & right-to-left', fa: 'زبان و راست‌به‌چپ' },
    intro: { en: 'English is the default; Persian is fully supported.', fa: 'انگلیسی پیش‌فرض است؛ فارسی کاملاً پشتیبانی می‌شود.' },
    steps: [
      { en: 'Toggle فارسی/English in the top bar — the whole layout mirrors to RTL.', fa: 'در نوار بالا فارسی/English را بزنید — کل چیدمان به RTL می‌چرخد.' },
      { en: 'Dates are Jalali-first in both languages, with the Gregorian date as a sub-calendar.', fa: 'تاریخ‌ها در هر دو زبان پیش‌فرض شمسی‌اند و تاریخ میلادی به‌عنوان زیرتقویم می‌آید.' },
      { en: 'Search normalizes Persian (ی/ي, ک/ك, digits) so spelling variants still match.', fa: 'جست‌وجو فارسی را نرمال می‌کند (ی/ي، ک/ك، اعداد) تا املاهای متفاوت هم پیدا شوند.' },
    ],
  },
];
