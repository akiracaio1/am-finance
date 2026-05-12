
export type TransactionStatus = 'Open' | 'Paid' | 'Overdue' | 'DueToday' | 'canceled';
export type AccountType = 'payable' | 'receivable';
export type PersonType = 'Pessoa Física' | 'Pessoa Jurídica';
export type EntryType = 'Provision' | 'Confirmed';
export type BankAccountType = 'Corrente' | 'Poupança' | 'Investimento' | 'Caixinha';

export interface Supplier {
  id: string;
  name: string;
  personType: PersonType;
  cnpj?: string;
  email?: string;
  phone?: string;
  category?: string;
  pixKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountCategory {
  id: string;
  name: string;
  description: string;
  type: string;
  code: string;
  parentCategoryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostCenter {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsPayableEntry {
  id: string;
  supplierId: string;
  accountCategoryId: string;
  costCenterId?: string;
  description: string;
  originalAmount: number;
  issueDate?: string;
  dueDate: string;
  paymentMethod?: string;
  status: 'Open' | 'Paid' | 'Overdue' | 'DueToday';
  entryType: EntryType;
  createdAt: string;
  updatedAt: string;
  paymentDate?: string;
  bankAccountId?: string;
  interest?: number;
  fine?: number;
  discount?: number;
  installmentInfo?: string;
}

export interface AccountsReceivableEntry {
  id: string;
  customerName: string;
  accountCategoryId: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'Open' | 'Paid';
  paymentDate?: string;
  bankAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  type: BankAccountType;
  initialBalance: number;
  openingDate: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'CREDIT' | 'DEBIT';
  reconciled: boolean;
  reconciledEntryId: string | null;
  fitId?: string;
  bankAccountId: string;
  ignored?: boolean;
}

export interface NoMovementDay {
  date: string;
}

export interface FinancialEntry {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: string;
  supplierId?: string;
  type: AccountType;
  category: string;
  interest?: number;
  fine?: number;
}
