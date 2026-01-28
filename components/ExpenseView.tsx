
import React, { useState, useEffect } from 'react';
import { Expense, Member, EventCategory } from '../types';
import { CATEGORY_ICONS } from '../constants';
import { Plus, Users, Calendar, X, ChevronRight, Trash2, Check, Landmark, ArrowRight, ExternalLink, Clock, ChevronDown, Tag, PieChart, CreditCard, ChevronLeft } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, setDoc, getDoc } from 'firebase/firestore';

interface ExpenseViewProps {
  members: Member[];
}

export const ExpenseView: React.FC<ExpenseViewProps> = ({ members }) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'settle'>('list');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [exchangeRate, setExchangeRate] = useState<number>(0.0245);
  const [localRateStr, setLocalRateStr] = useState<string>('0.0245');

  const [viewingMemberDetailsId, setViewingMemberDetailsId] = useState<string | null>(null);

  const [customCategories, setCustomCategories] = useState<Record<string, string>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('💸');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [amountInput, setAmountInput] = useState('');
  const [inputCurrency, setInputCurrency] = useState<'KRW' | 'TWD'>('KRW');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>(EventCategory.FOOD);
  const [payer, setPayer] = useState('');
  const [selectedSplits, setSelectedSplits] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [isCustomSplit, setIsCustomSplit] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('');

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Sync settings with Firestore real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.exchangeRate !== undefined) {
          setExchangeRate(data.exchangeRate);
          // Only update the input string if the value is significantly different
          // This prevents overwriting user input like "0." or "0.00" while typing
          setLocalRateStr(prev => {
             const currentNum = parseFloat(prev);
             if (!isNaN(currentNum) && Math.abs(currentNum - data.exchangeRate) < 0.000001) return prev;
             return data.exchangeRate.toString();
          });
        }
        if (data.customCategories) setCustomCategories(data.customCategories);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRateChange = async (newVal: string) => {
    setLocalRateStr(newVal);
    const rate = parseFloat(newVal);
    if (!isNaN(rate)) {
        setExchangeRate(rate);
        // Persist to Firestore
        await setDoc(doc(db, 'config', 'settings'), { exchangeRate: rate }, { merge: true });
    }
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

  const handleSave = async () => {
    const inputTotal = parseFloat(amountInput);
    if (!amountInput || isNaN(inputTotal) || !description.trim()) { alert("請輸入金額與描述！"); return; }
    if (selectedSplits.length === 0) { alert("請選擇分帳人！"); return; }
    
    let finalCustomSplits: Record<string, number> | null = null;
    if (isCustomSplit) {
      let sum = 0;
      finalCustomSplits = {};
      for (const id of selectedSplits) {
        const val = parseFloat(customSplits[id] || '0');
        finalCustomSplits[id] = val;
        sum += val;
      }
      if (Math.abs(sum - inputTotal) > 0.1) {
        alert(`自定義金額總和 (${sum}) 不等於總額 (${inputTotal})！`);
        return;
      }
    }

    let amountKRW = 0, amountTWD = 0;
    const safeRate = exchangeRate || 0.0245;

    if (inputCurrency === 'KRW') {
        amountKRW = Math.round(inputTotal);
        amountTWD = Math.round(inputTotal * safeRate);
    } else {
        amountTWD = Math.round(inputTotal);
        amountKRW = Math.round(inputTotal / safeRate);
    }
    
    const data: any = { 
      amountKRW, 
      amountTWD, 
      currency: inputCurrency, 
      category, 
      description: description.trim(), 
      notes: notes.trim(),
      payerId: payer, 
      splitWithIds: selectedSplits, 
      date: newDate, 
      time: newTime || '00:00', 
      timestamp: new Date().toISOString() 
    };

    if (finalCustomSplits !== null) {
      data.customSplits = finalCustomSplits;
    } else if (editingId) {
      data.customSplits = null;
    }

    if (editingId) await updateDoc(doc(db, 'expenses', editingId), data);
    else await addDoc(collection(db, 'expenses'), data);
    setIsModalOpen(false);
  };

  const calculateSettlement = () => {
    const memberPaid: Record<string, number> = {};
    const memberShare: Record<string, number> = {};
    members.forEach(m => { memberPaid[m.id] = 0; memberShare[m.id] = 0; });
    
    expenses.forEach(exp => {
        const currentTWD = exp.currency === 'KRW' ? Math.round(exp.amountKRW * exchangeRate) : exp.amountTWD;
        if (memberPaid[exp.payerId] !== undefined) {
           memberPaid[exp.payerId] += currentTWD;
        }
        
        if (exp.customSplits && Object.keys(exp.customSplits).length > 0) {
          (Object.entries(exp.customSplits) as [string, number][]).forEach(([id, amt]) => {
            if (memberShare[id] !== undefined) {
              const shareTWD = exp.currency === 'KRW' ? amt * exchangeRate : amt;
              memberShare[id] += shareTWD;
            }
          });
        } else {
          const splitIds = exp.splitWithIds || [];
          const splitCount = splitIds.length;
          if (splitCount > 0) {
              const share = currentTWD / splitCount;
              splitIds.forEach(id => { if (memberShare[id] !== undefined) { memberShare[id] += share; } });
          }
        }
    });

    const balances: Record<string, number> = {};
    members.forEach(m => { balances[m.id] = memberPaid[m.id] - memberShare[m.id]; });

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
    return { transactions, memberPaid, memberShare };
  };

  const settlement = calculateSettlement();
  const expensesByDate: Record<string, Expense[]> = {};
  expenses.forEach(exp => { if (!expensesByDate[exp.date]) expensesByDate[exp.date] = []; expensesByDate[exp.date].push(exp); });
  const sortedDates = Object.keys(expensesByDate).sort((a, b) => b.localeCompare(a));

  const viewingMember = members.find(m => m.id === viewingMemberDetailsId);
  const groupedMemberExpenses: Record<string, Expense[]> = {};
  if (viewingMember) {
    expenses.filter(e => (e.splitWithIds || []).includes(viewingMember.id)).forEach(exp => {
        if (!groupedMemberExpenses[exp.date]) groupedMemberExpenses[exp.date] = [];
        groupedMemberExpenses[exp.date].push(exp);
    });
  }
  const sortedMemberDates = Object.keys(groupedMemberExpenses).sort((a, b) => b.localeCompare(a));

  const openAddModal = () => {
    setEditingId(null); setAmountInput(''); setInputCurrency('KRW'); setDescription(''); setNotes(''); setCategory(EventCategory.FOOD);
    setNewDate(new Date().toISOString().split('T')[0]); setNewTime(getCurrentTime()); setIsAddingCategory(false);
    setIsCustomSplit(false); setCustomSplits({});
    if (members.length > 0) { setPayer(members[0].id); setSelectedSplits(members.map(m => m.id)); }
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingId(exp.id); setInputCurrency(exp.currency || 'KRW');
    setAmountInput(exp.currency === 'KRW' ? exp.amountKRW.toString() : exp.amountTWD.toString());
    setDescription(exp.description); setNotes(exp.notes || ''); setCategory(exp.category); setPayer(exp.payerId);
    setSelectedSplits(exp.splitWithIds || []); setNewDate(exp.date); setNewTime(exp.time || '00:00');
    setIsAddingCategory(false);
    if (exp.customSplits) {
      setIsCustomSplit(true);
      const stringifiedSplits: Record<string, string> = {};
      Object.entries(exp.customSplits).forEach(([id, val]) => { stringifiedSplits[id] = val.toString(); });
      setCustomSplits(stringifiedSplits);
    } else {
      setIsCustomSplit(false);
      setCustomSplits({});
    }
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col no-scrollbar">
      <div className="px-6 pt-4">
        <div className="bg-slate-100 p-1 rounded-xl flex shadow-sm">
            <button onClick={() => { setActiveSubTab('list'); setViewingMemberDetailsId(null); }} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'list' ? 'bg-white text-sky-400 shadow-sm' : 'text-slate-400'}`}>支出明細</button>
            <button onClick={() => { setActiveSubTab('settle'); setViewingMemberDetailsId(null); }} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'settle' ? 'bg-white text-sky-400 shadow-sm' : 'text-slate-400'}`}>結算 & 統計</button>
        </div>
      </div>

      {activeSubTab === 'list' ? (
        <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 pt-4 no-scrollbar">
            <div className="flex justify-between items-center px-1">
               <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">TIMELINE</h3>
               <button onClick={openAddModal} className="bg-sky-400 text-white p-2.5 rounded-xl shadow-active active:scale-90 transition-transform"><Plus size={18} strokeWidth={3}/></button>
            </div>
            {sortedDates.map(date => (
                <div key={date} className="space-y-3">
                    <div className="text-xs font-black text-sky-400 flex items-center gap-1.5 mb-1 px-1 uppercase tracking-tighter"><Calendar size={12}/> {date}</div>
                    <div className="space-y-3">
                    {expensesByDate[date].map(exp => {
                      const payerM = members.find(m => m.id === exp.payerId);
                      const currentTWD = exp.currency === 'KRW' ? Math.round(exp.amountKRW * exchangeRate) : exp.amountTWD;
                      const splitMembers = members.filter(m => (exp.splitWithIds || []).includes(m.id));
                      return (
                          <div key={exp.id} onClick={() => openEditModal(exp)} className="bg-white py-5 px-5 rounded-2xl shadow-soft border border-slate-50 flex flex-col gap-4 cursor-pointer active:scale-[0.98] transition-all relative">
                          <div className="flex justify-between items-start">
                              <div className="flex gap-4 min-w-0">
                                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-slate-50 border border-slate-100 shadow-xs shrink-0">{(allCategories as any)[exp.category] || '💸'}</div>
                                  <div className="pt-0.5 min-w-0">
                                    <div className="text-base font-bold text-slate-800 leading-tight mb-1.5 truncate">{exp.description}</div>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[10px] font-black text-slate-400 tracking-tight">By <span className="text-sky-400">{payerM?.name}</span></span>
                                       {exp.customSplits && <span className="text-[8px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded font-black border border-amber-100 uppercase tracking-tighter">Custom</span>}
                                    </div>
                                  </div>
                              </div>
                              <div className="text-right pt-0.5 shrink-0">
                                  <div className="flex items-center justify-end gap-1 text-[9px] font-black text-slate-300 uppercase mb-1.5">
                                    <Clock size={9} /> {exp.time || '--:--'}
                                  </div>
                                  <div className="text-base font-black text-slate-900 tracking-tight leading-none mb-1">NT$ {currentTWD.toLocaleString()}</div>
                                  <div className="text-[11px] font-black text-sky-400 uppercase tracking-tighter leading-none">₩{exp.amountKRW.toLocaleString()}</div>
                              </div>
                          </div>
                          {exp.notes && (
                            <div className="px-1 -mt-2">
                              <p className="text-[10px] text-slate-400 italic font-medium line-clamp-1 border-l-2 border-slate-100 pl-2">{exp.notes}</p>
                            </div>
                          )}
                          <div className="flex items-center pt-3 border-t border-slate-50">
                              <div className="flex flex-wrap gap-2 flex-1">
                                  {splitMembers.map(sm => (
                                      <img key={sm.id} src={sm.avatar} className="h-6 w-6 rounded-full ring-2 ring-white shadow-sm bg-white object-cover" alt={sm.name} />
                                  ))}
                              </div>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest pl-2 italic shrink-0">{(exp.splitWithIds || []).length} 參與者</span>
                          </div>
                          </div>
                      );
                    })}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-24 pt-4 space-y-6 no-scrollbar">
            <div className="bg-sky-50 rounded-2xl p-5 border border-sky-100 shadow-soft">
                <div className="flex justify-between items-center mb-4 gap-2">
                   <h4 className="text-sky-500 text-[10px] font-black tracking-tight uppercase shrink-0">匯率設定</h4>
                   <a 
                    href="https://rate.bot.com.tw/xrt?Lang=zh-TW" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[9px] font-black text-sky-400/70 hover:text-sky-400 transition-colors uppercase bg-white/60 px-2 py-1 rounded-lg border border-sky-400/10"
                   >
                     <Landmark size={10} /> 查看台銀牌告 <ExternalLink size={8} />
                   </a>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-slate-600 text-[10px] font-black leading-none uppercase shrink-0">1 KRW ≈</div>
                   <div className="flex-1 min-w-0 bg-white border border-sky-400/20 rounded-xl px-2 h-12 flex items-center shadow-sm">
                      <input type="number" step="0.0001" value={localRateStr} onChange={(e) => handleRateChange(e.target.value)} className="w-full text-center text-sky-500 text-lg font-black bg-transparent outline-none" />
                   </div>
                   <div className="text-slate-600 text-[10px] font-black leading-none uppercase shrink-0">TWD</div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <PieChart size={14} className="text-sky-400" />
                    <h3 className="text-slate-700 text-sm font-bold uppercase tracking-tight">個人總支出 (TWD)</h3>
                </div>
                <div className="bg-white rounded-2xl shadow-soft border border-slate-50 divide-y divide-slate-50 overflow-hidden">
                    {members.map(m => {
                        const totalShare = Math.round(settlement.memberShare[m.id]);
                        return (
                          <div key={m.id} onClick={() => setViewingMemberDetailsId(m.id)} className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 shadow-xs"><img src={m.avatar} alt={m.name} className="w-full h-full object-cover" /></div>
                                  <div>
                                      <div className="text-sm font-bold text-slate-700">{m.name}</div>
                                      <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">點擊查看支出詳情</div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 text-right">
                                  <div className="text-sm font-black text-sky-400">NT$ {totalShare.toLocaleString()}</div>
                                  <ChevronRight size={16} className="text-slate-200" />
                              </div>
                          </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <CreditCard size={14} className="text-sky-400" />
                    <h3 className="text-slate-700 text-sm font-bold uppercase tracking-tight">結算清單</h3>
                </div>
                <div className="bg-white rounded-2xl shadow-soft border border-slate-50 overflow-hidden">
                    <div className="divide-y divide-slate-50">
                    {settlement.transactions.length > 0 ? settlement.transactions.map((t, idx) => {
                        const from = members.find(m => m.id === t.from), to = members.find(m => m.id === t.to);
                        return (
                            <div key={idx} className="p-4 pr-6 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-2 justify-start min-w-0">
                                    <div className="flex flex-col items-center gap-1 w-12 shrink-0">
                                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm"><img src={from?.avatar} alt={from?.name} className="w-full h-full object-cover" /></div>
                                        <span className="text-[9px] font-black text-slate-400 tracking-tighter truncate w-full text-center">{from?.name}</span>
                                    </div>
                                    <div className="flex items-center px-1 shrink-0"><ArrowRight size={18} className="text-sky-200" strokeWidth={3} /></div>
                                    <div className="flex flex-col items-center gap-1 w-12 shrink-0">
                                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm"><img src={to?.avatar} alt={to?.name} className="w-full h-full object-cover" /></div>
                                        <span className="text-[9px] font-black text-slate-400 tracking-tighter truncate w-full text-center">{to?.name}</span>
                                    </div>
                                </div>
                                <div className="text-right ml-2 shrink-0">
                                    <div className="text-[9px] font-black text-slate-300 mb-1 uppercase tracking-widest">應給付</div>
                                    <div className="font-black text-sky-400 text-lg tracking-tight leading-none">NT$ {t.amount.toLocaleString()}</div>
                                </div>
                            </div>
                        )
                    }) : (
                        <div className="p-10 text-center text-slate-200 text-xs font-bold uppercase tracking-widest italic">All settled up!</div>
                    )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {viewingMemberDetailsId && viewingMember && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <img src={viewingMember.avatar} className="w-10 h-10 rounded-full border-2 border-sky-100 object-cover" alt={viewingMember.name} />
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">{viewingMember.name} 的支出詳情</h2>
                            <p className="text-[10px] font-black text-sky-400 uppercase">總支出額: NT$ {Math.round(settlement.memberShare[viewingMember.id]).toLocaleString()}</p>
                        </div>
                    </div>
                    <button onClick={() => setViewingMemberDetailsId(null)} className="bg-slate-50 p-2 rounded-xl text-slate-300 transition-colors active:scale-95"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-10">
                    {sortedMemberDates.length > 0 ? sortedMemberDates.map(date => (
                      <div key={date} className="space-y-3">
                         <div className="text-[10px] font-black text-sky-400 flex items-center gap-1.5 px-1 uppercase tracking-widest border-l-4 border-sky-400/30 pl-3 ml-1">{date}</div>
                         <div className="space-y-2.5">
                            {groupedMemberExpenses[date].map(exp => {
                              const currentTWD = exp.currency === 'KRW' ? Math.round(exp.amountKRW * exchangeRate) : exp.amountTWD;
                              const splitIds = exp.splitWithIds || [];
                              let individualShareTWD = 0;
                              if (exp.customSplits && exp.customSplits[viewingMember.id] !== undefined) {
                                individualShareTWD = exp.currency === 'KRW' ? Math.round(exp.customSplits[viewingMember.id] * exchangeRate) : Math.round(exp.customSplits[viewingMember.id]);
                              } else {
                                individualShareTWD = splitIds.length > 0 ? Math.round(currentTWD / splitIds.length) : 0;
                              }
                              return (
                                <div key={exp.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col shadow-xs gap-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex gap-3 items-center min-w-0 flex-1">
                                      <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-xl shrink-0">{(allCategories as any)[exp.category] || '💸'}</div>
                                      <div className="min-w-0">
                                        <div className="text-sm font-bold text-slate-700 truncate">{exp.description}</div>
                                        <div className="text-[10px] text-slate-300 font-bold uppercase flex items-center gap-1">
                                            <Users size={10}/> {splitIds.length} 人分擔 {exp.customSplits && "· 自定義"}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-sm font-black text-sky-500">NT$ {individualShareTWD.toLocaleString()}</div>
                                      <div className="text-[9px] font-bold text-slate-300">總計 ₩{exp.amountKRW.toLocaleString()}</div>
                                    </div>
                                  </div>
                                  {exp.notes && (
                                    <div className="bg-white/50 px-3 py-2 rounded-xl border border-slate-100/50">
                                      <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">{exp.notes}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                         </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center text-slate-200 text-xs font-bold uppercase italic">此人尚無分擔記錄</div>
                    )}
                </div>
            </div>
        </div>
      )}

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
                    
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">支出分類</label>
                        <div className="relative">
                            <select value={category} onChange={(e) => { if (e.target.value === 'ADD_NEW') { setIsAddingCategory(true); } else { setCategory(e.target.value); setIsAddingCategory(false); } }} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 border-none outline-none appearance-none pr-10 focus:ring-1 focus:ring-sky-100">
                                {Object.entries(allCategories).map(([name, emoji]) => (<option key={name} value={name}>{emoji} {name}</option>))}
                                <option value="ADD_NEW" className="text-sky-400 font-bold">+ 新增自定義分類...</option>
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 block ml-1">日期</label><input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none" /></div>
                        <div><label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 block ml-1">時間</label><input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none" /></div>
                    </div>
                    
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">描述</label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 focus:ring-sky-100" placeholder="這筆錢花在哪？" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">備註 (可選)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none focus:ring-1 focus:ring-sky-100 min-h-[60px]" placeholder="想記錄更多細節嗎？" /></div>

                    <div>
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 block ml-1">誰付錢？</label>
                        <div className="grid grid-cols-5 gap-2">{members.map(m => (<button key={m.id} onClick={() => setPayer(m.id)} className={`flex flex-col items-center gap-1 transition-all ${payer === m.id ? 'scale-105' : 'opacity-40 grayscale'}`}><div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 ${payer === m.id ? 'border-sky-400 shadow-active' : 'border-white bg-white shadow-xs'}`}><img src={m.avatar} className="w-full h-full rounded-full object-cover" /></div><span className={`text-[8px] font-bold truncate w-full text-center ${payer === m.id ? 'text-sky-400' : 'text-slate-500'}`}>{m.name}</span></button>))}</div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2 px-1">
                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest">分帳人與金額</label>
                            <button type="button" onClick={() => setIsCustomSplit(!isCustomSplit)} className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-all ${isCustomSplit ? 'bg-amber-400 text-white border-amber-500' : 'text-slate-400 border-slate-200'}`}>
                                {isCustomSplit ? '自定義金額' : '平均分帳'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {members.map(m => {
                                const isSel = selectedSplits.includes(m.id);
                                return (
                                    <div key={m.id} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${isSel ? 'bg-white border-sky-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-40 grayscale'}`}>
                                        <button onClick={() => {
                                            if (isSel) { if (selectedSplits.length > 1) setSelectedSplits(selectedSplits.filter(s => s !== m.id)); } 
                                            else setSelectedSplits([...selectedSplits, m.id]);
                                        }} className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center p-0.5 relative ${isSel ? 'border-sky-400 shadow-active' : 'border-white shadow-xs'}`}>
                                                <img src={m.avatar} className="w-full h-full rounded-full object-cover" alt={m.name} />
                                                {isSel && <div className="absolute inset-0 bg-sky-400/20 flex items-center justify-center rounded-full"><Check size={14} className="text-white drop-shadow-md" strokeWidth={4} /></div>}
                                            </div>
                                            <span className={`text-xs font-bold truncate ${isSel ? 'text-sky-500' : 'text-slate-500'}`}>{m.name}</span>
                                        </button>
                                        
                                        {isSel && isCustomSplit && (
                                            <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                                <span className="text-[9px] font-black text-slate-300">{inputCurrency}</span>
                                                <input 
                                                    type="number" 
                                                    value={customSplits[m.id] || ''} 
                                                    onChange={(e) => setCustomSplits({...customSplits, [m.id]: e.target.value})}
                                                    className="w-20 text-right text-xs font-black text-slate-700 bg-transparent outline-none" 
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                        {isSel && !isCustomSplit && (
                                            <div className="text-[10px] font-black text-slate-300 px-3 italic shrink-0">
                                                ~ {inputCurrency} {amountInput ? (parseFloat(amountInput) / selectedSplits.length).toFixed(0) : 0}
                                            </div>
                                        )}
                                    </div>
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
