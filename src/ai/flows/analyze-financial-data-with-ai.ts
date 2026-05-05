'use server';
/**
 * @fileOverview An AI agent for analyzing financial data and providing insights and recommendations.
 *
 * - analyzeFinancialDataWithAI - A function that handles the financial data analysis process.
 * - AnalyzeFinancialDataWithAIInput - The input type for the analyzeFinancialDataWithAI function.
 * - AnalyzeFinancialDataWithAIOutput - The return type for the analyzeFinancialDataWithAI function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimplifiedDRESchema = z.object({
  revenue: z.number().describe('Total revenue for the period.'),
  expenses: z.number().describe('Total expenses for the period.'),
  netResult: z.number().describe('Net result (revenue - expenses) for the period. (revenue - expenses)'),
});

const CashFlowPeriodSchema = z.object({
  period: z.string().describe('The period for the cash flow entry (e.g., "Last Month", "Q1 2024").'),
  inflows: z.number().describe('Total cash inflows for the period.'),
  outflows: z.number().describe('Total cash outflows for the period.'),
  netFlow: z.number().describe('Net cash flow for the period.'),
});

const OverdueAccountSchema = z.object({
  description: z.string().describe('Description of the overdue account.'),
  amount: z.number().describe('Amount of the overdue account.'),
  dueDate: z.string().describe('Due date of the overdue account in ISO format.'),
  daysOverdue: z.number().describe('Number of days the account is overdue.'),
});

const UpcomingAccountSchema = z.object({
  description: z.string().describe('Description of the upcoming account.'),
  amount: z.number().describe('Amount of the upcoming account.'),
  dueDate: z.string().describe('Due date of the upcoming account in ISO format.'),
  type: z.enum(['payable', 'receivable']).describe('Type of the upcoming account (payable or receivable).'),
});

export const AnalyzeFinancialDataWithAIInputSchema = z.object({
  simplifiedDRE: SimplifiedDRESchema.describe('Simplified Income Statement data.'),
  cashFlowStatement: z.array(CashFlowPeriodSchema).describe('Cash Flow Statement data for various periods.'),
  overdueAccounts: z.array(OverdueAccountSchema).describe('List of overdue accounts.'),
  upcomingAccounts: z.array(UpcomingAccountSchema).describe('List of upcoming accounts.'),
});
export type AnalyzeFinancialDataWithAIInput = z.infer<typeof AnalyzeFinancialDataWithAIInputSchema>;

export const AnalyzeFinancialDataWithAIOutputSchema = z.object({
  overallSummary: z.string().describe('A concise overall summary of the financial performance.'),
  keyInsights: z.array(z.string()).describe('Key insights derived from the financial data.'),
  strategicRecommendations: z.array(z.string()).describe('Strategic recommendations for improving financial performance.'),
  potentialRisks: z.array(z.string()).describe('Potential financial risks identified.'),
  opportunities: z.array(z.string()).describe('Potential financial opportunities identified.'),
});
export type AnalyzeFinancialDataWithAIOutput = z.infer<typeof AnalyzeFinancialDataWithAIOutputSchema>;

export async function analyzeFinancialDataWithAI(input: AnalyzeFinancialDataWithAIInput): Promise<AnalyzeFinancialDataWithAIOutput> {
  return analyzeFinancialDataWithAIFlow(input);
}

const analyzeFinancialDataPrompt = ai.definePrompt({
  name: 'analyzeFinancialDataPrompt',
  input: {schema: AnalyzeFinancialDataWithAIInputSchema},
  output: {schema: AnalyzeFinancialDataWithAIOutputSchema},
  prompt: `You are an expert financial analyst for a small business named Yumi Yumi 🍣, specializing in sushi. Your goal is to analyze the provided financial data and generate insights and actionable recommendations to help the business owner make better decisions.

Analyze the following financial reports:

Simplified Income Statement (DRE):
Revenue: {{{simplifiedDRE.revenue}}}
Expenses: {{{simplifiedDRE.expenses}}}
Net Result: {{{simplifiedDRE.netResult}}}

Cash Flow Statement (by period):
{{#each cashFlowStatement}}
Period: {{{period}}}
Inflows: {{{inflows}}}
Outflows: {{{outflows}}}
Net Flow: {{{netFlow}}}
---
{{/each}}

Overdue Accounts:
{{#if overdueAccounts}}
{{#each overdueAccounts}}
- Description: {{{description}}}, Amount: {{{amount}}}, Due Date: {{{dueDate}}}, Days Overdue: {{{daysOverdue}}}
{{/each}}
{{else}}
No overdue accounts.
{{/if}}

Upcoming Accounts:
{{#if upcomingAccounts}}
{{#each upcomingAccounts}}
- Description: {{{description}}}, Amount: {{{amount}}}, Due Date: {{{dueDate}}}, Type: {{{type}}}
{{/each}}
{{else}}
No upcoming accounts.
{{/if}}

Based on this data, provide:
1. An overall summary of the financial performance.
2. Key insights about the business's financial health.
3. Strategic and actionable recommendations for improvement.
4. Identification of any potential risks.
5. Identification of any potential opportunities.

Ensure your analysis is comprehensive, easy to understand, and directly addresses the business owner's need for better decision-making.`,
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
