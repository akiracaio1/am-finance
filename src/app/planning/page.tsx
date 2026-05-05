"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PLANNING_DAYS = [
  { date: '2024-03-22', day: 'Sex', inflow: 8400, outflow: 0, balance: 23800 },
  { date: '2024-03-23', day: 'Sáb', inflow: 12000, outflow: 1500, balance: 34300 },
  { date: '2024-03-24', day: 'Dom', inflow: 14500, outflow: 0, balance: 48800 },
  { date: '2024-03-25', day: 'Seg', inflow: 0, outflow: 4500, balance: 44300 },
  { date: '2024-03-26', day: 'Ter', inflow: 0, outflow: 850, balance: 43450 },
  { date: '2024-03-27', day: 'Qua', inflow: 1500, outflow: 0, balance: 44950 },
  { date: '2024-03-28', day: 'Qui', inflow: 0, outflow: 120, balance: 44830 },
];

export default function PlanningPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarClock className="text-primary w-8 h-8" />
            Planejamento Diário
          </h1>
          <p className="text-muted-foreground">Simule seu fluxo de caixa para os próximos dias.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon"><ChevronLeft /></Button>
          <Button variant="outline" size="icon"><ChevronRight /></Button>
          <Button className="gap-2">Adicionar Previsão</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {PLANNING_DAYS.map((day, i) => (
          <Card key={day.date} className={cn(
            "transition-data hover:translate-y-[-4px]",
            i === 0 ? "border-2 border-primary ring-2 ring-primary/20" : ""
          )}>
            <CardHeader className="p-4 border-b">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{day.day}</div>
              <div className="text-lg font-bold">
                {mounted ? `${new Date(day.date).getDate()} Mar` : '...'}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] uppercase text-emerald-600 font-bold">
                  <ArrowUpCircle className="w-3 h-3" /> Entradas
                </div>
                <div className="text-sm font-bold">R$ {day.inflow.toLocaleString('pt-BR')}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] uppercase text-destructive font-bold">
                  <ArrowDownCircle className="w-3 h-3" /> Saídas
                </div>
                <div className="text-sm font-bold">R$ {day.outflow.toLocaleString('pt-BR')}</div>
              </div>
              <div className="pt-2 border-t">
                <div className="text-[10px] uppercase text-muted-foreground font-bold">Saldo</div>
                <div className={cn(
                  "text-sm font-bold",
                  day.balance < 0 ? "text-destructive" : "text-primary"
                )}>
                  R$ {day.balance.toLocaleString('pt-BR')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Movimentações Diárias Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="w-12 text-center border-r pr-4">
                <p className="text-xs text-muted-foreground font-bold uppercase">Hoje</p>
                <p className="text-xl font-bold">22</p>
              </div>
              <div className="flex-1">
                <p className="font-bold">Repasse Semanal iFood</p>
                <p className="text-xs text-muted-foreground">Receita Projetada • Categoria: Vendas</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-600 font-bold">+ R$ 8.400,00</p>
                <Badge variant="outline" className="text-[10px]">Confirmado</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border opacity-70 italic">
              <div className="w-12 text-center border-r pr-4">
                <p className="text-xs text-muted-foreground font-bold uppercase">Sáb</p>
                <p className="text-xl font-bold">23</p>
              </div>
              <div className="flex-1">
                <p className="font-bold">Projeção de Vendas Fim de Semana</p>
                <p className="text-xs text-muted-foreground">Estimativa baseada em dados históricos</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-600 font-bold">+ R$ 12.000,00</p>
                <Badge variant="secondary" className="text-[10px]">Previsão</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
