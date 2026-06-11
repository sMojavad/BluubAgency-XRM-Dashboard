
import React, { useState, useEffect, useContext, useRef } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { User, Message, ChatThread } from '../types';
import { Send, Image as ImageIcon, Mic, MoreVertical, Search, Phone, Video, MessageSquare, Users, Megaphone, Trash2, Lock, Globe, Plus, X, Edit2, Check } from 'lucide-react';
import { formatJalaliShort, toPersianDigits } from '../utils';

const MessagesView = () => {
  const { user, confirmAction } = useContext(AuthContext);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Per-thread unread counts (feature 3)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  // Edit message state (feature 3)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Image upload (feature 4)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording (feature 6)
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<any>(null);

  // Scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshUnread = () => {
      if (user) setUnreadMap(api.messages.getUnreadPerThread(user.id));
  };

  const loadThreads = async () => {
      const t = await api.messages.getThreads();
      const u = await api.users.getAll();
      setThreads(t.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      setUsers(u);
      refreshUnread();
  };

  useEffect(() => {
      loadThreads();
  }, []);

  // Realtime: when App polling pulls new data, refresh threads/messages live
  useEffect(() => {
      const handleSync = () => {
          loadThreads();
          if (activeThreadId) {
              api.messages.getMessages(activeThreadId).then(setMessages);
          }
      };
      window.addEventListener('xrm-data-synced', handleSync);
      window.addEventListener('messagesUpdated', handleSync);
      return () => {
          window.removeEventListener('xrm-data-synced', handleSync);
          window.removeEventListener('messagesUpdated', handleSync);
      };
  }, [activeThreadId]);

  useEffect(() => {
      if(activeThreadId) {
          api.messages.getMessages(activeThreadId).then(setMessages);
          if (user) {
              api.messages.markThreadAsRead(activeThreadId, user.id).then(refreshUnread);
          }
      }
  }, [activeThreadId]);

  // Auto-scroll to latest message
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageContent = async (content: string, type: Message['type']) => {
      if(!content || !activeThreadId) return;
      const msg: Message = {
          id: Math.random().toString(36).substr(2, 9),
          threadId: activeThreadId,
          senderId: user!.id,
          content,
          type,
          createdAt: new Date().toISOString(),
          isSeen: false
      };
      await api.messages.sendMessage(msg);
      setMessages(prev => [...prev, msg]);

      // Sidebar preview text based on type
      const preview = type === 'text' ? content : type === 'image' ? '🖼️ تصویر' : type === 'voice' ? '🎤 پیام صوتی' : content;
      setThreads(prev => prev.map(t => {
          if (t.id === activeThreadId) {
              return { ...t, lastMessage: preview, updatedAt: msg.createdAt };
          }
          return t;
      }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())); // Move to top
  };

  const handleSend = async () => {
      if(!inputMsg.trim()) return;
      const text = inputMsg;
      setInputMsg('');
      await sendMessageContent(text, 'text');
  };

  // --- Feature 4: Image upload (file picker) ---
  const handleImageFile = (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          if (ev.target?.result) sendMessageContent(ev.target.result as string, 'image');
      };
      reader.readAsDataURL(file);
  };

  const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
      e.target.value = ''; // reset to allow same file again
  };

  // --- Feature 4: Paste image (Ctrl+V) ---
  const handlePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                  e.preventDefault();
                  handleImageFile(file);
              }
          }
      }
  };

  // --- Feature 6: Voice recording ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          audioChunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          recorder.onstop = () => {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const reader = new FileReader();
              reader.onload = (ev) => {
                  if (ev.target?.result) sendMessageContent(ev.target.result as string, 'voice');
              };
              reader.readAsDataURL(blob);
              stream.getTracks().forEach(tr => tr.stop());
          };
          recorder.start();
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
          setRecordSeconds(0);
          recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
      } catch (err) {
          alert('دسترسی به میکروفون امکان‌پذیر نیست');
      }
  };

  const stopRecording = (cancel = false) => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      const recorder = mediaRecorderRef.current;
      if (recorder) {
          if (cancel) {
              recorder.onstop = () => recorder.stream.getTracks().forEach(tr => tr.stop());
          }
          recorder.stop();
          mediaRecorderRef.current = null;
      }
  };

  // --- Feature 3: Edit / Delete message ---
  const startEditMessage = (msg: Message) => {
      setEditingMsgId(msg.id);
      setEditText(msg.content);
  };

  const saveEditMessage = async () => {
      if (!editingMsgId || !editText.trim()) return;
      await api.messages.updateMessage(editingMsgId, editText);
      setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, content: editText, isEdited: true } : m));
      setEditingMsgId(null);
      setEditText('');
  };

  const handleDeleteMessage = (msgId: string) => {
      confirmAction({
          description: 'این پیام حذف شود؟',
          onConfirm: async () => {
              await api.messages.deleteMessage(msgId, user!.id);
              setMessages(prev => prev.filter(m => m.id !== msgId));
          }
      });
  };

  const formatRecordTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return toPersianDigits(`${m}:${sec.toString().padStart(2, '0')}`);
  };

  const createNewThread = async (targetUserId: string) => {
      // Check existing
      const existing = threads.find(t => t.type === 'direct' && t.participants.includes(targetUserId) && t.participants.includes(user!.id));
      if(existing) {
          setActiveThreadId(existing.id);
      } else {
          const newThread: ChatThread = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'direct',
              participants: [user!.id, targetUserId],
              updatedAt: new Date().toISOString()
          };
          await api.messages.createThread(newThread);
          setThreads(prev => [newThread, ...prev]);
          setActiveThreadId(newThread.id);
      }
      setShowNewChatModal(false);
  };

  const handleBroadcast = async (target: 'Team' | 'Clients') => {
      const newThread: ChatThread = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'broadcast',
          name: target === 'Team' ? '📢 اطلاعیه تیم' : '📢 اطلاعیه مشتریان',
          participants: [user!.id], 
          updatedAt: new Date().toISOString(),
          lastMessage: 'گروه ایجاد شد'
      };
      await api.messages.createThread(newThread);
      setThreads(prev => [...prev, newThread]);
      setActiveThreadId(newThread.id);
      setShowBroadcastModal(false);
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      confirmAction({
          description: 'آیا مطمئن هستید؟ گفتگو حذف خواهد شد.',
          onConfirm: async () => {
              try {
                  await api.messages.deleteThread(id, user!.id);
                  setThreads(prev => [...prev.filter(t => t.id !== id)]);
                  if(activeThreadId === id) setActiveThreadId(null);
              } catch(err) {
                  alert('خطا در حذف گفتگو');
              }
          }
      });
  };

  const getThreadName = (thread: ChatThread) => {
      if(thread.type === 'group' || thread.type === 'broadcast') return thread.name;
      const otherId = thread.participants.find(p => p !== user!.id);
      const u = users.find(usr => usr.id === otherId);
      return u ? `${u.firstName} ${u.lastName}` : 'کاربر ناشناس';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
        {/* Sidebar List */}
        <div className="w-80 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-lg">پیام‌ها</h3>
                     <div className="flex gap-2">
                         <button onClick={() => setShowNewChatModal(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 hover:text-primary-600 transition" title="گفتگوی جدید">
                             <Plus size={20}/>
                         </button>
                         <button onClick={() => setShowBroadcastModal(!showBroadcastModal)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 hover:text-primary-600 transition" title="ارسال همگانی">
                             <Megaphone size={20}/>
                         </button>
                     </div>
                </div>
                
                {showBroadcastModal && (
                    <div className="mb-4 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl flex gap-2 animate-in slide-in-from-top-2">
                        <button onClick={() => handleBroadcast('Team')} className="flex-1 text-xs bg-white dark:bg-slate-800 py-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition">همگانی تیم</button>
                        <button onClick={() => handleBroadcast('Clients')} className="flex-1 text-xs bg-white dark:bg-slate-800 py-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition">همگانی مشتری</button>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                    <input className="w-full bg-gray-50 dark:bg-slate-900 rounded-xl py-2 pr-10 pl-4 text-sm outline-none focus:ring-1 focus:ring-primary-500/20 transition" placeholder="جستجو..."/>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {threads.map(t => (
                    <div 
                        key={t.id} 
                        onClick={() => setActiveThreadId(t.id)}
                        className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition group relative ${activeThreadId === t.id ? 'bg-primary-50 dark:bg-slate-700' : ''}`}
                    >
                        <div className="relative w-10 h-10 shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                                {t.type === 'broadcast' ? <Megaphone size={18}/> : getThreadName(t)[0]}
                            </div>
                            {/* Unread badge on avatar (feature 3) */}
                            {(unreadMap[t.id] || 0) > 0 && activeThreadId !== t.id && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                                    {toPersianDigits((unreadMap[t.id] || 0) > 99 ? '99+' : unreadMap[t.id])}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <h4 className={`text-sm truncate ${(unreadMap[t.id] || 0) > 0 && activeThreadId !== t.id ? 'font-black text-gray-900 dark:text-white' : 'font-bold text-gray-800 dark:text-white'}`}>{getThreadName(t)}</h4>
                                <span className="text-[9px] text-gray-400">{formatJalaliShort(t.updatedAt)}</span>
                            </div>
                            <p className={`text-xs truncate mt-0.5 ${(unreadMap[t.id] || 0) > 0 && activeThreadId !== t.id ? 'text-gray-700 dark:text-gray-200 font-bold' : 'text-gray-400'}`}>{t.lastMessage || 'شروع گفتگو'}</p>
                            
                            {/* Tags */}
                            <div className="flex gap-1 mt-1">
                                {t.type === 'direct' && (
                                    <span className="text-[9px] bg-gray-100 dark:bg-slate-600 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Lock size={8}/> خصوصی
                                    </span>
                                )}
                                {(t.type === 'group' || t.type === 'broadcast') && (
                                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Globe size={8}/> عمومی
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <button 
                            type="button"
                            onClick={(e) => handleDeleteThread(e, t.id)}
                            className="absolute left-2 opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition shadow-sm z-10 cursor-pointer"
                        >
                            <Trash2 size={14} className="pointer-events-none"/>
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
            {activeThreadId ? (
                <>
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                                {getThreadName(threads.find(t=>t.id === activeThreadId)!)[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white">{getThreadName(threads.find(t=>t.id === activeThreadId)!)}</h3>
                                <span className="text-xs text-green-500">آنلاین</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar">
                        {(() => {
                            const activeThread = threads.find(t => t.id === activeThreadId);
                            const isGroupChat = activeThread?.type === 'group' || activeThread?.type === 'broadcast';
                            return messages.map(msg => {
                                const isMine = msg.senderId === user!.id;
                                const sender = users.find(u => u.id === msg.senderId);
                                const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'کاربر';
                                const isEditing = editingMsgId === msg.id;
                                return (
                                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                                    {/* Edit/Delete actions (own text messages) */}
                                    {isMine && !isEditing && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition self-center ml-1">
                                            {msg.type === 'text' && (
                                                <button onClick={() => startEditMessage(msg)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition" title="ویرایش"><Edit2 size={13}/></button>
                                            )}
                                            <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition" title="حذف"><Trash2 size={13}/></button>
                                        </div>
                                    )}
                                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${isMine ? 'bg-primary-500 text-white rounded-tl-none' : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-tr-none shadow-sm'}`}>
                                        {/* Sender name for incoming group messages (feature 3) */}
                                        {!isMine && isGroupChat && (
                                            <div className="text-[11px] font-black text-primary-500 dark:text-primary-300 mb-1">{senderName}</div>
                                        )}

                                        {isEditing ? (
                                            <div className="flex flex-col gap-2 min-w-[200px]">
                                                <input
                                                    autoFocus
                                                    value={editText}
                                                    onChange={e => setEditText(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveEditMessage(); if (e.key === 'Escape') { setEditingMsgId(null); setEditText(''); } }}
                                                    className="bg-white/20 text-white placeholder:text-white/60 outline-none px-2 py-1.5 rounded-lg text-sm border border-white/30"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => { setEditingMsgId(null); setEditText(''); }} className="p-1 bg-white/20 rounded-md hover:bg-white/30 transition"><X size={14}/></button>
                                                    <button onClick={saveEditMessage} className="p-1 bg-white/30 rounded-md hover:bg-white/40 transition"><Check size={14}/></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Content by type (features 4 & 6) */}
                                                {msg.type === 'image' ? (
                                                    <img src={msg.content} alt="تصویر" className="max-w-full rounded-lg cursor-pointer max-h-64 object-cover" onClick={() => window.open(msg.content, '_blank')}/>
                                                ) : msg.type === 'voice' ? (
                                                    <audio controls src={msg.content} className="max-w-[220px] h-10"/>
                                                ) : (
                                                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                                                )}
                                            </>
                                        )}

                                        <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isMine ? 'text-primary-100' : 'text-gray-400'}`}>
                                            {msg.isEdited && <span className="opacity-70">(ویرایش‌شده)</span>}
                                            {new Date(msg.createdAt).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}
                                            {isMine && (
                                                <span>{msg.isSeen ? '✓✓' : '✓'}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                );
                            });
                        })()}
                        <div ref={messagesEndRef}/>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
                        {isRecording ? (
                            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl border border-red-100 dark:border-red-800 animate-in fade-in">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="flex-1 text-sm font-bold text-red-600 dark:text-red-400">در حال ضبط... {formatRecordTime(recordSeconds)}</span>
                                <button onClick={() => stopRecording(true)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition" title="لغو">
                                    <Trash2 size={18}/>
                                </button>
                                <button onClick={() => stopRecording(false)} className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/30" title="ارسال صدا">
                                    <Send size={18} className="rotate-180"/>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInput}/>
                                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition" title="ارسال تصویر">
                                    <ImageIcon size={20}/>
                                </button>
                                <button onClick={startRecording} className="p-3 text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition" title="ضبط صدا">
                                    <Mic size={20}/>
                                </button>
                                <input
                                    className="flex-1 bg-gray-100 dark:bg-slate-900 border-none outline-none px-4 py-3 rounded-xl text-sm"
                                    placeholder="پیام خود را بنویسید... (یا تصویر را Paste کنید)"
                                    value={inputMsg}
                                    onChange={e => setInputMsg(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    onPaste={handlePaste}
                                />
                                <button onClick={handleSend} className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/30">
                                    <Send size={18} className="rotate-180"/>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <MessageSquare size={48} className="mb-4 opacity-50"/>
                    <p>یک گفتگو را انتخاب کنید یا پیام جدید ارسال کنید</p>
                    <div className="flex gap-2 mt-4">
                         {users.filter(u=>u.id!==user?.id).slice(0,3).map(u => (
                             <button key={u.id} onClick={() => createNewThread(u.id)} className="text-xs bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">{u.firstName}</button>
                         ))}
                    </div>
                </div>
            )}
        </div>

        {/* New Chat Modal */}
        {showNewChatModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 dark:text-white">شروع گفتگو جدید</h3>
                        <button onClick={() => setShowNewChatModal(false)} className="text-gray-500 hover:text-red-500 transition"><X size={20}/></button>
                    </div>
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                            <input 
                                className="w-full bg-gray-50 dark:bg-slate-900 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-1 focus:ring-primary-500/20 transition"
                                placeholder="جستجو نام کاربر..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {users.filter(u => u.id !== user?.id && (u.firstName.includes(searchTerm) || u.lastName.includes(searchTerm))).length === 0 ? (
                            <div className="text-center text-gray-400 py-8 text-sm">کاربری یافت نشد</div>
                        ) : (
                            users.filter(u => u.id !== user?.id && (u.firstName.includes(searchTerm) || u.lastName.includes(searchTerm))).map(u => (
                                <button 
                                    key={u.id}
                                    onClick={() => createNewThread(u.id)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition text-right group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-slate-600 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-lg">
                                        {u.firstName[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 dark:text-white group-hover:text-primary-600 transition">{u.firstName} {u.lastName}</div>
                                        <div className="text-xs text-gray-400">{u.role === 'ClientUser' ? 'مشتری' : 'عضو تیم'}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default MessagesView;
