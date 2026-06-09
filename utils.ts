
import { User, UserRole, PermissionKey, AppSettings, SidebarItemConfig } from './types';
import * as LucideIcons from 'lucide-react';

// Persian Number Converter
export const toPersianDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/\d/g, (x) => String.fromCharCode(x.charCodeAt(0) + 1728));
};

export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  return str.toString().replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
};

// Currency Formatter
export const formatCurrency = (amount: number): string => {
  if (typeof amount !== 'number') return '0';
  return toPersianDigits(amount.toLocaleString('en-US'));
};

// Input Formatter (Adds commas)
export const formatPriceInput = (value: string): string => {
  const clean = toEnglishDigits(value).replace(/\D/g, '');
  if (!clean) return '';
  return toPersianDigits(Number(clean).toLocaleString('en-US'));
};

export const parsePriceInput = (value: string): number => {
  const clean = toEnglishDigits(value).replace(/\D/g, '');
  return Number(clean) || 0;
};

// Full Number to Words Converter
const ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const tens = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

const convertThousand = (num: number): string => {
  if (num === 0) return '';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const rem = num % 10;
    return tens[Math.floor(num / 10)] + (rem ? ' و ' + ones[rem] : '');
  }
  const rem = num % 100;
  return hundreds[Math.floor(num / 100)] + (rem ? ' و ' + convertThousand(rem) : '');
};

export const numberToWords = (num: number, unit: string = 'تومان'): string => {
  if (num === 0) return `صفر ${unit}`;
  
  const parts = [];
  const billions = Math.floor(num / 1000000000);
  let rem = num % 1000000000;
  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (billions) parts.push(convertThousand(billions) + ' میلیارد');
  if (millions) parts.push(convertThousand(millions) + ' میلیون');
  if (thousands) parts.push(convertThousand(thousands) + ' هزار');
  if (rem) parts.push(convertThousand(rem));

  return parts.join(' و ') + ' ' + unit;
};

// Calculate Share
export const calculateShare = (total: number, percent: number): number => {
    if (!total || !percent) return 0;
    return Math.round((total * percent) / 100);
};

// Date Formatter (Jalaali)
export const formatJalali = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.startsWith('14') || dateStr.startsWith('13')) return toPersianDigits(dateStr);
  
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

export const formatJalaliShort = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.startsWith('14') || dateStr.startsWith('13')) return toPersianDigits(dateStr);

  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'Completed': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'Canceled': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    // Invoice Colors
    case 'پیش‌نویس': return 'bg-gray-100 text-gray-600';
    case 'ارسال‌شده': return 'bg-blue-50 text-blue-600';
    case 'دیده‌شده': return 'bg-indigo-50 text-indigo-600';
    case 'تأییدشده': return 'bg-teal-50 text-teal-600';
    case 'پرداخت‌شده': return 'bg-green-100 text-green-700';
    case 'معوق': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

// --- DATE LOGIC ---

// Calculate Days Between
export const daysBetween = (d1: Date, d2: Date) => {
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
};

