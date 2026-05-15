
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
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Clock,
  ChevronDown,
  ChevronUp,
  Scale
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase
} from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { 
  AccountsPayableEntry, 
  AccountsReceivableEntry, 
  AccountCategory, 
  Supplier, 
  CostCenter,
  BankAccount
} from "@/lib/types";
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  isWithinInterval,
  eachMonthOfInterval
} from "date-fns";
import { 
  exportToExcel, 
  formatCurrency, 
  calculateProfessionalDRE,
  calculateGrowth 
} from "@/lib/report-utils";
import { analyzeFinancialDataWithAI, AnalyzeFinancialDataWithAIOutput } from "@/ai/flows/analyze-financial-data-with-ai";
import { cn } from "@/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

export default function ReportsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Filtros Globais
  const [dateType, setDateType] = useState<"dueDate" | "paymentDate">("paymentDate");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterCostCenterId, setFilterCostCenterId] = useState("all");
  
  // Estados de IA e Análise
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

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "bankAccounts");
  }, [db, user]);

  const { data: payables } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: receivables } = useCollection<AccountsReceivableEntry>(receivablesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);
  const { data: accounts } = useCollection<BankAccount>(accountsQuery);

  // Lógica de Filtragem (Período Atual e Anterior para Comparação)
  const stats = useMemo(() => {
    if (!payables || !receivables || !categories) return null;

    const filterByInterval = (data: any[], start: string, end: string) => {
      return data.filter(item => {
        const d = item[dateType];
        if (!d) return false;
        const isDateMatch = d >= start && d <= end;
        const isCenterMatch = filterCostCenterId === "all" || item.costCenterId === filterCostCenterId;
        return isDateMatch && isCenterMatch;
      });
    };

    // Período Atual
    const currentP = filterByInterval(payables, startDate, endDate);
    const currentR = filterByInterval(receivables, startDate, endDate);
    const currentDRE = calculateProfessionalDRE(currentP, currentR, categories);

    // Período Anterior (para crescimento %)
    const prevStart = format(subMonths(parseISO(startDate), 1), "yyyy-MM-dd");
    const prevEnd = format(subMonths(parseISO(endDate), 1), "yyyy-MM-dd");
    const prevP = filterByInterval(payables, prevStart, prevEnd);
    const prevR = filterByInterval(receivables, prevStart, prevEnd);
    const prevDRE = calculateProfessionalDRE(prevP, prevR, categories);

    // Dados de Evolução Mensal (Últimos 6 meses)
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    const evolutionData = months.map(m => {
      const ms = format(startOfMonth(m), "yyyy-MM-dd");
      const me = format(endOfMonth(m), "yyyy-MM-dd");
      const mP = filterByInterval(payables, ms, me);
      const mR = filterByInterval(receivables, ms, me);
      const dre = calculateProfessionalDRE(mP, mR, categories);
      return {
        name: format(m, "MMM"),
        receita: dre.grossRevenue,
        despesa: dre.totalVariableCosts + dre.totalFixedExpenses,
        lucro: dre.netResult
      };
    });

    return {
      current: currentDRE,
      previous: prevDRE,
      evolution: evolutionData,
      raw: { payables: currentP, receivables: currentR }
    };
  }, [payables, receivables, categories, startDate, endDate, dateType, filterCostCenterId]);

  // Ranking de Centros de Custo
  const costCenterRanking = useMemo(() => {
    if (!centers || !stats) return [];
    return centers.map(c => {
      const cRev = stats.raw.receivables.filter(r => r.costCenterId === c.id).reduce((a, b) => a + b.amount, 0);
      const cExp = stats.raw.payables.filter(p => p.costCenterId === c.id).reduce((a, b) => a + (b.originalAmount + (b.interest || 0) - (b.discount || 0)), 0);
      return {
        name: c.name,
        revenue: cRev,
        expense: cExp,
        net: cRev - cExp,
        margin: cRev > 0 ? ((cRev - cExp) / cRev) * 100 : 0
      };
    }).filter(c => c.revenue !== 0 || c.expense !== 0)
      .sort((a, b) => b.net - a.net);
  }, [centers, stats]);

  const runAIAnalysis = async () => {
    if (!stats) return;
    setIsAnalyzing(true);
    try {
      const input = {
        simplifiedDRE: {
          revenue: stats.current.grossRevenue,
          expenses: stats.current.totalVariableCosts + stats.current.totalFixedExpenses,
          netResult: stats.current.netResult
        },
        cashFlowStatement: stats.evolution.map(e => ({
          period: e.name,
          inflows: e.receita,
          outflows: e.despesa,
          netFlow: e.lucro
        })),
        overdueAccounts: stats.raw.payables
          .filter(p => p.status !== 'Paid' && p.dueDate < format(new Date(), "yyyy-MM-dd"))
          .map(p => ({
            description: p.description,
            amount: p.originalAmount,
            dueDate: p.dueDate,
            daysOverdue: 5 // Placeholder
          })),
        upcomingAccounts: []
      };
      const result = await analyzeFinancialDataWithAI(input);
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (!stats) return;
    const data = [
      ...stats.raw.receivables.map(r => ({ Tipo: 'Entrada', Data: r[dateType], Desc: r.description, Valor: r.amount, Categoria: categories?.find(c => c.id === r.accountCategoryId)?.name })),
      ...stats.raw.payables.map(p => ({ Tipo: 'Saída', Data: p[dateType], Desc: p.description, Valor: p.originalAmount, Categoria: categories?.find(c => c.id === p.accountCategoryId)?.name }))
    ];
    exportToExcel({ data, filename: `Relatorio_AM_Finance_${startDate}`, sheetName: 'Movimentacoes' });
  };

  if (!mounted || !stats) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header Estratégico */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Scale className="text-primary w-8 h-8" />
            Gestão Estratégica
          </h1>
          <p className="text-muted-foreground">Relatórios gerenciais e inteligência financeira em tempo real.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="gap-2 flex-1 md:flex-none" onClick={handleExport}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar BI
          </Button>
          <Button 
            className="gap-2 flex-1 md:flex-none bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md border-none"
            onClick={runAIAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Consultoria IA
          </Button>
        </div>
      </div>

      {/* Painel de Filtros BI */}
      <Card className="bg-card/50 backdrop-blur-sm border-dashed shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Regime Financeiro
              </Label>
              <Select value={dateType} onValueChange={(v: any) => setDateType(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paymentDate">Regime de Caixa (Liquidação)</SelectItem>
                  <SelectItem value="dueDate">Regime de Competência (Vencimento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Início</Label>
              <Input type="date" className="bg-background" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fim</Label>
              <Input type="date" className="bg-background" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Centro de Custo</Label>
              <Select value={filterCostCenterId} onValueChange={setFilterCostCenterId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Centros</SelectItem>
                  {centers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => {
                setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
              }}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Badge variant="outline" className="h-10 px-4 text-[10px] uppercase font-bold bg-primary/5 text-primary border-primary/20">
                {stats.raw.payables.length + stats.raw.receivables.length} Movimentações
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Dashboard Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Receita Bruta', 
            val: stats.current.grossRevenue, 
            prev: stats.previous.grossRevenue, 
            icon: ArrowUpRight, 
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
          },
          { 
            label: 'Resultado Líquido', 
            val: stats.current.netResult, 
            prev: stats.previous.netResult, 
            icon: Wallet, 
            color: stats.current.netResult >= 0 ? 'text-primary' : 'text-destructive',
            bg: stats.current.netResult >= 0 ? 'bg-primary/5' : 'bg-destructive/5'
          },
          { 
            label: 'Margem Operacional', 
            val: `${stats.current.marginPerc.toFixed(1)}%`, 
            prev: stats.previous.marginPerc, 
            icon: Percent, 
            color: 'text-amber-600',
            bg: 'bg-amber-50'
          },
          { 
            label: 'Burn Rate (Saídas)', 
            val: stats.current.totalVariableCosts + stats.current.totalFixedExpenses, 
            prev: stats.previous.totalVariableCosts + stats.previous.totalFixedExpenses, 
            icon: ArrowDownRight, 
            color: 'text-destructive',
            bg: 'bg-destructive/5'
          }
        ].map((kpi, i) => {
          const growth = typeof kpi.prev === 'number' && typeof kpi.val === 'number' ? calculateGrowth(kpi.val, kpi.prev) : null;
          return (
            <Card key={i} className="hover:shadow-md transition-all border-none bg-card/60">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{kpi.label}</span>
                <div className={cn("p-1.5 rounded-md", kpi.bg, kpi.color)}>
                  <kpi.icon className="w-3.5 h-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className={cn("text-xl font-bold", kpi.color)}>
                  {typeof kpi.val === 'string' ? kpi.val : formatCurrency(kpi.val)}
                </div>
                {growth !== null && (
                  <p className={cn("text-[10px] mt-1 font-medium flex items-center gap-1", growth >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                    {growth >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {Math.abs(growth).toFixed(1)}% vs mês ant.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full md:w-[640px] h-12 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-2">Executivo</TabsTrigger>
          <TabsTrigger value="dre" className="gap-2">DRE Gerencial</TabsTrigger>
          <TabsTrigger value="cost-centers" className="gap-2">C. Custos</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">Inteligência IA</TabsTrigger>
        </TabsList>

        {/* Dashboards Visuais */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Evolução de Lucratividade</CardTitle></CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.evolution}>
                    <defs>
                      <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `R$${v/1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorLucro)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /> Receita vs Despesa</CardTitle></CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.evolution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DRE Gerencial Profissional */}
        <TabsContent value="dre">
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-muted/10 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Demonstração do Resultado (DRE)</CardTitle>
                  <CardDescription>Visão estratégica por grupos de contas colapsáveis.</CardDescription>
                </div>
                <Badge variant="outline" className="gap-2">
                  <Scale className="w-3 h-3" /> {dateType === 'paymentDate' ? 'Regime de Caixa' : 'Regime de Competência'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-sm font-body">
                {/* 1. Receita Bruta */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="revenue" className="border-none">
                    <div className="flex justify-between p-4 bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <span className="font-black text-emerald-800 uppercase tracking-tight">(+) RECEITA BRUTA OPERACIONAL</span>
                      </AccordionTrigger>
                      <span className="font-black text-emerald-800 pr-10">{formatCurrency(stats.current.grossRevenue)}</span>
                    </div>
                    <AccordionContent className="bg-white">
                      {Object.entries(stats.current.revenueByGroup).map(([group, val]) => (
                        <div key={group} className="flex justify-between p-4 pl-12 text-muted-foreground border-b border-muted/30 italic">
                          <span>{group}</span>
                          <span>{formatCurrency(val as number)}</span>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>

                  {/* 2. Custos Variáveis */}
                  <AccordionItem value="variable" className="border-none">
                    <div className="flex justify-between p-4 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <span className="font-black text-destructive uppercase tracking-tight">(-) CUSTOS VARIÁVEIS</span>
                      </AccordionTrigger>
                      <span className="font-black text-destructive pr-10">{formatCurrency(stats.current.totalVariableCosts)}</span>
                    </div>
                    <AccordionContent className="bg-white">
                      {Object.entries(stats.current.variableCostsByGroup).map(([group, val]) => (
                        <div key={group} className="flex justify-between p-4 pl-12 text-muted-foreground border-b border-muted/30 italic">
                          <span>{group}</span>
                          <span>{formatCurrency(val as number)}</span>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* 3. Margem de Contribuição */}
                <div className="flex justify-between p-4 bg-amber-50/50 font-black text-amber-900 border-b">
                  <span className="uppercase tracking-widest">(=) MARGEM DE CONTRIBUIÇÃO</span>
                  <span className="underline decoration-double">{formatCurrency(stats.current.contributionMargin)}</span>
                </div>

                {/* 4. Despesas Fixas */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="fixed" className="border-none">
                    <div className="flex justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <span className="font-black text-slate-700 uppercase tracking-tight">(-) DESPESAS FIXAS / ESTRUTURAIS</span>
                      </AccordionTrigger>
                      <span className="font-black text-slate-700 pr-10">{formatCurrency(stats.current.totalFixedExpenses)}</span>
                    </div>
                    <AccordionContent className="bg-white">
                      {Object.entries(stats.current.fixedExpensesByGroup).map(([group, val]) => (
                        <div key={group} className="flex justify-between p-4 pl-12 text-muted-foreground border-b border-muted/30 italic">
                          <span>{group}</span>
                          <span>{formatCurrency(val as number)}</span>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* 5. EBITDA */}
                <div className="flex justify-between p-4 bg-primary/5 font-black text-primary border-b">
                  <span className="uppercase tracking-widest">(=) EBITDA OPERACIONAL</span>
                  <span>{formatCurrency(stats.current.ebitda)}</span>
                </div>

                {/* 6. Financeiro */}
                <div className="flex justify-between p-4 bg-destructive/5 text-destructive italic">
                  <span className="font-bold">(-) RESULTADO FINANCEIRO (Juros/Tarifas)</span>
                  <span className="font-bold">{formatCurrency(stats.current.financialResult)}</span>
                </div>

                {/* 7. Resultado Líquido Final */}
                <div className={cn(
                  "flex justify-between p-6 text-xl transition-all",
                  stats.current.netResult >= 0 ? "bg-primary text-white" : "bg-destructive text-white"
                )}>
                  <span className="font-black uppercase tracking-tighter">(=) RESULTADO LÍQUIDO FINAL</span>
                  <span className="font-black underline decoration-double text-2xl">{formatCurrency(stats.current.netResult)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Centros de Custo Avançado */}
        <TabsContent value="cost-centers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /> Ranking de Performance</CardTitle></CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-6">
                  {costCenterRanking.map((c, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold">{c.name}</span>
                          <div className="flex gap-3 text-[10px] text-muted-foreground font-medium">
                            <span className="text-emerald-600">Entrada: {formatCurrency(c.revenue)}</span>
                            <span className="text-destructive">Saída: {formatCurrency(c.expense)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={cn("text-sm font-black", c.net >= 0 ? 'text-primary' : 'text-destructive')}>
                            {formatCurrency(c.net)}
                          </span>
                          <p className="text-[10px] text-muted-foreground font-bold">{c.margin.toFixed(1)}% Margem</p>
                        </div>
                      </div>
                      <Progress value={Math.max(0, c.margin)} className={cn("h-1.5", c.net >= 0 ? 'bg-primary/10' : 'bg-destructive/10')} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-bold">Distribuição de Lucro</CardTitle></CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={costCenterRanking.slice(0, 5)} margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="net" radius={[0, 4, 4, 0]}>
                      {costCenterRanking.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inteligência IA */}
        <TabsContent value="ai">
          <Card className={cn(
            "transition-all duration-700 overflow-hidden",
            analysisResult ? "border-accent ring-4 ring-accent/10" : "bg-muted/30 border-dashed"
          )}>
            <div className="bg-accent/5 p-6 border-b border-accent/10 flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <Zap className="w-5 h-5" />
                  Insight Engine Profissional
                </CardTitle>
                <CardDescription>Análise automatizada de anomalias, riscos e tendências.</CardDescription>
              </div>
              <Sparkles className="w-8 h-8 text-accent/20" />
            </div>
            <CardContent className="pt-6">
              {!analysisResult ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6 animate-pulse">
                    <Target className="w-10 h-10 text-accent" />
                  </div>
                  <h3 className="font-black text-xl mb-2">Pronto para a Consultoria?</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Nossa IA vai auditar seus {stats.raw.payables.length + stats.raw.receivables.length} lançamentos deste período buscando riscos ocultos.
                  </p>
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                  <div className="p-5 bg-accent/10 rounded-xl border-l-4 border-accent shadow-sm">
                    <p className="text-sm font-bold leading-relaxed text-accent-foreground italic">
                      "{analysisResult.overallSummary}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-accent flex items-center gap-2 tracking-widest">
                        <TrendingUp className="w-4 h-4" /> Plano de Ação Estratégico
                      </h4>
                      <ul className="space-y-3">
                        {analysisResult.strategicRecommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-sm bg-white p-3 rounded-lg border shadow-sm group hover:border-accent/30 transition-colors">
                            <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-accent/10 text-accent font-bold">{i+1}</Badge>
                            <span className="text-foreground/80 font-medium">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-destructive flex items-center gap-2 tracking-widest">
                        <AlertTriangle className="w-4 h-4" /> Auditoria de Riscos
                      </h4>
                      <div className="grid gap-3">
                        {analysisResult.potentialRisks.map((risk, i) => (
                          <div key={i} className="flex items-start gap-3 p-4 bg-destructive/5 rounded-xl border border-destructive/10">
                            <div className="p-2 bg-destructive/10 rounded-full">
                              <Zap className="w-3 h-3 text-destructive" />
                            </div>
                            <span className="text-sm text-destructive-foreground font-bold leading-snug">{risk}</span>
                          </div>
                        ))}
                      </div>
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
