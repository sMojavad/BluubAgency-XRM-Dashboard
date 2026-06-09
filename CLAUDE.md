# XRM — سیستم جامع مدیریت آژانس

## معرفی پروژه
سیستم مدیریت یکپارچه آژانس (XRM) شامل CRM، مدیریت پروژه، حسابداری، تیم، پیام‌رسانی و فاکتور.

## تکنولوژی
- **Framework**: React 19 + Vite 6
- **Language**: TypeScript
- **Routing**: React Router DOM v7
- **UI**: Lucide React + Framer Motion + Recharts
- **Database Sync**: Supabase (kv_store table)
- **Deployment**: Vercel
- **Domain**: xrm.bluubpro.ir

## ساختار فایل‌ها
```
├── services/
│   ├── db.ts          ← تمام منطق داده (localStorage + Supabase sync)
│   ├── supabase.ts    ← Supabase client و sync functions
│   └── ledger.ts      ← منطق حسابداری
├── views/             ← تمام صفحات اصلی
├── components/        ← کامپوننت‌های مشترک
├── App.tsx            ← کامپوننت اصلی و routing
├── types.ts           ← تمام type definitions
├── utils.ts           ← توابع کمکی
└── .env               ← متغیرهای محیطی (هرگز commit نشود)
```

## فایل‌های حساس — هرگز overwrite نکن
این ۳ فایل تنظیمات اتصال به Supabase دارند و نباید با export جدید جایگزین شوند:
1. `services/supabase.ts`
2. `services/db.ts` (مخصوصاً import و تابع saveItems و login)
3. `.env`

## متغیرهای محیطی (.env)
```
VITE_SUPABASE_URL=https://xfzgpvycaifmcbgrnknb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## دیتابیس — Supabase
- **Project**: XRM Bluub Agency
- **Table**: `kv_store` (key TEXT, value JSONB, updated_at TIMESTAMPTZ)
- **RLS**: غیرفعال (DISABLED)
- تمام داده‌ها به صورت key-value ذخیره می‌شوند
- هر entity یک key دارد (مثلاً xrm_users، xrm_projects و...)

## نحوه کارکرد sync
- هنگام load: `syncFromSupabase()` → Supabase → localStorage
- هنگام save: `saveItems()` → localStorage + `pushToSupabase()`
- هنگام login: ابتدا sync از Supabase، سپس بررسی credentials

## تغییرات کلیدی در db.ts
```typescript
// Import
import { pushToSupabase, syncFromSupabase } from './supabase';

// saveItems - باید async باشد
const saveItems = async (key: string, items: any[]) => {
  localStorage.setItem(key, JSON.stringify(items));
  await pushToSupabase(key, items);
};

// login - باید قبل از بررسی sync کند
login: async (username, password) => {
  await syncFromSupabase();
  await delay();
  // ... بقیه کد
}
```

## تغییرات کلیدی در App.tsx
```typescript
// Import
import { syncFromSupabase } from './services/supabase';

// useEffect اصلی
useEffect(() => {
  const init = async () => {
    await syncFromSupabase();
    initDB();
    api.automation.runChecks();
    const storedUser = localStorage.getItem('xrm_current_user');
    if (storedUser) setUser(JSON.parse(storedUser));
    refreshSettings().then(() => setLoading(false));
  };
  init();
}, []);
```

## GitHub
- **Repo**: https://github.com/sMojavad/BluubAgency-XRM-Dashboard
- **Branch اصلی**: main
- **Local path**: J:\Ai\Claude\Projects\2- BluubAgency XRM Dashboard

## Vercel
- **Domain**: xrm.bluubpro.ir
- **Auto Deploy**: از branch main
- **Env Vars**: VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY باید در Vercel تنظیم شوند

## workflow توسعه
```bash
# اجرای لوکال
npm install
npm run dev

# deploy به production
git add .
git commit -m "feat: توضیح تغییر"
git push origin main
```

## نکات مهم
- پسوردها به صورت plain text ذخیره می‌شوند (passwordHash در واقع plain است)
- Admin اولیه: username=09117540145، password=1234
- تاریخ‌ها به فرمت شمسی نمایش داده می‌شوند
- تمام متن‌های UI به فارسی هستند
- سیستم RTL است