export const getJalaliParts = (date: Date, cal: 'jalali' | 'gregorian' = 'jalali') => {
    // Safety check for Invalid Date
    if (isNaN(date.getTime())) {
        return { y: 1403, m: 1, d: 1 };
    }

    const calendarType = cal === 'jalali' ? 'persian' : 'gregory';
    const locale = cal === 'jalali' ? 'fa-IR' : 'en-US';
    
    try {
        const fmt = new Intl.DateTimeFormat(`${locale}-u-ca-${calendarType}`, { year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = fmt.formatToParts(date);
        const y = parseInt(toEnglishDigits(parts.find(p => p.type === 'year')?.value || '1400'));
        const m = parseInt(toEnglishDigits(parts.find(p => p.type === 'month')?.value || '1'));
        const d = parseInt(toEnglishDigits(parts.find(p => p.type === 'day')?.value || '1'));
        return { y, m, d };
    } catch (e) {
        // Fallback for extreme edge cases
        return { y: 1403, m: 1, d: 1 };
    }
};

export const getConversionDisplay = (date: Date) => {
    const greg = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const hijri = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-civil', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    return { greg, hijri };
};

export const getRelativeDateLabel = (targetDate: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'امروز';
    if (diffDays === 1) return 'فردا';
    if (diffDays === -1) return 'دیروز';
    
    if (diffDays > 0) return `${toPersianDigits(diffDays)} روز بعد`;
    return `${toPersianDigits(Math.abs(diffDays))} روز قبل`;
};

// --- DAILY MESSAGE ---
export const getDailyMessage = (role: UserRole | undefined): string => {
    const day = new Date().getDay();
    const messages = [
        "شروع هفته بهترین زمان برای برنامه‌ریزی دقیق است.", // Sat
        "امروز یک قدم کوچک بردار تا فردا راحت‌تر باشی.", // Sun
        "تمرکز روی کیفیت، همیشه نتیجه‌بخش است.", // Mon
        "عملکرد این هفته‌ات تا اینجا عالی بوده، ادامه بده.", // Tue
        "کارهای باقی‌مانده را اولویت‌بندی کن.", // Wed
        "آخر هفته نزدیک است، انرژی‌ات را حفظ کن.", // Thu
        "زمان خوبی برای جمع‌بندی و استراحت است." // Fri
    ];
    
    const msg = messages[(day + 1) % 7]; // Shift to match Jalali approximate logic
    return msg;
};


// --- PERMISSIONS & CONFIG DEFAULTS ---

export const DEFAULT_SIDEBAR_CONFIG: SidebarItemConfig[] = [
    { id: 'dashboard', label: 'داشبورد', path: '/', iconName: 'LayoutDashboard', isVisible: true, order: 0, requiredPermission: 'VIEW_DASHBOARD' },
    { id: 'notifications', label: 'اعلان‌ها', path: '/notifications', iconName: 'Bell', isVisible: true, order: 0.5 },
    { id: 'projects', label: 'پروژه‌ها', path: '/projects', iconName: 'FolderKanban', isVisible: true, order: 1, requiredPermission: 'VIEW_PROJECTS' },
    { id: 'clients', label: 'مدیریت مشتریان', path: '/clients', iconName: 'Users', isVisible: true, order: 2, requiredPermission: 'VIEW_CLIENTS' },
    { id: 'invoices', label: 'فاکتورها', path: '/invoices', iconName: 'FileText', isVisible: true, order: 3, requiredPermission: 'VIEW_INVOICES' },
    { id: 'finance', label: 'حسابداری', path: '/finance', iconName: 'Wallet', isVisible: true, order: 4, requiredPermission: 'VIEW_FINANCE' },
    { id: 'my-team', label: 'تیم من', path: '/my-team', iconName: 'Users', isVisible: true, order: 4.5, requiredPermission: 'VIEW_MY_TEAM' },
    { id: 'team', label: 'مدیریت تیم', path: '/team', iconName: 'Briefcase', isVisible: true, order: 5, requiredPermission: 'VIEW_TEAM' },
    { id: 'messages', label: 'پیام‌ها', path: '/messages', iconName: 'MessageSquare', isVisible: true, order: 6, requiredPermission: 'VIEW_MESSAGES' },
    { id: 'my-settings', label: 'تنظیمات من', path: '/my-settings', iconName: 'Settings', isVisible: true, order: 98, requiredPermission: 'VIEW_MY_SETTINGS' },
    { id: 'settings', label: 'تنظیمات', path: '/settings', iconName: 'Settings', isVisible: true, order: 99, requiredPermission: 'VIEW_SETTINGS' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
    [UserRole.Admin]: [
        'VIEW_DASHBOARD', 'VIEW_CLIENTS', 'MANAGE_CLIENTS', 'VIEW_PROJECTS', 'MANAGE_PROJECTS', 
        'VIEW_INVOICES', 'MANAGE_INVOICES', 'VIEW_TEAM', 'MANAGE_TEAM', 'VIEW_FINANCE', 'MANAGE_FINANCE', 
        'VIEW_MESSAGES', 'VIEW_SETTINGS', 'MANAGE_SETTINGS', 'VIEW_LOGS'
    ],
    [UserRole.Manager]: [
        'VIEW_DASHBOARD', 'VIEW_CLIENTS', 'MANAGE_CLIENTS', 'VIEW_PROJECTS', 'MANAGE_PROJECTS', 
        'VIEW_INVOICES', 'MANAGE_INVOICES', 'VIEW_TEAM', 'MANAGE_TEAM', 'VIEW_FINANCE', 
        'VIEW_MESSAGES', 'VIEW_SETTINGS', 'VIEW_LOGS'
    ],
    [UserRole.TeamMember]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_MY_TEAM', 'VIEW_MY_SETTINGS', 'CHANGE_OWN_PASSWORD', 'VIEW_MESSAGES'
    ],
    // RBAC: Customer only sees Dashboard, Projects, Invoices (Self), Messages
    [UserRole.ClientUser]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_INVOICES', 'VIEW_MESSAGES'
    ],
    [UserRole.ConnectionUser]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_INVOICES', 'VIEW_MESSAGES', 'VIEW_CLIENTS', 'VIEW_FINANCE'
    ]
};

