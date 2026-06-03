"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  Filter,
  CalendarDays,
  Download,
  Loader2,
  RefreshCcw,
  AlertCircle,
  ArrowDownCircle
} from "lucide-react";
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
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase
} from "@/firebase";
import { collection } from "firebase/firestore";
import { 
  AccountsPayableEntry, 
  AccountCategory, 
  Supplier, 
  CostCenter
} from "@/lib/types";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
} from "date-fns";
import { 
  exportToExcel, 
  formatCurrency 
} from "@/lib/report-utils";
import { cn } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export default function ReportsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  // Filtros de Período
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Queries
  const payablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsPayableEntries");
  }, [db, user]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "suppliers");
  }, [db, user]);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const { data: payables, isLoading: loadingPay } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);

  // Lógica de Filtragem: Somente Pendentes (Não Pagos) no período por Data de Vencimento
  const pendingPayables = useMemo(() => {
    if (!payables) return [];
    return payables
      .filter(p => 
        p.status !== 'Paid' && 
        p.dueDate >= startDate && 
        p.dueDate <= endDate
      )
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [payables, startDate, endDate]);

  const totalPending = pendingPayables.reduce((acc, curr) => acc + curr.originalAmount, 0);

  const handleExportExcel = () => {
    if (pendingPayables.length === 0) return;

    const exportData = pendingPayables.map(p => ({
      'Vencimento': p.dueDate ? format(new Date(p.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : '-',
      'Fornecedor': suppliers?.find(s => s.id === p.supplierId)?.name || 'N/A',
      'Descrição': p.description,
      'Categoria': categories?.find(c => c.id === p.accountCategoryId)?.name || 'Geral',
      'Centro de Custo': centers?.find(c => c.id === p.costCenterId)?.name || '-',
      'Valor (R$)': p.originalAmount,
      'Status': p.status === 'Overdue' ? 'Atrasado' : p.status === 'DueToday' ? 'Hoje' : 'A Vencer'
    }));

    exportToExcel({ 
      data: exportData, 
      filename: `Contas_Pagar_Pendentes_${startDate}_a_${endDate}`, 
      sheetName: 'Pendências',
      summary: { 'Descrição': 'TOTAL PENDENTE', 'Valor (R$)': totalPending }
    });
  };

  if (!mounted || loadingPay) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileSpreadsheet className="text-primary w-8 h-8" />
          Relatórios de Exportação
        </h1>
        <p className="text-muted-foreground">Gere documentos profissionais para sua gestão financeira.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel de Filtros */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros do Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Início do Vencimento</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Fim do Vencimento</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="pt-4 border-t">
              <Button 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md"
                onClick={handleExportExcel}
                disabled={pendingPayables.length === 0}
              >
                <Download className="w-4 h-4" /> Exportar para Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prévia dos Resultados */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-destructive" />
                Contas a Pagar: Pendências
              </CardTitle>
              <CardDescription>Visualização prévia dos lançamentos não pagos no período.</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total no Período</p>
              <p className="text-xl font-black text-destructive">{formatCurrency(totalPending)}</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPayables.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">{p.dueDate ? format(new Date(p.dueDate + 'T12:00:00'), 'dd/MM/yy') : '-'}</TableCell>
                      <TableCell className="text-xs">{suppliers?.find(s => s.id === p.supplierId)?.name || '-'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">{p.description}</TableCell>
                      <TableCell className="text-right font-bold text-xs">{formatCurrency(p.originalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {pendingPayables.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic text-sm">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          Nenhuma conta pendente encontrada para este período.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informativo */}
      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="pt-6 flex gap-4 items-start">
          <div className="p-2 bg-primary/10 rounded-full">
            <RefreshCcw className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Como funciona a exportação?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O sistema filtra automaticamente todas as contas que estão com status <strong>Aberto</strong>, <strong>Atrasado</strong> ou <strong>Hoje</strong>. 
              Ao clicar no botão de exportar, um arquivo Excel será gerado com o detalhamento completo, incluindo categoria e centro de custo, 
              pronto para ser enviado ou impresso.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
