
import { utils, writeFile } from 'xlsx';
import { format, parseISO, subMonths, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
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
  
  if (summary) {
    utils.sheet_add_json(ws, [summary], { skipHeader: true, origin: -1 });
  }

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  
  writeFile(wb, `${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

/**
 * Calcula a DRE Profissional baseada no Plano de Contas
 */
export const calculateProfessionalDRE = (
  payables: AccountsPayableEntry[],
  receivables: AccountsReceivableEntry[],
  categories: AccountCategory[]
) => {
  const paidReceivables = receivables.filter(r => r.status === 'Paid');
  const paidPayables = payables.filter(p => p.status === 'Paid');

  // Auxiliar para pegar nome e código da categoria raiz
  const getCategoryGroup = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return { id: 'other', name: 'Outros', code: '0' };
    
    let root = cat;
    while (root.parentCategoryId) {
      const parent = categories.find(p => p.id === root.parentCategoryId);
      if (!parent) break;
      root = parent;
    }
    return { id: root.id, name: root.name, code: root.code };
  };

  // 1. Receita Bruta (Categorias de Receita)
  const revenueByGroup: Record<string, number> = {};
  paidReceivables.forEach(r => {
    const group = getCategoryGroup(r.accountCategoryId).name;
    revenueByGroup[group] = (revenueByGroup[group] || 0) + r.amount;
  });
  const grossRevenue = Object.values(revenueByGroup).reduce((a, b) => a + b, 0);

  // 2. Custos Variáveis (Geralmente grupo 1.0 no padrão AM Finance)
  const variableCostsByGroup: Record<string, number> = {};
  const variableEntries = paidPayables.filter(p => {
    const group = getCategoryGroup(p.accountCategoryId);
    return group.code.startsWith('1');
  });
  variableEntries.forEach(p => {
    const group = getCategoryGroup(p.accountCategoryId).name;
    variableCostsByGroup[group] = (variableCostsByGroup[group] || 0) + (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0));
  });
  const totalVariableCosts = Object.values(variableCostsByGroup).reduce((a, b) => a + b, 0);

  // 3. Margem de Contribuição
  const contributionMargin = grossRevenue - totalVariableCosts;

  // 4. Despesas Fixas (Geralmente grupo 2.0 no padrão AM Finance)
  const fixedExpensesByGroup: Record<string, number> = {};
  const fixedEntries = paidPayables.filter(p => {
    const group = getCategoryGroup(p.accountCategoryId);
    return group.code.startsWith('2');
  });
  fixedEntries.forEach(p => {
    const group = getCategoryGroup(p.accountCategoryId).name;
    fixedExpensesByGroup[group] = (fixedExpensesByGroup[group] || 0) + (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0));
  });
  const totalFixedExpenses = Object.values(fixedExpensesByGroup).reduce((a, b) => a + b, 0);

  // 5. EBITDA / Resultado Operacional
  const ebitda = contributionMargin - totalFixedExpenses;

  // 6. Resultado Financeiro (Juros e Multas pagos)
  const financialResult = paidPayables.reduce((acc, p) => acc + (p.interest || 0) + (p.fine || 0), 0);

  // 7. Resultado Líquido
  const netResult = ebitda - financialResult;

  return {
    grossRevenue,
    revenueByGroup,
    totalVariableCosts,
    variableCostsByGroup,
    contributionMargin,
    totalFixedExpenses,
    fixedExpensesByGroup,
    ebitda,
    financialResult,
    netResult,
    marginPerc: grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0
  };
};

/**
 * Calcula variação percentual entre dois valores
 */
export const calculateGrowth = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};
