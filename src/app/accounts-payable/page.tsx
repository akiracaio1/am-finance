"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  ArrowDownCircle, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  FileText
} from "lucide-react";
import { MOCK_ENTRIES, MOCK_SUPPLIERS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function AccountsPayablePage() {
  const [filterStatus, setFilterStatus] = useState("all");
  
  const entries = MOCK_ENTRIES.filter(e => e.type === 'payable');
  const filteredEntries = filterStatus === 'all' 
    ? entries 
    : entries.filter(e => e.status === filterStatus);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="border-none"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Calendar className="w-3 h-3 mr-1" /> Aberto</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowDownCircle className="text-destructive w-8 h-8" />
            Contas a Pagar
          </h1>
          <p className="text-muted-foreground">Acompanhe e gerencie suas próximas despesas e contas.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <FileText className="w-4 h-4" /> Importar Lote
          </Button>
          <Button className="gap-2">
            Novo Lançamento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive/80">Total em Atraso</p>
            <div className="text-2xl font-bold text-destructive">R$ 4.500,00</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-primary/80">Pendente Próximos 7 Dias</p>
            <div className="text-2xl font-bold text-primary">R$ 350,00</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-emerald-700">Pago este Mês</p>
            <div className="text-2xl font-bold text-emerald-800">R$ 1.500,00</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Lista de Despesas</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id} className="group">
                  <TableCell className="font-mono text-sm">
                    {new Date(entry.dueDate).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {MOCK_SUPPLIERS.find(s => s.id === entry.supplierId)?.name || 'N/A'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <span className="text-muted-foreground text-xs block uppercase tracking-wider">{entry.category}</span>
                    {entry.description}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(entry.status)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    entry.status === 'overdue' ? "text-destructive" : ""
                  )}>
                    R$ {entry.amount.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
