import { Supplier, FinancialEntry, BankAccount, ChartOfAccount, BankStatementItem } from './types';

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: '1', name: 'Peixaria Central', cnpj: '12.345.678/0001-90', contact: 'central@peixe.com', category: 'Insumos' },
  { id: '2', name: 'Distribuidora Arroz Sushi', cnpj: '98.765.432/0001-21', contact: 'vendas@arroz.com', category: 'Insumos' },
  { id: '3', name: 'Condomínio Shopping', cnpj: '45.678.910/0001-55', contact: 'financeiro@shopping.com', category: 'Aluguel' },
];

export const MOCK_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  { id: '1', code: '1.0', name: 'Operacional' },
  { id: '2', code: '1.1', name: 'Insumos', parent: '1' },
  { id: '3', code: '1.1.1', name: 'Peixe', parent: '2' },
  { id: '4', code: '2.0', name: 'Custos Fixos' },
  { id: '5', code: '2.1', name: 'Aluguel', parent: '4' },
];

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  { id: '1', bankName: 'Itaú', accountNumber: '12345-6', balance: 15400.50 },
  { id: '2', bankName: 'Nubank', accountNumber: '98765-4', balance: 2100.00 },
];

export const MOCK_ENTRIES: FinancialEntry[] = [
  { id: 'e1', description: 'Compra de Salmão', amount: 1500, dueDate: '2024-03-20', status: 'paid', type: 'payable', category: 'Peixe', supplierId: '1' },
  { id: 'e2', description: 'Aluguel Março', amount: 4500, dueDate: '2024-03-05', status: 'overdue', type: 'payable', category: 'Aluguel', supplierId: '3' },
  { id: 'e3', description: 'Vendas iFood Semanal', amount: 8400, dueDate: '2024-03-22', status: 'open', type: 'receivable', category: 'Faturamento' },
  { id: 'e4', description: 'Embalagens Delivery', amount: 350, dueDate: '2024-03-25', status: 'open', type: 'payable', category: 'Insumos', supplierId: '2' },
];

export const MOCK_OFX_ITEMS: BankStatementItem[] = [
  { id: 's1', date: '2024-03-20', amount: -1500, description: 'TED PEIXARIA CENTRAL' },
  { id: 's2', date: '2024-03-18', amount: -120, description: 'MANUTENÇÃO CONTA' },
  { id: 's3', date: '2024-03-22', amount: 8400, description: 'IFOOD BRASIL' },
];
