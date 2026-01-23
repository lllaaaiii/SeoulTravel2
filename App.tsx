
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

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'members'), (snapshot) => {
      const fetchedMembers: Member[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Member));
      
      fetchedMembers.sort((a, b) => a.id.localeCompare(b.id));

      if (fetchedMembers.length > 0) {
        setMembers(fetchedMembers);
      } else {
        seedMembers();
      }
    });
    return () => unsubscribe();
  }, []);

  const seedMembers = async () => {
    for (const member of MEMBERS) {
      await setDoc(doc(db, 'members', member.id), member);
    }
  };

  const handleUpdateMemberName = async (id: string, newName: string) => {
    await updateDoc(doc(db, 'members', id), { name: newName });
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
    <div className="h-screen w-full max-w-md mx-auto bg-[#F8FAFC] flex flex-col relative overflow-hidden font-sans">
      {/* Header Area */}
      <header className="px-6 pt-6 pb-2 bg-transparent z-20">
        <div className="flex flex-col">
           <h1 className="text-3xl font-bold text-sky-400 tracking-tight leading-none mb-1 uppercase">Seoul Go!</h1>
           <div className="flex items-center gap-2">
              <div className="bg-amber-400 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-amber-glow">
                時光膠囊
              </div>
              <p className="text-[10px] text-slate-300 font-bold tracking-wider">2026.01.30 - 02.05</p>
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>

      {/* Fixed Bottom Navigation - Updated with new style */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 pb-[env(safe-area-inset-bottom,24px)] pt-2 z-[60]">
        <nav className="bg-white/95 backdrop-blur-md rounded-[32px] shadow-nav p-1 flex justify-between items-center border border-slate-100/50">
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

      {/* Settings FAB */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center border border-slate-100 active:scale-95 transition-all z-30"
      >
         <Settings size={18} className="text-slate-300" />
      </button>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">旅伴設定</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-300 p-1">✕</button>
            </div>
            <div className="space-y-3 mb-8">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 border-2 border-white shadow-sm overflow-hidden`}>
                    <img src={member.avatar} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <input 
                    type="text" 
                    value={member.name}
                    onChange={(e) => handleUpdateMemberName(member.id, e.target.value)}
                    className="flex-1 bg-transparent border-none text-base font-bold text-slate-700 outline-none font-bold"
                  />
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
    <div className={`transition-all duration-300 flex items-center justify-center w-12 h-10 ${active ? 'text-sky-400 scale-110' : 'text-slate-300 group-active:scale-90'}`}>
      <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
    </div>
    <span className={`text-[10px] font-bold transition-colors duration-200 mt-0.5 ${active ? 'text-sky-400' : 'text-slate-400'}`}>
      {label}
    </span>
  </button>
);

export default App;