export const ALL_PERMISSIONS: {key: PermissionKey, label: string, category: string}[] = [
    { key: 'VIEW_DASHBOARD', label: 'مشاهده داشبورد', category: 'عمومی' },
    { key: 'VIEW_MESSAGES', label: 'مشاهده پیام‌ها', category: 'عمومی' },
    { key: 'VIEW_CLIENTS', label: 'مشاهده مشتریان', category: 'مشتریان' },
    { key: 'MANAGE_CLIENTS', label: 'مدیریت مشتریان (افزودن/حذف)', category: 'مشتریان' },
    { key: 'VIEW_PROJECTS', label: 'مشاهده پروژه‌ها', category: 'پروژه‌ها' },
    { key: 'MANAGE_PROJECTS', label: 'مدیریت پروژه‌ها', category: 'پروژه‌ها' },
    { key: 'VIEW_INVOICES', label: 'مشاهده فاکتورها', category: 'مالی' },
    { key: 'MANAGE_INVOICES', label: 'مدیریت فاکتورها', category: 'مالی' },
    { key: 'VIEW_FINANCE', label: 'مشاهده حسابداری کل', category: 'مالی' },
    { key: 'MANAGE_FINANCE', label: 'مدیریت تراکنش‌ها', category: 'مالی' },
    { key: 'VIEW_TEAM', label: 'مشاهده اعضای تیم', category: 'تیم' },
    { key: 'MANAGE_TEAM', label: 'مدیریت اعضای تیم', category: 'تیم' },
    { key: 'VIEW_SETTINGS', label: 'مشاهده تنظیمات', category: 'سیستم' },
    { key: 'MANAGE_SETTINGS', label: 'تغییر تنظیمات اصلی', category: 'سیستم' },
    { key: 'VIEW_LOGS', label: 'مشاهده لاگ سیستم', category: 'سیستم' },
];

export interface ProjectHealth {
    status: 'healthy' | 'attention' | 'risky' | 'critical' | 'overdue' | 'today' | 'upcoming';
    labelFa: string;
    score: number;
    reasons: string[];
}

const getJalaliAbsoluteDays = (y: number, m: number, d: number) => {
    let days = y * 365 + Math.floor((y * 8) / 33);
    for (let i = 1; i < m; i++) {
        days += i <= 6 ? 31 : 30;
    }
    return days + d;
};

const getDaysDiff = (targetDateStr: string | undefined): number | null => {
    if (!targetDateStr) return null;
    
    try {
        const enStr = toEnglishDigits(String(targetDateStr)).trim();
        
        // Handle ISO or standard Gregorian formats
        if ((enStr.includes('-') || enStr.includes('T')) && !enStr.startsWith('13') && !enStr.startsWith('14')) {
            const targetDate = new Date(enStr);
            if (!isNaN(targetDate.getTime())) {
                targetDate.setHours(0,0,0,0);
                const today = new Date();
                today.setHours(0,0,0,0);
                return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            }
        }
        
        // Handle Jalali parts (YYYY/MM/DD)
        const parts = enStr.split('/');
        if (parts.length === 3) {
            const ty = parseInt(parts[0], 10);
            const tm = parseInt(parts[1], 10);
            const td = parseInt(parts[2], 10);
            
            if (!isNaN(ty) && !isNaN(tm) && !isNaN(td)) {
                const todayParts = getJalaliParts(new Date(), 'jalali');
                const targetAbsolute = getJalaliAbsoluteDays(ty, tm, td);
                const todayAbsolute = getJalaliAbsoluteDays(todayParts.y, todayParts.m, todayParts.d);
                return targetAbsolute - todayAbsolute;
            }
        }
        
        // Fallback for weird formats
        const targetDate = new Date(enStr);
        if (!isNaN(targetDate.getTime())) {
            targetDate.setHours(0,0,0,0);
            const today = new Date();
            today.setHours(0,0,0,0);
            return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        return null;
    } catch (e) {
        return null;
    }
};

const parseNumberVal = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    try {
        const clean = toEnglishDigits(String(val)).replace(/[%,\s]/g, '');
        const num = Number(clean);
        return isNaN(num) ? null : num;
    } catch {
        return null;
    }
};

