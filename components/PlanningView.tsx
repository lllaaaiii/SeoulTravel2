
import React, { useState, useEffect } from 'react';
import { TodoItem, Member } from '../types';
import { Check, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

interface PlanningViewProps {
  members: Member[];
}

export const PlanningView: React.FC<PlanningViewProps> = ({ members }) => {
  const activeTab = 'shopping';
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (members.length > 0 && !activeMemberId) {
        setActiveMemberId(members[0].id);
    }
  }, [members, activeMemberId]);

  useEffect(() => {
    const q = query(collection(db, 'todos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TodoItem)));
    });
    return () => unsubscribe();
  }, []);

  const activeMember = members.find(m => m.id === activeMemberId);
  const filteredTodos = todos.filter(t => t.ownerId === activeMemberId && t.type === activeTab);

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'todos', id), { completed: !currentStatus });
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !activeMemberId) return;
    
    try {
      await addDoc(collection(db, 'todos'), { 
        text: newItemText, 
        completed: false, 
        ownerId: activeMemberId, 
        type: activeTab, 
        createdAt: new Date().toISOString() 
      });
      setNewItemText('');
    } catch (err) {
      console.error("Add failed:", err);
      alert("新增失敗，請檢查網路連線");
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <div className="bg-amber-100 p-2 rounded-xl"><ShoppingBag size={20} className="text-amber-500" /></div>
        購物清單
      </h2>

      <div className="mb-3">
          <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-1 block">是誰想買？</label>
          <div className="grid grid-cols-5 gap-1.5 py-2">
             {members.map(m => (
                <button
                   key={m.id}
                   onClick={() => setActiveMemberId(m.id)}
                   className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeMemberId === m.id ? 'scale-110' : 'opacity-40 grayscale'}`}
                >
                   <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 transition-all ${activeMemberId === m.id ? 'border-sky-400 shadow-active' : 'border-white bg-white shadow-xs'}`}>
                       <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
                   </div>
                   <span className={`text-[8px] font-bold truncate w-full text-center ${activeMemberId === m.id ? 'text-sky-500' : 'text-slate-500'}`}>{m.name}</span>
                </button>
             ))}
          </div>
       </div>

      <div className="flex-1 bg-white rounded-3xl p-6 shadow-soft border border-slate-50 flex flex-col overflow-hidden">
        <h3 className="text-lg font-bold text-slate-700 mb-4">{activeMember?.name} 的願望</h3>
        
        <form onSubmit={addItem} className="mb-4 relative">
             <input 
                type="text" 
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="想要買什麼？" 
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 outline-none text-xs font-bold text-slate-700"
             />
             <button type="submit" className="absolute right-1.5 top-1.5 w-8 h-8 bg-sky-400 text-white rounded-lg flex items-center justify-center">
               <Plus size={20} />
             </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pb-24">
          {filteredTodos.map(item => (
            <div 
              key={item.id} 
              onClick={() => toggleTodo(item.id, item.completed)}
              className={`flex items-start p-3 rounded-xl cursor-pointer transition-all active:scale-95 ${item.completed ? 'bg-slate-50/50 opacity-50' : 'bg-slate-50 border border-slate-100'}`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 mt-0.5 shrink-0 transition-all ${item.completed ? 'bg-sky-400 border-sky-400' : 'border-slate-300 bg-white'}`}>
                {item.completed && <Check size={12} className="text-white" strokeWidth={4} />}
              </div>
              <span className={`text-xs font-bold flex-1 min-w-0 break-all whitespace-pre-wrap leading-normal ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.text}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); if(window.confirm("確定刪除此清單項目？")) deleteDoc(doc(db, 'todos', item.id)); }} 
                className="text-slate-200 ml-1.5 p-1 hover:text-rose-400 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {filteredTodos.length === 0 && (
             <div className="text-center py-6 text-slate-200 italic font-bold text-[11px]">還沒有心願項目</div>
          )}
        </div>
      </div>
    </div>
  );
};
