
import React, { useState, useEffect, useContext, useRef } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { User, Message, ChatThread } from '../types';
import { Send, Image as ImageIcon, Mic, MoreVertical, Search, Phone, Video, MessageSquare, Users, Megaphone, Trash2, Lock, Globe, Plus, X, Edit2, Check, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { formatJalaliShort, toPersianDigits } from '../utils';
import { playNotificationSound } from '../services/sound';

const MessagesView = () => {
  const { user, confirmAction, settings } = useContext(AuthContext);
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

  // Image lightbox (popup viewer with zoom/pan/download)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panState = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const openLightbox = (src: string) => { setLightboxSrc(src); setZoom(1); setPan({ x: 0, y: 0 }); };
  const closeLightbox = () => { setLightboxSrc(null); setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomIn = () => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const downloadImage = (src: string) => {
      const a = document.createElement('a');
      a.href = src;
      a.download = `chat-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
  };

  // Close lightbox with Escape, zoom with +/-
  useEffect(() => {
      if (!lightboxSrc) return;
      const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') closeLightbox();
          else if (e.key === '+' || e.key === '=') zoomIn();
          else if (e.key === '-') zoomOut();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
  }, [lightboxSrc]);

  const onLightboxWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn(); else zoomOut();
  };
  const onPanStart = (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      panState.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
  };
  const onPanMove = (e: React.MouseEvent) => {
      if (!panState.current.dragging) return;
      setPan({ x: panState.current.originX + (e.clientX - panState.current.startX), y: panState.current.originY + (e.clientY - panState.current.startY) });
  };
  const onPanEnd = () => { panState.current.dragging = false; };

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
      // Idempotent append: sendMessage fires 'messagesUpdated' which may already
      // reload this message from storage — avoid adding a duplicate.
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);

      // Notification sound on send
      playNotificationSound(settings?.notificationSound);

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

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar">
                        {(() => {
                            const activeThread = threads.find(t => t.id === activeThreadId);
                            const isGroupChat = activeThread?.type === 'group' || activeThread?.type === 'broadcast';
                            return messages.map(msg => {
                                const isMine = msg.senderId === user!.id;
                                const sender = users.find(u => u.id === msg.senderId);
                                const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'کاربر';
                                const isEditing = editingMsgId === msg.id;
                                const isMedia = msg.type === 'image';
                                return (
                                <div
                                    key={msg.id}
                                    className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} group animate-in fade-in ${isMine ? 'slide-in-from-bottom-2 slide-in-from-left-2' : 'slide-in-from-bottom-2 slide-in-from-right-2'} duration-300`}
                                >
                                    {/* Edit/Delete actions (own messages) */}
                                    {isMine && !isEditing && (
                                        <div className="flex items-center gap-1 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 self-center">
                                            {msg.type === 'text' && (
                                                <button onClick={() => startEditMessage(msg)} className="p-1.5 text-gray-400 hover:text-blue-500 bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg transition shadow-sm active:scale-90" title="ویرایش"><Edit2 size={13}/></button>
                                            )}
                                            <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600 rounded-lg transition shadow-sm active:scale-90" title="حذف"><Trash2 size={13}/></button>
                                        </div>
                                    )}
                                    <div className={`max-w-[72%] text-sm shadow-sm transition-all duration-200 group-hover:shadow-md
                                        ${isMedia ? 'p-1.5' : 'px-3.5 py-2.5'}
                                        ${isMine
                                            ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl rounded-bl-md'
                                            : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-br-md border border-gray-100 dark:border-slate-600'}`}
                                    >
                                        {/* Sender name for incoming group messages */}
                                        {!isMine && isGroupChat && (
                                            <div className={`text-[11px] font-black text-primary-500 dark:text-primary-300 mb-1 ${isMedia ? 'px-2 pt-1' : ''}`}>{senderName}</div>
                                        )}

                                        {isEditing ? (
                                            <div className="flex flex-col gap-2 min-w-[210px]">
                                                <input
                                                    autoFocus
                                                    value={editText}
                                                    onChange={e => setEditText(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveEditMessage(); if (e.key === 'Escape') { setEditingMsgId(null); setEditText(''); } }}
                                                    className="bg-white/15 text-white placeholder:text-white/60 outline-none px-3 py-2 rounded-xl text-sm border border-white/30 focus:border-white/60 transition"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => { setEditingMsgId(null); setEditText(''); }} className="px-2.5 py-1 bg-white/15 rounded-lg hover:bg-white/25 transition text-xs font-bold flex items-center gap-1 active:scale-95"><X size={13}/> لغو</button>
                                                    <button onClick={saveEditMessage} className="px-2.5 py-1 bg-white/25 rounded-lg hover:bg-white/35 transition text-xs font-bold flex items-center gap-1 active:scale-95"><Check size={13}/> ذخیره</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Content by type */}
                                                {msg.type === 'image' ? (
                                                    <div className="relative overflow-hidden rounded-xl group/img cursor-zoom-in" onClick={() => openLightbox(msg.content)}>
                                                        <img src={msg.content} alt="تصویر" className="max-w-full rounded-xl max-h-72 object-cover transition-transform duration-300 group-hover/img:scale-[1.03]"/>
                                                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                                            <div className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/50 text-white rounded-full p-2 backdrop-blur-sm">
                                                                <ZoomIn size={18}/>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : msg.type === 'voice' ? (
                                                    <div className={`flex items-center gap-2 rounded-xl p-1 ${isMine ? 'bg-white/10' : 'bg-gray-50 dark:bg-slate-600/40'}`}>
                                                        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isMine ? 'bg-white/25 text-white' : 'bg-primary-100 dark:bg-slate-500 text-primary-600 dark:text-primary-200'}`}>
                                                            <Mic size={16}/>
                                                        </div>
                                                        <audio controls src={msg.content} className="h-9 max-w-[200px]"/>
                                                    </div>
                                                ) : (
                                                    <span className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</span>
                                                )}
                                            </>
                                        )}

                                        <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMedia ? 'px-2 pb-1' : ''} ${isMine ? 'text-primary-100' : 'text-gray-400'}`}>
                                            {msg.isEdited && <span className="opacity-70">(ویرایش‌شده)</span>}
                                            {new Date(msg.createdAt).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}
                                            {isMine && (
                                                <span className="font-bold">{msg.isSeen ? '✓✓' : '✓'}</span>
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
                    <div className="p-3 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
                        {isRecording ? (
                            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-2xl border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <span className="relative flex h-3 w-3 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="flex-1 text-sm font-bold text-red-600 dark:text-red-400">در حال ضبط صدا... <span className="tabular-nums">{formatRecordTime(recordSeconds)}</span></span>
                                <button onClick={() => stopRecording(true)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition active:scale-90" title="لغو ضبط">
                                    <Trash2 size={18}/>
                                </button>
                                <button onClick={() => stopRecording(false)} className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 active:scale-90" title="ارسال صدا">
                                    <Send size={18} className="rotate-180"/>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-900 rounded-2xl p-1.5 transition focus-within:ring-2 focus-within:ring-primary-500/20">
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInput}/>
                                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition active:scale-90" title="ارسال تصویر">
                                    <ImageIcon size={20}/>
                                </button>
                                <button onClick={startRecording} className="p-2.5 text-gray-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition active:scale-90" title="ضبط صدا">
                                    <Mic size={20}/>
                                </button>
                                <input
                                    className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-sm"
                                    placeholder="پیام خود را بنویسید... (یا تصویر را Paste کنید)"
                                    value={inputMsg}
                                    onChange={e => setInputMsg(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    onPaste={handlePaste}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputMsg.trim()}
                                    className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 active:scale-90 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100"
                                >
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

        {/* Image Lightbox (popup viewer with zoom / pan / download) */}
        {lightboxSrc && (
            <div
                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
                onClick={closeLightbox}
            >
                {/* Toolbar */}
                <div
                    className="flex items-center justify-between p-4 text-white animate-in slide-in-from-top-2 duration-300"
                    onClick={e => e.stopPropagation()}
                >
                    <span className="text-sm font-bold bg-white/10 px-3 py-1.5 rounded-full">{toPersianDigits(Math.round(zoom * 100))}٪</span>
                    <div className="flex items-center gap-2">
                        <button onClick={zoomOut} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition active:scale-90" title="کوچک‌نمایی"><ZoomOut size={20}/></button>
                        <button onClick={zoomIn} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition active:scale-90" title="بزرگ‌نمایی"><ZoomIn size={20}/></button>
                        <button onClick={resetZoom} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition active:scale-90" title="بازنشانی"><RotateCcw size={18}/></button>
                        <button onClick={() => downloadImage(lightboxSrc)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition active:scale-90" title="دانلود"><Download size={20}/></button>
                        <div className="w-px h-6 bg-white/20 mx-1"></div>
                        <button onClick={closeLightbox} className="p-2.5 bg-white/10 hover:bg-red-500/80 rounded-xl transition active:scale-90" title="بستن (Esc)"><X size={20}/></button>
                    </div>
                </div>

                {/* Image canvas */}
                <div
                    className="flex-1 flex items-center justify-center overflow-hidden select-none"
                    onClick={e => e.stopPropagation()}
                    onWheel={onLightboxWheel}
                    onMouseDown={onPanStart}
                    onMouseMove={onPanMove}
                    onMouseUp={onPanEnd}
                    onMouseLeave={onPanEnd}
                    style={{ cursor: zoom > 1 ? (panState.current.dragging ? 'grabbing' : 'grab') : 'default' }}
                >
                    <img
                        src={lightboxSrc}
                        alt="نمایش تصویر"
                        draggable={false}
                        className="max-w-[92vw] max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: panState.current.dragging ? 'none' : 'transform 0.15s ease-out' }}
                    />
                </div>
                <p className="text-center text-white/40 text-xs pb-4">برای بستن کلیک کنید یا Esc بزنید — اسکرول برای زوم</p>
            </div>
        )}
    </div>
  );
};

export default MessagesView;