export const parseMoney = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    try {
        const englishDigitsStr = toEnglishDigits(String(val));
        const clean = englishDigitsStr.replace(/[^\d.-]/g, '');
        const num = Number(clean);
        return isNaN(num) ? 0 : num;
    } catch {
        return 0;
    }
};

export const calculateProjectFinancials = (projectId: string, invoices: any[], transactions: any[]) => {
    const projectInvoices = invoices.filter(i => i.projectId === projectId);
    const invoiceIds = projectInvoices.map(i => i.id);

    const projectInvoicesTotal = projectInvoices.reduce((sum, inv) => sum + parseMoney(inv.finalAmount || inv.totalAmount || inv.amount), 0);
    
    // Transactions belonging to project or its invoices
    const projectTransactions = transactions.filter(t => {
        // Direct project transaction
        if (t.projectId === projectId) return true;
        // Or linked via invoice
        if (t.invoiceId && invoiceIds.includes(t.invoiceId)) return true;
        return false;
    });
    
    const incomeTransactions = projectTransactions.filter(t => t.type === 'Income' && t.status === 'Approved');
    const projectTotalIncome = incomeTransactions.reduce((sum, t) => sum + parseMoney(t.amount), 0);
    
    const expenseTransactions = projectTransactions.filter(t => t.type === 'Expense' && t.status === 'Approved');
    const projectTotalExpense = expenseTransactions.reduce((sum, t) => sum + parseMoney(t.amount), 0);

    const projectInvoicesPaid = projectTotalIncome; 
    const projectReceivableRemaining = Math.max(0, projectInvoicesTotal - projectInvoicesPaid);
    const projectNetProfit = projectTotalIncome - projectTotalExpense;

    let financialStatus = 'بدون تراکنش';
    let financialStatusColor = 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400';
    
    if (projectInvoicesTotal > 0 && projectReceivableRemaining > 0) {
        financialStatus = 'در انتظار دریافت';
        financialStatusColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    } else if (projectTotalIncome > 0 && projectReceivableRemaining === 0 && projectInvoicesTotal > 0) {
        financialStatus = 'تسویه‌شده';
        financialStatusColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    } else if (projectTotalIncome > 0 && projectTotalExpense === 0) {
        financialStatus = 'درآمدزا';
        financialStatusColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    } else if (projectTotalExpense > 0 && projectTotalIncome === 0) {
        financialStatus = 'دارای هزینه';
        financialStatusColor = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    } else if (projectInvoicesTotal === 0 && projectTotalIncome > 0) {
        financialStatus = 'بدون فاکتور';
        financialStatusColor = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    }

    return {
        projectTotalIncome,
        projectTotalExpense,
        projectInvoicesTotal,
        projectInvoicesPaid,
        projectReceivableRemaining,
        projectNetProfit,
        financialStatus,
        financialStatusColor,
        projectTransactions,
        projectInvoices
    };
};

