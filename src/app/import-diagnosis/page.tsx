"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileSearch, 
  Sparkles, 
  ListChecks, 
  AlertCircle, 
  Lightbulb,
  ArrowRight,
  ClipboardCheck
} from "lucide-react";
import { analyzeSpreadsheetStructure, AnalyzeSpreadsheetOutput } from "@/ai/flows/analyze-spreadsheet-structure";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function ImportDiagnosisPage() {
  const [content, setContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeSpreadsheetOutput | null>(null);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast({
        title: "Conteúdo vazio",
        description: "Por favor, cole o conteúdo da sua planilha para análise.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const output = await analyzeSpreadsheetStructure({ spreadsheetContent: content });
      setResult(output);
      toast({
        title: "Análise Concluída",
        description: "A IA identificou oportunidades de melhoria baseadas na sua planilha.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível processar os dados agora.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileSearch className="text-primary w-8 h-8" />
          Diagnóstico de Planilha
        </h1>
        <p className="text-muted-foreground">Compare sua planilha antiga com o novo sistema para não perder nenhum detalhe.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Cole seus dados</CardTitle>
            <CardDescription>Copie as linhas da sua planilha (incluindo o cabeçalho) e cole abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <Textarea 
              placeholder="Data; Descrição; Valor; Categoria; Status..." 
              className="flex-1 min-h-[300px] font-mono text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing}
              className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {isAnalyzing ? "Analisando..." : <><Sparkles className="w-4 h-4" /> Analisar Estrutura</>}
            </Button>
          </CardContent>
        </Card>

        <Card className={!result ? "bg-muted/30 border-dashed flex items-center justify-center" : ""}>
          {!result ? (
            <div className="text-center p-12">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Os resultados da análise de IA aparecerão aqui.</p>
            </div>
          ) : (
            <CardContent className="pt-6 space-y-6 animate-in zoom-in-95 duration-500">
              <div className="space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                  <ListChecks className="w-4 h-4" /> Campos Detectados
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.detectedFields.map((f, i) => (
                    <Badge key={i} variant="outline">{f}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" /> O que falta no sistema?
                </h3>
                <ul className="text-xs space-y-2">
                  {result.missingInSystem.map((m, i) => (
                    <li key={i} className="flex gap-2 bg-destructive/5 p-2 rounded border border-destructive/10">
                      <ArrowRight className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-accent">
                  <Lightbulb className="w-4 h-4" /> Sugestões de Melhoria
                </h3>
                <ul className="text-xs space-y-2">
                  {result.improvementSuggestions.map((s, i) => (
                    <li key={i} className="flex gap-2 bg-accent/5 p-2 rounded border border-accent/10">
                      <Sparkles className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-bold mb-3">Novas Categorias Recomendadas</h3>
                <div className="flex flex-wrap gap-2">
                  {result.recommendedCategories.map((c, i) => (
                    <Badge key={i} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
