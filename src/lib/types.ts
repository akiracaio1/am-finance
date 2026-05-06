
export type TransactionStatus = 'open' | 'paid' | 'overdue' | 'canceled';
export type AccountType = 'payable' | 'receivable';
export type PersonType = 'Pessoa Física' | 'Pessoa Jurídica';

export interface Supplier {
  id: string;
  name: string;
  personType: PersonType;
  cnpj?: string; // Serves as CPF or CNPJ
  contact?: string; // Legacy field
  email?: string;
  phone?: string;
  category?: string;
  pixKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChartOfAccount {
  id: string;
  name: string;
  parent?: string;
  code: string;
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
  status: TransactionStatus;
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

export interface CashFlowDay {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}
