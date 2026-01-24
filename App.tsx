
import React, { useState, useEffect } from 'react';
import { Tab, Member } from './types';
import { MEMBERS } from './constants';
import { ScheduleView } from './components/ScheduleView';
import { ExpenseView } from './components/ExpenseView';
import { PlanningView } from './components/PlanningView';
import { JournalView } from './components/JournalView';
import { Calendar, CircleDollarSign, BookOpen, ShoppingBag, Settings } from 'lucide-react';
import { db } from './services/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SCHEDULE);
  const [members, setMembers] = useState<Member[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // 固定嵌入照片網址
  const coverImage = "https://i.postimg.cc/c1zyQDmq/we.png";

  useEffect(() => {
    const unsubscribeMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const fetchedMembers: Member[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Member));
      fetchedMembers.sort((a, b) => a.id.localeCompare(b.id));
      if (fetchedMembers.length > 0) setMembers(fetchedMembers);
      else seedMembers();
    });

    return () => {
      unsubscribeMembers();
    };
  }, []);

  const seedMembers = async () => {
    for (const member of MEMBERS) {
      await setDoc(doc(db, 'members', member.id), member);
    }
  };

  const handleUpdateMemberName = async (id: string, newName: string) => {
    await updateDoc(doc(db, 'members', id), { name: newName });
  };

  const handleMemberAvatarChange = async (memberId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await updateDoc(doc(db, 'members', memberId), { avatar: base64String });
    };
    reader.readAsDataURL(file);
  };

  const renderContent = () => {
    return (
      <div className="page-transition h-full overflow-y-auto no-scrollbar">
        {(() => {
          switch (activeTab) {
            case Tab.SCHEDULE: return <ScheduleView members={members} />;
            case Tab.EXPENSE: return <ExpenseView members={members} />;
            case Tab.PLANNING: return <PlanningView members={members} />;
            case Tab.JOURNAL: return <JournalView members={members} />;
            default: return <ScheduleView members={members} />;
          }
        })()}
      </div>
    );
  };

  return (
    <div className="h-screen w-full max-w-md mx-auto bg-[#FCFBF7] flex flex-col relative overflow-hidden font-sans">
      {/* Header Area */}
      <header className="px-6 pt-10 pb-4 bg-transparent z-20 flex items-center justify-between gap-2">
        <div className="flex flex-col flex-1 min-w-0">
           <h1 className="text-2xl font-black text-sky-400 tracking-tighter leading-none mb-2 uppercase truncate drop-shadow-sm">Seoul Go!</h1>
           <div className="flex flex-col items-start gap-1.5">
              <div className="bg-sky-400 text-brand-100 border border-sky-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm whitespace-nowrap uppercase tracking-widest">
                時光膠囊
              </div>
              <p className="text-[9px] text-slate-400 font-black tracking-widest whitespace-nowrap leading-none pl-0.5">2026.01.30 - 02.05</p>
           </div>
        </div>
        
        {/* 去背效果 Cover Image */}
        <div className="w-36 h-20 shrink-0 relative flex items-center justify-center overflow-visible -my-2">
          <img 
            src={coverImage} 
            alt="Cover" 
            className="h-full w-auto object-contain mix-blend-multiply filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)] transition-transform duration-500 hover:scale-110 active:scale-95" 
          />
        </div>

        {/* Settings Button */}
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm shadow-soft flex items-center justify-center border border-white active:scale-95 transition-all shrink-0"
        >
           <Settings size={20} className="text-slate-300" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 pb-[env(safe-area-inset-bottom,16px)] pt-2 z-[60]">
        <nav className="bg-white/90 backdrop-blur-md rounded-[24px] shadow-nav p-0.5 flex justify-between items-center border border-slate-100/50">
          <NavButton 
            active={activeTab === Tab.SCHEDULE} 
            onClick={() => setActiveTab(Tab.SCHEDULE)} 
            icon={Calendar} 
            label="行程" 
          />
          <NavButton 
            active={activeTab === Tab.EXPENSE} 
            onClick={() => setActiveTab(Tab.EXPENSE)} 
            icon={CircleDollarSign} 
            label="記帳" 
          />
          <NavButton 
            active={activeTab === Tab.PLANNING} 
            onClick={() => setActiveTab(Tab.PLANNING)} 
            icon={ShoppingBag} 
            label="購物" 
          />
          <NavButton 
            active={activeTab === Tab.JOURNAL} 
            onClick={() => setActiveTab(Tab.JOURNAL)} 
            icon={BookOpen} 
            label="日誌" 
          />
        </nav>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-center">
          <div className="bg-white rounded-t-[32px] p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">旅伴設定</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-300 p-1 text-xl">✕</button>
            </div>
            <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto no-scrollbar">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-3 bg-slate-50 p-2 pr-4 rounded-2xl border border-slate-100">
                  <label className="relative cursor-pointer group shrink-0">
                    <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white flex items-center justify-center">
                      <img src={member.avatar} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleMemberAvatarChange(member.id, e)}
                    />
                  </label>
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-slate-300 uppercase tracking-widest block ml-1 mb-0.5">旅伴姓名</label>
                    <input 
                      type="text" 
                      value={member.name}
                      onChange={(e) => handleUpdateMemberName(member.id, e.target.value)}
                      className="w-full bg-white px-3 py-1.5 rounded-xl text-sm font-bold text-slate-700 outline-none border border-slate-100 focus:border-sky-200 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-4 bg-sky-400 text-white text-lg font-bold rounded-2xl shadow-active active:scale-95 transition-all"
            >
              完成設定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center flex-1 py-1 group"
  >
    <div className={`transition-all duration-300 flex items-center justify-center w-8 h-8 ${active ? 'text-sky-400 scale-110' : 'text-slate-300 group-active:scale-90'}`}>
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    </div>
    <span className={`text-[10px] font-bold transition-colors duration-200 mt-0.5 ${active ? 'text-sky-400' : 'text-slate-400'}`}>
      {label}
    </span>
  </button>
);

export default App;
