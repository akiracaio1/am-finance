
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertCircle,
  Clock,
  ArrowRight
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
import { MOCK_ENTRIES, MOCK_BANK_ACCOUNTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

const data = [
  { name: 'Jan', value: 45000 },
  { name: 'Fev', value: 52000 },
  { name: 'Mar', value: 48000 },
  { name: 'Abr', value: 61000 },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalBalance = MOCK_BANK_ACCOUNTS.reduce((acc, curr) => acc + curr.balance, 0);
  const receivables = MOCK_ENTRIES.filter(e => e.type === 'receivable' && e.status !== 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const payables = MOCK_ENTRIES.filter(e => e.type === 'payable' && e.status !== 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const overdueCount = MOCK_ENTRIES.filter(e => e.status === 'overdue').length;

  // Crucial para evitar erros de hidratação com Recharts
  if (!mounted) return (
    <div className="space-y-8 p-4">
      <div className="h-20 bg-muted animate-pulse rounded-lg" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Executivo</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo ao AM Finance. Aqui está o resumo do seu negócio.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/reports">Ver Relatórios</Link>
          </Button>
          <Button asChild>
            <Link href="/accounts-payable">Nova Despesa</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-data">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo em Caixa</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalBalance.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">+2.5% em relação ao mês passado</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-data">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">R$ {receivables.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">Esperado nos próximos 15 dias</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-data border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ {payables.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {overdueCount} itens em atraso
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-data">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Mensal</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 48.000</div>
            <p className="text-xs text-muted-foreground">Mês atual (est.)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução da Receita</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {MOCK_ENTRIES.slice(0, 4).map((entry) => (
                <div key={entry.id} className="flex items-center">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center mr-4",
                    entry.type === 'receivable' ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                  )}>
                    {entry.type === 'receivable' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.dueDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="ml-auto font-medium">
                    {entry.type === 'receivable' ? '+' : '-'}R$ {entry.amount.toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-primary hover:text-primary hover:bg-muted" asChild>
              <Link href="/accounts-payable" className="flex items-center gap-2">
                Ver Toda Atividade <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