export const calculateDashboardFinancials = (projects: any[], invoices: any[], transactions: any[], clients: any[]) => {
    const currentIncome = transactions.filter(t => t.type === 'Income' && t.status === 'Approved').reduce((sum, t) => sum + parseMoney(t.amount), 0);
    const currentExpense = transactions.filter(t => t.type === 'Expense' && t.status === 'Approved').reduce((sum, t) => sum + parseMoney(t.amount), 0);
    
    let totalInvoicedTotal = 0;
    let totalInvoicedPaid = 0;
    let overdueInvoicesCount = 0;
    let overdueReceivables = 0;

    const processedInvoiceIds = new Set<string>();

    const projectsFinancials = projects.map(p => {
        const pf = calculateProjectFinancials(p.id, invoices, transactions);
        pf.projectInvoices.forEach((i: any) => processedInvoiceIds.add(i.id));
        return { project: p, financials: pf };
    });

    const isUnpaid = (status: string) => ['ارسال‌شده', 'دیده‌شده', 'تأییدشده', 'معوق', 'پیش‌نویس'].includes(status);

    invoices.forEach(inv => {
        const invTotal = parseMoney(inv.finalAmount || inv.totalAmount || inv.amount);
        if (!processedInvoiceIds.has(inv.id)) {
            totalInvoicedTotal += invTotal;
            const invTrans = transactions.filter(t => t.invoiceId === inv.id && t.type === 'Income' && t.status === 'Approved');
            let invPaid = invTrans.reduce((sum, t) => sum + parseMoney(t.amount), 0);
            
            // if no transactions but invoice is paid
            if (inv.status === 'پرداخت‌شده' && invPaid === 0) invPaid = invTotal;

            totalInvoicedPaid += invPaid;
        }

        // Overdue calculation
        if (invTotal > 0 && isUnpaid(inv.status)) {
            const isOverdueReal = inv.status === 'معوق' || (inv.dueDate && new Date(inv.dueDate) < new Date());
            if (isOverdueReal) {
                overdueInvoicesCount++;
                const invTrans2 = transactions.filter(t => t.invoiceId === inv.id && t.type === 'Income' && t.status === 'Approved');
                const p = invTrans2.reduce((sum, t) => sum + parseMoney(t.amount), 0);
                overdueReceivables += Math.max(0, invTotal - p);
            }
        }
    });

    projectsFinancials.forEach(pf => {
        totalInvoicedTotal += pf.financials.projectInvoicesTotal;
        totalInvoicedPaid += pf.financials.projectTotalIncome; 
    });

    const outstandingReceivables = Math.max(0, totalInvoicedTotal - totalInvoicedPaid);
    const netProfit = currentIncome - currentExpense;

    let pendingReceivables = 0;
    let expectedProjectIncome = 0;

    projectsFinancials.forEach(pf => {
        const unpaidInv = pf.financials.projectReceivableRemaining;
        const budget = parseMoney(pf.project.totalBudget || pf.project.budget?.total);
        if (unpaidInv === 0 && budget > pf.financials.projectTotalIncome && invoices.filter(i => i.projectId === pf.project.id).length === 0) {
            // No invoice yet, but budget exists
            expectedProjectIncome += (budget - pf.financials.projectTotalIncome);
        }
    });

    const pendingInvoiceReceivables = invoices.filter(i => isUnpaid(i.status) && i.status !== 'معوق').reduce((sum, i) => {
        const invTotal = parseMoney(i.finalAmount || i.totalAmount || i.amount);
        const invTrans = transactions.filter(t => t.invoiceId === i.id && t.type === 'Income' && t.status === 'Approved');
        const p = invTrans.reduce((s, t) => s + parseMoney(t.amount), 0);
        return sum + Math.max(0, invTotal - p);
    }, 0);

    pendingReceivables = expectedProjectIncome + pendingInvoiceReceivables;

    const forecastedRevenue = totalInvoicedTotal + expectedProjectIncome;
    const forecastedExpenses = currentExpense + projects.reduce((sum, p) => sum + parseMoney(p.expenses || p.totalExpenses), 0);
    const estimatedProfit = forecastedRevenue - forecastedExpenses;

    const riskyProjects = projectsFinancials.filter(pf => {
         const hasUnpaidInvoices = pf.financials.projectReceivableRemaining > 0;
         const hasHighExpense = pf.financials.projectTotalExpense > pf.financials.projectTotalIncome;
         const isNetNegative = pf.financials.projectNetProfit < 0;
         return hasUnpaidInvoices || hasHighExpense || isNetNegative;
    }).map(pf => {
        const hasUnpaid = pf.financials.projectReceivableRemaining > 0;
        const hasHighExp = pf.financials.projectTotalExpense > pf.financials.projectTotalIncome;
        return {
            id: pf.project.id,
            title: pf.project.title || 'بدون عنوان',
            isRisk: true,
            riskDesc: hasUnpaid ? 'فاکتور عقب‌افتاده دارد' : (hasHighExp ? 'هزینه بیش از درآمد' : 'سود منفی'),
            expenses: pf.financials.projectTotalExpense,
            budget: parseMoney(pf.project.totalBudget)
        };
    }).slice(0, 3);

    return {
        currentIncome,
        currentExpense,
        invoicedIncome: totalInvoicedTotal,
        actualReceived: currentIncome, 
        outstandingReceivables,
        netProfit,
        forecastedRevenue,
        forecastedExpenses,
        estimatedProfit,
        pendingReceivables,
        overdueReceivables,
        overdueInvoicesCount,
        riskyProjects,
        projectsFinancials
    };
};

