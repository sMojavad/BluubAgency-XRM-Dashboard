
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, FolderKanban, Briefcase, Settings, 
  LogOut, Menu, Bell, Clock, Plus, Wallet, ChevronRight, X, Check, Search, MessageSquare, FileText, Eye, EyeOff, Lock, AlertCircle, CheckCircle, UserCheck
} from 'lucide-react';

import { initDB, api } from './services/db';
import { syncFromSupabase } from './services/supabase';
import { playNotificationSound } from './services/sound';
import { applyTheme } from './services/theme';
import { User, UserRole, Task, AppSettings, PermissionKey, ToastMessage, ToastType, Notification, SidebarItemConfig } from './types';
import { toPersianDigits, formatJalali, generateId, checkPermission, getIcon, DEFAULT_SIDEBAR_CONFIG, getRelativeDateLabel } from './utils';
import { Modal, JalaliDatePicker, ToastContainer } from './components/Shared';
import { ConfirmActionDialog } from './components/ConfirmActionDialog';

import { AuthContext } from './AuthContext';

// Views
import LoginView from './views/Login';
import DashboardView from './views/Dashboard';
import ClientsView from './views/Clients';
import ProjectsView from './views/Projects';
import TeamView from './views/Team';
import MyTeamView from './views/MyTeam';
import FinanceView from './views/Finance';
import SettingsView from './views/Settings';
import MySettingsView from './views/MySettings';
import MessagesView from './views/Messages';
import InvoicesView from './views/Invoices';
import InvoiceEditor from './views/InvoiceEditor';
import InvoicePrint from './views/InvoicePrint';
import NotificationsView from './views/NotificationsView'; 

// --- Layout Components ---

