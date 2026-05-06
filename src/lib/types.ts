
export type TransactionStatus = 'Open' | 'Paid' | 'Overdue' | 'DueToday' | 'canceled';
export type AccountType = 'payable' | 'receivable';
export type PersonType = 'Pessoa Física' | 'Pessoa Jurídica';

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
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
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

export interface BankStatementItem {
  id: string;
  date: string;
  amount: number;
  description: string;
  matchedEntryId?: string;
}
