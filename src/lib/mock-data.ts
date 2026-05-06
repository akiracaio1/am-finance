import { Supplier, FinancialEntry, BankAccount, ChartOfAccount, BankStatementItem } from './types';

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: '1', name: 'Peixaria Central', cnpj: '12.345.678/0001-90', personType: 'Pessoa Jurídica', category: 'Insumos', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', name: 'Distribuidora Arroz Sushi', cnpj: '98.765.432/0001-21', personType: 'Pessoa Jurídica', category: 'Insumos', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '3', name: 'Condomínio Shopping', cnpj: '45.678.910/0001-55', personType: 'Pessoa Jurídica', category: 'Aluguel', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const MOCK_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  // 1.0 Operacional
  { id: '1', code: '1.0', name: 'Operacional (Custos Variáveis e Insumos)' },
  { id: '1.1', code: '1.1', name: 'Insumos e Materiais Diretos', parent: '1' },
  { id: '1.1.1', code: '1.1.1', name: 'Materiais para Revenda', parent: '1.1' },
  { id: '1.1.2', code: '1.1.2', name: 'Materiais Aplicados na Prestação de Serviços', parent: '1.1' },
  { id: '1.1.3', code: '1.1.3', name: 'Embalagens', parent: '1.1' },
  { id: '1.1.4', code: '1.1.4', name: 'Gás GLP (Combustível de Produção)', parent: '1.1' },
  
  { id: '1.2', code: '1.2', name: 'Impostos sobre Vendas', parent: '1' },
  { id: '1.2.1', code: '1.2.1', name: 'Simples Nacional - DAS', parent: '1.2' },
  { id: '1.2.2', code: '1.2.2', name: 'ICMS ST sobre Vendas', parent: '1.2' },

  { id: '1.3', code: '1.3', name: 'Logística e Vendas', parent: '1' },
  { id: '1.3.1', code: '1.3.1', name: 'Fretes pagos', parent: '1.3' },
  { id: '1.3.2', code: '1.3.2', name: 'Transporte de Mercadorias Vendidas', parent: '1.3' },
  { id: '1.3.3', code: '1.3.3', name: 'Descontos incondicionais concedidos', parent: '1.3' },

  // 2.0 Custos Fixos
  { id: '2', code: '2.0', name: 'Custos Fixos (Despesas Administrativas e Estruturais)' },
  { id: '2.1', code: '2.1', name: 'Ocupação e Utilidades', parent: '2' },
  { id: '2.1.1', code: '2.1.1', name: 'Aluguel', parent: '2.1' },
  { id: '2.1.2', code: '2.1.2', name: 'Energia Elétrica', parent: '2.1' },
  { id: '2.1.3', code: '2.1.3', name: 'Água e Saneamento', parent: '2.1' },
  { id: '2.1.4', code: '2.1.4', name: 'Telefonia e Internet', parent: '2.1' },

  { id: '2.2', code: '2.2', name: 'Pessoal e Honorários', parent: '2' },
  { id: '2.2.1', code: '2.2.1', name: 'Salários', parent: '2.2' },
  { id: '2.2.2', code: '2.2.2', name: 'Remuneração de Autônomos', parent: '2.2' },
  { id: '2.2.3', code: '2.2.3', name: 'Honorários Contábeis', parent: '2.2' },

  { id: '2.3', code: '2.3', name: 'Manutenção e Administrativo', parent: '2' },
  { id: '2.3.1', code: '2.3.1', name: 'Copa e Cozinha', parent: '2.3' },
  { id: '2.3.2', code: '2.3.2', name: 'Utensílios e Equipamentos de Cozinha', parent: '2.3' },
  { id: '2.3.3', code: '2.3.3', name: 'Materiais de Escritório', parent: '2.3' },
  { id: '2.3.4', code: '2.3.4', name: 'Software / Licença de Uso', parent: '2.3' },
  { id: '2.3.5', code: '2.3.5', name: 'Combustíveis (uso administrativo/veículos)', parent: '2.3' },

  // 3.0 Marketing
  { id: '3', code: '3.0', name: 'Marketing e Desenvolvimento' },
  { id: '3.1', code: '3.1', name: 'Promoção e Publicidade', parent: '3' },
  { id: '3.1.1', code: '3.1.1', name: 'Marketing e Publicidade', parent: '3.1' },
  { id: '3.1.2', code: '3.1.2', name: 'Tráfego Pago', parent: '3.1' },

  { id: '3.2', code: '3.2', name: 'Treinamento', parent: '3' },
  { id: '3.2.1', code: '3.2.1', name: 'Cursos e Treinamentos', parent: '3.2' },

  { id: '3.3', code: '3.3', name: 'Eventos', parent: '3' },
  { id: '3.3.1', code: '3.3.1', name: 'Taxas de Participação em Eventos', parent: '3.3' },

  // 4.0 Investimentos
  { id: '4', code: '4.0', name: 'Investimentos e Movimentações de Sócios' },
  { id: '4.1', code: '4.1', name: 'Ativos Imobilizados', parent: '4' },
  { id: '4.1.1', code: '4.1.1', name: 'Máquinas, Equipamentos e Instalações Industriais', parent: '4.1' },

  { id: '4.2', code: '4.2', name: 'Fluxo de Sócios', parent: '4' },
  { id: '4.2.1', code: '4.2.1', name: 'Antecipação de Lucros', parent: '4.2' },
  { id: '4.2.2', code: '4.2.2', name: 'Empréstimos de Sócios', parent: '4.2' },
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
