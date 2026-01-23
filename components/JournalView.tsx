import React, { useState, useEffect } from 'react';
import { PenTool, Send, X, Pencil } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { JournalEntry, Member } from '../types';

interface JournalViewProps {
  members: Member[];
}

export const JournalView: React.FC<JournalViewProps> = ({ members }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  useEffect(() => {
    if (members.length > 0 && !authorId) {
        setAuthorId(members[0].id);
    }
  }, [members, authorId]);

  useEffect(() => {
    const q = query(collection(db, 'journal'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEntries: JournalEntry[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as JournalEntry));
      setEntries(fetchedEntries);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;

    try {
      if (editingId) {
          await updateDoc(doc(db, 'journal', editingId), {
              content: inputContent,
              authorId: authorId,
          });
          setEditingId(null);
      } else {
          await addDoc(collection(db, 'journal'), {
            content: inputContent,
            date: new Date().toISOString(),
            authorId: authorId,
          });
      }
      setInputContent('');
    } catch (error) {
      console.error("Error posting journal: ", error);
    }
  };

  const startEdit = (entry: JournalEntry) => {
      setEditingId(entry.id);
      setInputContent(entry.content);
      setAuthorId(entry.authorId);
      const container = document.querySelector('.journal-container');
      if (container) container.scrollTop = 0;
  }

  const cancelEdit = () => {
      setEditingId(null);
      setInputContent('');
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("確定要刪除這篇日記嗎？")) {
          try {
            await deleteDoc(doc(db, 'journal', id));
            if (editingId === id) cancelEdit();
          } catch (err) {
            console.error("Delete failed:", err);
          }
      }
  }

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto pb-32 no-scrollbar journal-container">
       {/* Slimmed Header Card */}
       <div className="flex items-center gap-4 bg-white rounded-[2rem] p-4 shadow-soft mb-6 border border-slate-50">
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
             <PenTool size={24} />
          </div>
          <div className="text-left">
             <h2 className="text-lg font-bold text-slate-800">旅途日記</h2>
             <p className="text-slate-400 text-[10px] font-medium tracking-tight">記錄這趟旅程的點點滴滴...</p>
          </div>
       </div>

       {/* Author Selector Section - Optimized grid to show all 5 members */}
       <div className="mb-4">
          <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 block">發布者身份</label>
          <div className="grid grid-cols-5 gap-2 py-4">
             {members.map(m => (
                <button
                   key={m.id}
                   onClick={() => setAuthorId(m.id)}
                   className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${authorId === m.id ? 'scale-110' : 'opacity-40 grayscale'}`}
                >
                   <div className={`w-12 h-12 rounded-full border-[3px] flex items-center justify-center p-[1px] transition-all ${authorId === m.id ? 'border-sky-400 shadow-active bg-sky-50' : 'border-white shadow-sm bg-white'}`}>
                       <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
                   </div>
                   <span className={`text-[9px] font-bold truncate w-full text-center ${authorId === m.id ? 'text-sky-500' : 'text-slate-500'}`}>{m.name}</span>
                </button>
             ))}
          </div>
       </div>

       {/* Input Area */}
       <form onSubmit={handleSubmit} className="mb-8 relative">
          <textarea
             value={inputContent}
             onChange={e => setInputContent(e.target.value)}
             placeholder={`${members.find(m => m.id === authorId)?.name || '我'}，今天過得怎麼樣？`}
             className={`w-full p-5 pr-14 rounded-[2rem] border-2 focus:border-sky-200 outline-none resize-none shadow-soft text-sm min-h-[120px] transition-all ${editingId ? 'border-sky-300 bg-sky-50/50' : 'border-white bg-white'}`}
          />
          <button type="submit" className="absolute bottom-4 right-4 w-10 h-10 bg-sky-400 text-white rounded-xl shadow-lg flex items-center justify-center active:scale-90 transition-transform">
             <Send size={18} />
          </button>
          {editingId && (
              <button type="button" onClick={cancelEdit} className="absolute top-4 right-4 text-slate-300">
                  <X size={20} />
              </button>
          )}
       </form>

       <div className="space-y-6">
          <div className="flex items-center gap-2 px-1">
             <div className="h-[1px] flex-1 bg-slate-100"></div>
             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Memories</span>
             <div className="h-[1px] flex-1 bg-slate-100"></div>
          </div>

          {entries.map(entry => {
             const author = members.find(m => m.id === entry.authorId);
             const dateObj = new Date(entry.date);
             const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
             
             return (
               <div key={entry.id} className={`bg-white p-6 rounded-[2.5rem] shadow-soft border group transition-all relative ${editingId === entry.id ? 'border-sky-400 ring-4 ring-sky-50' : 'border-slate-50'}`}>
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-50 shadow-sm">
                         <img src={author?.avatar} alt={author?.name} className="w-full h-full object-cover" />
                     </div>
                     <div>
                        <span className="text-sm font-bold text-slate-700 block leading-tight">{author?.name}</span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase">{dateStr}</span>
                     </div>
                     <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => startEdit(entry)} className="p-2 text-slate-200 hover:text-sky-400 hover:bg-sky-50 rounded-xl transition-all"><Pencil size={16} /></button>
                        <button onClick={(e) => handleDelete(e, entry.id)} className="p-2 text-slate-200 hover:text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><X size={16} /></button>
                     </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap font-medium pl-1">
                     {entry.content}
                  </p>
               </div>
             );
          })}
          
          {entries.length === 0 && (
             <div className="text-center py-20 px-10">
                <div className="text-slate-200 mb-4 flex justify-center"><PenTool size={48} strokeWidth={1} /></div>
                <div className="text-slate-300 text-sm font-bold">還沒有日記，來寫下第一篇回憶吧！</div>
             </div>
          )}
       </div>
    </div>
  );
};