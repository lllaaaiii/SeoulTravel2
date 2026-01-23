import React, { useState, useEffect } from 'react';
import { Tab, Member } from './types';
import { MEMBERS } from './constants';
import { ScheduleView } from './components/ScheduleView';
import { ExpenseView } from './components/ExpenseView';
import { PlanningView } from './components/PlanningView';
import { JournalView } from './components/JournalView';
import { Calendar, DollarSign, BookOpen, ShoppingBag, Settings } from 'lucide-react';
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
      {/* Header following mockup */}
      <header className="px-8 pt-10 pb-4 bg-transparent z-20">
        <div className="flex flex-col">
           <h1 className="text-[2.5rem] font-bold text-sky-400 tracking-tight leading-none mb-1">Seoul Go!</h1>
           <div className="flex items-center gap-3">
              <div className="bg-sky-400 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
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

      {/* Floating Bottom Navigation */}
      <div className="px-6 pb-8 pt-2">
        <nav className="bg-white rounded-[2rem] shadow-nav p-2 flex justify-between items-center z-50 border border-slate-50">
          <NavButton 
            active={activeTab === Tab.SCHEDULE} 
            onClick={() => setActiveTab(Tab.SCHEDULE)} 
            icon={Calendar} 
            label="行程" 
          />
          <NavButton 
            active={activeTab === Tab.EXPENSE} 
            onClick={() => setActiveTab(Tab.EXPENSE)} 
            icon={DollarSign} 
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
        className="absolute top-10 right-8 w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center border border-slate-100 active:scale-95 transition-all z-30"
      >
         <Settings size={20} className="text-slate-300" />
      </button>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-center">
          <div className="bg-white rounded-t-[3rem] p-8 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">旅伴設定</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-300 p-2">✕</button>
            </div>
            <div className="space-y-4 mb-10">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className={`w-12 h-12 rounded-full flex-shrink-0 border-4 border-white shadow-sm overflow-hidden`}>
                    <img src={member.avatar} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <input 
                    type="text" 
                    value={member.name}
                    onChange={(e) => handleUpdateMemberName(member.id, e.target.value)}
                    className="flex-1 bg-transparent border-none text-lg font-bold text-slate-700 outline-none"
                  />
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-5 bg-sky-400 text-white text-xl font-bold rounded-[2rem] shadow-active active:scale-95 transition-all"
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
    className="flex flex-col items-center justify-center flex-1 py-1"
  >
    <div className={`p-2 rounded-2xl transition-all duration-300 ${active ? 'text-sky-400' : 'text-slate-300'}`}>
      <Icon size={26} strokeWidth={active ? 2.5 : 2} />
    </div>
    <span className={`text-[10px] font-bold transition-colors duration-200 mt-0.5 ${active ? 'text-sky-400' : 'text-slate-300'}`}>
      {label}
    </span>
  </button>
);

export default App;