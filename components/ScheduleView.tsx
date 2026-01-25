
import React, { useState, useEffect } from 'react';
import { ScheduleEvent, EventCategory, PreTripTask, Member } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { MapPin, Info, Plus, X, Check, Trash2, Plane, ChevronDown } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, doc, arrayUnion, arrayRemove, orderBy, getDoc, setDoc } from 'firebase/firestore';

interface ScheduleViewProps {
  members: Member[];
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ members }) => {
  const dates = [
    { display: 'PRE', val: 'PRE_TRIP', icon: '📝' },
    { display: '1', val: '2026-01-30', date: '1/30' },
    { display: '2', val: '2026-01-31', date: '1/31' },
    { display: '3', val: '2026-02-01', date: '2/01' },
    { display: '4', val: '2026-02-02', date: '2/02' },
    { display: '5', val: '2026-02-03', date: '2/03' },
    { display: '6', val: '2026-02-04', date: '2/04' },
    { display: '7', val: '2026-02-05', date: '2/05' },
  ];

  const [selectedDate, setSelectedDate] = useState(dates[1].val);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [preTripTasks, setPreTripTasks] = useState<PreTripTask[]>([]);
  
  // 自定義分類相關狀態
  const [customCategories, setCustomCategories] = useState<Record<string, string>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📍');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<string>(EventCategory.SIGHTSEEING);
  const [newNotes, setNewNotes] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // 獲取自定義分類
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'scheduleSettings'));
        if (configDoc.exists()) {
          if (configDoc.data().customCategories) setCustomCategories(configDoc.data().customCategories);
        }
      } catch (e) { console.warn("Fetch schedule settings error:", e); }
    };
    fetchConfig();
  }, []);

  const handleAddNewCategory = async () => {
    if (!newCatName.trim()) return;
    const updated = { ...customCategories, [newCatName.trim()]: newCatEmoji };
    setCustomCategories(updated);
    setIsAddingCategory(false);
    await setDoc(doc(db, 'config', 'scheduleSettings'), { customCategories: updated }, { merge: true });
    setNewCategory(newCatName.trim());
    setNewCatName('');
  };

  useEffect(() => {
    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEvent)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'pretrip_tasks'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPreTripTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PreTripTask)));
    });
    return () => unsubscribe();
  }, []);

  const handleAddPreTripTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskTitle.trim()) return;
      await addDoc(collection(db, 'pretrip_tasks'), { 
        title: newTaskTitle, 
        completedBy: [], 
        createdAt: new Date().toISOString() 
      });
      setNewTaskTitle('');
  };

  const deletePreTripTask = async (id: string) => { 
    if(window.confirm("確定要刪除此行前準備項目嗎？")) await deleteDoc(doc(db, 'pretrip_tasks', id)); 
  }

  const toggleTaskCompletion = async (taskId: string, memberId: string, isCompleted: boolean) => {
      const taskRef = doc(db, 'pretrip_tasks', taskId);
      await updateDoc(taskRef, { completedBy: isCompleted ? arrayRemove(memberId) : arrayUnion(memberId) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'events', editingId), { location: newLocation, category: newCategory, notes: newNotes });
      } else {
        await addDoc(collection(db, 'events'), { 
          date: selectedDate, 
          time: '', 
          title: '', 
          location: newLocation, 
          category: newCategory, 
          notes: newNotes, 
          createdAt: new Date().toISOString() 
        });
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };
  
  const handleDeleteEvent = async (id?: string) => {
    const targetId = id || editingId;
    if (!targetId) return;
    if(window.confirm("確定要刪除這個行程嗎？")) { 
      try {
        await deleteDoc(doc(db, 'events', targetId)); 
        setIsModalOpen(false); 
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  }

  const allCategoryIcons = { ...CATEGORY_ICONS, ...customCategories };
  const allCategoryColors = { ...CATEGORY_COLORS };

  const getCategoryIcon = (cat: string) => (allCategoryIcons as any)[cat] || '📍';
  const getCategoryColorClass = (cat: string) => (allCategoryColors as any)[cat] || 'bg-slate-50 text-slate-400 border-slate-100';

  const filteredEvents = events
    .filter(e => e.date === selectedDate)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); 

  return (
    <div className="h-full flex flex-col">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-6 py-2 mb-1">
        {dates.map((d) => (
          <button
            key={d.val}
            onClick={() => setSelectedDate(d.val)}
            className={`flex-shrink-0 flex flex-col items-center justify-center w-[48px] h-[64px] rounded-xl transition-all duration-300 ${
              selectedDate === d.val
                ? 'bg-white border-[1.5px] border-sky-400 shadow-active scale-105'
                : 'bg-slate-50 border-[1.5px] border-transparent text-slate-300'
            }`}
          >
            {d.val === 'PRE_TRIP' ? (
              <div className="flex flex-col items-center w-full px-1">
                <span className="text-[8px] font-black text-slate-400 mb-0.5 uppercase tracking-normal w-full text-center">PRE</span>
                <span className="text-base leading-none text-sky-400">📝</span>
              </div>
            ) : (
              <>
                <span className="text-[7px] font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">DAY</span>
                <span className={`text-base font-bold leading-tight ${selectedDate === d.val ? 'text-sky-400' : 'text-slate-300'}`}>{d.display}</span>
                <span className="text-[7px] font-bold leading-none">{d.date}</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-4 no-scrollbar pt-2">
        {selectedDate === 'PRE_TRIP' ? (
             <div className="space-y-3">
                 <div className="bg-white p-5 rounded-3xl shadow-soft border border-slate-50">
                     <h3 className="text-base font-bold text-slate-800 mb-4">行前準備</h3>
                     <form onSubmit={handleAddPreTripTask} className="relative mb-4">
                        <input 
                           type="text" 
                           placeholder="準備事項..." 
                           value={newTaskTitle}
                           onChange={e => setNewTaskTitle(e.target.value)}
                           className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border-none outline-none text-xs font-bold"
                        />
                        <button type="submit" className="absolute right-1.5 top-1.5 w-8 h-8 bg-sky-400 text-white rounded-lg flex items-center justify-center shadow-active">
                           <Plus size={18} />
                        </button>
                     </form>
                     <div className="space-y-2">
                        {preTripTasks.map(task => (
                            <div key={task.id} className="bg-white rounded-xl border border-slate-100 p-3 shadow-xs">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-slate-700 text-xs">{task.title}</span>
                                    <button onClick={() => deletePreTripTask(task.id)} className="text-slate-200 p-1 hover:text-rose-400 transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-start w-full px-0.5">
                                    {members.map(member => {
                                        const isDone = task.completedBy.includes(member.id);
                                        return (
                                            <button 
                                                key={member.id}
                                                onClick={() => toggleTaskCompletion(task.id, member.id, isDone)}
                                                className="flex flex-col items-center shrink-0 gap-1 w-10"
                                            >
                                                <div className={`w-8 h-8 rounded-full border-2 overflow-hidden relative transition-all ${isDone ? 'border-sky-400 ring-2 ring-sky-50' : 'border-slate-100 grayscale opacity-40'}`}>
                                                    <img src={member.avatar} className="w-full h-full object-cover" alt={member.name}/>
                                                    {isDone && (
                                                        <div className="absolute inset-0 bg-sky-400/30 flex items-center justify-center rounded-full">
                                                            <Check size={14} className="text-white drop-shadow-md" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[8px] font-bold truncate w-full text-center ${isDone ? 'text-sky-400' : 'text-slate-300'}`}>{member.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                     </div>
                 </div>
             </div>
        ) : (
        <>
            {/* 去程航班 */}
            {selectedDate === '2026-01-30' && (
              <div className="bg-white rounded-[24px] border-2 border-dashed border-sky-400/20 p-4 shadow-soft relative overflow-hidden mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="bg-sky-400 text-brand-100 border border-sky-500/30 text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-tighter">出發</div>
                  <div className="text-sky-400 text-[10px] font-bold tracking-widest uppercase">TPE → ICN</div>
                </div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">TPE</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">20:00</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3 relative">
                    <Plane size={14} className="text-sky-400 mb-1 rotate-45" />
                    <div className="w-full h-[1px] bg-sky-100 flex items-center justify-between">
                       <div className="w-1.5 h-1.5 rounded-full bg-sky-400 -ml-0.5"></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-sky-400 -mr-0.5"></div>
                    </div>
                    <span className="text-[8px] text-slate-300 mt-1 font-bold tracking-wider uppercase">IT 602</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">ICN</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">23:30</div>
                  </div>
                </div>
              </div>
            )}

            {/* 回程航班 */}
            {selectedDate === '2026-02-05' && (
              <div className="bg-white rounded-[24px] border-2 border-dashed border-sky-400/20 p-4 shadow-soft relative overflow-hidden mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="bg-sky-400 text-brand-100 border border-sky-500/30 text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-tighter">抵達</div>
                  <div className="text-sky-400 text-[10px] font-bold tracking-widest uppercase">ICN → TPE</div>
                </div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">ICN</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">16:20</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3 relative">
                    <Plane size={14} className="text-sky-400 mb-1 rotate-45" />
                    <div className="w-full h-[1px] bg-sky-100 flex items-center justify-between">
                       <div className="w-1.5 h-1.5 rounded-full bg-sky-400 -ml-0.5"></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-sky-400 -mr-0.5"></div>
                    </div>
                    <span className="text-[8px] text-slate-300 mt-1 font-bold tracking-wider uppercase">KE 2027</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">TPE</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">18:10</div>
                  </div>
                </div>
              </div>
            )}

            <button 
                onClick={() => { setEditingId(null); setNewLocation(''); setNewNotes(''); setIsModalOpen(true); }}
                className="w-full bg-sky-400 text-brand-100 font-black py-4 rounded-2xl shadow-active flex items-center justify-center space-x-2 active:scale-[0.98] transition-all mb-4 border border-sky-500/20"
            >
              <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shadow-soft">
                <Plus size={14} strokeWidth={4} className="text-sky-400" />
              </div>
              <span className="text-sm tracking-tight uppercase">新增行程</span>
            </button>

            <div className="space-y-3">
            {filteredEvents.map((event) => (
                <div 
                    key={event.id}
                    onClick={() => { setEditingId(event.id); setNewLocation(event.location); setNewCategory(event.category); setNewNotes(event.notes || ''); setIsModalOpen(true); }}
                    className="bg-white rounded-[20px] p-4 shadow-soft border border-slate-50 active:scale-[0.98] transition-all relative group"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoryColorClass(event.category).replace('text-sky-400', 'text-sky-400')}`}>
                            {getCategoryIcon(event.category)} {event.category}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                          className="text-slate-100 hover:text-rose-400 transition-colors p-1"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <h3 className="text-base font-bold text-slate-700 mb-1 leading-snug">{event.location}</h3>
                    {event.notes && <p className="text-[11px] text-slate-400 italic font-medium truncate">{event.notes}</p>}
                </div>
            ))}
            {filteredEvents.length === 0 && selectedDate !== 'PRE_TRIP' && (
              <div className="text-center py-12 text-slate-200 text-xs font-bold uppercase tracking-widest italic">No events planned</div>
            )}
            </div>
        </>
        )}
      </div>

      {isModalOpen && selectedDate !== 'PRE_TRIP' && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-end justify-center">
           <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800">{editingId ? '編輯行程' : '新增行程'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 text-xl">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <input type="text" placeholder="目的地名稱" value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full text-lg font-bold py-3 border-b-2 border-slate-50 focus:border-sky-400 outline-none transition-colors" required />
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">行程分類</label>
                    <div className="relative">
                        <select 
                            value={newCategory} 
                            onChange={(e) => {
                                if (e.target.value === 'ADD_NEW') { setIsAddingCategory(true); } 
                                else { setNewCategory(e.target.value); setIsAddingCategory(false); }
                            }}
                            className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 border-none outline-none appearance-none pr-10 focus:ring-1 focus:ring-sky-100"
                        >
                            {Object.entries(CATEGORY_ICONS).map(([name, emoji]) => (
                                <option key={name} value={name}>{emoji} {name}</option>
                            ))}
                            {Object.entries(customCategories).map(([name, emoji]) => (
                                <option key={name} value={name}>{emoji} {name}</option>
                            ))}
                            <option value="ADD_NEW" className="text-sky-400 font-bold">+ 新增自定義分類...</option>
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                 </div>

                 {isAddingCategory && (
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[8px] font-bold text-purple-400 mb-1 block">分類名稱</label>
                                <input type="text" placeholder="例: 練舞" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full p-2 bg-white rounded-lg text-xs font-bold outline-none border border-purple-100 focus:border-purple-300" />
                            </div>
                            <div className="w-12">
                                <label className="text-[8px] font-bold text-purple-400 mb-1 block">圖示</label>
                                <input type="text" placeholder="💃" value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} className="w-full p-2 bg-white rounded-lg text-center text-xs outline-none border border-purple-100" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsAddingCategory(false)} className="flex-1 py-1.5 bg-white text-slate-400 text-[10px] font-bold rounded-lg border border-slate-100">取消</button>
                            <button onClick={handleAddNewCategory} className="flex-1 py-1.5 bg-sky-400 text-white text-[10px] font-bold rounded-lg shadow-sm">新增分類</button>
                        </div>
                    </div>
                 )}

                 <textarea placeholder="有些備註想記錄嗎？" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl h-24 outline-none focus:ring-1 focus:ring-sky-200 text-xs font-bold text-slate-600" />
                 
                 <div className="flex gap-3 pt-4">
                     {editingId && (
                         <button type="button" onClick={() => handleDeleteEvent()} className="px-5 py-4 bg-rose-50 text-rose-500 font-bold rounded-2xl active:scale-95 transition-all">
                             <Trash2 size={20} />
                         </button>
                     )}
                     <button type="submit" className="flex-1 py-4 bg-sky-400 text-white text-base font-bold rounded-2xl shadow-active active:scale-95 transition-all">
                        {editingId ? '儲存變更' : '確定新增'}
                     </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
