'use server';
/**
 * @fileOverview Fluxo de IA para analisar a estrutura de planilhas externas e sugerir melhorias no sistema.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeSpreadsheetInputSchema = z.object({
  spreadsheetContent: z.string().describe('O conteúdo bruto da planilha colado pelo usuário (CSV, TAB ou texto).'),
});
export type AnalyzeSpreadsheetInput = z.infer<typeof AnalyzeSpreadsheetInputSchema>;

const AnalyzeSpreadsheetOutputSchema = z.object({
  detectedFields: z.array(z.string()).describe('Campos identificados na planilha.'),
  missingInSystem: z.array(z.string()).describe('Elementos importantes encontrados na planilha que não estão no sistema atual.'),
  improvementSuggestions: z.array(z.string()).describe('Sugestões de como adaptar o sistema para acomodar esses novos dados.'),
  recommendedCategories: z.array(z.string()).describe('Novas categorias para o Plano de Contas baseadas na planilha.'),
});
export type AnalyzeSpreadsheetOutput = z.infer<typeof AnalyzeSpreadsheetOutputSchema>;

export async function analyzeSpreadsheetStructure(input: AnalyzeSpreadsheetInput): Promise<AnalyzeSpreadsheetOutput> {
  return analyzeSpreadsheetStructureFlow(input);
}

const analyzeSpreadsheetPrompt = ai.definePrompt({
  name: 'analyzeSpreadsheetPrompt',
  input: {schema: AnalyzeSpreadsheetInputSchema},
  output: {schema: AnalyzeSpreadsheetOutputSchema},
  prompt: `Você é um consultor técnico de sistemas financeiros. O usuário colou o conteúdo de uma planilha que ele usa para controle manual.
Seu objetivo é analisar esse conteúdo e comparar com o sistema atual da Yumi Yumi 🍣 (que já possui: DRE, Fluxo de Caixa, Contas a Pagar/Receber, Conciliação e Plano de Contas).

Conteúdo da Planilha:
"""
{{{spreadsheetContent}}}
"""

Identifique:
1. Quais colunas/campos ele usa (ex: data de pagamento, método, taxa de cartão).
2. O que tem lá que falta no nosso sistema (ex: controle de estoque, comissão de garçons, impostos específicos).
3. Sugira como podemos expandir o sistema atual para ser mais completo que a planilha dele.

Responda em PORTUGUÊS (Brasil).`,
});

const analyzeSpreadsheetStructureFlow = ai.defineFlow(
  {
    name: 'analyzeSpreadsheetStructureFlow',
    inputSchema: AnalyzeSpreadsheetInputSchema,
    outputSchema: AnalyzeSpreadsheetOutputSchema,
  },
  async input => {
    const {output} = await analyzeSpreadsheetPrompt(input);
    return output!;
  }
);
