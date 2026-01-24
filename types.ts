
export interface Member {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex
  avatar: string;
}

export enum Tab {
  SCHEDULE = 'SCHEDULE',
  EXPENSE = 'EXPENSE',
  JOURNAL = 'JOURNAL',
  PLANNING = 'PLANNING'
}

export enum EventCategory {
  SIGHTSEEING = '景點',
  FOOD = '美食',
  TRANSPORT = '交通',
  STAY = '住宿',
  SHOPPING = '購物'
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  location: string;
  category: EventCategory;
  notes?: string;
  mapLink?: string;
  createdAt?: string;
}

export interface PreTripTask {
  id: string;
  title: string;
  completedBy: string[]; // List of member IDs who finished this
  createdAt?: string;
}

export interface Expense {
  id: string;
  amountKRW: number;
  amountTWD: number;
  currency: 'KRW' | 'TWD'; // Track original input currency
  category: string;
  description: string;
  notes?: string; // 新增備註
  payerId: string;
  splitWithIds: string[]; // IDs of members involved
  date: string;
  time: string; // 新增時間欄位
  timestamp?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  authorId: string;
  photos?: string[];
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  ownerId: string;
  type: 'todo' | 'packing' | 'shopping';
  createdAt?: string;
}
