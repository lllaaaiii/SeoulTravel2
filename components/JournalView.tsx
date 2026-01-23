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
    <div className="h-full flex flex-col p-6 overflow-y-auto pb-24 no-scrollbar journal-container">
       {/* Slimmed Header Card */}
       <div className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-soft mb-4 border border-slate-50">
          <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
             <PenTool size={20} />
          </div>
          <div className="text-left">
             <h2 className="text-base font-bold text-slate-800">旅途日記</h2>
             <p className="text-slate-400 text-[9px] font-medium tracking-tight">記錄這趟旅程的點點滴滴...</p>
          </div>
       </div>

       {/* Author Selector Section */}
       <div className="mb-3">
          <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-1 block">發布者身份</label>
          <div className="grid grid-cols-5 gap-1.5 py-2">
             {members.map(m => (
                <button
                   key={m.id}
                   onClick={() => setAuthorId(m.id)}
                   className={`flex flex-col items-center gap-1 transition-all duration-300 ${authorId === m.id ? 'scale-110' : 'opacity-40 grayscale'}`}
                >
                   <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 transition-all ${authorId === m.id ? 'border-sky-400 shadow-active' : 'border-white bg-white shadow-xs'}`}>
                       <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
                   </div>
                   <span className={`text-[8px] font-bold truncate w-full text-center ${authorId === m.id ? 'text-sky-500' : 'text-slate-500'}`}>{m.name}</span>
                </button>
             ))}
          </div>
       </div>

       {/* Compact Input Area */}
       <form onSubmit={handleSubmit} className="mb-6 relative">
          <textarea
             value={inputContent}
             onChange={e => setInputContent(e.target.value)}
             placeholder={`${members.find(m => m.id === authorId)?.name || '我'}，今天過得怎麼樣？`}
             className={`w-full p-4 pr-12 rounded-2xl border-2 focus:border-sky-200 outline-none resize-none shadow-soft text-xs min-h-[100px] transition-all ${editingId ? 'border-sky-300 bg-sky-50/50' : 'border-white bg-white'}`}
          />
          <button type="submit" className="absolute bottom-3 right-3 w-9 h-9 bg-sky-400 text-white rounded-lg shadow-lg flex items-center justify-center active:scale-90 transition-transform">
             <Send size={16} />
          </button>
          {editingId && (
              <button type="button" onClick={cancelEdit} className="absolute top-3 right-3 text-slate-300">
                  <X size={18} />
              </button>
          )}
       </form>

       <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
             <div className="h-[1px] flex-1 bg-slate-100"></div>
             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Memories</span>
             <div className="h-[1px] flex-1 bg-slate-100"></div>
          </div>

          {entries.map(entry => {
             const author = members.find(m => m.id === entry.authorId);
             const dateObj = new Date(entry.date);
             const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
             
             return (
               <div key={entry.id} className={`bg-white p-4 rounded-2xl shadow-soft border group transition-all relative ${editingId === entry.id ? 'border-sky-400 ring-2 ring-sky-50' : 'border-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                     <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-100 shadow-xs">
                         <img src={author?.avatar} alt={author?.name} className="w-full h-full object-cover" />
                     </div>
                     <div>
                        <span className="text-xs font-bold text-slate-700 block leading-tight">{author?.name}</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">{dateStr}</span>
                     </div>
                     <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => startEdit(entry)} className="p-1.5 text-slate-200 hover:text-sky-400 hover:bg-sky-50 rounded-lg transition-all"><Pencil size={14} /></button>
                        <button onClick={(e) => handleDelete(e, entry.id)} className="p-1.5 text-slate-200 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><X size={14} /></button>
                     </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs whitespace-pre-wrap font-medium pl-1">
                     {entry.content}
                  </p>
               </div>
             );
          })}
          
          {entries.length === 0 && (
             <div className="text-center py-10 px-8">
                <div className="text-slate-200 mb-2 flex justify-center"><PenTool size={36} strokeWidth={1} /></div>
                <div className="text-slate-300 text-[11px] font-bold">還沒有日記，來寫下第一篇回憶吧！</div>
             </div>
          )}
       </div>
    </div>
  );
};