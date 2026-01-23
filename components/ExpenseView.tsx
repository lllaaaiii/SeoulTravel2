
import React, { useState, useEffect } from 'react';
import { Expense, Member, EventCategory } from '../types';
import { CATEGORY_ICONS } from '../constants';
import { Plus, Users, Calendar, X, ChevronRight, Trash2, Check, Landmark, ArrowRight, ExternalLink } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, setDoc, getDoc } from 'firebase/firestore';

interface ExpenseViewProps {
  members: Member[];
}

export const ExpenseView: React.FC<ExpenseViewProps> = ({ members }) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'settle'>('list');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0.0245);
  
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

  useEffect(() => {
    const fetchConfig = async () => {
      const configDoc = await getDoc(doc(db, 'config', 'settings'));
      if (configDoc.exists() && configDoc.data().exchangeRate) {
        setExchangeRate(configDoc.data().exchangeRate);
      }
    };
    fetchConfig();
  }, []);

  const handleRateChange = async (newVal: string) => {
    const rate = parseFloat(newVal);
    setExchangeRate(rate || 0);
    if (rate > 0) {
      await setDoc(doc(db, 'config', 'settings'), { exchangeRate: rate }, { merge: true });
    }
  };

  useEffect(() => {
    if (members.length > 0) {
        if (!payer) setPayer(members[0].id);
        if (selectedSplits.length === 0 && !editingId) setSelectedSplits(members.map(m => m.id));
    }
  }, [members, editingId]);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setAmountInput('');
    setInputCurrency('KRW');
    setDescription('');
    setCategory(EventCategory.FOOD);
    setNewDate(new Date().toISOString().split('T')[0]);
    setSelectedSplits(members.map(m => m.id));
    setPayer(members[0].id);
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
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!amountInput || !description) return;
    if (selectedSplits.length === 0) { alert("請至少選擇一位分帳人！"); return; }
    
    let amountKRW = 0, amountTWD = 0;
    const inputVal = parseInt(amountInput);
    if (inputCurrency === 'KRW') {
        amountKRW = inputVal;
        amountTWD = Math.round(inputVal * exchangeRate);
    } else {
        amountTWD = inputVal;
        amountKRW = Math.round(inputVal / exchangeRate);
    }
    
    const data = { amountKRW, amountTWD, currency: inputCurrency, category, description, payerId: payer, splitWithIds: selectedSplits, date: newDate, timestamp: new Date().toISOString() };

    try {
      if (editingId) await updateDoc(doc(db, 'expenses', editingId), data);
      else await addDoc(collection(db, 'expenses'), data);
      setIsModalOpen(false);
    } catch (error) { console.error(error); }
  };

  const calculateSettlement = () => {
    const balances: Record<string, number> = {};
    const paidTotals: Record<string, number> = {};
    const shareTotals: Record<string, number> = {};
    members.forEach(m => { balances[m.id] = 0; paidTotals[m.id] = 0; shareTotals[m.id] = 0; });
    expenses.forEach(exp => {
        const amount = exp.amountTWD; balances[exp.payerId] += amount; paidTotals[exp.payerId] += amount;
        const splitCount = exp.splitWithIds.length;
        if (splitCount > 0) {
            const share = amount / splitCount;
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
    return { transactions, paidTotals, shareTotals };
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
                    <div className="space-y-2">
                    {expensesByDate[date].map(exp => {
                    const payerM = members.find(m => m.id === exp.payerId);
                    return (
                        <div key={exp.id} onClick={() => openEditModal(exp)} className="bg-white py-3 px-4 rounded-2xl shadow-soft border border-slate-50 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-slate-50 border border-slate-100 shadow-xs">{(CATEGORY_ICONS as any)[exp.category] || '💸'}</div>
                            <div>
                              <div className="text-sm font-bold text-slate-700 leading-tight mb-0.5">{exp.description}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-slate-400 tracking-tight">By <span className="text-sky-400">{payerM?.name}</span></span>
                                <div className="flex -space-x-1.5 ml-1">
                                  {exp.splitWithIds.map(id => <img key={id} src={members.find(m => m.id === id)?.avatar} className="w-4 h-4 rounded-full border border-white bg-slate-50 shadow-xs" />)}
                                </div>
                              </div>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-slate-800 tracking-tight">₩{exp.amountKRW.toLocaleString()}</div>
                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">NT$ {exp.amountTWD.toLocaleString()}</div>
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
            {/* 修改點：改為淺藍色背景 (bg-sky-50) 並將標題改為中文 */}
            <div className="bg-sky-50 rounded-2xl p-5 border border-sky-100 shadow-soft">
                <div className="flex justify-between items-center mb-4">
                   <h4 className="text-sky-500 text-[11px] font-black tracking-tight uppercase">匯率設定</h4>
                   <a 
                     href="https://rate.bot.com.tw/xrt?Lang=zh-TW" 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="bg-white text-sky-400 text-[9px] font-bold px-3 py-1.5 rounded-lg border border-sky-400/20 shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                   >
                      <Landmark size={10} /> 臺銀牌告匯率 <ExternalLink size={10} />
                   </a>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-slate-600 text-[11px] font-black leading-none uppercase shrink-0">1 KRW ≈</div>
                   <div className="flex-1 bg-white border border-sky-400/20 rounded-xl px-4 h-12 flex items-center shadow-sm">
                      <input 
                         type="number" 
                         step="0.0001"
                         value={exchangeRate} 
                         onChange={(e) => handleRateChange(e.target.value)}
                         className="flex-1 text-center text-sky-500 text-xl font-black bg-transparent outline-none"
                      />
                   </div>
                   <div className="text-slate-600 text-[11px] font-black leading-none uppercase shrink-0">TWD</div>
                </div>
            </div>

            {/* 統一結算報表 */}
            <div>
                <h3 className="text-slate-600 text-sm font-bold mb-3 px-1">統一結算報表 (TWD)</h3>
                <div className="bg-white rounded-2xl shadow-soft border border-slate-50 overflow-hidden">
                    <div className="divide-y divide-slate-50">
                    {settlement.transactions.map((t, idx) => {
                        const from = members.find(m => m.id === t.from), to = members.find(m => m.id === t.to);
                        return (
                            <div key={idx} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 flex-1 max-w-[150px]">
                                    <div className="flex flex-col items-center gap-1 w-12 shrink-0">
                                        <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shadow-xs"><img src={from?.avatar} /></div>
                                        <span className="text-rose-400 font-bold text-[9px] truncate w-full text-center">{from?.name}</span>
                                    </div>
                                    <div className="flex-shrink-0 mx-0.5">
                                       <ArrowRight size={14} className="text-slate-200" />
                                    </div>
                                    <div className="flex flex-col items-center gap-1 w-12 shrink-0">
                                        <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shadow-xs"><img src={to?.avatar} /></div>
                                        <span className="text-emerald-500 font-bold text-[9px] truncate w-full text-center">{to?.name}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-slate-300 text-[9px] font-bold mb-0.5 uppercase tracking-tighter">Settlement</div>
                                    <div className="font-black text-sky-400 text-base tracking-tight leading-none">NT$ {t.amount.toLocaleString()}</div>
                                </div>
                            </div>
                        )
                    })}
                    {settlement.transactions.length === 0 && <div className="text-center text-slate-200 py-8 text-[11px] font-bold uppercase tracking-widest italic">All balanced!</div>}
                    </div>
                </div>
            </div>

            {/* 個人總額統計 */}
            <div>
                <h3 className="text-slate-600 text-sm font-bold mb-3 px-1">個人分攤統計</h3>
                <div className="space-y-2">
                    {members.map(m => (
                        <div key={m.id} onClick={() => setDetailMemberId(m.id)} className="bg-white p-3 rounded-2xl shadow-soft border border-slate-50 flex items-center justify-between cursor-pointer active:scale-[0.98] group">
                            <div className="flex items-center gap-3">
                                <img src={m.avatar} className="w-8 h-8 rounded-full border border-slate-50 shadow-xs"/>
                                <div className="text-sm font-bold text-slate-700">{m.name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-base font-bold text-sky-400 tracking-tight">NT$ {Math.round(settlement.shareTotals[m.id]).toLocaleString()}</div>
                                <ChevronRight className="text-slate-100 group-hover:text-sky-400 transition-colors" size={16}/>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 新增/編輯視窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-end justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold text-slate-800">{editingId ? '編輯款項' : '新增支出'}</h2><button onClick={() => setIsModalOpen(false)} className="text-slate-300 text-xl">✕</button></div>
                <div className="space-y-4">
                    <div className="flex gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex-1"><label className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1 block px-1">Amount</label><input type="number" inputMode="numeric" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none" placeholder="0" /></div>
                        <div className="flex bg-white rounded-xl p-1 shadow-xs border border-slate-100">
                             <button onClick={() => setInputCurrency('KRW')} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${inputCurrency === 'KRW' ? 'bg-sky-400 text-white' : 'text-slate-400'}`}>KRW</button>
                             <button onClick={() => setInputCurrency('TWD')} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${inputCurrency === 'TWD' ? 'bg-sky-400 text-white' : 'text-slate-400'}`}>TWD</button>
                        </div>
                    </div>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 focus:ring-sky-200" placeholder="這筆錢花在哪？" />
                    <div>
                        <label className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 block ml-1">誰付錢？</label>
                        <div className="grid grid-cols-5 gap-2">
                            {members.map(m => (
                                <button key={m.id} onClick={() => setPayer(m.id)} className={`flex flex-col items-center gap-1 transition-all ${payer === m.id ? 'scale-105' : 'opacity-40 grayscale'}`}>
                                    {/* Fix: use m.avatar instead of member.avatar */}
                                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 transition-all ${payer === m.id ? 'border-sky-400 shadow-active' : 'border-white bg-white'}`}><img src={m.avatar} className="w-full h-full rounded-full object-cover" /></div>
                                    <span className={`text-[8px] font-bold truncate w-full text-center ${payer === m.id ? 'text-sky-400' : 'text-slate-500'}`}>{m.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 block ml-1">分帳人</label>
                        <div className="grid grid-cols-5 gap-2">
                            {members.map(m => {
                                const isSel = selectedSplits.includes(m.id);
                                return (
                                    <button key={m.id} onClick={() => {
                                      if (isSel) {
                                        if (selectedSplits.length > 1) setSelectedSplits(selectedSplits.filter(s => s !== m.id));
                                      } else setSelectedSplits([...selectedSplits, m.id]);
                                    }} className={`flex flex-col items-center gap-1 transition-all ${isSel ? 'scale-105' : 'opacity-40 grayscale'}`}>
                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 relative transition-all ${isSel ? 'border-sky-400 shadow-active' : 'border-white bg-white'}`}>
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
                    {editingId && <button onClick={async () => {
                      if (window.confirm("確定要刪除這筆款項嗎？")) {
                        await deleteDoc(doc(db, 'expenses', editingId));
                        setIsModalOpen(false);
                      }
                    }} className="p-4 bg-rose-50 text-rose-500 font-bold rounded-2xl active:scale-90 transition-all"><Trash2 size={20} /></button>}
                    <button onClick={handleSave} className="flex-1 py-4 bg-sky-400 text-white text-base font-bold rounded-2xl shadow-active active:scale-95 transition-all">{editingId ? '儲存變更' : '確定新增'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
