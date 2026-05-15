
import { utils, writeFile } from 'xlsx';
import { format, parseISO } from 'date-fns';
import { AccountsPayableEntry, AccountsReceivableEntry, AccountCategory, Supplier, CostCenter } from './types';

/**
 * Formata um número para moeda brasileira (BRL)
 */
export const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Interface para os dados de exportação do Excel
 */
interface ExportData {
  data: any[];
  filename: string;
  sheetName: string;
  summary?: Record<string, string | number>;
}

/**
 * Exporta dados para um arquivo Excel estruturado
 */
export const exportToExcel = ({ data, filename, sheetName, summary }: ExportData) => {
  const ws = utils.json_to_sheet(data);
  
  // Adiciona linha de sumário se houver
  if (summary) {
    utils.sheet_add_json(ws, [summary], { skipHeader: true, origin: -1 });
  }

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  
  writeFile(wb, `${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

/**
 * Calcula a DRE baseada nos lançamentos e categorias
 */
export const calculateDRE = (
  payables: AccountsPayableEntry[],
  receivables: AccountsReceivableEntry[],
  categories: AccountCategory[]
) => {
  const revenueEntries = receivables.filter(r => r.status === 'Paid');
  const expenseEntries = payables.filter(p => p.status === 'Paid');

  // Agrupamento por Categoria Raiz ou Pai
  const getTopLevelName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return 'Outros';
    if (!cat.parentCategoryId) return cat.name;
    const parent = categories.find(p => p.id === cat.parentCategoryId);
    return parent ? parent.name : cat.name;
  };

  const revenueTotal = revenueEntries.reduce((acc, curr) => acc + curr.amount, 0);
  const expenseTotal = expenseEntries.reduce((acc, curr) => 
    acc + (curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0)), 0
  );

  return {
    grossRevenue: revenueTotal,
    operatingExpenses: expenseTotal,
    netResult: revenueTotal - expenseTotal,
    revenueByGroup: revenueEntries.reduce((acc: any, curr) => {
      const group = getTopLevelName(curr.accountCategoryId);
      acc[group] = (acc[group] || 0) + curr.amount;
      return acc;
    }, {}),
    expenseByGroup: expenseEntries.reduce((acc: any, curr) => {
      const group = getTopLevelName(curr.accountCategoryId);
      const val = (curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0));
      acc[group] = (acc[group] || 0) + val;
      return acc;
    }, {})
  };
};
