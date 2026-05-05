"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpCircle, 
  Upload, 
  Download, 
  BarChart3, 
  PieChart as PieIcon
} from "lucide-react";
import { MOCK_ENTRIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function AccountsReceivablePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const entries = MOCK_ENTRIES.filter(e => e.type === 'receivable');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowUpCircle className="text-accent w-8 h-8" />
            Contas a Receber
          </h1>
          <p className="text-muted-foreground">Monitore o faturamento e importações de relatórios de vendas.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exportar Relatório
          </Button>
          <Button className="gap-2 bg-accent hover:bg-accent/90">
            <Upload className="w-4 h-4" /> Importar CSV Receita
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Receita iFood</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 12.400,00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Vendas Balcão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 35.600,00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 124,50</div>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-accent font-bold">Total Esperado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">R$ 48.000,00</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Entradas de Faturamento Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Ref</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">
                      {mounted ? new Date(entry.dueDate).toLocaleDateString('pt-BR') : '...'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20">
                        {entry.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className="text-right font-bold text-accent">R$ {entry.amount.toLocaleString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="w-4 h-4" />
              Canais de Venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'iFood', percent: 25, color: 'bg-primary' },
                { label: 'Balcão', percent: 65, color: 'bg-accent' },
                { label: 'Rappi', percent: 10, color: 'bg-muted-foreground' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className="font-bold">{item.percent}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className={cn("h-full", item.color)} style={{ width: `${item.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-dashed text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
              <p className="text-xs text-muted-foreground">Dados históricos de faturamento são sincronizados diariamente do seu sistema PDV.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
