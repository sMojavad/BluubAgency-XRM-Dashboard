
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Project, ProjectStatus, Client, User, PaymentMethod, UserRole, Notification, Transaction, TransactionType, FinanceCategory, Invoice, TransactionStatus, LedgerSnapshot, ProjectFile } from '../types';
import { LedgerSnapshotService } from '../services/ledger';
import { generateId, toPersianDigits, formatCurrency, formatJalali, getStatusColor, calculateShare, calculateProjectHealth, ProjectHealth, calculateProjectFinancials } from '../utils';
import { Plus, Filter, Calendar, DollarSign, Edit, Trash, Users, Bell, TrendingUp, TrendingDown, Wallet, PieChart, FileText, Link, Check, Paperclip, Download, X, StickyNote, Lock, Percent } from 'lucide-react';
import { Modal, CurrencyInput, JalaliDatePicker } from '../components/Shared';

const getHealthColor = (status: ProjectHealth['status']) => {
   switch(status) {
       case 'healthy': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
       case 'attention': 
       case 'upcoming': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
       case 'risky': 
       case 'today': return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
       case 'critical': 
       case 'overdue': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
       default: return 'bg-gray-50 text-gray-700';
   }
};

const ProjectsView = () => {
  const { user, showToast, confirmAction, settings } = useContext(AuthContext);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); // New: For P&L Calc
  const [invoices, setInvoices] = useState<Invoice[]>([]); // New: For Invoice Linking
  const [snapshots, setSnapshots] = useState<Record<string, LedgerSnapshot>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    description: '',
    status: ProjectStatus.Active,
    projectType: 'Web',
    sourceType: 'Client',
    deadlineWarningDays: 3,
    totalBudget: 0,
    connectionSharePercent: 0,
    expenses: 0,
    paymentMethod: PaymentMethod.Cash,
    members: [],
    memberAllocations: {},
    installments: [],
    linkedInvoiceId: undefined
  });
  
  // New state for sending notification
  const [notifyMembers, setNotifyMembers] = useState(true);

  // Notes and files UI state
  const [activeNoteTab, setActiveNoteTab] = useState<'public' | 'personal'>('public');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Access Control
  const isClient = user?.role === UserRole.ClientUser || user?.role === UserRole.ConnectionUser;
  const isTeamMember = user?.role === UserRole.TeamMember;
  const canManage = user?.role === UserRole.Admin || user?.role === UserRole.Manager;

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    // Modified: Fetch transactions for P&L calculation
    const [pData, cData, uData, tData, iData] = await Promise.all([
        api.projects.getAll(), 
        api.clients.getAll(), 
        api.users.getAll(),
        api.transactions.getAll(),
        api.invoices.getAll()
    ]);
    
    // --- DATA SCOPING ---
    let scopedProjects = pData;
    if (isClient) {
        scopedProjects = pData.filter(p => p.sourceId === user.id);
    } else if (isTeamMember) {
        scopedProjects = pData.filter(p => p.members?.includes(user.id));
    }
    
    const snaps: Record<string, LedgerSnapshot> = {};
    for (const p of scopedProjects) {
        snaps[p.id] = await LedgerSnapshotService.getSnapshot('project', p.id);
    }
    
    setSnapshots(snaps);
    setProjects(scopedProjects);
    setClients(cData);
    setUsers(uData);
    setTransactions(tData);
    setInvoices(iData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]); // Re-load on user change
  
  useEffect(() => {
    const handleLedgerUpdate = () => {
        loadData();
    };
    window.addEventListener('ledgerUpdated', handleLedgerUpdate);
    return () => window.removeEventListener('ledgerUpdated', handleLedgerUpdate);
  }, [user]);

  // --- AUTOMATED COMMISSION LOGIC ---
  const handleCommissionLogic = async (project: Project, oldProject?: Project) => {
      // 1. Check if invoice linked and commission percent exists
      if (project.linkedInvoiceId && project.connectionSharePercent > 0) {
          const inv = invoices.find(i => i.id === project.linkedInvoiceId);
          if (!inv) return;

          const commissionAmount = Math.round(inv.finalAmount * (project.connectionSharePercent / 100));
          const sysKey = `COMMISSION:${project.id}`;
          
          // Check if system transaction exists
          const existing = transactions.find(t => t.systemKey === sysKey);

          if (existing) {
              // Update if amount changed
              if (existing.amount !== commissionAmount) {
                  const updatedTx = { ...existing, amount: commissionAmount, title: `پورسانت پروژه ${project.title} (سیستمی)` };
                  await api.transactions.update(updatedTx);
                  // Goal 4: Sync local state for immediate P&L update
                  setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
              }
          } else {
              // Create new
              const newTx: Transaction = {
                  id: generateId(),
                  type: TransactionType.Expense,
                  category: FinanceCategory.Agency,
                  amount: commissionAmount,
                  date: new Date().toISOString(),
                  title: `پورسانت پروژه ${project.title} (سیستمی)`,
                  description: 'محاسبه خودکار بر اساس فاکتور متصل',
                  status: 'Registered', // Needs approval
                  projectId: project.id,
                  systemKey: sysKey,
                  createdAt: new Date().toISOString()
              };
              await api.transactions.create(newTx, user!.id);
              // Goal 4: Sync local state
              setTransactions(prev => [...prev, newTx]);
          }
      } else {
          // If unlinked or 0%, check if we need to remove/cancel old commission
          if (oldProject && oldProject.linkedInvoiceId && !project.linkedInvoiceId) {
               const sysKey = `COMMISSION:${project.id}`;
               const existing = transactions.find(t => t.systemKey === sysKey);
               if (existing && existing.status !== 'Cancelled') {
                   const cancelledTx = { ...existing, status: 'Cancelled' as TransactionStatus, description: existing.description + ' (لغو شده به دلیل حذف لینک فاکتور)' };
                   await api.transactions.update(cancelledTx);
                   // Goal 4: Sync local state
                   setTransactions(prev => prev.map(t => t.id === cancelledTx.id ? cancelledTx : t));
               }
          }
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // LOGIC GUARD
    if (!canManage) {
        showToast('شما مجوز ایجاد یا ویرایش پروژه را ندارید', 'error');
        return;
    }

    if (!user) return;

    try {
      // Update Total Budget if Invoice(s) Linked
      let projectData = { ...formData } as Project;
      const linkedIds: string[] = projectData.linkedInvoiceIds && projectData.linkedInvoiceIds.length > 0
          ? projectData.linkedInvoiceIds
          : (projectData.linkedInvoiceId ? [projectData.linkedInvoiceId] : []);
      if (linkedIds.length > 0) {
          const sum = linkedIds.reduce((acc, id) => {
              const inv = invoices.find(i => i.id === id);
              return acc + (inv ? inv.finalAmount : 0);
          }, 0);
          projectData.totalBudget = sum;
          // Keep linkedInvoiceId in sync (first) for commission + card display compat
          projectData.linkedInvoiceId = linkedIds[0];
          projectData.linkedInvoiceIds = linkedIds;
      }

      if (formData.id) {
          // Edit
          const oldProject = projects.find(p => p.id === formData.id);
          await api.projects.update(projectData, user.id);
          
          // Auto Commission
          await handleCommissionLogic(projectData, oldProject);

          setProjects(prev => prev.map(p => p.id === formData.id ? projectData : p));
          showToast('پروژه با موفقیت ویرایش شد', 'success');
      } else {
          // Create
          // 1. Prepare Data
          projectData = {
              ...projectData,
              id: generateId(),
              createdAt: new Date().toISOString(),
              members: formData.members?.length ? formData.members : [user.id],
          };
          
          // 2. Create Project (Wait for success)
          await api.projects.create(projectData, user.id);
          
          // Auto Commission
          await handleCommissionLogic(projectData);

          setProjects(prev => [...prev, projectData]);
          
          // 3. Notification Logic
          if (notifyMembers) {
              const membersToNotify = projectData.members;
              for (const memberId of membersToNotify) {
                  await api.notifications.create({
                      id: generateId(),
                      userId: memberId,
                      type: 'Project',
                      title: 'شما به یک پروژه اضافه شدید',
                      message: `پروژه «${projectData.title}» به شما تخصیص داده شد.`,
                      link: '/projects',
                      isRead: false,
                      createdAt: new Date().toISOString(),
                      relatedId: projectData.id
                  });
              }
          }

          showToast('پروژه جدید با موفقیت ثبت شد', 'success');
      }
      
      setIsModalOpen(false);
      // Reset
      setFormData({
        title: '', description: '', status: ProjectStatus.Active,
        projectType: 'Web', sourceType: 'Client', deadlineWarningDays: 3, totalBudget: 0, connectionSharePercent: 0,
        members: [], memberAllocations: {}, memberCostAllocations: {}, teamCostPercent: 0,
        paymentMethod: PaymentMethod.Cash, installments: [], linkedInvoiceId: undefined,
        publicNotes: '', personalNotes: {}, projectFiles: []
      });
      setNotifyMembers(true);
      setActiveNoteTab('public');
      // Reload to see new transactions if any (Optional now since we sync locally, but good for safety)
      // loadData(); 
    } catch (e) {
      console.error(e);
      showToast('خطا در ذخیره پروژه', 'error');
    }
  };

  const handleEdit = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (!canManage) return; 
      setFormData(project);
      setIsModalOpen(true);
  };

  // --- DELETE HANDLER (SECURED) ---
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    if (!canManage) {
        return;
    }

    confirmAction({
        description: 'آیا مطمئن هستید؟ پروژه حذف خواهد شد.',
        onConfirm: async () => {
          try {
            await api.projects.delete(id, user!.id);
            setProjects(prev => [...prev.filter(p => p.id !== id)]);
            showToast('پروژه حذف شد', 'success');
          } catch(err) {
            showToast('خطا در حذف پروژه', 'error');
          }
        }
    });
  };

  const toggleMember = (userId: string) => {
     const current = formData.members || [];
     if(current.includes(userId)) {
         setFormData({...formData, members: current.filter(id => id !== userId)});
     } else {
         setFormData({...formData, members: [...current, userId]});
     }
  };

  const connectionShareAmount = calculateShare(formData.totalBudget || 0, formData.connectionSharePercent || 0);

  // Non-admin members for cost allocation
  const nonAdminMembers = (formData.members || [])
      .map(id => users.find(u => u.id === id))
      .filter((u): u is User => !!u && u.role !== UserRole.Admin);

  const distributeTeamCostEvenly = () => {
      if (nonAdminMembers.length === 0) return;
      const share = Math.floor(100 / nonAdminMembers.length);
      const allocations: Record<string, number> = {};
      nonAdminMembers.forEach((u, i) => {
          allocations[u.id] = i === nonAdminMembers.length - 1
              ? 100 - share * (nonAdminMembers.length - 1)
              : share;
      });
      setFormData(prev => ({ ...prev, memberCostAllocations: allocations }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
          if (file.size > 5 * 1024 * 1024) { showToast('فایل نباید بیشتر از ۵MB باشد', 'error'); return; }
          const reader = new FileReader();
          reader.onloadend = () => {
              const newFile: ProjectFile = {
                  id: generateId(), name: file.name, size: file.size, type: file.type,
                  dataUrl: reader.result as string, uploadedBy: user!.id,
                  uploadedAt: new Date().toISOString()
              };
              setFormData(prev => ({ ...prev, projectFiles: [...(prev.projectFiles || []), newFile] }));
          };
          reader.readAsDataURL(file);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeProjectFile = (fileId: string) => {
      setFormData(prev => ({ ...prev, projectFiles: (prev.projectFiles || []).filter(f => f.id !== fileId) }));
  };

  // --- P&L CALCULATOR HELPER (FIXED BUG #1) ---
  const calculatePnL = (projectId: string) => {
      const fin = calculateProjectFinancials(projectId, invoices, transactions);
      
      const income = fin.projectTotalIncome;
      const expense = fin.projectTotalExpense;

      // --- COMPUTED COMMISSION ---
      const project = projects.find(p => p.id === projectId);
      let commission = 0;
      if (project && project?.connectionSharePercent > 0) {
          commission = Math.round(income * (project.connectionSharePercent / 100));
      }

      const totalExpense = expense + commission;
      const net = income - totalExpense;

      return { 
          income, 
          expense, 
          commission, 
          totalExpense, 
          net, 
          statusLabel: fin.financialStatus, 
          statusColor: fin.financialStatusColor,
          receivable: fin.projectReceivableRemaining,
          invoiced: fin.projectInvoicesTotal
      };
  };

  const getPnlStatus = (pnl: { income: number, net: number }) => {
      const threshold = pnl.income * 0.01; // 1% threshold for break-even
      if (Math.abs(pnl.net) <= threshold && pnl.income > 0) return { label: 'سر‌به‌سر', color: 'bg-gray-100 text-gray-600' };
      if (pnl.net > 0) return { label: 'سودده', color: 'bg-emerald-100 text-emerald-700' };
      if (pnl.net < 0) return { label: 'زیان‌ده', color: 'bg-red-100 text-red-700' };
      return { label: 'بدون تراکنش', color: 'bg-gray-50 text-gray-400' }; // No income yet
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{isClient ? 'پروژه‌های من' : 'مدیریت پروژه‌ها'}</h2>
          <p className="text-gray-500">{isClient ? 'لیست پروژه‌های فعال شما' : 'لیست تمام پروژه‌ها'}</p>
        </div>
        {/* Only Admin/Manager can create */}
        {canManage && (
            <button 
              onClick={() => { setFormData({title: '', totalBudget: 0, connectionSharePercent: 0, status: ProjectStatus.Active, sourceType: 'Client'}); setIsModalOpen(true); }}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2"
            >
              <Plus size={20} />
              <span>پروژه جدید</span>
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(project => {
           // Calculate Real P&L
           const pnl = calculatePnL(project.id);
           const pnlStatus = getPnlStatus(pnl);
           
           // Budget Calculation
           const hasBudget = project.totalBudget > 0;
           const budgetProgress = hasBudget ? Math.min(100, (pnl.income / project.totalBudget) * 100) : 0;
           
           // Find Linked Invoice(s)
           const projectLinkedIds: string[] = project.linkedInvoiceIds && project.linkedInvoiceIds.length > 0
               ? project.linkedInvoiceIds
               : (project.linkedInvoiceId ? [project.linkedInvoiceId] : []);
           const linkedInvoicesList = projectLinkedIds
               .map(lid => invoices.find(i => i.id === lid))
               .filter((i): i is NonNullable<typeof i> => !!i);
           const health = calculateProjectHealth(project, settings);
           const financialKeywords = ['بودجه', 'هزینه'];
           const displayReasons = health.reasons.filter(r => {
               if (canManage) return true;
               if (financialKeywords.some(kw => r.includes(kw))) return false;
               return true;
           });

           return (
            <div key={project.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2 items-center">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getStatusColor(project.status)}`}>
                      {project.status === 'Active' ? 'در جریان' : project.status}
                    </span>
                    {!isClient && (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${getHealthColor(health.status)}`}>
                           {health.labelFa}
                        </span>
                    )}
                </div>
                
                {/* ACTION BUTTONS: HIDDEN FOR CLIENTS/TEAM */}
                {canManage && (
                    <div className="flex gap-2 z-20 relative" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                       <button type="button" onClick={(e) => handleEdit(e, project)} className="text-gray-400 hover:text-blue-500 cursor-pointer p-1"><Edit size={16} className="pointer-events-none" /></button>
                       <button type="button" onClick={(e) => handleDelete(e, project.id)} className="text-gray-400 hover:text-red-500 cursor-pointer p-1"><Trash size={16} className="pointer-events-none" /></button>
                    </div>
                )}
              </div>

              <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">{project.title}</h3>
              {linkedInvoicesList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                      {linkedInvoicesList.map(inv => (
                          <div key={inv.id} className="text-[10px] text-blue-500 bg-blue-50 w-fit px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Link size={10}/> فاکتور #{toPersianDigits(inv.number)}
                          </div>
                      ))}
                  </div>
              )}
              <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px]">{project.description || 'بدون توضیحات'}</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar size={14}/> تاریخ شروع:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{formatJalali(project.startDate || '')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar size={14}/> ددلاین:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{formatJalali(project.deadline)}</span>
                </div>
                
                 <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Users size={14}/> اعضا:</span>
                  {isClient ? (
                      // CLIENT VIEW: Just a number
                      <span className="font-bold text-gray-700 dark:text-gray-300">{toPersianDigits(project.members?.length || 0)} نفر</span>
                  ) : (
                      // ADMIN/TEAM VIEW: Avatars
                      <div className="flex -space-x-2 space-x-reverse">
                          {project.members?.map(mid => {
                              const member = users.find(u => u.id === mid);
                              return member?.avatarUrl ? (
                                  <img key={mid} src={member.avatarUrl} className="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-slate-700" title={member.firstName} />
                              ) : (
                                  <div key={mid} className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 border-2 border-white dark:border-slate-700 flex items-center justify-center text-primary-700 dark:text-primary-300 text-[9px] font-bold" title={member?.firstName}>
                                      {member?.firstName?.[0] || '?'}
                                  </div>
                              );
                          })}
                      </div>
                  )}
                </div>
              </div>

              {/* --- NEW: PROJECT P&L SECTION (Read-Only) --- */}
              {/* Only visible to Admin/Manager or Team (if permitted). Hidden for Client usually, but logic allows based on UI requirement A. */}
              {!isClient && (
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700 mb-4 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-gray-500 flex items-center gap-1"><Wallet size={12}/> اطلاعات مالی</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pnl.statusColor}`}>
                              {pnl.statusLabel}
                          </span>
                      </div>

                      {pnl.invoiced > 0 && (
                          <div className="flex justify-between items-center bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg text-[10px] mb-2 border border-gray-100 dark:border-slate-700 shadow-sm">
                              <span className="text-gray-500 dark:text-gray-400">مجموع مطالبه (فاکتورها):</span>
                              <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(pnl.invoiced)} تومان</span>
                          </div>
                      )}

                      {(pnl.receivable > 0) && (
                          <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-900/10 px-2 py-1.5 rounded-lg text-[10px] mb-3 border border-orange-100 dark:border-orange-900/30 shadow-sm">
                              <span className="text-orange-600 dark:text-orange-400">مانده حساب (در انتظار):</span>
                              <span className="font-bold text-orange-700 dark:text-orange-300">{formatCurrency(pnl.receivable)} تومان</span>
                          </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-2 text-center relative mb-2">
                          {/* Vertical Dividers */}
                          <div className="absolute top-2 bottom-2 right-[33%] w-px bg-gray-200 dark:bg-slate-700"></div>
                          <div className="absolute top-2 bottom-2 right-[66%] w-px bg-gray-200 dark:bg-slate-700"></div>

                          <div>
                              <span className="text-[9px] text-gray-400 block mb-0.5">دریافتی واقعی</span>
                              <span className="text-xs font-bold text-emerald-600 flex justify-center items-center gap-0.5">
                                  {formatCurrency(pnl.income)}
                              </span>
                          </div>
                          <div>
                              <span className="text-[9px] text-gray-400 block mb-0.5">هزینه کل</span>
                              <span className="text-xs font-bold text-red-500 flex justify-center items-center gap-0.5">
                                  {formatCurrency(pnl.totalExpense)}
                              </span>
                          </div>
                          <div>
                              <span className="text-[9px] text-gray-400 block mb-0.5">سود خالص</span>
                              <span className={`text-xs font-black dir-ltr ${pnl.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {formatCurrency(pnl.net)}
                              </span>
                          </div>
                      </div>

                      {/* Computed Commission Row (Req B) */}
                      {pnl.commission > 0 && (
                          <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded text-[9px] mb-2 border border-red-100 dark:border-red-900/30 mt-2">
                              <span className="text-red-600 dark:text-red-400">کمیسیون کانکشن (محاسبه شده):</span>
                              <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(pnl.commission)}</span>
                          </div>
                      )}

                      {/* Budget Realization Bar */}
                      {hasBudget && (
                          <div className="mt-1 pt-2 border-t border-gray-200 dark:border-slate-700/50">
                              <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                                  <span>تحقق بودجه ({formatCurrency(project.totalBudget)})</span>
                                  <span>{toPersianDigits(Math.round(budgetProgress))}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, budgetProgress)}%` }}></div>
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* Public Notes */}
              {project.publicNotes && (
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800 mb-3">
                      <p className="text-[10px] font-bold text-blue-600 mb-1 flex items-center gap-1"><StickyNote size={10}/> یادداشت پروژه</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">{project.publicNotes}</p>
                  </div>
              )}

              {/* Personal Notes (only visible to current user) */}
              {user && project.personalNotes?.[user.id] && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-800 mb-3">
                      <p className="text-[10px] font-bold text-amber-600 mb-1 flex items-center gap-1"><Lock size={10}/> یادداشت شخصی شما</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">{project.personalNotes[user.id]}</p>
                  </div>
              )}

              {/* Project Files */}
              {(project.projectFiles || []).length > 0 && (
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700 mb-3">
                      <p className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1"><Paperclip size={10}/> فایل‌های پروژه ({toPersianDigits((project.projectFiles || []).length)})</p>
                      <div className="space-y-1.5">
                          {(project.projectFiles || []).map(f => (
                              <a key={f.id} href={f.dataUrl} download={f.name}
                                  className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-primary-300 transition group">
                                  <span className="text-[10px] text-gray-600 dark:text-gray-300 truncate">{f.name}</span>
                                  <Download size={11} className="text-gray-400 group-hover:text-primary-600 shrink-0"/>
                              </a>
                          ))}
                      </div>
                  </div>
              )}

              {!isClient && (
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500">سلامت پروژه</h4>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{toPersianDigits(health.score)} / ۱۰۰</span>
                     </div>
                     {displayReasons.length > 0 ? (
                         <ul className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                            {displayReasons.slice(0,3).map((r, i) => <li key={i}>{r}</li>)}
                         </ul>
                     ) : (
                         <p className="text-[10px] text-gray-500">مورد پرریسکی برای این پروژه شناسایی نشده است.</p>
                     )}
                  </div>
              )}
            </div>
           );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'ویرایش پروژه' : 'ایجاد پروژه جدید'} size="lg">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* ... Form Content ... */}
                 <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-medium mb-1">عنوان پروژه</label>
                   <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium mb-1">منبع پروژه</label>
                   <select className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" value={formData.sourceType} onChange={e => setFormData({...formData, sourceType: e.target.value as any})}>
                     <option value="Client">مشتری</option>
                     <option value="Connection">کانکشن</option>
                     <option value="Agency">آژانس</option>
                   </select>
                 </div>

                 {(formData.sourceType === 'Client' || formData.sourceType === 'Connection') && (
                   <div>
                     <label className="block text-sm font-medium mb-1">انتخاب {formData.sourceType === 'Client' ? 'مشتری' : 'معرف'}</label>
                     <select className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" value={formData.sourceId || ''} onChange={e => setFormData({...formData, sourceId: e.target.value})}>
                       <option value="">انتخاب کنید...</option>
                       {clients.filter(c => formData.sourceType === 'Client' ? (c.type === 'Client' || c.type === 'Both') : (c.type === 'Connection' || c.type === 'Both')).map(c => (
                         <option key={c.id} value={c.id}>{c.name}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {/* New Linked Invoices (multi-select) */}
                 {(() => {
                     // Derive the currently linked invoice ids (backward-compat with single linkedInvoiceId)
                     const linkedIds: string[] = formData.linkedInvoiceIds && formData.linkedInvoiceIds.length > 0
                         ? formData.linkedInvoiceIds
                         : (formData.linkedInvoiceId ? [formData.linkedInvoiceId] : []);

                     const toggleInvoice = (invId: string) => {
                         setFormData(prev => {
                             const current: string[] = prev.linkedInvoiceIds && prev.linkedInvoiceIds.length > 0
                                 ? prev.linkedInvoiceIds
                                 : (prev.linkedInvoiceId ? [prev.linkedInvoiceId] : []);
                             const updated = current.includes(invId)
                                 ? current.filter(id => id !== invId)
                                 : [...current, invId];
                             const newBudget = updated.reduce((sum, id) => {
                                 const inv = invoices.find(i => i.id === id);
                                 return sum + (inv ? inv.finalAmount : 0);
                             }, 0);
                             return {
                                 ...prev,
                                 linkedInvoiceIds: updated,
                                 linkedInvoiceId: updated[0] || undefined, // keep first for commission/card compat
                                 totalBudget: updated.length > 0 ? newBudget : prev.totalBudget
                             };
                         });
                     };

                     const linkedTotal = linkedIds.reduce((sum, id) => {
                         const inv = invoices.find(i => i.id === id);
                         return sum + (inv ? inv.finalAmount : 0);
                     }, 0);

                     return (
                     <div className="col-span-1 md:col-span-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                         <label className="block text-sm font-bold mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                             <FileText size={16}/> اتصال به فاکتور (تعیین بودجه خودکار)
                             {linkedIds.length > 0 && (
                                 <span className="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full">
                                     {toPersianDigits(linkedIds.length)} فاکتور
                                 </span>
                             )}
                         </label>
                         <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1.5 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-2">
                             {invoices.length === 0 ? (
                                 <p className="text-xs text-gray-400 text-center py-3">فاکتوری ثبت نشده است</p>
                             ) : invoices.map(inv => {
                                 const isSelected = linkedIds.includes(inv.id);
                                 return (
                                     <button
                                        type="button"
                                        key={inv.id}
                                        onClick={() => toggleInvoice(inv.id)}
                                        className={`w-full text-right px-3 py-2 text-sm rounded-lg font-medium transition flex items-center justify-between gap-2 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300'}`}
                                     >
                                         <span className="truncate">#{toPersianDigits(inv.number)} - {inv.title} <span className="text-xs opacity-60">({formatCurrency(inv.finalAmount)})</span></span>
                                         <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-slate-500'}`}>
                                             {isSelected && <Check size={10} className="text-white" strokeWidth={3}/>}
                                         </div>
                                     </button>
                                 );
                             })}
                         </div>
                         {linkedIds.length > 0 && (
                             <p className="text-xs text-blue-600 mt-2">
                                 بودجه پروژه به صورت خودکار برابر با مجموع مبلغ نهایی {toPersianDigits(linkedIds.length)} فاکتور ({formatCurrency(linkedTotal)}) تنظیم می‌شود.
                             </p>
                         )}
                     </div>
                     );
                 })()}

                 <div>
                   <CurrencyInput label="بودجه کل (تومان)" value={formData.totalBudget} onChange={(val: number) => setFormData({...formData, totalBudget: val})} disabled={!!(formData.linkedInvoiceIds && formData.linkedInvoiceIds.length > 0) || !!formData.linkedInvoiceId}/>
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">درصد سهم کانکشن (%)</label>
                   <input type="number" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" value={formData.connectionSharePercent} onChange={e => setFormData({...formData, connectionSharePercent: Number(e.target.value)})} />
                   <p className="text-xs text-gray-500 mt-1">مبلغ سهم: {formatCurrency(connectionShareAmount)} تومان</p>
                   {formData.linkedInvoiceId && formData.connectionSharePercent > 0 && (
                       <p className="text-[10px] text-emerald-600 mt-1">
                           * یک تراکنش هزینه سیستمی برای این کمیسیون به صورت خودکار ثبت می‌شود.
                       </p>
                   )}
                 </div>

                 <div>
                    <JalaliDatePicker label="تاریخ شروع" value={formData.startDate} onChange={(d: string) => setFormData({...formData, startDate: d})} />
                 </div>
                 <div>
                    <JalaliDatePicker label="ددلاین پایان" value={formData.deadline} onChange={(d: string) => setFormData({...formData, deadline: d})} />
                 </div>

                 <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-2">اعضای تیم</label>
                    <div className="flex flex-wrap gap-2">
                        {users.map(u => (
                            <button 
                              key={u.id}
                              type="button"
                              onClick={() => toggleMember(u.id)}
                              className={`px-3 py-1 rounded-full text-sm border transition ${formData.members?.includes(u.id) ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                            >
                                {u.firstName} {u.lastName}
                            </button>
                        ))}
                    </div>
                 </div>

                 {/* ── Team Cost Allocation ── */}
                 {nonAdminMembers.length > 0 && (
                     <div className="col-span-1 md:col-span-2 bg-violet-50 dark:bg-violet-900/10 p-4 rounded-xl border border-violet-100 dark:border-violet-800">
                         <div className="flex items-center justify-between mb-3">
                             <label className="text-sm font-bold text-violet-700 dark:text-violet-300 flex items-center gap-2">
                                 <Percent size={16}/> تخصیص هزینه نیروها
                             </label>
                             <button type="button" onClick={distributeTeamCostEvenly} className="text-xs bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300 px-2 py-1 rounded-lg font-bold hover:bg-violet-200 transition">
                                 توزیع مساوی
                             </button>
                         </div>
                         <div className="flex items-center gap-3 mb-4">
                             <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">درصد هزینه نیروها از بودجه:</label>
                             <input
                                 type="number" min="0" max="100"
                                 className="w-20 px-2 py-1 text-sm border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-slate-900 outline-none text-center"
                                 value={formData.teamCostPercent || 0}
                                 onChange={e => setFormData(prev => ({ ...prev, teamCostPercent: Number(e.target.value) }))}
                             />
                             <span className="text-xs text-gray-500">%</span>
                             {(formData.teamCostPercent || 0) > 0 && (formData.totalBudget || 0) > 0 && (
                                 <span className="text-xs text-violet-600 font-bold">= {formatCurrency(Math.round(((formData.teamCostPercent || 0) / 100) * (formData.totalBudget || 0)))} تومان</span>
                             )}
                         </div>
                         <div className="space-y-2">
                             {nonAdminMembers.map(u => {
                                 const pct = (formData.memberCostAllocations || {})[u.id] || 0;
                                 const amount = (formData.teamCostPercent || 0) > 0 && (formData.totalBudget || 0) > 0
                                     ? Math.round((pct / 100) * ((formData.teamCostPercent || 0) / 100) * (formData.totalBudget || 0))
                                     : 0;
                                 return (
                                     <div key={u.id} className="flex items-center gap-3">
                                         <span className="text-xs text-gray-700 dark:text-gray-300 w-28 truncate">{u.firstName} {u.lastName}</span>
                                         <input
                                             type="number" min="0" max="100"
                                             className="w-16 px-2 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-slate-900 outline-none text-center"
                                             value={pct}
                                             onChange={e => setFormData(prev => ({
                                                 ...prev,
                                                 memberCostAllocations: { ...(prev.memberCostAllocations || {}), [u.id]: Number(e.target.value) }
                                             }))}
                                         />
                                         <span className="text-xs text-gray-400">%</span>
                                         {amount > 0 && <span className="text-xs text-violet-600">{formatCurrency(amount)} تومان</span>}
                                     </div>
                                 );
                             })}
                         </div>
                     </div>
                 )}

                 {/* ── Notes (public + personal) ── */}
                 <div className="col-span-1 md:col-span-2">
                     <div className="flex gap-2 mb-2">
                         <button type="button" onClick={() => setActiveNoteTab('public')}
                             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeNoteTab === 'public' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                             <StickyNote size={13}/> یادداشت پروژه
                         </button>
                         <button type="button" onClick={() => setActiveNoteTab('personal')}
                             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeNoteTab === 'personal' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                             <Lock size={13}/> یادداشت شخصی
                         </button>
                     </div>
                     {activeNoteTab === 'public' ? (
                         <textarea
                             rows={4}
                             placeholder="یادداشت‌های پروژه که برای همه اعضا قابل مشاهده است..."
                             className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none text-sm resize-none"
                             value={formData.publicNotes || ''}
                             onChange={e => setFormData(prev => ({ ...prev, publicNotes: e.target.value }))}
                         />
                     ) : (
                         <div>
                             <p className="text-[10px] text-amber-600 mb-2 flex items-center gap-1"><Lock size={10}/> فقط شما می‌توانید این یادداشت را ببینید</p>
                             <textarea
                                 rows={4}
                                 placeholder="یادداشت شخصی شما (مخفی از سایرین)..."
                                 className="w-full px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 outline-none text-sm resize-none"
                                 value={(formData.personalNotes || {})[user!.id] || ''}
                                 onChange={e => setFormData(prev => ({
                                     ...prev,
                                     personalNotes: { ...(prev.personalNotes || {}), [user!.id]: e.target.value }
                                 }))}
                             />
                         </div>
                     )}
                 </div>

                 {/* ── File Attachments ── */}
                 <div className="col-span-1 md:col-span-2">
                     <label className="block text-sm font-bold mb-2 flex items-center gap-2"><Paperclip size={15}/> فایل‌های پروژه</label>
                     <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                     <button type="button" onClick={() => fileInputRef.current?.click()}
                         className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition flex items-center justify-center gap-2">
                         <Paperclip size={16}/> انتخاب فایل (حداکثر ۵MB هر فایل)
                     </button>
                     {(formData.projectFiles || []).length > 0 && (
                         <div className="mt-2 space-y-2">
                             {(formData.projectFiles || []).map(f => (
                                 <div key={f.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700">
                                     <div className="flex items-center gap-2 min-w-0">
                                         <Paperclip size={14} className="text-gray-400 shrink-0"/>
                                         <span className="text-xs font-medium truncate">{f.name}</span>
                                         <span className="text-[10px] text-gray-400 shrink-0">({Math.round(f.size / 1024)}KB)</span>
                                     </div>
                                     <button type="button" onClick={() => removeProjectFile(f.id)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                                         <X size={14}/>
                                     </button>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>

                 {!formData.id && (
                     <div className="col-span-1 md:col-span-2">
                         <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                             <input
                                type="checkbox"
                                className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                                checked={notifyMembers}
                                onChange={e => setNotifyMembers(e.target.checked)}
                             />
                             <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                 <Bell size={16}/> ارسال اعلان برای اعضای این پروژه
                             </span>
                         </label>
                     </div>
                 )}

                 <div className="col-span-1 md:col-span-2 pt-4 flex gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">انصراف</button>
                    <button type="submit" className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition">
                        {formData.id ? 'ذخیره تغییرات' : 'ثبت پروژه'}
                    </button>
                 </div>
              </form>
      </Modal>
    </div>
  );
};

export default ProjectsView;
