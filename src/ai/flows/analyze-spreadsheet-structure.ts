
'use server';
/**
 * @fileOverview Fluxo de IA para analisar a estrutura de planilhas no AM Finance.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeSpreadsheetInputSchema = z.object({
  spreadsheetContent: z.string().describe('Conteúdo da planilha colado pelo usuário.'),
});
export type AnalyzeSpreadsheetInput = z.infer<typeof AnalyzeSpreadsheetInputSchema>;

const AnalyzeSpreadsheetOutputSchema = z.object({
  detectedFields: z.array(z.string()).describe('Campos identificados.'),
  missingInSystem: z.array(z.string()).describe('Elementos faltando no sistema.'),
  improvementSuggestions: z.array(z.string()).describe('Sugestões de adaptação.'),
  recommendedCategories: z.array(z.string()).describe('Novas categorias recomendadas.'),
});
export type AnalyzeSpreadsheetOutput = z.infer<typeof AnalyzeSpreadsheetOutputSchema>;

export async function analyzeSpreadsheetStructure(input: AnalyzeSpreadsheetInput): Promise<AnalyzeSpreadsheetOutput> {
  return analyzeSpreadsheetStructureFlow(input);
}

const analyzeSpreadsheetPrompt = ai.definePrompt({
  name: 'analyzeSpreadsheetPrompt',
  input: {schema: AnalyzeSpreadsheetInputSchema},
  output: {schema: AnalyzeSpreadsheetOutputSchema},
  prompt: `Você é um consultor técnico do AM Finance. O usuário colou dados de uma planilha manual.
Compare esses dados com a estrutura do AM Finance (DRE, Fluxo de Caixa, Contas a Pagar/Receber).

Conteúdo:
"""
{{{spreadsheetContent}}}
"""

Identifique lacunas e sugira como o AM Finance pode substituir essa planilha de forma inteligente.
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
