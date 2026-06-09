import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { User, UserRole, UserStatus, Department } from '../types';
import { User as UserIcon } from 'lucide-react';

const MyTeamView = () => {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<User[]>([]);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const loadData = async () => {
          if (!user || user.role !== UserRole.TeamMember) {
              setLoading(false);
              return;
          }
          const [uData, dData] = await Promise.all([api.users.getAll(), api.departments.getAll()]);
          
          if (user.departmentId || (user as any).departmentName) {
              let deptName = (user as any).departmentName || '';
              if (user.departmentId) {
                  const myDept = dData.find(d => d.id === user.departmentId);
                  if (myDept) deptName = myDept.name;
              }
              setDepartmentName(deptName);
              
              const teamMembers = uData.filter(u => 
                  (u.departmentId === user.departmentId || (u as any).departmentName === deptName) && 
                  (u.role === UserRole.Admin || u.role === UserRole.Manager || u.role === UserRole.TeamMember)
              );
              setUsers(teamMembers);
          } else {
              setUsers([]);
          }
          setLoading(false);
      };
      
      loadData();
  }, [user]);

  if (loading) {
      return (
          <div className="flex justify-center py-20">
              <div className="text-gray-400">در حال بارگذاری...</div>
          </div>
      );
  }

  if (!user?.departmentId && !(user as any)?.departmentName) {
      return (
          <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <div className="text-gray-500 font-bold">هنوز دپارتمانی برای شما ثبت نشده است.</div>
          </div>
      );
  }

  return (
    <div className="font-shabnam animate-in fade-in slide-in-from-bottom-4">
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                تیم من
            </h2>
            <p className="text-gray-500 text-sm mt-1">اعضای دپارتمان {departmentName} در این بخش نمایش داده می‌شوند.</p>
        </div>

        {users.length === 0 ? (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
                <div className="text-gray-500 font-bold">در حال حاضر عضو دیگری در دپارتمان شما ثبت نشده است.</div>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map(u => {
                    const isMe = u.id === user.id;
                    return (
                        <div key={u.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col items-center text-center hover:shadow-lg transition relative overflow-hidden">
                            {isMe && (
                                <div className="absolute top-4 left-4 bg-primary-100 text-primary-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    شما
                                </div>
                            )}
                            <div className="absolute top-4 right-4">
                                <span className={`w-3 h-3 rounded-full block ${u.status === UserStatus.Active ? 'bg-green-500' : u.status === UserStatus.Busy ? 'bg-amber-500' : 'bg-gray-300'}`}></span>
                            </div>

                            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4 overflow-hidden shadow-sm border-2 border-white dark:border-slate-600">
                                {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={32} className="text-gray-400"/>}
                            </div>
                            
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white">{u.firstName} {u.lastName}</h3>
                            <span className="text-xs text-gray-400 mb-3">{u.role === UserRole.Manager ? 'مدیر تیم' : u.role === UserRole.Admin ? 'مدیر سیستم' : 'عضو تیم'}</span>
                            
                            <div className="flex gap-2 mb-3 mt-2">
                                <span className="bg-gray-100 dark:bg-slate-700 text-gray-500 px-3 py-1 rounded-lg text-xs font-bold">{departmentName}</span>
                            </div>

                            {u.jobDetails?.skills && u.jobDetails.skills.length > 0 && (
                                <div className="flex flex-wrap gap-1 justify-center mt-2">
                                    {u.jobDetails.skills.slice(0,3).map(skill => (
                                        <span key={skill} className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
    </div>
  );
};

export default MyTeamView;
