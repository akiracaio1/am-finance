
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
  overallSummary: z.string().describe('Resumo do desempenho financeiro.'),
  keyInsights: z.array(z.string()).describe('Insights chave.'),
  strategicRecommendations: z.array(z.string()).describe('Recomendações estratégicas.'),
  potentialRisks: z.array(z.string()).describe('Riscos identificados.'),
  opportunities: z.array(z.string()).describe('Oportunidades identificadas.'),
});
export type AnalyzeFinancialDataWithAIOutput = z.infer<typeof AnalyzeFinancialDataWithAIOutputSchema>;

export async function analyzeFinancialDataWithAI(input: AnalyzeFinancialDataWithAIInput): Promise<AnalyzeFinancialDataWithAIOutput> {
  return analyzeFinancialDataWithAIFlow(input);
}

const analyzeFinancialDataPrompt = ai.definePrompt({
  name: 'analyzeFinancialDataPrompt',
  input: {schema: AnalyzeFinancialDataWithAIInputSchema},
  output: {schema: AnalyzeFinancialDataWithAIOutputSchema},
  prompt: `Você é o assistente de inteligência do AM Finance. Seu objetivo é analisar os dados financeiros e gerar insights estratégicos.

DRE:
Receita: {{{simplifiedDRE.revenue}}}
Despesas: {{{simplifiedDRE.expenses}}}
Resultado Líquido: {{{simplifiedDRE.netResult}}}

Fluxo de Caixa:
{{#each cashFlowStatement}}
Período: {{{period}}} | Saldo: {{{netFlow}}}
{{/each}}

Contas em Atraso:
{{#each overdueAccounts}}
- {{{description}}}: R$ {{{amount}}} ({{{daysOverdue}}} dias)
{{/each}}

Forneça uma análise detalhada e recomendações para o negócio. Responda em PORTUGUÊS (Brasil).`,
});

const analyzeFinancialDataWithAIFlow = ai.defineFlow(
  {
    name: 'analyzeFinancialDataWithAIFlow',
    inputSchema: AnalyzeFinancialDataWithAIInputSchema,
    outputSchema: AnalyzeFinancialDataWithAIOutputSchema,
  },
  async input => {
    const {output} = await analyzeFinancialDataPrompt(input);
    return output!;
  }
);
