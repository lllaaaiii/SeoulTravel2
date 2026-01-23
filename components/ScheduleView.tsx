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
      {/* Date Picker - Scaled down */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-8 py-3 mb-2">
        {dates.map((d) => (
          <button
            key={d.val}
            onClick={() => setSelectedDate(d.val)}
            className={`flex-shrink-0 flex flex-col items-center justify-center w-[56px] h-[76px] rounded-2xl transition-all duration-300 ${
              selectedDate === d.val
                ? 'bg-white border-[2px] border-sky-400 shadow-active scale-105'
                : 'bg-slate-50 border-[2px] border-transparent text-slate-300'
            }`}
          >
            {d.val === 'PRE_TRIP' ? (
              <>
                <span className="text-[8px] font-bold text-slate-400 mb-0.5">PRE</span>
                <span className="text-lg">📝</span>
              </>
            ) : (
              <>
                <span className="text-[8px] font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">DAY</span>
                <span className={`text-lg font-bold mb-0.5 ${selectedDate === d.val ? 'text-sky-500' : 'text-slate-300'}`}>{d.display}</span>
                <span className="text-[8px] font-bold">{d.date}</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-32 space-y-6">
        {selectedDate === 'PRE_TRIP' ? (
             <div className="space-y-4">
                 <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50">
                     <h3 className="text-xl font-bold text-slate-800 mb-6">行前準備</h3>
                     <form onSubmit={handleAddPreTripTask} className="relative mb-6">
                        <input 
                           type="text" 
                           placeholder="新增準備事項..." 
                           value={newTaskTitle}
                           onChange={e => setNewTaskTitle(e.target.value)}
                           className="w-full pl-5 pr-14 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-sky-100 outline-none text-sm font-medium"
                        />
                        <button type="submit" className="absolute right-2 top-2 w-10 h-10 bg-sky-400 text-white rounded-xl flex items-center justify-center">
                           <Plus size={24} />
                        </button>
                     </form>
                     <div className="space-y-4">
                        {preTripTasks.map(task => (
                            <div key={task.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                <div className="flex justify-between items-center mb-5">
                                    <span className="font-bold text-slate-700">{task.title}</span>
                                    <button onClick={() => deletePreTripTask(task.id)} className="text-slate-200 p-1 hover:text-rose-400">
                                      <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-start w-full px-1">
                                    {members.map(member => {
                                        const isDone = task.completedBy.includes(member.id);
                                        return (
                                            <button 
                                                key={member.id}
                                                onClick={() => toggleTaskCompletion(task.id, member.id, isDone)}
                                                className="flex flex-col items-center shrink-0 gap-1.5 w-12"
                                            >
                                                <div className={`w-10 h-10 rounded-full border-2 overflow-hidden relative transition-all ${isDone ? 'border-sky-400 ring-2 ring-sky-50' : 'border-slate-100 grayscale opacity-40'}`}>
                                                    <img src={member.avatar} className="w-full h-full object-cover" alt={member.name}/>
                                                    {isDone && (
                                                        <div className="absolute inset-0 bg-sky-400/40 flex items-center justify-center">
                                                            <Check size={18} className="text-white drop-shadow-md" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[9px] font-bold truncate w-full text-center ${isDone ? 'text-sky-500' : 'text-slate-300'}`}>{member.name}</span>
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
            {selectedDate === '2026-01-30' && (
              <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-sky-100 p-6 shadow-soft relative overflow-hidden mb-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="bg-sky-100 text-sky-500 text-[10px] font-bold px-3 py-1 rounded-full">去程</div>
                  <div className="text-sky-400 text-[10px] font-bold tracking-widest uppercase">TPE → ICN</div>
                </div>
                <div className="flex items-center justify-between px-2 mb-4">
                  <div className="text-center">
                    <h4 className="text-3xl font-bold text-slate-700">TPE</h4>
                    <div className="bg-slate-50 px-3 py-1 rounded-full text-xs text-slate-400 mt-2">20:00</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-4 relative">
                    <Plane size={18} className="text-sky-400 mb-1" />
                    <div className="w-full h-[2px] bg-sky-100 flex items-center justify-between">
                       <div className="w-2 h-2 rounded-full bg-sky-400 -ml-1"></div>
                       <div className="w-2 h-2 rounded-full bg-sky-400 -mr-1"></div>
                    </div>
                    <span className="text-[10px] text-slate-300 mt-2 font-bold tracking-wider">IT 602</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-3xl font-bold text-slate-700">ICN</h4>
                    <div className="bg-slate-50 px-3 py-1 rounded-full text-xs text-slate-400 mt-2">23:30</div>
                  </div>
                </div>
              </div>
            )}

            <button 
                onClick={() => { setEditingId(null); setNewLocation(''); setNewNotes(''); setIsModalOpen(true); }}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-5 rounded-[2rem] shadow-lg flex items-center justify-center space-x-2 active:scale-[0.98] transition-all mb-8"
            >
              <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                <Plus size={16} strokeWidth={3} />
              </div>
              <span className="text-lg">新增一個行程</span>
            </button>

            <div className="space-y-4">
            {filteredEvents.map((event) => (
                <div 
                    key={event.id}
                    onClick={() => { setEditingId(event.id); setNewLocation(event.location); setNewCategory(event.category); setNewNotes(event.notes || ''); setIsModalOpen(true); }}
                    className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-50 active:scale-[0.98] transition-all relative group"
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className={`px-4 py-1 rounded-2xl text-[10px] font-bold border ${CATEGORY_COLORS[event.category]}`}>
                            {CATEGORY_ICONS[event.category]} {event.category}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                          className="text-slate-200 hover:text-rose-400 transition-colors p-1"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">{event.location}</h3>
                    {event.notes && <p className="text-sm text-slate-400 italic font-medium">{event.notes}</p>}
                </div>
            ))}
            </div>
        </>
        )}
      </div>

      {isModalOpen && selectedDate !== 'PRE_TRIP' && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center">
           <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">{editingId ? '編輯行程' : '新增行程'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 text-2xl">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <input type="text" placeholder="去哪裡？" value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full text-xl font-bold py-4 border-b-2 border-slate-100 focus:border-sky-400 outline-none transition-colors" required />
                 </div>
                 <div className="grid grid-cols-3 gap-2">
                    {Object.values(EventCategory).map(cat => (
                        <button key={cat} type="button" onClick={() => setNewCategory(cat)} className={`py-3 rounded-2xl text-xs font-bold border transition-all ${newCategory === cat ? 'bg-sky-400 text-white border-sky-400 shadow-active' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
                          {CATEGORY_ICONS[cat]} {cat}
                        </button>
                    ))}
                 </div>
                 <textarea placeholder="寫點備註..." value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl h-24 outline-none focus:ring-2 focus:ring-sky-100 text-sm" />
                 <div className="flex gap-3 pt-4">
                     {editingId && (
                         <button type="button" onClick={() => handleDeleteEvent()} className="px-6 py-5 bg-rose-50 text-rose-500 font-bold rounded-[1.5rem] active:scale-95 transition-all">
                             <Trash2 size={24} />
                         </button>
                     )}
                     <button type="submit" className="flex-1 py-5 bg-sky-400 text-white text-lg font-bold rounded-[1.5rem] shadow-active active:scale-95 transition-all">
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