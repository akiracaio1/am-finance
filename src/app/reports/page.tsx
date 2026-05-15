
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  PieChart, 
  Sparkles, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown,
  LayoutGrid,
  Filter,
  CalendarDays,
  ArrowRight,
  Download,
  Loader2,
  RefreshCcw,
  Target,
  AlertTriangle,
  Zap,
  BarChart3,
  Building2,
  Users
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useDoc
} from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { 
  AccountsPayableEntry, 
  AccountsReceivableEntry, 
  AccountCategory, 
  Supplier, 
  CostCenter,
  CostCenterGroup
} from "@/lib/types";
import { 
  format, 
  parseISO, 
  isWithinInterval, 
  startOfMonth, 
  endOfMonth 
} from "date-fns";
import { exportToExcel, formatCurrency, calculateDRE } from "@/lib/report-utils";
import { analyzeFinancialDataWithAI, AnalyzeFinancialDataWithAIOutput } from "@/ai/flows/analyze-financial-data-with-ai";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Estados de Filtro
  const [dateType, setDateType] = useState<"dueDate" | "paymentDate">("paymentDate");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterCostCenterId, setFilterCostCenterId] = useState("all");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeFinancialDataWithAIOutput | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Queries
  const payablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsPayableEntries");
  }, [db, user]);

  const receivablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsReceivableEntries");
  }, [db, user]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "suppliers");
  }, [db, user]);

  const { data: payables } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: receivables } = useCollection<AccountsReceivableEntry>(receivablesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  // Lógica de Filtragem de Dados
  const filteredData = useMemo(() => {
    if (!payables || !receivables) return { payables: [], receivables: [] };

    const filterFn = (item: any) => {
      const dateStr = item[dateType];
      if (!dateStr) return false;
      
      const date = parseISO(dateStr);
      const isDateMatch = date >= parseISO(startDate) && date <= parseISO(endDate);
      const isCenterMatch = filterCostCenterId === "all" || item.costCenterId === filterCostCenterId;
      
      return isDateMatch && isCenterMatch;
    };

    return {
      payables: payables.filter(filterFn),
      receivables: receivables.filter(filterFn)
    };
  }, [payables, receivables, startDate, endDate, dateType, filterCostCenterId]);

  // Cálculos Financeiros
  const totals = useMemo(() => {
    const revenue = filteredData.receivables.reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = filteredData.payables.reduce((acc, curr) => 
      acc + (curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0)), 0
    );
    return { revenue, expenses, net: revenue - expenses };
  }, [filteredData]);

  const dreData = useMemo(() => {
    if (!categories) return null;
    return calculateDRE(filteredData.payables, filteredData.receivables, categories);
  }, [filteredData, categories]);

  // Funções de Exportação
  const handleExportLançamentos = () => {
    const data = [
      ...filteredData.receivables.map(r => ({
        Tipo: 'ENTRADA (Receita)',
        Vencimento: r.dueDate,
        Liquidação: r.paymentDate || '-',
        Descrição: r.description,
        Cliente_Origem: r.customerName,
        Categoria: categories?.find(c => c.id === r.accountCategoryId)?.name || '-',
        Valor: r.amount,
        Status: r.status === 'Paid' ? 'Recebido' : 'Pendente'
      })),
      ...filteredData.payables.map(p => ({
        Tipo: 'SAÍDA (Despesa)',
        Vencimento: p.dueDate,
        Liquidação: p.paymentDate || '-',
        Descrição: p.description,
        Fornecedor: suppliers?.find(s => s.id === p.supplierId)?.name || '-',
        Categoria: categories?.find(c => c.id === p.accountCategoryId)?.name || '-',
        Valor: p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0),
        Status: p.status === 'Paid' ? 'Pago' : 'Pendente'
      }))
    ].sort((a,b) => a.Vencimento.localeCompare(b.Vencimento));

    exportToExcel({
      data,
      filename: `Relatorio_Lancamentos_${startDate}_a_${endDate}`,
      sheetName: 'Lançamentos Financeiros',
      summary: { 'Descrição': 'TOTAL CONSOLIDADO', 'Valor': totals.net }
    });
  };

  const runAIAnalysis = async () => {
    if (!dreData) return;
    setIsAnalyzing(true);
    try {
      const input = {
        simplifiedDRE: {
          revenue: totals.revenue,
          expenses: totals.expenses,
          netResult: totals.net
        },
        cashFlowStatement: [
          { period: "Período Selecionado", inflows: totals.revenue, outflows: totals.expenses, netFlow: totals.net }
        ],
        overdueAccounts: filteredData.payables
          .filter(p => p.status !== 'Paid' && p.dueDate < format(new Date(), "yyyy-MM-dd"))
          .map(p => ({
            description: p.description,
            amount: p.originalAmount,
            dueDate: p.dueDate,
            daysOverdue: 10
          })),
        upcomingAccounts: []
      };

      const result = await analyzeFinancialDataWithAI(input);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Erro na análise IA", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!mounted) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PieChart className="text-primary w-8 h-8" />
            Relatórios e Inteligência
          </h1>
          <p className="text-muted-foreground">Visão estratégica e exportação profissional dos dados financeiros.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="gap-2 flex-1 md:flex-none" onClick={handleExportLançamentos}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel
          </Button>
          <Button 
            className="gap-2 flex-1 md:flex-none bg-gradient-to-r from-primary to-accent hover:opacity-90 border-none"
            onClick={runAIAnalysis}
            disabled={isAnalyzing || !dreData}
          >
            {isAnalyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? "Analisando..." : "Consultoria IA"}
          </Button>
        </div>
      </div>

      {/* Painel de Filtros Globais */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Filtrar por Data de:</Label>
              <Select value={dateType} onValueChange={(v: any) => setDateType(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Vencimento</SelectItem>
                  <SelectItem value="paymentDate">Liquidação (Pago/Rec.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Início do Período</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" className="pl-9 bg-background" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fim do Período</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" className="pl-9 bg-background" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Centro de Custo</Label>
              <Select value={filterCostCenterId} onValueChange={setFilterCostCenterId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Centros</SelectItem>
                  {centers?.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => {
                setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
                setFilterCostCenterId("all");
              }}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Badge variant="outline" className="h-10 px-4 text-[10px] uppercase border-primary/20 bg-primary/5 text-primary font-bold">
                {filteredData.payables.length + filteredData.receivables.length} Registros
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="p-4 pb-0 text-[10px] uppercase font-bold text-muted-foreground">Total Entradas (Receitas)</CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-emerald-700">{formatCurrency(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardHeader className="p-4 pb-0 text-[10px] uppercase font-bold text-muted-foreground">Total Saídas (Despesas)</CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totals.expenses)}</div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4 shadow-sm", totals.net >= 0 ? "border-l-primary" : "border-l-amber-500")}>
          <CardHeader className="p-4 pb-0 text-[10px] uppercase font-bold text-muted-foreground">Resultado Operacional</CardHeader>
          <CardContent className="p-4 pt-1">
            <div className={cn("text-2xl font-bold", totals.net >= 0 ? "text-primary" : "text-amber-600")}>{formatCurrency(totals.net)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full md:w-[600px] h-12">
          <TabsTrigger value="overview" className="gap-2">Overview</TabsTrigger>
          <TabsTrigger value="dre" className="gap-2">DRE Gerencial</TabsTrigger>
          <TabsTrigger value="cost-centers" className="gap-2">C. Custos</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">Inteligência IA</TabsTrigger>
        </TabsList>

        {/* Aba de Resumo Visual */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Receitas por Grupo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {dreData && Object.entries(dreData.revenueByGroup).map(([group, val]: any) => (
                  <div key={group} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium"><span>{group}</span><span>{formatCurrency(val)}</span></div>
                    <Progress value={(val / totals.revenue) * 100} className="h-1.5 bg-emerald-50" />
                  </div>
                ))}
                {!dreData || Object.keys(dreData.revenueByGroup).length === 0 && <p className="text-center py-10 text-muted-foreground italic text-xs">Sem entradas no período.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="w-5 h-5 text-destructive" /> Despesas por Grupo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {dreData && Object.entries(dreData.expenseByGroup).sort((a: any, b: any) => b[1] - a[1]).map(([group, val]: any) => (
                  <div key={group} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium"><span>{group}</span><span>{formatCurrency(val)}</span></div>
                    <Progress value={(val / totals.expenses) * 100} className="h-1.5 bg-destructive/5" />
                  </div>
                ))}
                {!dreData || Object.keys(dreData.expenseByGroup).length === 0 && <p className="text-center py-10 text-muted-foreground italic text-xs">Sem saídas no período.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba DRE Gerencial */}
        <TabsContent value="dre">
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle>DRE Gerencial - Competência</CardTitle>
              <CardDescription>Visualização por regime de liquidação no período selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-sm">
                <div className="flex justify-between p-4 bg-emerald-50/30">
                  <span className="font-bold uppercase tracking-tight text-emerald-800">(+) RECEITA BRUTA OPERACIONAL</span>
                  <span className="font-bold text-emerald-800">{formatCurrency(totals.revenue)}</span>
                </div>
                
                {dreData && Object.entries(dreData.revenueByGroup).map(([group, val]: any) => (
                  <div key={group} className="flex justify-between p-4 pl-8 text-muted-foreground">
                    <span>{group}</span>
                    <span>{formatCurrency(val)}</span>
                  </div>
                ))}

                <div className="flex justify-between p-4 bg-destructive/5">
                  <span className="font-bold uppercase tracking-tight text-destructive">(-) DESPESAS E CUSTOS</span>
                  <span className="font-bold text-destructive">{formatCurrency(totals.expenses)}</span>
                </div>

                {dreData && Object.entries(dreData.expenseByGroup).map(([group, val]: any) => (
                  <div key={group} className="flex justify-between p-4 pl-8 text-muted-foreground">
                    <span>{group}</span>
                    <span>{formatCurrency(val)}</span>
                  </div>
                ))}

                <div className={cn("flex justify-between p-6 bg-muted/20 text-lg", totals.net >= 0 ? "text-primary" : "text-destructive")}>
                  <span className="font-bold uppercase">(=) RESULTADO LÍQUIDO</span>
                  <span className="font-black underline decoration-double">{formatCurrency(totals.net)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Centros de Custo */}
        <TabsContent value="cost-centers">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {centers?.sort((a,b) => a.name.localeCompare(b.name)).map(center => {
              const cRevenue = filteredData.receivables.filter(r => r.costCenterId === center.id).reduce((acc, curr) => acc + curr.amount, 0);
              const cExpense = filteredData.payables.filter(p => p.costCenterId === center.id).reduce((acc, curr) => 
                acc + (curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0)), 0
              );
              const cNet = cRevenue - cExpense;

              if (cRevenue === 0 && cExpense === 0) return null;

              return (
                <Card key={center.id} className="hover:shadow-md transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm font-bold uppercase truncate pr-2">{center.name}</CardTitle>
                      <LayoutGrid className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold">
                      <div className="bg-emerald-50 text-emerald-700 p-2 rounded">
                        Entradas: {formatCurrency(cRevenue)}
                      </div>
                      <div className="bg-destructive/5 text-destructive p-2 rounded">
                        Saídas: {formatCurrency(cExpense)}
                      </div>
                    </div>
                    <div className={cn("text-center p-3 rounded-lg border-2", cNet >= 0 ? "bg-primary/5 border-primary/20 text-primary" : "bg-destructive/5 border-destructive/20 text-destructive")}>
                      <p className="text-[10px] uppercase font-black opacity-70 mb-1">Margem do Centro</p>
                      <p className="text-xl font-bold">{formatCurrency(cNet)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {(!centers || centers.length === 0) && (
              <div className="col-span-full py-20 border-2 border-dashed rounded-xl text-center text-muted-foreground italic">
                Nenhuma movimentação por Centro de Custo no período.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Aba de Inteligência IA */}
        <TabsContent value="ai">
          <Card className={cn(
            "transition-all duration-500",
            analysisResult ? "border-accent ring-2 ring-accent/20" : "bg-muted/30 border-dashed"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Centro de Inteligência IA
              </CardTitle>
              <CardDescription>Insights gerados a partir dos dados filtrados.</CardDescription>
            </CardHeader>
            <CardContent>
              {!analysisResult ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <Zap className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="font-bold text-lg">Pronto para analisar?</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                    Clique no botão "Consultoria IA" no topo da página para processar os dados atuais.
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
                        <Target className="w-3 h-3" /> Recomendações Estratégicas
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
                        <AlertTriangle className="w-3 h-3" /> Pontos de Atenção / Riscos
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
