'use server';
/**
 * @fileOverview Agente de IA AM Finance para analisar dados financeiros e fornecer insights.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimplifiedDRESchema = z.object({
  revenue: z.number().describe('Receita total do período.'),
  expenses: z.number().describe('Despesas totais do período.'),
  netResult: z.number().describe('Resultado líquido (receita - despesas) do período.'),
});

const CashFlowPeriodSchema = z.object({
  period: z.string().describe('O período da entrada de fluxo de caixa.'),
  inflows: z.number().describe('Entradas totais de caixa.'),
  outflows: z.number().describe('Saídas totais de caixa.'),
  netFlow: z.number().describe('Fluxo líquido de caixa.'),
});

const OverdueAccountSchema = z.object({
  description: z.string().describe('Descrição da conta em atraso.'),
  amount: z.number().describe('Valor da conta em atraso.'),
  dueDate: z.string().describe('Data de vencimento.'),
  daysOverdue: z.number().describe('Dias em atraso.'),
});

const UpcomingAccountSchema = z.object({
  description: z.string().describe('Descrição da conta futura.'),
  amount: z.number().describe('Valor da conta futura.'),
  dueDate: z.string().describe('Data de vencimento.'),
  type: z.enum(['payable', 'receivable']).describe('Tipo da conta.'),
});

const AnalyzeFinancialDataWithAIInputSchema = z.object({
  simplifiedDRE: SimplifiedDRESchema.describe('Dados da DRE.'),
  cashFlowStatement: z.array(CashFlowPeriodSchema).describe('Dados do Fluxo de Caixa.'),
  overdueAccounts: z.array(OverdueAccountSchema).describe('Contas em atraso.'),
  upcomingAccounts: z.array(UpcomingAccountSchema).describe('Contas futuras.'),
});
export type AnalyzeFinancialDataWithAIInput = z.infer<typeof AnalyzeFinancialDataWithAIInputSchema>;

const AnalyzeFinancialDataWithAIOutputSchema = z.object({
  overallSummary: z.string().describe('Resumo executivo do desempenho financeiro.'),
  keyInsights: z.array(z.string()).describe('Insights chave baseados em anomalias ou tendências.'),
  strategicRecommendations: z.array(z.string()).describe('Recomendações estratégicas para o empresário.'),
  potentialRisks: z.array(z.string()).describe('Riscos financeiros identificados (ex: queima de caixa).'),
  opportunities: z.array(z.string()).describe('Oportunidades identificadas para aumentar margem.'),
});
export type AnalyzeFinancialDataWithAIOutput = z.infer<typeof AnalyzeFinancialDataWithAIOutputSchema>;

// Fix: Defining schema before using it in definePrompt
const AnalyzeProfessionalAIOutputSchema = AnalyzeFinancialDataWithAIOutputSchema;

export async function analyzeFinancialDataWithAI(input: AnalyzeFinancialDataWithAIInput): Promise<AnalyzeFinancialDataWithAIOutput> {
  return analyzeFinancialDataWithAIFlow(input);
}

const analyzeFinancialDataPrompt = ai.definePrompt({
  name: 'analyzeFinancialDataPrompt',
  input: {schema: AnalyzeFinancialDataWithAIInputSchema},
  output: {schema: AnalyzeProfessionalAIOutputSchema}, // Now schema is defined before access
  prompt: `Você é o Diretor Financeiro (CFO) do AM Finance, um sistema de gestão financeira profissional.
Seu objetivo é analisar os dados financeiros e fornecer uma consultoria estratégica de alto nível.

CONTEXTO DOS DADOS:
- DRE: Receita: R$ {{{simplifiedDRE.revenue}}} | Despesas: R$ {{{simplifiedDRE.expenses}}} | Resultado: R$ {{{simplifiedDRE.netResult}}}
- EVOLUÇÃO TEMPORAL:
{{#each cashFlowStatement}}
* Período: {{{period}}} | Saldo Operacional: R$ {{{netFlow}}}
{{/each}}

- CONTAS EM ATRASO CRÍTICAS:
{{#each overdueAccounts}}
* {{{description}}}: R$ {{{amount}}} (Vencido em: {{{dueDate}}})
{{/each}}

TAREFAS:
1. Avalie a margem operacional e o burn rate.
2. Identifique tendências de crescimento ou queda nos últimos meses.
3. Aponte riscos de liquidez baseados nos atrasos.
4. Sugira ações para reduzir custos fixos ou aumentar a margem bruta.

Forneça uma análise detalhada e recomendações acionáveis. Responda em PORTUGUÊS (Brasil).`,
});

const analyzeFinancialDataWithAIFlow = ai.defineFlow(
  {
    name: 'analyzeFinancialDataWithAIFlow',
    inputSchema: AnalyzeFinancialDataWithAIInputSchema,
    outputSchema: AnalyzeProfessionalAIOutputSchema,
  },
  async input => {
    const {output} = await analyzeFinancialDataPrompt(input);
    return output!;
  }
);