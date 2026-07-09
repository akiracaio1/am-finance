
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CalendarClock, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  Info,
  CalendarDays,
  Target,
  BarChart3,
  Search,
  LayoutGrid,
  Loader2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  MinusCircle,
  HelpCircle
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase 
} from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  format, 
  addDays, 
  addWeeks, 
  addMonths, 
  parseISO, 
  startOfDay, 
  isSameDay, 
  isValid,
  isBefore,
  differenceInDays,
  eachDayOfInterval,
  endOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  AccountsPayableEntry, 
  AccountsReceivableEntry, 
  ManualForecast, 
  BankAccount, 
  ForecastScenario 
} from "@/lib/types";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Horizon = "7d" | "15d" | "30d" | "60d" | "90d" | "13w" | "12m";

export default function CashFlowForecastPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  
  // Filtros Globais
  const [horizon, setHorizon] = useState<Horizon>("30d");
  const [scenario, setScenario] = useState<ForecastScenario>("Realistic");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  
  // Modais
  const [isNewForecastOpen, setIsNewForecastOpen] = useState(false);

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

  const manualQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "manualForecasts");
  }, [db, user]);

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "bankAccounts");
  }, [db, user]);

  const { data: payables } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: receivables } = useCollection<AccountsReceivableEntry>(receivablesQuery);
  const { data: manualForecasts } = useCollection<ManualForecast>(manualQuery);
  const { data: accounts } = useCollection<BankAccount>(accountsQuery);

  // Lógica Principal de Cálculo do Forecast
  const forecastData = useMemo(() => {
    if (!mounted || !accounts) return null;

    const today = startOfDay(new Date());
    let horizonEnd = addDays(today, 30);
    if (horizon === "7d") horizonEnd = addDays(today, 7);
    if (horizon === "15d") horizonEnd = addDays(today, 15);
    if (horizon === "60d") horizonEnd = addDays(today, 60);
    if (horizon === "90d") horizonEnd = addDays(today, 90);
    if (horizon === "13w") horizonEnd = addWeeks(today, 13);
    if (horizon === "12m") horizonEnd = addMonths(today, 12);

    const interval = eachDayOfInterval({ start: today, end: horizonEnd });
    
    // Saldo Inicial Hoje (Soma de todas as contas)
    const currentBankBalance = accounts.reduce((acc, curr) => acc + (curr.initialBalance || 0), 0);

    // Preparar Entradas e Saídas do Forecast
    const filterByScenario = (item: any, type: 'payable' | 'receivable' | 'manual') => {
      if (item.status === 'Paid') return false;
      if (item.planningStatus && item.planningStatus !== 'Programmed') return false;

      if (type === 'manual') {
        if (scenario === 'Conservative' && item.scenario !== 'Conservative') return false;
        if (scenario === 'Realistic' && item.scenario === 'Optimistic') return false;
        return true;
      }

      const expectedDate = type === 'payable' ? item.expectedPaymentDate : item.expectedReceivalDate;
      if (!expectedDate) return false;

      if (scenario === 'Conservative') {
        return item.entryType === 'Confirmed';
      }
      return true;
    };

    const programmedPayables = payables?.filter(p => filterByScenario(p, 'payable')) || [];
    const programmedReceivables = receivables?.filter(r => filterByScenario(r, 'receivable')) || [];
    const programmedManual = manualForecasts?.filter(m => filterByScenario(m, 'manual')) || [];

    let currentBalance = currentBankBalance;
    const chartData: any[] = [];
    const timelineData: any[] = [];

    interval.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      
      const dayPayables = programmedPayables.filter(p => p.expectedPaymentDate === dateStr);
      const dayReceivables = programmedReceivables.filter(r => r.expectedReceivalDate === dateStr);
      const dayManual = programmedManual.filter(m => m.expectedDate === dateStr);

      const inflows = dayReceivables.reduce((acc, r) => acc + r.amount, 0) + 
                      dayManual.filter(m => m.type === 'INFLOW').reduce((acc, m) => acc + m.amount, 0);
      
      const outflows = dayPayables.reduce((acc, p) => acc + p.originalAmount, 0) + 
                       dayManual.filter(m => m.type === 'OUTFLOW').reduce((acc, m) => acc + m.amount, 0);

      const initialBalance = currentBalance;
      currentBalance = currentBalance + inflows - outflows;

      const daySummary = {
        date: dateStr,
        displayDate: format(day, "dd/MM"),
        fullDate: format(day, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        initialBalance,
        inflows,
        outflows,
        finalBalance: currentBalance,
        transactions: [
          ...dayReceivables.map(r => ({ ...r, origin: 'Conta a Receber', type: 'INFLOW' })),
          ...dayPayables.map(p => ({ ...p, origin: 'Conta a Pagar', type: 'OUTFLOW', amount: p.originalAmount })),
          ...dayManual.map(m => ({ ...m, origin: 'Previsão Manual' }))
        ]
      };

      chartData.push({
        name: dateStr,
        display: format(day, "dd MMM", { locale: ptBR }),
        saldo: Number(currentBalance.toFixed(2))
      });

      timelineData.push(daySummary);
    });

    // Cálculos de KPIs
    const minBalance = Math.min(...timelineData.map(d => d.finalBalance));
    const maxBalance = Math.max(...timelineData.map(d => d.finalBalance));
    const negativeDays = timelineData.filter(d => d.finalBalance < 0).length;
    const totalInflows = timelineData.reduce((acc, d) => acc + d.inflows, 0);
    const totalOutflows = timelineData.reduce((acc, d) => acc + d.outflows, 0);

    return { 
      currentBankBalance, 
      chartData, 
      timelineData, 
      minBalance, 
      maxBalance, 
      negativeDays,
      totalInflows,
      totalOutflows,
      sevenDayProj: timelineData[6]?.finalBalance || currentBalance,
      thirtyDayProj: timelineData[29]?.finalBalance || currentBalance
    };
  }, [mounted, horizon, scenario, payables, receivables, manualForecasts, accounts]);

  const selectedDayData = useMemo(() => {
    return forecastData?.timelineData.find(d => d.date === selectedDate);
  }, [forecastData, selectedDate]);

  const handleSaveForecast = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    
    const id = `fc_${Date.now()}`;
    const data: ManualForecast = {
      id,
      description: formData.get("description") as string,
      type: formData.get("type") as 'INFLOW' | 'OUTFLOW',
      amount: Number(formData.get("amount")),
      expectedDate: formData.get("date") as string,
      scenario: formData.get("scenario") as ForecastScenario,
      createdAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, "users", user.uid, "manualForecasts", id), data);
    toast({ title: "Previsão registrada!" });
    setIsNewForecastOpen(false);
  };

  if (!mounted || !forecastData) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* HEADER E FILTROS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarClock className="text-primary w-8 h-8" />
            Forecast de Fluxo de Caixa
          </h1>
          <p className="text-muted-foreground mt-1">Simulação estratégica baseada em datas previstas e cenários.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <Tabs value={horizon} onValueChange={(v: any) => setHorizon(v)} className="bg-muted p-1 rounded-lg">
            <TabsList className="h-8">
              <TabsTrigger value="7d" className="text-[10px] h-6">7D</TabsTrigger>
              <TabsTrigger value="15d" className="text-[10px] h-6">15D</TabsTrigger>
              <TabsTrigger value="30d" className="text-[10px] h-6">30D</TabsTrigger>
              <TabsTrigger value="90d" className="text-[10px] h-6">90D</TabsTrigger>
              <TabsTrigger value="12m" className="text-[10px] h-6">12M</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={scenario} onValueChange={(v: any) => setScenario(v)}>
            <SelectTrigger className="w-[160px] h-10">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Conservative">Conservador</SelectItem>
              <SelectItem value="Realistic">Realista</SelectItem>
              <SelectItem value="Optimistic">Otimista</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setIsNewForecastOpen(true)} className="gap-2 shadow-lg h-10">
            <Plus className="w-4 h-4" /> Nova Previsão
          </Button>
        </div>
      </div>

      {/* BLOCO 1: RESUMO FINANCEIRO (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {[
          { label: 'Disponível Hoje', value: forecastData.currentBankBalance, icon: Wallet, color: 'text-primary' },
          { label: 'Proj. 7 dias', value: forecastData.sevenDayProj, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Proj. 30 dias', value: forecastData.thirtyDayProj, icon: BarChart3, color: 'text-primary' },
          { label: 'Entradas Prev.', value: forecastData.totalInflows, icon: ArrowUpCircle, color: 'text-emerald-600' },
          { label: 'Saídas Prev.', value: forecastData.totalOutflows, icon: ArrowDownCircle, color: 'text-destructive' },
          { label: 'Menor Saldo', value: forecastData.minBalance, icon: TrendingDown, color: forecastData.minBalance < 0 ? 'text-destructive' : 'text-primary' },
          { label: 'Maior Saldo', value: forecastData.maxBalance, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Dias Negativos', value: forecastData.negativeDays, icon: AlertCircle, color: forecastData.negativeDays > 0 ? 'text-destructive' : 'text-muted-foreground', isQty: true },
        ].map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm bg-card/60 overflow-hidden">
            <CardHeader className="p-3 pb-0">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                <kpi.icon className="w-3 h-3 opacity-50" /> {kpi.label}
              </span>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className={cn("text-sm font-black", kpi.color)}>
                {kpi.isQty ? kpi.value : `R$ ${kpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* BLOCO 2: GRÁFICO DE EVOLUÇÃO */}
      <Card className="border-none shadow-sm bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Curva de Disponibilidade</CardTitle>
            <CardDescription>Evolução diária do saldo projetado.</CardDescription>
          </div>
          <div className="flex gap-4 text-[10px] font-bold uppercase text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary/20 rounded" /> Saldo Positivo</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-destructive/20 rounded" /> Saldo Negativo</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData.chartData}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="display" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  interval={horizon === '12m' ? 30 : horizon === '90d' ? 7 : 0}
                />
                <YAxis 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`, 'Saldo']}
                />
                <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" />
                <Area 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSaldo)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* BLOCO 3: TIMELINE FINANCEIRA */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Linha do Tempo Diária
            </h3>
            <span className="text-xs text-muted-foreground italic">Clique no dia para ver detalhes</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {forecastData.timelineData.map((day) => (
              <Card 
                key={day.date} 
                className={cn(
                  "cursor-pointer transition-all hover:scale-[1.02] border-none shadow-sm",
                  selectedDate === day.date ? "ring-2 ring-primary bg-primary/5" : "bg-card/40",
                  day.finalBalance < 0 ? "border-l-4 border-l-destructive" : "border-l-4 border-l-emerald-500"
                )}
                onClick={() => setSelectedDate(day.date)}
              >
                <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{day.displayDate}</span>
                    <span className="text-xs font-black truncate max-w-[120px]">{day.fullDate.split(',')[0]}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] h-5", day.finalBalance < 0 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                    {day.finalBalance < 0 ? 'Déficit' : 'Saudável'}
                  </Badge>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground uppercase font-bold">Início:</span>
                    <span className="font-mono">R$ {day.initialBalance.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 p-1.5 rounded flex items-center justify-between">
                      <ArrowUpCircle className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-700">+{day.inflows.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="bg-destructive/5 p-1.5 rounded flex items-center justify-between">
                      <ArrowDownCircle className="w-3 h-3 text-destructive" />
                      <span className="text-[10px] font-bold text-destructive">-{day.outflows.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Saldo Final:</span>
                    <span className={cn("text-xs font-black", day.finalBalance < 0 ? "text-destructive" : "text-primary")}>
                      R$ {day.finalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* BLOCO 4: MOVIMENTAÇÕES DO DIA SELECIONADO */}
        <div className="space-y-4">
          <Card className="sticky top-6 border-none shadow-lg bg-card/80 backdrop-blur-sm h-fit">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Detalhes do Dia
                </CardTitle>
                <Badge className="bg-primary">{selectedDayData?.displayDate}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">{selectedDayData?.fullDate}</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {/* Entradas */}
                <div className="p-4 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> Entradas Programadas
                  </h4>
                  {selectedDayData?.transactions.filter(t => t.type === 'INFLOW').map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start group">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{t.description || t.customerName}</p>
                        <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
                          <Badge variant="outline" className="text-[8px] h-3 px-1">{t.origin}</Badge>
                        </p>
                      </div>
                      <span className="text-xs font-black text-emerald-600">+R$ {t.amount.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                  {selectedDayData?.transactions.filter(t => t.type === 'INFLOW').length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">Nenhuma entrada prevista.</p>
                  )}
                </div>

                {/* Saídas */}
                <div className="p-4 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-destructive flex items-center gap-2">
                    <TrendingDown className="w-3 h-3" /> Saídas Programadas
                  </h4>
                  {selectedDayData?.transactions.filter(t => t.type === 'OUTFLOW').map((t, idx) => (
                    <div key={idx} className="flex justify-between items-start group">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{t.description}</p>
                        <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
                          <Badge variant="outline" className="text-[8px] h-3 px-1">{t.origin}</Badge>
                        </p>
                      </div>
                      <span className="text-xs font-black text-destructive">-R$ {t.amount.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                  {selectedDayData?.transactions.filter(t => t.type === 'OUTFLOW').length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">Nenhuma saída programada.</p>
                  )}
                </div>
              </div>

              {/* Footer de Fechamento do Dia */}
              <div className="bg-muted/40 p-4 space-y-2 border-t mt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Fluxo Líquido do Dia</span>
                  <span className={cn("font-bold", (selectedDayData?.inflows || 0) - (selectedDayData?.outflows || 0) >= 0 ? "text-emerald-600" : "text-destructive")}>
                    R$ {((selectedDayData?.inflows || 0) - (selectedDayData?.outflows || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black border-t pt-2">
                  <span className="text-primary">Saldo de Encerramento</span>
                  <span className={cn(selectedDayData?.finalBalance && selectedDayData.finalBalance < 0 ? "text-destructive" : "text-primary")}>
                    R$ {selectedDayData?.finalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex gap-3 items-start">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-800 space-y-2">
              <p className="font-bold">Como funciona este Forecast?</p>
              <p>O sistema ignora datas de vencimento antigas e foca apenas em <strong>Datas Previstas</strong> de pagamento/recebimento futuras.</p>
              <p>O cenário <strong>Realista</strong> inclui tudo o que está programado, enquanto o <strong>Conservador</strong> prioriza apenas obrigações confirmadas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: NOVA PREVISÃO MANUAL */}
      <Dialog open={isNewForecastOpen} onOpenChange={setIsNewForecastOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveForecast}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Nova Previsão Simulada
              </DialogTitle>
              <DialogDescription>Use para planejar vendas futuras, investimentos ou metas sem alterar o contábil.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Natureza</Label>
                  <Select name="type" defaultValue="INFLOW">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFLOW">Entrada (Receita)</SelectItem>
                      <SelectItem value="OUTFLOW">Saída (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cenário Alvo</Label>
                  <Select name="scenario" defaultValue="Realistic">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Conservative">Conservador</SelectItem>
                      <SelectItem value="Realistic">Realista</SelectItem>
                      <SelectItem value="Optimistic">Otimista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Descrição da Previsão</Label>
                <Input name="description" placeholder="Ex: Meta de Vendas Julho" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor Projetado</Label>
                  <Input name="amount" type="number" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label>Data Prevista</Label>
                  <Input name="date" type="date" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Adicionar ao Forecast</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Wallet extends React.ForwardRefExoticComponent<any> {}
