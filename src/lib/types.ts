
export type TransactionStatus = 'Open' | 'Paid' | 'Overdue' | 'DueToday' | 'canceled';
export type AccountType = 'payable' | 'receivable';
export type PersonType = 'Pessoa Física' | 'Pessoa Jurídica';
export type EntryType = 'Provision' | 'Confirmed';
export type BankAccountType = 'Corrente' | 'Poupança' | 'Investimento' | 'Caixinha';
export type CostCenterStatus = 'Active' | 'Archived';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

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

export interface CostCenterGroup {
  id: string;
  name: string;
  description?: string;
  parentGroupId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CostCenter {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  status: CostCenterStatus;
  archivedAt?: string;
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
  issueDate: string; // Obrigatório para Competência
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
  rootEntryId?: string; // Vínculo para pagamentos parciais
}

export interface AccountsReceivableEntry {
  id: string;
  customerName: string;
  accountCategoryId: string;
  description: string;
  amount: number;
  issueDate: string; // Obrigatório para Competência
  dueDate: string;
  status: 'Open' | 'Paid';
  paymentDate?: string;
  bankAccountId?: string;
  createdAt: string;
  updatedAt: string;
  costCenterId?: string;
  rootEntryId?: string; // Vínculo para pagamentos parciais
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

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  timestamp: string;
  details?: any; // Snapshot dos dados
}

export interface UserProfile {
  id: string;
  email: string;
  companyId: string;
  displayName?: string;
  role?: 'admin' | 'user';
  createdAt: any;
}
