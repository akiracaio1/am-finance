'use server';
/**
 * @fileOverview Um agente de IA para analisar dados financeiros e fornecer insights e recomendações.
 *
 * - analyzeFinancialDataWithAI - Uma função que gerencia o processo de análise de dados financeiros.
 * - AnalyzeFinancialDataWithAIInput - O tipo de entrada para a função analyzeFinancialDataWithAI.
 * - AnalyzeFinancialDataWithAIOutput - O tipo de retorno para a função analyzeFinancialDataWithAI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimplifiedDRESchema = z.object({
  revenue: z.number().describe('Receita total do período.'),
  expenses: z.number().describe('Despesas totais do período.'),
  netResult: z.number().describe('Resultado líquido (receita - despesas) do período.'),
});

const CashFlowPeriodSchema = z.object({
  period: z.string().describe('O período da entrada de fluxo de caixa (ex: "Mês Passado", "Q1 2024").'),
  inflows: z.number().describe('Entradas totais de caixa no período.'),
  outflows: z.number().describe('Saídas totais de caixa no período.'),
  netFlow: z.number().describe('Fluxo líquido de caixa no período.'),
});

const OverdueAccountSchema = z.object({
  description: z.string().describe('Descrição da conta em atraso.'),
  amount: z.number().describe('Valor da conta em atraso.'),
  dueDate: z.string().describe('Data de vencimento da conta em atraso no formato ISO.'),
  daysOverdue: z.number().describe('Número de dias que a conta está em atraso.'),
});

const UpcomingAccountSchema = z.object({
  description: z.string().describe('Descrição da conta futura.'),
  amount: z.number().describe('Valor da conta futura.'),
  dueDate: z.string().describe('Data de vencimento da conta futura no formato ISO.'),
  type: z.enum(['payable', 'receivable']).describe('Tipo da conta futura (a pagar ou a receber).'),
});

export const AnalyzeFinancialDataWithAIInputSchema = z.object({
  simplifiedDRE: SimplifiedDRESchema.describe('Dados simplificados da Demonstração de Resultado do Exercício.'),
  cashFlowStatement: z.array(CashFlowPeriodSchema).describe('Dados do Fluxo de Caixa para vários períodos.'),
  overdueAccounts: z.array(OverdueAccountSchema).describe('Lista de contas em atraso.'),
  upcomingAccounts: z.array(UpcomingAccountSchema).describe('Lista de contas futuras.'),
});
export type AnalyzeFinancialDataWithAIInput = z.infer<typeof AnalyzeFinancialDataWithAIInputSchema>;

export const AnalyzeFinancialDataWithAIOutputSchema = z.object({
  overallSummary: z.string().describe('Um resumo conciso e geral do desempenho financeiro.'),
  keyInsights: z.array(z.string()).describe('Insights chave derivados dos dados financeiros.'),
  strategicRecommendations: z.array(z.string()).describe('Recomendações estratégicas para melhorar o desempenho financeiro.'),
  potentialRisks: z.array(z.string()).describe('Riscos financeiros potenciais identificados.'),
  opportunities: z.array(z.string()).describe('Oportunidades financeiras potenciais identificadas.'),
});
export type AnalyzeFinancialDataWithAIOutput = z.infer<typeof AnalyzeFinancialDataWithAIOutputSchema>;

export async function analyzeFinancialDataWithAI(input: AnalyzeFinancialDataWithAIInput): Promise<AnalyzeFinancialDataWithAIOutput> {
  return analyzeFinancialDataWithAIFlow(input);
}

const analyzeFinancialDataPrompt = ai.definePrompt({
  name: 'analyzeFinancialDataPrompt',
  input: {schema: AnalyzeFinancialDataWithAIInputSchema},
  output: {schema: AnalyzeFinancialDataWithAIOutputSchema},
  prompt: `Você é um analista financeiro especialista para uma pequena empresa chamada Yumi Yumi 🍣, especializada em sushi. Seu objetivo é analisar os dados financeiros fornecidos e gerar insights e recomendações acionáveis para ajudar o proprietário da empresa a tomar melhores decisões.

Analise os seguintes relatórios financeiros:

Demonstração de Resultado Simplificada (DRE):
Receita: {{{simplifiedDRE.revenue}}}
Despesas: {{{simplifiedDRE.expenses}}}
Resultado Líquido: {{{simplifiedDRE.netResult}}}

Fluxo de Caixa (por período):
{{#each cashFlowStatement}}
Período: {{{period}}}
Entradas: {{{inflows}}}
Saídas: {{{outflows}}}
Fluxo Líquido: {{{netFlow}}}
---
{{/each}}

Contas em Atraso:
{{#if overdueAccounts}}
{{#each overdueAccounts}}
- Descrição: {{{description}}}, Valor: {{{amount}}}, Vencimento: {{{dueDate}}}, Dias em Atraso: {{{daysOverdue}}}
{{/each}}
{{else}}
Não há contas em atraso.
{{/if}}

Contas Futuras:
{{#if upcomingAccounts}}
{{#each upcomingAccounts}}
- Descrição: {{{description}}}, Valor: {{{amount}}}, Vencimento: {{{dueDate}}}, Tipo: {{{type}}}
{{/each}}
{{else}}
Não há contas futuras previstas.
{{/if}}

Com base nesses dados, forneça:
1. Um resumo geral do desempenho financeiro.
2. Insights principais sobre a saúde financeira do negócio.
3. Recomendações estratégicas e acionáveis para melhoria.
4. Identificação de quaisquer riscos potenciais.
5. Identificação de quaisquer oportunidades potenciais.

Responda em PORTUGUÊS (Brasil). Certifique-se de que sua análise seja abrangente, fácil de entender e enderece diretamente a necessidade do proprietário de tomar decisões melhores.`,
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