const SidebarItem = ({ to, icon: Icon, label, active, badge, hasPulse, isSidebarOpen }: any) => {
    const navigate = useNavigate();
    return (
      <div 
        className={`flex items-center gap-3 py-3 mx-2 rounded-xl cursor-pointer transition-all duration-200 mb-1 relative
        ${isSidebarOpen ? 'px-4' : 'px-0 justify-center'}
        ${active 
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 shadow-sm font-bold' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        onClick={() => navigate(to)}
        title={!isSidebarOpen ? label : ""}
      >
        {Icon && <Icon size={20} />}
        {isSidebarOpen && <span className="text-sm flex-1">{label}</span>}
        
        {/* Badge & Pulse Logic */}
        {(badge > 0 || hasPulse) && (
            <div className={`flex items-center gap-1 ${!isSidebarOpen ? 'absolute top-2 right-2' : ''}`}>
                {hasPulse && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
                {badge > 0 && isSidebarOpen && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {toPersianDigits(badge > 99 ? '99+' : badge)}
                    </span>
                )}
            </div>
        )}
      </div>
    );
};

const Sidebar = ({ user, settings, unreadMessages, isSidebarOpen, setIsSidebarOpen }: { user: User, settings: AppSettings | null, unreadMessages: number, isSidebarOpen: boolean, setIsSidebarOpen: (open: boolean) => void }) => {
  const location = useLocation();
  
  // Use config from settings, or fallback
  let items = settings?.sidebarConfig || DEFAULT_SIDEBAR_CONFIG;
  if (settings?.sidebarConfig) {
      const existingIds = new Set(settings.sidebarConfig.map(i => i.id));
      const missingItems = DEFAULT_SIDEBAR_CONFIG.filter(i => !existingIds.has(i.id));
      if (missingItems.length > 0) {
          items = [...settings.sidebarConfig, ...missingItems];
      }
  }
  
  // Sort items
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  const getSidebarItemData = (item: SidebarItemConfig, role: UserRole) => {
      let isVisible = item.isVisible;
      let label = item.label;

      if (role !== UserRole.TeamMember) {
          if (item.id === 'my-team' || item.id === 'my-settings') {
              isVisible = false;
          }
      }

      if (role === UserRole.Admin) {
          if (item.id === 'projects') label = 'مدیریت پروژه‌ها';
          if (item.id === 'clients') label = 'مدیریت مشتریان';
          if (item.id === 'team') label = 'مدیریت تیم';
      }
      
      if (role === UserRole.Manager) {
          if (item.id === 'projects') label = 'پروژه‌ها';
          if (item.id === 'clients') label = 'مشتریان مرتبط';
          if (item.id === 'team') label = 'تیم پروژه';
          if (item.id === 'finance') label = 'گزارش‌ها';
          if (item.id === 'settings') isVisible = false;
      }
      
      if (role === UserRole.TeamMember) {
          if (item.id === 'dashboard') label = 'داشبورد من';
          if (item.id === 'projects') label = 'پروژه‌های من';
          if (item.id === 'team' || item.id === 'clients' || item.id === 'finance' || item.id === 'settings' || item.id === 'invoices') {
              isVisible = false;
          }
      }
      
      if (role === UserRole.ClientUser) {
          if (item.id === 'dashboard') label = 'داشبورد من';
          if (item.id === 'projects') label = 'پروژه‌های من';
          if (item.id === 'invoices') label = 'فاکتورهای من';
          if (item.id === 'team' || item.id === 'clients' || item.id === 'finance' || item.id === 'settings') {
              isVisible = false;
          }
      }

      if (role === UserRole.ConnectionUser) {
          if (item.id === 'dashboard') label = 'داشبورد من';
          if (item.id === 'projects') label = 'پروژه‌های معرفی‌شده';
          if (item.id === 'finance') label = 'کمیسیون‌های من';
          if (item.id === 'clients') label = 'معرفی‌های من';
          if (item.id === 'team' || item.id === 'settings') {
              isVisible = false;
          }
      }
      
      return { isVisible, label };
  };

  return (
    <div className={`fixed top-0 right-0 h-full ${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 z-[100] flex flex-col shadow-lg transition-all duration-300 no-print`}>
      <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col gap-4'} border-b border-gray-100 dark:border-slate-700`}>
        {isSidebarOpen && (
          <div className="flex items-center gap-3">
            {settings?.dashboardLogoUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-slate-700 shadow-md shrink-0">
                <img src={settings.dashboardLogoUrl} alt="logo" className="w-full h-full object-contain"/>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-primary-300 flex items-center justify-center text-white font-bold shadow-md">
                X
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-xl text-gray-800 dark:text-white tracking-tight">XRM</h1>
              <p className="text-xs text-gray-400">سیستم جامع مدیریت</p>
            </div>
          </div>
        )}

        {!isSidebarOpen && (
          settings?.dashboardLogoUrl ? (
            <div className="w-10 h-10 min-h-[40px] rounded-xl overflow-hidden flex flex-shrink-0 items-center justify-center bg-white dark:bg-slate-700 shadow-md">
              <img src={settings.dashboardLogoUrl} alt="logo" className="w-full h-full object-contain"/>
            </div>
          ) : (
            <div className="w-10 h-10 min-h-[40px] rounded-xl bg-gradient-to-tr from-brand to-primary-300 flex flex-shrink-0 items-center justify-center text-white font-bold shadow-md">
              X
            </div>
          )
        )}

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-slate-600"
          title={isSidebarOpen ? 'بستن منو' : 'باز کردن منو'}
        >
          <Menu size={20} />
        </button>
      </div>
      
      <div className="flex-1 py-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {sortedItems.map(item => {
            const { isVisible, label } = getSidebarItemData(item, user.role);

            if (!isVisible) return null;
            if (item.requiredPermission && !checkPermission(user, item.requiredPermission, settings)) return null;

            // Message specific props
            const isMessageItem = item.id === 'messages';
            const badgeCount = isMessageItem ? unreadMessages : 0;
            const pulse = isMessageItem && unreadMessages > 0;

            return (
                <SidebarItem 
                    key={item.id}
                    to={item.path} 
                    icon={getIcon(item.iconName)} 
                    label={label} 
                    active={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))}
                    badge={badgeCount}
                    hasPulse={pulse}
                    isSidebarOpen={isSidebarOpen}
                />
            );
        })}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-slate-700">
        <div className={`bg-gray-50 dark:bg-slate-900 rounded-2xl ${isSidebarOpen ? 'p-3 flex items-center gap-3' : 'p-2 flex justify-center'} shadow-inner transition-all`}>
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
             {user.avatarUrl ? <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" /> : <Users size={18} className="text-gray-500" />}
          </div>
          {isSidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChangePasswordModal = ({ isOpen, onClose, user, logout, showToast }: any) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowCurrent(false);
            setShowNew(false);
            setErrorMsg('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!currentPassword) {
            setErrorMsg('رمز عبور فعلی را وارد کنید.');
            return;
        }
        if (!newPassword) {
            setErrorMsg('رمز عبور جدید را وارد کنید.');
            return;
        }
        if (newPassword.length < 6) {
            setErrorMsg('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
            return;
        }
        if (!confirmPassword) {
            setErrorMsg('تکرار رمز عبور جدید را وارد کنید.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setErrorMsg('تکرار رمز عبور جدید با رمز جدید یکسان نیست.');
            return;
        }
        if (currentPassword === newPassword) {
            setErrorMsg('رمز عبور جدید نباید با رمز فعلی یکسان باشد.');
            return;
        }
        if (user.passwordHash !== currentPassword) {
            setErrorMsg('رمز عبور فعلی اشتباه است.');
            return;
        }

        const updatedUser = { ...user, passwordHash: newPassword };
        await api.users.update(updatedUser, user.id);
        
        onClose();
        showToast('رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.', 'success');
        setTimeout(() => {
            logout();
        }, 1500);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تغییر رمز عبور">
            <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                    <div className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {errorMsg}
                    </div>
                )}
                
                <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">رمز عبور فعلی</label>
                    <div className="relative">
                        <input 
                            type={showCurrent ? "text" : "password"} 
                            value={currentPassword} 
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-left" 
                            dir="ltr"
                        />
                        <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">رمز عبور جدید</label>
                    <div className="relative">
                        <input 
                            type={showNew ? "text" : "password"} 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-left" 
                            dir="ltr"
                        />
                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">تکرار رمز عبور جدید</label>
                    <input 
                        type={showNew ? "text" : "password"} 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-left" 
                        dir="ltr"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-6 py-2 rounded-xl text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition font-bold">
                        لغو
                    </button>
                    <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-xl font-bold transition flex items-center gap-2">
                        <Check size={18} />
                        ذخیره تغییرات
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const TopBar = () => {
  const { user, logout, previewUser, setPreviewUser, showToast, settings } = useContext(AuthContext);
  const prevUnreadRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState<any>(null);
  
  // Task State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [quickTaskText, setQuickTaskText] = useState('');
  
  // Range Task
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');

  // Notification State
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const navigate = useNavigate();

  // Load Notifications
  useEffect(() => {
      const fetchNotifs = async () => {
          if(user) {
              const data = await api.notifications.getAll(user.id);
              const unread = data.filter(n => !n.isRead).length;
              // Play bell sound when a NEW unread notification arrives (not on first load)
              if (prevUnreadRef.current !== null && unread > prevUnreadRef.current) {
                  playNotificationSound(settings?.notificationBellSound);
              }
              prevUnreadRef.current = unread;
              setNotifications(data);
          }
      };
      fetchNotifs();
      const interval = setInterval(fetchNotifs, 10000); // Poll every 10s
      
      const handleUpdate = () => fetchNotifs();
      window.addEventListener('notificationUpdated', handleUpdate);
      
      return () => {
          clearInterval(interval);
          window.removeEventListener('notificationUpdated', handleUpdate);
      };
  }, [user, settings]);

  // Click Outside for Notification Dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setShowNotif(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    api.logs.add(user?.id || '', 'START_TIMER', 'شروع تایمر کار');
    const interval = setInterval(() => {
      setCurrentTime(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
    showToast('تایمر شروع شد', 'success');
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
    if (timerInterval) clearInterval(timerInterval);
    api.logs.add(user?.id || '', 'STOP_TIMER', `توقف تایمر. مدت: ${formatTime(currentTime)}`);
    showToast(`تایمر متوقف شد. مدت: ${formatTime(currentTime)}`, 'info');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return toPersianDigits(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const handleQuickTask = async (e: React.FormEvent) => {
    e.preventDefault(); 
    e.stopPropagation();

    if(quickTaskText) {
      await api.tasks.create({
          id: generateId(),
          title: quickTaskText,
          deadline: taskEndDate || undefined, 
          isDone: false,
          createdAt: new Date().toISOString()
      });
      api.logs.add(user?.id || '', 'CREATE_TASK', `تسک سریع: ${quickTaskText}`);
      showToast('تسک جدید با موفقیت ثبت شد', 'success');
      
      setQuickTaskText('');
      setTaskStartDate('');
      setTaskEndDate('');
      setShowTaskModal(false);
      window.dispatchEvent(new Event('taskUpdated'));
    }
  };
  
  useEffect(() => {
      if(searchQuery.length > 2) {
          const runSearch = async () => {
              const clients = await api.clients.getAll();
              const projects = await api.projects.getAll();
              const foundClients = clients.filter(c => c.name.includes(searchQuery)).map(c => ({...c, type: 'مشتری', link: '/clients'}));
              const foundProjects = projects.filter(p => p.title.includes(searchQuery)).map(p => ({...p, type: 'پروژه', name: p.title, link: '/projects'}));
              setSearchResults([...foundClients, ...foundProjects]);
          };
          runSearch();
      } else {
          setSearchResults([]);
      }
  }, [searchQuery]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
    {/* Impersonation Banner */}
    {previewUser && (
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 text-sm font-bold flex flex-col sm:flex-row justify-between items-center sticky top-0 z-[60] shadow-lg animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-2 sm:mb-0">
              <div className="p-1.5 bg-white/20 rounded-full animate-pulse">
                  <UserCheck size={20} />
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="opacity-90">در حال مشاهده سیستم به‌عنوان:</span>
                  <span className="bg-black/20 px-2 rounded text-white border border-white/20">
                      {previewUser.firstName} {previewUser.lastName} ({previewUser.role})
                  </span>
              </div>
          </div>
          <button 
             onClick={() => setPreviewUser(null)} 
             className="bg-white text-amber-700 hover:bg-gray-100 px-4 py-1.5 rounded-lg transition text-xs font-black shadow-sm flex items-center gap-2"
          >
              <LogOut size={14}/> بازگشت به حالت مدیرکل
          </button>
      </div>
    )}

    <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 sticky top-0 z-40 transition-colors shadow-sm no-print">
      <div className="flex items-center gap-6">
        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700">
          {formatJalali(new Date().toISOString())}
        </div>
        
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 rounded-full px-1 py-1 border border-gray-100 dark:border-slate-700">
           {!isTimerRunning ? (
             <button onClick={handleStartTimer} className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition shadow-sm">
               <Plus size={16} />
             </button>
           ) : (
             <button onClick={handleStopTimer} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shadow-sm animate-pulse">
               <div className="w-3 h-3 bg-white rounded-sm"></div>
             </button>
           )}
           <span className="px-3 font-mono text-lg font-bold text-primary-600 dark:text-primary-400 dir-ltr">
             {formatTime(currentTime)}
           </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
            <div className={`flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl transition-all duration-300 ${showSearch ? 'w-64 px-3' : 'w-10 px-0 justify-center'}`}>
                <button onClick={() => setShowSearch(!showSearch)} className="p-2 text-gray-500">
                    <Search size={20} />
                </button>
                {showSearch && (
                    <>
                    <input 
                        className="bg-transparent border-none outline-none w-full text-sm" 
                        placeholder="جستجو..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    {searchQuery && (
                        <button onClick={() => {setSearchQuery(''); document.querySelector('input')?.focus()}} className="text-gray-400 hover:text-red-500">
                            <X size={14} />
                        </button>
                    )}
                    </>
                )}
            </div>
            {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-64 bg-white dark:bg-slate-800 shadow-xl rounded-xl mt-2 p-2 z-50 border border-gray-100 dark:border-slate-700">
                    {searchResults.map((item, i) => (
                        <div key={i} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer" onClick={() => navigate(item.link)}>
                            <div className="text-sm font-bold">{item.name}</div>
                            <div className="text-xs text-gray-400">{item.type}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <button 
           onClick={() => setShowTaskModal(true)}
           className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition" 
           title="افزودن تسک سریع"
        >
          <Clock size={20} />
        </button>
        
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button 
             onClick={() => setShowNotif(!showNotif)}
             className={`p-2 rounded-xl transition relative ${showNotif ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
          >
            <Bell size={20} className={unreadCount > 0 ? 'animate-swing' : ''}/>
            {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                </span>
            )}
          </button>
          
          {showNotif && (
             <div className="absolute top-full left-0 mt-3 w-80 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700 z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden font-shabnam">
               <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                   <h4 className="font-bold text-gray-800 dark:text-white text-sm">اعلان‌ها ({toPersianDigits(unreadCount)})</h4>
                   <button onClick={() => { if(user) api.notifications.markAllAsRead(user.id); }} className="text-xs text-primary-600 hover:underline">خواندن همه</button>
               </div>
               <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                   {notifications.length > 0 ? notifications.slice(0, 5).map(n => (
                       <div 
                            key={n.id} 
                            onClick={async () => {
                                if(!n.isRead && user) await api.notifications.markAsRead(n.id, user.id);
                                if(n.link) { navigate(n.link); setShowNotif(false); }
                            }}
                            className={`p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition relative group ${n.isRead ? 'opacity-70' : 'bg-blue-50/30'}`}
                       >
                           {!n.isRead && <span className="absolute top-4 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                           <div className="flex justify-between mb-1">
                               <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate pr-2">{n.title}</span>
                               <span className="text-[10px] text-gray-400 whitespace-nowrap">{getRelativeDateLabel(new Date(n.createdAt))}</span>
                           </div>
                           <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                       </div>
                   )) : (
                       <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                           <Bell size={24} className="mb-2 opacity-30"/>
                           <span className="text-xs">هیچ اعلان جدیدی ندارید</span>
                       </div>
                   )}
               </div>
               <div className="p-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-center">
                   <button 
                      onClick={() => { 
                          setShowNotif(false); 
                          navigate('/notifications');
                      }} 
                      className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary-600 w-full py-2 flex items-center justify-center gap-1"
                   >
                       <span>مشاهده همه اعلان‌ها</span>
                       <ChevronRight size={12} className="rotate-180"/>
                   </button>
               </div>
             </div>
          )}
        </div>
        
        <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1"></div>

        <div 
          className="relative"
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <div className="flex items-center gap-2 cursor-pointer py-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{user?.firstName}</span>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
          </div>
          
          {showProfileMenu && (
            <div className="absolute top-full left-0 w-48 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200">
               {user?.role !== UserRole.TeamMember && (
                 <button onClick={() => setShowChangePasswordModal(true)} className="w-full text-right px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                   <Lock size={16} />
                   تغییر رمز عبور
                 </button>
               )}
               <button onClick={logout} className="w-full text-right px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                 <LogOut size={16} />
                 خروج از سیستم
               </button>
            </div>
          )}
        </div>
      </div>
    </header>

    <ChangePasswordModal 
      isOpen={showChangePasswordModal} 
      onClose={() => setShowChangePasswordModal(false)} 
      user={user} 
      logout={logout} 
      showToast={showToast} 
    />

    <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="تسک سریع">
       <form onSubmit={handleQuickTask}>
          <textarea 
            className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none mb-4"
            rows={2}
            placeholder="چه کاری باید انجام دهید؟"
            value={quickTaskText}
            onChange={e => setQuickTaskText(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuickTask(e);
                }
            }}
            autoFocus
          ></textarea>
          
          <div className="mb-4">
              <JalaliDatePicker 
                  label="انتخاب بازه زمانی (ددلاین)"
                  isRange={true}
                  startDate={taskStartDate}
                  endDate={taskEndDate}
                  onRangeChange={(start, end) => {
                      setTaskStartDate(start);
                      setTaskEndDate(end);
                  }}
              />
          </div>

          <div className="flex justify-end">
             <button type="button" onClick={handleQuickTask} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-xl font-bold transition">ثبت</button>
          </div>
       </form>
    </Modal>
    </>
  );
};

const ProtectedLayout = () => {
  const { user, previewUser, settings } = useContext(AuthContext);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Decide who is the "Effective User" (Actual or Preview)
  // This logic is now handled in Context Provider, so `user` here is already effective user
  // But we still pass it for clarity if needed.
  // Actually, due to Context change in App component, `user` from context IS the effective user.
  
  useEffect(() => {
      const fetchMsgs = async () => {
          if (user) {
              const count = await api.messages.getUnreadMessagesCount(user.id);
              setUnreadMsgCount(count);
          }
      };
      
      fetchMsgs();
      const interval = setInterval(fetchMsgs, 10000); 
      
      const handleUpdate = () => fetchMsgs();
      window.addEventListener('messagesUpdated', handleUpdate);
      
      return () => {
          clearInterval(interval);
          window.removeEventListener('messagesUpdated', handleUpdate);
      };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      <Sidebar user={user} settings={settings} unreadMessages={unreadMsgCount} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className={`${isSidebarOpen ? 'mr-64' : 'mr-20'} transition-all duration-300 print:mr-0`}>
        <TopBar />
        <main className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 print:p-0 print:max-w-none">
           <Routes>
             <Route path="/" element={<DashboardView />} />
             <Route path="/clients" element={<ClientsView />} />
             <Route path="/projects" element={<ProjectsView />} />
             <Route path="/invoices" element={<InvoicesView />} />
             <Route path="/invoices/new" element={<InvoiceEditor />} />
             <Route path="/invoices/edit/:id" element={<InvoiceEditor />} />
             <Route path="/invoices/:id/print" element={<InvoicePrint />} />
             <Route path="/team" element={<TeamView />} />
             <Route path="/my-team" element={<MyTeamView />} />
             <Route path="/finance" element={<FinanceView />} />
             <Route path="/messages" element={<MessagesView />} />
             <Route path="/my-settings" element={<MySettingsView />} />
             <Route path="/settings" element={<SettingsView />} />
             <Route path="/notifications" element={<NotificationsView />} />
             <Route path="*" element={<Navigate to="/" />} />
           </Routes>
        </main>
      </div>
    </div>
  );
};

// --- App Root ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  // Realtime polling — every 15s pull from Supabase and notify all views
  useEffect(() => {
    const interval = setInterval(async () => {
      if (localStorage.getItem('xrm_current_user')) {
        await syncFromSupabase();
        window.dispatchEvent(new CustomEvent('xrm-data-synced'));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Presence heartbeat — marks the current user as online while the app is open
  useEffect(() => {
    if (!user) return;
    api.presence.heartbeat(user.id); // immediate
    const hb = setInterval(() => {
      if (document.visibilityState === 'visible') api.presence.heartbeat(user.id);
    }, 25000);
    const onVisible = () => { if (document.visibilityState === 'visible') api.presence.heartbeat(user.id); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(hb); document.removeEventListener('visibilitychange', onVisible); };
  }, [user]);

  const refreshSettings = async () => {
      const s = await api.settings.get();
      setSettings(s);
      applyTheme(s.themeColor, s.brandColor);
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('xrm_current_user', JSON.stringify(userData));
    showToast(`خوش آمدید ${userData.firstName}`, 'success');
  };

  const logout = () => {
    setUser(null);
    setPreviewUser(null);
    localStorage.removeItem('xrm_current_user');
  };

  // --- Impersonation Wrapper with Logging ---
  const handleSetPreviewUser = (targetUser: User | null) => {
      if (targetUser) {
          // Start Impersonation
          api.logs.add(user?.id || '', 'IMPERSONATION_START', `View as ${targetUser.firstName} ${targetUser.lastName} (${targetUser.role})`);
          setPreviewUser(targetUser);
      } else {
          // End Impersonation
          api.logs.add(user?.id || '', 'IMPERSONATION_END', 'Returned to Admin Mode');
          setPreviewUser(null);
      }
  };

  const hasPermission = (perm: PermissionKey) => {
      // Check against EFFECTIVE user
      const u = previewUser || user;
      return checkPermission(u, perm, settings);
  };

  const showToast = (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Global Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
      isOpen: boolean;
      title: string;
      description: string;
      confirmText?: string;
      isDestructive?: boolean;
      onConfirm: () => Promise<void> | void;
  }>({
      isOpen: false,
      title: '',
      description: '',
      onConfirm: async () => {}
  });

  const confirmAction = (options: {
      title?: string;
      description?: string;
      confirmText?: string;
      isDestructive?: boolean;
      onConfirm: () => Promise<void> | void;
  }) => {
      setConfirmDialog({
          isOpen: true,
          title: options.title || 'حذف مورد',
          description: options.description || 'این عمل قابل بازگشت نیست. حذف انجام شود؟',
          confirmText: options.confirmText || 'حذف',
          isDestructive: options.isDestructive !== undefined ? options.isDestructive : true,
          onConfirm: async () => {
              await options.onConfirm();
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading XRM...</div>;

  // Context value swaps 'user' with impersonated user if active
  const effectiveUser = previewUser || user;

  return (
    <AuthContext.Provider value={{ 
        user: effectiveUser, // PASS EFFECTIVE USER TO ALL COMPONENTS
        login, logout, loading, 
        settings, refreshSettings, 
        hasPermission,
        previewUser, 
        setPreviewUser: handleSetPreviewUser,
        showToast,
        confirmAction
    }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmActionDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText={confirmDialog.confirmText}
          isDestructive={confirmDialog.isDestructive}
      />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;
