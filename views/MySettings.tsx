import React, { useState, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { UserRole, UserStatus } from '../types';
import { Shield, Lock, Check, AlertCircle, Eye, EyeOff, User as UserIcon } from 'lucide-react';

const MySettingsView = () => {
    const { user, logout, showToast } = useContext(AuthContext);
    
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    if (!user) return null;

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
        
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast('رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.', 'success');
        
        setTimeout(() => {
            logout();
        }, 1500);
    };

    return (
        <div className="font-shabnam animate-in fade-in slide-in-from-bottom-4 max-w-4xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    تنظیمات من
                </h2>
                <p className="text-gray-500 text-sm mt-1">مدیریت اطلاعات و امنیت حساب کاربری</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Overview (Read-Only) */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 text-center flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4 overflow-hidden border-4 border-white dark:border-slate-600 shadow-sm relative">
                            {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={40} className="text-gray-400"/>}
                            <div className="absolute bottom-1 right-1">
                                <span className={`w-4 h-4 rounded-full border-2 border-white block ${user.status === UserStatus.Active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            </div>
                        </div>
                        <h3 className="font-bold text-xl text-gray-800 dark:text-white">{user.firstName} {user.lastName}</h3>
                        <p className="text-sm text-gray-500 mt-1 font-mono dir-ltr">{user.username}</p>
                        
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                            <span className="bg-primary-50 text-primary-700 px-3 py-1 rounded-lg text-xs font-bold">
                                {user.role === UserRole.Admin ? 'مدیر سیستم' : user.role === UserRole.Manager ? 'مدیر ارشد' : user.role === UserRole.TeamMember ? 'عضو تیم' : 'کاربر'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-start gap-3">
                        <Shield className="text-blue-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-1">امنیت حساب</h4>
                            <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                                هرگز رمز عبور خود را با شخص دیگری به اشتراک نگذارید. پرسنل سیستم هرگز رمز عبور شما را درخواست نمی‌کنند.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Password Change Form */}
                <div className="md:col-span-2">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
                            <Lock className="text-gray-400" size={24} />
                            <h3 className="font-bold text-lg">تغییر رمز عبور</h3>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                            {errorMsg && (
                                <div className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رمز عبور فعلی</label>
                                <div className="relative">
                                    <input 
                                        type={showCurrent ? "text" : "password"} 
                                        value={currentPassword} 
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-left" 
                                        dir="ltr"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رمز عبور جدید</label>
                                <div className="relative">
                                    <input 
                                        type={showNew ? "text" : "password"} 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-left" 
                                        dir="ltr"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">تکرار رمز عبور جدید</label>
                                <input 
                                    type={showNew ? "text" : "password"} 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-left" 
                                    dir="ltr"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20">
                                    <Check size={18} />
                                    ذخیره تغییرات
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MySettingsView;
