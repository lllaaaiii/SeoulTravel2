
import React, { useState, useEffect } from 'react';
import { Expense, Member, EventCategory } from '../types';
import { CATEGORY_ICONS } from '../constants';
import { Plus, Users, Calendar, X, ChevronRight, Trash2, Check, Landmark, ArrowRight, ExternalLink, Clock, ChevronDown, Tag } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, setDoc, getDoc } from 'firebase/firestore';

interface ExpenseViewProps {
  members: Member[];
}

export const ExpenseView: React.FC<ExpenseViewProps> = ({ members }) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'settle'>('list');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0.0245);
  
  // 自定義分類狀態
  const [customCategories, setCustomCategories] = useState<Record<string, string>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('💸');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null); 
  
  const [amountInput, setAmountInput] = useState('');
  const [inputCurrency, setInputCurrency] = useState<'KRW' | 'TWD'>('KRW');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(EventCategory.FOOD);
  const [payer, setPayer] = useState('');
  const [selectedSplits, setSelectedSplits] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('');

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'settings'));
        if (configDoc.exists()) {
          if (configDoc.data().exchangeRate) setExchangeRate(configDoc.data().exchangeRate);
          if (configDoc.data().customCategories) setCustomCategories(configDoc.data().customCategories);
        }
      } catch (e) { console.warn("Fetch settings error:", e); }
    };
    fetchConfig();
  }, []);

  const handleRateChange = async (newVal: string) => {
    const rate = parseFloat(newVal);
    setExchangeRate(rate || 0);
    if (rate > 0) await setDoc(doc(db, 'config', 'settings'), { exchangeRate: rate }, { merge: true });
  };

  useEffect(() => {
    if (members.length > 0 && !payer) {
      setPayer(members[0].id);
      setSelectedSplits(members.map(m => m.id));
    }
  }, [members, payer]);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      fetched.sort((a, b) => {
        if (a.date === b.date) return (b.time || '00:00').localeCompare(a.time || '00:00');
        return 0;
      });
      setExpenses(fetched);
    });
    return () => unsubscribe();
  }, []);

  const allCategories = { ...CATEGORY_ICONS, ...customCategories };

  const handleAddNewCategory = async () => {
    if (!newCatName.trim()) return;
    const updated = { ...customCategories, [newCatName.trim()]: newCatEmoji };
    setCustomCategories(updated);
    setCategory(newCatName.trim());
    setIsAddingCategory(false);
    setNewCatName('');
    await setDoc(doc(db, 'config', 'settings'), { customCategories: updated }, { merge: true });
  };

  const openAddModal = () => {
    setEditingId(null);
    setAmountInput('');
    setInputCurrency('KRW');
    setDescription('');
    setCategory(EventCategory.FOOD);
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewTime(getCurrentTime());
    setIsAddingCategory(false);
    if (members.length > 0) {
      setPayer(members[0].id);
      setSelectedSplits(members.map(m => m.id));
    }
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingId(exp.id);
    setInputCurrency(exp.currency || 'KRW');
    setAmountInput(exp.currency === 'KRW' ? exp.amountKRW.toString() : exp.amountTWD.toString());
    setDescription(exp.description);
    setCategory(exp.category);
    setPayer(exp.payerId);
    setSelectedSplits(exp.splitWithIds);
    setNewDate(exp.date);
    setNewTime(exp.time || '00:00');
    setIsAddingCategory(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const inputVal = parseFloat(amountInput);
    if (!amountInput || isNaN(inputVal) || !description.trim()) { alert("請輸入金額與描述！"); return; }
    if (selectedSplits.length === 0) { alert("請選擇分帳人！"); return; }
    
    let amountKRW = 0, amountTWD = 0;
    const safeRate = exchangeRate || 0.0245;

    if (inputCurrency === 'KRW') {
        amountKRW = Math.round(inputVal);
        amountTWD = Math.round(inputVal * safeRate);
    } else {
        amountTWD = Math.round(inputVal);
        amountKRW = Math.round(inputVal / safeRate);
    }
    
    const data = { 
      amountKRW, amountTWD, currency: inputCurrency, category, 
      description: description.trim(), payerId: payer, splitWithIds: selectedSplits, 
      date: newDate, time: newTime || '00:00', timestamp: new Date().toISOString() 
    };

    if (editingId) await updateDoc(doc(db, 'expenses', editingId), data);
    else await addDoc(collection(db, 'expenses'), data);
    setIsModalOpen(false);
  };

  const calculateSettlement = () => {
    const balances: Record<string, number> = {};
    const shareTotals: Record<string, number> = {};
    members.forEach(m => { balances[m.id] = 0; shareTotals[m.id] = 0; });
    expenses.forEach(exp => {
        const currentTWD = exp.currency === 'KRW' ? Math.round(exp.amountKRW * exchangeRate) : exp.amountTWD;
        balances[exp.payerId] += currentTWD;
        const splitCount = exp.splitWithIds.length;
        if (splitCount > 0) {
            const share = currentTWD / splitCount;
            exp.splitWithIds.forEach(id => { if (balances[id] !== undefined) { balances[id] -= share; shareTotals[id] += share; } });
        }
    });
    const debtors: {id: string, amount: number}[] = [], creditors: {id: string, amount: number}[] = [];
    Object.entries(balances).forEach(([id, amount]) => { if (amount < -1) debtors.push({ id, amount }); else if (amount > 1) creditors.push({ id, amount }); });
    debtors.sort((a, b) => a.amount - b.amount); creditors.sort((a, b) => b.amount - a.amount);
    const transactions: {from: string, to: string, amount: number}[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const d = debtors[i], c = creditors[j], amt = Math.min(Math.abs(d.amount), c.amount);
        transactions.push({ from: d.id, to: c.id, amount: Math.round(amt) });
        d.amount += amt; c.amount -= amt;
        if (Math.abs(d.amount) < 1) i++; if (c.amount < 1) j++;
    }
    return { transactions, shareTotals };
  };

  const settlement = calculateSettlement();
  const expensesByDate: Record<string, Expense[]> = {};
  expenses.forEach(exp => { if (!expensesByDate[exp.date]) expensesByDate[exp.date] = []; expensesByDate[exp.date].push(exp); });
  const sortedDates = Object.keys(expensesByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="h-full flex flex-col no-scrollbar">
      <div className="px-6 pt-4">
        <div className="bg-slate-100 p-1 rounded-xl flex shadow-sm">
            <button onClick={() => setActiveSubTab('list')} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSubTab === 'list' ? 'bg-white text-sky-400 shadow-sm' : 'text-slate-400'}`}>支出明細</button>
            <button onClick={() => setActiveSubTab('settle')} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSubTab === 'settle' ? 'bg-white text-sky-400 shadow-sm' : 'text-slate-400'}`}>結算 & 統計</button>
        </div>
      </div>

      {activeSubTab === 'list' ? (
        <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 pt-4 no-scrollbar">
            <div className="flex justify-between items-center px-1">
               <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">TIMELINE</h3>
               <button onClick={openAddModal} className="bg-sky-400 text-white p-2.5 rounded-xl shadow-active active:scale-90 transition-transform"><Plus size={18} strokeWidth={3}/></button>
            </div>
            {sortedDates.map(date => (
                <div key={date} className="space-y-2">
                    <div className="text-[10px] font-bold text-sky-400 flex items-center gap-1.5 mb-1 px-1 uppercase tracking-tighter"><Calendar size={10}/> {date}</div>
                    <div className="space-y-2.5">
                    {expensesByDate[date].map(exp => {
                      const payerM = members.find(m => m.id === exp.payerId);
                      const currentTWD = exp.currency === 'KRW' ? Math.round(exp.amountKRW * exchangeRate) : exp.amountTWD;
                      const splitMembers = members.filter(m => exp.splitWithIds.includes(m.id));
                      return (
                          <div key={exp.id} onClick={() => openEditModal(exp)} className="bg-white py-4 px-4 rounded-2xl shadow-soft border border-slate-50 flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all relative">
                          <div className="flex justify-between items-start">
                              <div className="flex gap-3">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-slate-50 border border-slate-100 shadow-xs shrink-0">{(allCategories as any)[exp.category] || '💸'}</div>
                                  <div>
                                    <div className="text-sm font-bold text-slate-700 leading-tight mb-1">{exp.description}</div>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[9px] font-bold text-slate-400 tracking-tight">By <span className="text-sky-400">{payerM?.name}</span></span>
                                    </div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="flex items-center justify-end gap-1 text-[8px] font-black text-slate-300 uppercase mb-1">
                                    <Clock size={8} /> {exp.time || '--:--'}
                                  </div>
                                  <div className="text-sm font-black text-slate-800 tracking-tight leading-none mb-0.5">₩{exp.amountKRW.toLocaleString()}</div>
                                  <div className="text-[9px] font-black text-sky-400 uppercase tracking-tighter leading-none">NT$ {currentTWD.toLocaleString()}</div>
                              </div>
                          </div>
                          <div className="flex items-center pt-2 border-t border-slate-50">
                              <div className="flex flex-wrap gap-1.5 flex-1">
                                  {splitMembers.map(sm => (
                                      <img key={sm.id} src={sm.avatar} className="h-5 w-5 rounded-full ring-1 ring-slate-100 shadow-xs bg-white" alt={sm.name} />
                                  ))}
                              </div>
                              <span className="text-[8px] font-black text-slate-200 uppercase tracking-widest pl-2 italic shrink-0">{exp.splitWithIds.length} 參與者</span>
                          </div>
                          </div>
                      );
                    })}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-24 pt-4 space-y-5 no-scrollbar">
            {/* 結算介面 */}
            <div className="bg-sky-50 rounded-2xl p-5 border border-sky-100 shadow-soft">
                <div className="flex justify-between items-center mb-4 gap-2">
                   <h4 className="text-sky-500 text-[10px] font-black tracking-tight uppercase shrink-0">匯率設定</h4>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-slate-600 text-[10px] font-black leading-none uppercase shrink-0">1 KRW ≈</div>
                   <div className="flex-1 min-w-0 bg-white border border-sky-400/20 rounded-xl px-2 h-12 flex items-center shadow-sm">
                      <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => handleRateChange(e.target.value)} className="w-full text-center text-sky-500 text-lg font-black bg-transparent outline-none" />
                   </div>
                   <div className="text-slate-600 text-[10px] font-black leading-none uppercase shrink-0">TWD</div>
                </div>
            </div>
            <div>
                <h3 className="text-slate-600 text-sm font-bold mb-3 px-1">統一結算報表 (TWD)</h3>
                <div className="bg-white rounded-2xl shadow-soft border border-slate-50 overflow-hidden">
                    <div className="divide-y divide-slate-50">
                    {settlement.transactions.map((t, idx) => {
                        const from = members.find(m => m.id === t.from), to = members.find(m => m.id === t.to);
                        return (
                            <div key={idx} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-1 flex-1">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shadow-xs"><img src={from?.avatar} /></div>
                                    <div className="flex-shrink-0 px-1"><ArrowRight size={14} className="text-slate-200" /></div>
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shadow-xs"><img src={to?.avatar} /></div>
                                </div>
                                <div className="text-right ml-2">
                                    <div className="font-black text-sky-400 text-base">NT$ {t.amount.toLocaleString()}</div>
                                </div>
                            </div>
                        )
                    })}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 新增/編輯彈窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-end justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold text-slate-800">{editingId ? '編輯款項' : '新增支出'}</h2><button onClick={() => setIsModalOpen(false)} className="text-slate-300 text-xl">✕</button></div>
                
                <div className="space-y-4">
                    <div className="flex gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex-1 min-w-0"><label className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1 block px-1">金額</label><input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none" placeholder="0" /></div>
                        <div className="flex bg-white rounded-xl p-1 shadow-xs border border-slate-100 shrink-0">
                             <button onClick={() => setInputCurrency('KRW')} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${inputCurrency === 'KRW' ? 'bg-sky-400 text-white' : 'text-slate-400'}`}>KRW</button>
                             <button onClick={() => setInputCurrency('TWD')} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${inputCurrency === 'TWD' ? 'bg-sky-400 text-white' : 'text-slate-400'}`}>TWD</button>
                        </div>
                    </div>

                    {/* 下拉式選單分類選擇器 */}
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">支出分類</label>
                        <div className="relative">
                            <select 
                                value={category} 
                                onChange={(e) => {
                                    if (e.target.value === 'ADD_NEW') { setIsAddingCategory(true); } 
                                    else { setCategory(e.target.value); setIsAddingCategory(false); }
                                }}
                                className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 border-none outline-none appearance-none pr-10 focus:ring-1 focus:ring-sky-100"
                            >
                                {Object.entries(allCategories).map(([name, emoji]) => (
                                    <option key={name} value={name}>{emoji} {name}</option>
                                ))}
                                <option value="ADD_NEW" className="text-sky-400 font-bold">+ 新增自定義分類...</option>
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                    </div>

                    {isAddingCategory && (
                        <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[8px] font-bold text-sky-400 mb-1 block">分類名稱</label>
                                    <input type="text" placeholder="例: 甜點" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full p-2 bg-white rounded-lg text-xs font-bold outline-none border border-sky-100 focus:border-sky-300" />
                                </div>
                                <div className="w-12">
                                    <label className="text-[8px] font-bold text-sky-400 mb-1 block">圖示</label>
                                    <input type="text" placeholder="🍔" value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} className="w-full p-2 bg-white rounded-lg text-center text-xs outline-none border border-sky-100" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsAddingCategory(false)} className="flex-1 py-1.5 bg-white text-slate-400 text-[10px] font-bold rounded-lg border border-slate-100">取消</button>
                                <button onClick={handleAddNewCategory} className="flex-1 py-1.5 bg-sky-400 text-white text-[10px] font-bold rounded-lg shadow-sm">新增分類</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 block ml-1">日期</label><input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none" /></div>
                        <div><label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 block ml-1">時間</label><input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none" /></div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">描述</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 focus:ring-sky-100" placeholder="這筆錢花在哪？" />
                    </div>

                    <div>
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 block ml-1">誰付錢？</label>
                        <div className="grid grid-cols-5 gap-2">
                            {members.map(m => (
                                <button key={m.id} onClick={() => setPayer(m.id)} className={`flex flex-col items-center gap-1 transition-all ${payer === m.id ? 'scale-105' : 'opacity-40 grayscale'}`}>
                                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 ${payer === m.id ? 'border-sky-400 shadow-active' : 'border-white bg-white shadow-xs'}`}><img src={m.avatar} className="w-full h-full rounded-full object-cover" /></div>
                                    <span className={`text-[8px] font-bold truncate w-full text-center ${payer === m.id ? 'text-sky-400' : 'text-slate-500'}`}>{m.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 block ml-1">分帳人</label>
                        <div className="grid grid-cols-5 gap-2">
                            {members.map(m => {
                                const isSel = selectedSplits.includes(m.id);
                                return (
                                    <button key={m.id} onClick={() => {
                                      if (isSel) { if (selectedSplits.length > 1) setSelectedSplits(selectedSplits.filter(s => s !== m.id)); } 
                                      else setSelectedSplits([...selectedSplits, m.id]);
                                    }} className={`flex flex-col items-center gap-1 transition-all ${isSel ? 'scale-105' : 'opacity-40 grayscale'}`}>
                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 relative transition-all ${isSel ? 'border-sky-400 shadow-active' : 'border-white bg-white shadow-xs'}`}>
                                            <img src={m.avatar} className="w-full h-full rounded-full object-cover" />
                                            {isSel && <div className="absolute inset-0 bg-sky-400/20 flex items-center justify-center rounded-full"><Check size={14} className="text-white drop-shadow-md" strokeWidth={4} /></div>}
                                        </div>
                                        <span className={`text-[8px] font-bold truncate w-full text-center ${isSel ? 'text-sky-400' : 'text-slate-500'}`}>{m.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-3 mt-8">
                    {editingId && <button onClick={async () => { if (window.confirm("確定刪除？")) { await deleteDoc(doc(db, 'expenses', editingId)); setIsModalOpen(false); } }} className="p-4 bg-rose-50 text-rose-500 font-bold rounded-2xl active:scale-90 transition-all"><Trash2 size={20} /></button>}
                    <button onClick={handleSave} className="flex-1 py-4 bg-sky-400 text-white text-base font-bold rounded-2xl shadow-active active:scale-95 transition-all">{editingId ? '儲存變更' : '確定新增'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