export const calculateProjectHealth = (project: any, settings: AppSettings | null = null): ProjectHealth => {
    let score = 100;
    const reasons: string[] = [];
    
    const msgs = settings?.projectHealthMessages || {};
    const txtOverdueBadge = msgs.overdueBadge || 'ددلاین گذشته';
    const txtOverdueReason = msgs.overdueReason || 'ددلاین پروژه گذشته است.';
    const txtTodayBadge = msgs.todayBadge || 'ددلاین امروز';
    const txtTodayReason = msgs.todayReason || 'ددلاین پروژه امروز است.';
    const txtUpcomingBadge = msgs.upcomingBadge || 'ددلاین نزدیک';
    const txtUpcomingReason = msgs.upcomingReason || 'ددلاین پروژه نزدیک است.';
    const txtAttentionBadge = msgs.attentionBadge || 'نیازمند توجه';
    const txtLowProgressReason = msgs.lowProgressReason || 'پیشرفت پروژه نسبت به زمان باقیمانده پایین است.';
    const txtHealthyBadge = msgs.healthyBadge || 'سالم';
    const txtHealthyReason = msgs.healthyReason || 'مورد پرریسکی برای این پروژه شناسایی نشده است.';
    const txtIdleReason = msgs.idleReason || 'مدتی است فعالیت جدیدی روی پروژه ثبت نشده است.';
    const txtBudgetReason = msgs.budgetReason || 'هزینه‌ها به محدوده بحرانی بودجه رسیده‌اند.';
    const txtExpenseReason = msgs.expenseReason || 'مصرف بودجه نیازمند بررسی است.';

    if (!project) {
        return { status: 'healthy', labelFa: txtHealthyBadge, score: 100, reasons: [] };
    }

    if (project.status === 'Completed' || project.status === 'Archived' || project.status === 'Canceled' || project.status === 'Done') {
        return { status: 'healthy', labelFa: txtHealthyBadge, score: 100, reasons: [] };
    }

    let isOverdue = false;
    let isToday = false;
    let isUpcoming = false;

    // 1. Deadline Risk
    const deadlineField = project.deadline ?? project.deadlineDate ?? project.dueDate ?? project.endDate ?? project.deadlineJalaliDate ?? project.jalaliDeadline ?? project.projectDeadline;
    if (deadlineField) {
        const diffDays = getDaysDiff(deadlineField);
        const warningDays = parseNumberVal(project.deadlineWarningDays) ?? 3;
        
        if (diffDays !== null) {
            if (diffDays < 0) {
                score -= 45;
                reasons.push(txtOverdueReason);
                isOverdue = true; // Still active but deadline past
            } else if (diffDays === 0) {
                score -= 35;
                reasons.push(txtTodayReason);
                isToday = true;
            } else if (diffDays <= warningDays) {
                score -= 20;
                reasons.push(txtUpcomingReason);
                isUpcoming = true;
            }
        }
    }

    // 2. Progress Risk
    const rawProgress = project.progress ?? project.completionPercentage ?? project.percentComplete ?? project.projectProgress ?? project.completion ?? project.progressPercent;
    const progressVal = parseNumberVal(rawProgress);

    if (progressVal !== null) {
        if (isOverdue && progressVal < 100) {
             score -= 20;
             reasons.push(txtLowProgressReason);
        } else if (isUpcoming && progressVal < 50) {
             score -= 20;
             reasons.push(txtLowProgressReason);
        } else if (project.status === 'Active' && progressVal < 30) {
             score -= 15;
             reasons.push('پیشرفت پروژه پایین است.');
        } else if (isUpcoming && progressVal >= 30 && progressVal < 60) {
             score -= 10;
             reasons.push(txtLowProgressReason);
        }
    }

    // 3. Budget Risk
    const rawTotalBudget = project.totalBudget ?? project.budget?.total ?? project.projectBudget ?? project.allocatedBudget;
    let budgetVal = parseNumberVal(rawTotalBudget);
    
    if (project.budget && project.budget.total !== undefined) {
         budgetVal = parseNumberVal(project.budget.total);
    }
    
    const rawExpenses = project.expenses ?? project.totalExpenses ?? project.spent ?? project.projectExpenses ?? project.cost;
    const expensesVal = parseNumberVal(rawExpenses) || 0;

    if (budgetVal !== null && budgetVal > 0) {
        const expenseRatio = expensesVal / budgetVal;
        if (expenseRatio >= 1) {
            score -= 30;
            reasons.push(txtBudgetReason);
        } else if (expenseRatio >= 0.9) {
            score -= 25;
            reasons.push(txtBudgetReason);
        } else if (expenseRatio >= 0.7) {
            score -= 15;
            reasons.push(txtExpenseReason);
        } else if (expenseRatio >= 0.5) {
            score -= 5;
            reasons.push(txtExpenseReason);
        }
    }

    // 4. Tasks Risk
    if (project.tasks && Array.isArray(project.tasks)) {
         let overdueTasks = 0;
         let openTasks = 0;
         project.tasks.forEach((t: any) => {
             if (!t.isDone && t.status !== 'completed' && t.status !== 'done') {
                 openTasks++;
                 if (t.deadline) {
                     const tDiff = getDaysDiff(t.deadline);
                     if (tDiff !== null && tDiff < 0) overdueTasks++;
                 }
             }
         });
         
         if (overdueTasks > 0) {
             score -= Math.min(20, overdueTasks * 5); // up to -20
             reasons.push('تعداد تسک‌های انجام‌نشده و گذشته از ددلاین بالاست.');
         } else if (openTasks > 5 && progressVal !== null && progressVal < 30) {
             score -= 10;
             reasons.push('حجم تسک‌های باز نسبت به پیشرفت پروژه زیاد است.');
         }
    }

    // 5. Last Activity Risk
    const lastActivityField = project.lastActivityAt ?? project.updatedAt;
    if (lastActivityField && project.status === 'Active') {
        const updatedDiff = getDaysDiff(lastActivityField);
        if (updatedDiff !== null) {
            if (updatedDiff < -14) {
                score -= 20;
                reasons.push(txtIdleReason);
            } else if (updatedDiff < -7) {
                score -= 10;
                reasons.push(txtIdleReason);
            }
        }
    }

    // Math constraints
    score = Math.max(0, Math.min(100, score));

    // Deduplicate reasons
    const uniqueReasons = Array.from(new Set(reasons));

    let status: ProjectHealth['status'] = 'healthy';
    let labelFa: string = txtHealthyBadge;

    if (isOverdue) {
        status = 'overdue';
        labelFa = txtOverdueBadge;
    } else if (isToday) {
        status = 'today';
        labelFa = txtTodayBadge;
    } else if (isUpcoming) {
        status = 'upcoming';
        labelFa = txtUpcomingBadge;
    } else if (score >= 80) {
        status = 'healthy';
        labelFa = txtHealthyBadge;
    } else if (score >= 60) {
        status = 'attention';
        labelFa = txtAttentionBadge;
    } else if (score >= 40) {
        status = 'risky';
        labelFa = 'پرریسک';
    } else {
        status = 'critical';
        labelFa = 'بحرانی';
    }

    return { status, labelFa, score, reasons: uniqueReasons };
};

export const checkPermission = (user: User | null, permission: PermissionKey | undefined, settings: AppSettings | null): boolean => {
    if (!user) return false;
    if (!permission) return true; // No permission required
    if (user.role === UserRole.Admin) return true; // Admin has all power (Safety net)

    // Hardcoded fallbacks for new TeamMember permissions
    if (user.role === UserRole.TeamMember && ['VIEW_MY_TEAM', 'VIEW_MY_SETTINGS', 'CHANGE_OWN_PASSWORD'].includes(permission)) {
        return true;
    }

    // 1. Check Specific Override
    if (user.permissionOverrides && user.permissionOverrides[permission] !== undefined) {
        return user.permissionOverrides[permission]!;
    }

    // 2. Check Role Default
    const rolePerms = settings?.rolePermissions?.[user.role] || DEFAULT_ROLE_PERMISSIONS[user.role];
    return rolePerms.includes(permission);
};

export const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.HelpCircle;
};
