
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { AccountsPayableEntry, AccountsReceivableEntry, BankAccount } from "@/lib/types";
import { format, startOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Queries Reais
  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "bankAccounts");
  }, [db, user]);

  const payablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsPayableEntries");
  }, [db, user]);

  const receivablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsReceivableEntries");
  }, [db, user]);

  const { data: accounts, isLoading: loadingAcc } = useCollection<BankAccount>(accountsQuery);
  const { data: payables, isLoading: loadingPay } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: receivables, isLoading: loadingRec } = useCollection<AccountsReceivableEntry>(receivablesQuery);

  // Cálculos de KPIs
  const kpis = useMemo(() => {
    if (!mounted || !payables || !receivables || !accounts) return null;

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const currentMonthStart = startOfMonth(today);

    // Saldo em Caixa = Saldo Inicial + Entradas Pagas - Saídas Pagas
    const totalInitialBalance = accounts.reduce((acc, curr) => acc + (curr.initialBalance || 0), 0);
    
    const totalPaidReceivables = receivables
      .filter(r => r.status === 'Paid')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalPaidPayables = payables
      .filter(p => p.status === 'Paid')
      .reduce((acc, curr) => {
        const netValue = curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0);
        return acc + netValue;
      }, 0);

    const totalBalance = totalInitialBalance + totalPaidReceivables - totalPaidPayables;
    
    const totalReceivables = receivables
      .filter(r => r.status === 'Open')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalPayables = payables
      .filter(p => p.status !== 'Paid')
      .reduce((acc, curr) => acc + curr.originalAmount, 0);

    const overdueCount = payables
      .filter(p => p.status !== 'Paid' && p.dueDate < todayStr)
      .length;

    const monthlyRevenue = receivables
      .filter(r => r.status === 'Paid' && r.paymentDate && parseISO(r.paymentDate) >= currentMonthStart)
      .reduce((acc, curr) => acc + curr.amount, 0);

    // Dados para o Gráfico de Evolução (Últimos 4 meses)
    const chartData = [3, 2, 1, 0].map(offset => {
      const monthDate = subMonths(today, offset);
      const mStart = startOfMonth(monthDate);
      const mEnd = startOfMonth(subMonths(monthDate, -1)); 
      
      const value = receivables
        .filter(r => r.status === 'Paid' && r.paymentDate && parseISO(r.paymentDate) >= mStart && parseISO(r.paymentDate) < mEnd)
        .reduce((acc, curr) => acc + curr.amount, 0);

      return {
        name: format(monthDate, "MMM", { locale: ptBR }),
        value: value || 0
      };
    });

    // Atividade Recente (Unificada)
    const recentActivity = [
      ...receivables.map(r => ({ ...r, type: 'receivable' as const })),
      ...payables.map(p => ({ ...p, type: 'payable' as const, amount: p.originalAmount }))
    ].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
     .slice(0, 5);

    return { totalBalance, totalReceivables, totalPayables, overdueCount, monthlyRevenue, chartData, recentActivity };
  }, [mounted, payables, receivables, accounts]);

  if (!mounted || loadingAcc || loadingPay || loadingRec) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Consolidando informações reais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Executivo</h1>
          <p className="text-muted-foreground mt-1">Visão em tempo real da saúde financeira da sua empresa.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button asChild variant="outline" className="flex-1 md:flex-none">
            <Link href="/reports">Ver Relatórios</Link>
          </Button>
          <Button asChild className="flex-1 md:flex-none shadow-lg">
            <Link href="/accounts-payable">Nova Despesa</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-all border-none bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Saldo em Caixa</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {kpis?.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Soma inicial + realizados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all border-none bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">A Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">R$ {kpis?.totalReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Entradas pendentes no sistema</p>
          </CardContent>
        </Card>

        <Card className={cn("hover:shadow-md transition-all border-none bg-card/60 border-l-4", (kpis?.overdueCount || 0) > 0 ? "border-l-destructive" : "border-l-primary")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">A Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ {kpis?.totalPayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            { (kpis?.overdueCount || 0) > 0 ? (
              <p className="text-[10px] text-destructive flex items-center gap-1 font-bold mt-1 animate-pulse">
                <AlertCircle className="w-3 h-3" /> {kpis?.overdueCount} contas em atraso!
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-1">Nenhum atraso detectado</p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all border-none bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Faturamento Mês</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {kpis?.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Recebido até o momento</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Evolução do Faturamento</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`} />
                  <Tooltip 
                    cursor={{fill: 'rgba(0,0,0,0.05)'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {kpis?.recentActivity.map((entry: any, i) => (
                <div key={i} className="flex items-center group">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center mr-4 transition-transform group-hover:scale-110",
                    entry.type === 'receivable' ? "bg-emerald-50 text-emerald-600" : "bg-destructive/5 text-destructive"
                  )}>
                    {entry.type === 'receivable' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold leading-none truncate max-w-[180px]">{entry.description}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">
                      {new Date(entry.dueDate).toLocaleDateString('pt-BR')} • {entry.status === 'Paid' ? 'Pago' : 'Pendente'}
                    </p>
                  </div>
                  <div className={cn(
                    "ml-auto text-sm font-black",
                    entry.type === 'receivable' ? "text-emerald-600" : "text-destructive"
                  )}>
                    {entry.type === 'receivable' ? '+' : '-'} R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
              {kpis?.recentActivity.length === 0 && (
                <div className="py-20 text-center opacity-30 italic text-sm">
                  Nenhuma atividade registrada ainda.
                </div>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-primary hover:text-primary hover:bg-primary/5 font-bold" asChild>
              <Link href="/accounts-payable" className="flex items-center gap-2">
                Gerenciar Lançamentos <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
