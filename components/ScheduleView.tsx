
import React, { useState, useEffect } from 'react';
import { ScheduleEvent, EventCategory, PreTripTask, Member } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { MapPin, Info, Plus, X, Check, Trash2, Plane } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, doc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<EventCategory>(EventCategory.SIGHTSEEING);
  const [newNotes, setNewNotes] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

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
              <>
                <span className="text-[7px] font-bold text-slate-400 mb-0.5">PRE</span>
                <span className="text-base">📝</span>
              </>
            ) : (
              <>
                <span className="text-[7px] font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">DAY</span>
                <span className={`text-base font-bold mb-0.5 ${selectedDate === d.val ? 'text-sky-500' : 'text-slate-300'}`}>{d.display}</span>
                <span className="text-[7px] font-bold">{d.date}</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-4 no-scrollbar">
        {selectedDate === 'PRE_TRIP' ? (
             <div className="space-y-3">
                 <div className="bg-white p-4 rounded-3xl shadow-soft border border-slate-50">
                     <h3 className="text-lg font-bold text-slate-800 mb-4">行前準備</h3>
                     <form onSubmit={handleAddPreTripTask} className="relative mb-4">
                        <input 
                           type="text" 
                           placeholder="新增準備事項..." 
                           value={newTaskTitle}
                           onChange={e => setNewTaskTitle(e.target.value)}
                           className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-sky-100 outline-none text-xs font-medium"
                        />
                        <button type="submit" className="absolute right-1.5 top-1.5 w-8 h-8 bg-sky-400 text-white rounded-lg flex items-center justify-center shadow-active">
                           <Plus size={18} />
                        </button>
                     </form>
                     <div className="space-y-3">
                        {preTripTasks.map(task => (
                            <div key={task.id} className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-slate-700 text-sm">{task.title}</span>
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
                                                        <div className="absolute inset-0 bg-sky-400/30 flex items-center justify-center">
                                                            <Check size={14} className="text-white drop-shadow-md" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[8px] font-bold truncate w-full text-center ${isDone ? 'text-sky-500' : 'text-slate-300'}`}>{member.name}</span>
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
              <div className="bg-white rounded-2xl border-2 border-dashed border-sky-50 p-4 shadow-soft relative overflow-hidden mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="bg-amber-400 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase">出發</div>
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
                    <span className="text-[8px] text-slate-300 mt-1 font-bold tracking-wider">IT 602</span>
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
              <div className="bg-white rounded-2xl border-2 border-dashed border-sky-50 p-4 shadow-soft relative overflow-hidden mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="bg-amber-400 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase">抵達</div>
                  <div className="text-sky-400 text-[10px] font-bold tracking-widest uppercase">ICN → TPE</div>
                </div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">ICN</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">16:20</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3 relative">
                    <Plane size={14} className="text-sky-400 mb-1 rotate-90" />
                    <div className="w-full h-[1px] bg-sky-100 flex items-center justify-between">
                       <div className="w-1.5 h-1.5 rounded-full bg-sky-400 -ml-0.5"></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-sky-400 -mr-0.5"></div>
                    </div>
                    <span className="text-[8px] text-slate-300 mt-1 font-bold tracking-wider">KE 2027</span>
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
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl shadow-amber-glow flex items-center justify-center space-x-2 active:scale-[0.98] transition-all mb-4"
            >
              <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                <Plus size={14} strokeWidth={3} />
              </div>
              <span className="text-base">新增一個行程</span>
            </button>

            <div className="space-y-3">
            {filteredEvents.map((event) => (
                <div 
                    key={event.id}
                    onClick={() => { setEditingId(event.id); setNewLocation(event.location); setNewCategory(event.category); setNewNotes(event.notes || ''); setIsModalOpen(true); }}
                    className="bg-white rounded-2xl p-4 shadow-soft border border-slate-50 active:scale-[0.98] transition-all relative group"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`px-3 py-0.5 rounded-xl text-[9px] font-bold border ${CATEGORY_COLORS[event.category]}`}>
                            {CATEGORY_ICONS[event.category]} {event.category}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                          className="text-slate-100 hover:text-rose-400 transition-colors p-1"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-1 leading-tight">{event.location}</h3>
                    {event.notes && <p className="text-xs text-slate-400 italic font-medium truncate">{event.notes}</p>}
                </div>
            ))}
            </div>
        </>
        )}
      </div>

      {isModalOpen && selectedDate !== 'PRE_TRIP' && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center">
           <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">{editingId ? '編輯行程' : '新增行程'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 text-xl">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <input type="text" placeholder="去哪裡？" value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full text-lg font-bold py-3 border-b-2 border-slate-100 focus:border-sky-400 outline-none transition-colors" required />
                 </div>
                 <div className="grid grid-cols-3 gap-2">
                    {Object.values(EventCategory).map(cat => (
                        <button key={cat} type="button" onClick={() => setNewCategory(cat)} className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${newCategory === cat ? 'bg-sky-400 text-white border-sky-400 shadow-active' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
                          {CATEGORY_ICONS[cat]} {cat}
                        </button>
                    ))}
                 </div>
                 <textarea placeholder="寫點備註..." value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl h-20 outline-none focus:ring-2 focus:ring-sky-100 text-xs font-bold" />
                 <div className="flex gap-3 pt-2">
                     {editingId && (
                         <button type="button" onClick={() => handleDeleteEvent()} className="px-4 py-4 bg-rose-50 text-rose-500 font-bold rounded-xl active:scale-95 transition-all">
                             <Trash2 size={20} />
                         </button>
                     )}
                     <button type="submit" className="flex-1 py-4 bg-sky-400 text-white text-base font-bold rounded-xl shadow-active active:scale-95 transition-all">
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
