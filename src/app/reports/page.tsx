"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  PieChart, 
  Sparkles, 
  FileText, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Lightbulb,
  AlertTriangle,
  Target,
  Zap,
  RotateCcw
} from "lucide-react";
import { 
  AnalyzeFinancialDataWithAIInput, 
  AnalyzeFinancialDataWithAIOutput,
  analyzeFinancialDataWithAI 
} from "@/ai/flows/analyze-financial-data-with-ai";
import { MOCK_ENTRIES } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeFinancialDataWithAIOutput | null>(null);

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const input: AnalyzeFinancialDataWithAIInput = {
        simplifiedDRE: {
          revenue: 48000,
          expenses: 32000,
          netResult: 16000
        },
        cashFlowStatement: [
          { period: "Março 2024", inflows: 48000, outflows: 32000, netFlow: 16000 },
          { period: "Fevereiro 2024", inflows: 52000, outflows: 35000, netFlow: 17000 }
        ],
        overdueAccounts: MOCK_ENTRIES
          .filter(e => e.status === 'overdue')
          .map(e => ({
            description: e.description,
            amount: e.amount,
            dueDate: e.dueDate,
            daysOverdue: 15
          })),
        upcomingAccounts: MOCK_ENTRIES
          .filter(e => e.status === 'open')
          .map(e => ({
            description: e.description,
            amount: e.amount,
            dueDate: e.dueDate,
            type: e.type as 'payable' | 'receivable'
          }))
      };

      const result = await analyzeFinancialDataWithAI(input);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Análise de IA falhou", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PieChart className="text-primary w-8 h-8" />
            Relatórios Financeiros
          </h1>
          <p className="text-muted-foreground">Demonstrativos detalhados e inteligência de negócios impulsionada por IA.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <FileText className="w-4 h-4" /> Baixar PDF
          </Button>
          <Button 
            onClick={runAIAnalysis} 
            disabled={isAnalyzing}
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 border-none shadow-lg"
          >
            {isAnalyzing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? "Analisando..." : "Analisar com IA"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>DRE Simplificado (P&L)</CardTitle>
            <CardDescription>Demonstração de Resultado para Março 2024</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-bold tracking-tighter">Receita Bruta</p>
                <p className="text-3xl font-bold text-emerald-600">R$ 48.000,00</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">+12% vs sem. ant.</Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Custos Operacionais (Insumos)</span>
                <span className="font-bold">R$ 22.000,00</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Custos Fixos e Admin</span>
                <span className="font-bold">R$ 10.000,00</span>
              </div>
              <Progress value={20} className="h-2" />
            </div>

            <div className="pt-4 border-t flex justify-between items-center">
              <p className="text-lg font-bold">Resultado Líquido</p>
              <p className="text-2xl font-bold text-primary">R$ 16.000,00</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "transition-all duration-500",
          analysisResult ? "border-accent ring-2 ring-accent/20" : "bg-muted/30 border-dashed"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Centro de Inteligência IA
            </CardTitle>
            <CardDescription>Insights gerados a partir dos seus dados financeiros.</CardDescription>
          </CardHeader>
          <CardContent>
            {!analysisResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <Lightbulb className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-bold text-lg">Nenhuma análise disponível</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                  Clique no botão "Analisar com IA" acima para obter consultoria financeira baseada nos seus números reais.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                  <p className="text-sm font-medium leading-relaxed italic text-foreground/80">
                    "{analysisResult.overallSummary}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-accent flex items-center gap-1">
                      <Target className="w-3 h-3" /> Recomendações
                    </h4>
                    <ul className="text-xs space-y-2">
                      {analysisResult.strategicRecommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-accent font-bold">•</span> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Riscos
                    </h4>
                    <ul className="text-xs space-y-2">
                      {analysisResult.potentialRisks.map((risk, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-destructive font-bold">•</span> {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-xs font-bold uppercase text-emerald-600 flex items-center gap-1 mb-2">
                    <Zap className="w-3 h-3" /> Oportunidades Rápidas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.opportunities.map((opp, i) => (
                      <Badge key={i} variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none">
                        {opp}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
