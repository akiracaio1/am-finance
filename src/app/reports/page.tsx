
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
  ArrowDownCircle,
  CheckCircle2,
  Calculator,
  TrendingDown
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  parseISO,
  isValid
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

type ReportType = "pending" | "paid";

export default function ReportsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("pending");

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

  // Lógica de Filtragem
  const filteredData = useMemo(() => {
    if (!payables) return [];

    if (reportType === "pending") {
      // Filtra por Vencimento e Status Aberto/Atrasado
      return payables
        .filter(p => 
          p.status !== 'Paid' && 
          p.dueDate >= startDate && 
          p.dueDate <= endDate
        )
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    } else {
      // Filtra por Data de Pagamento e Status Pago
      return payables
        .filter(p => 
          p.status === 'Paid' && 
          p.paymentDate &&
          p.paymentDate >= startDate && 
          p.paymentDate <= endDate
        )
        .sort((a, b) => (a.paymentDate || "").localeCompare(b.paymentDate || ""));
    }
  }, [payables, reportType, startDate, endDate]);

  const totalValue = filteredData.reduce((acc, curr) => {
    if (reportType === 'pending') return acc + curr.originalAmount;
    // Para pagos, soma o valor líquido real
    const net = curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0);
    return acc + net;
  }, 0);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    const exportData = filteredData.map(p => {
      const category = categories?.find(c => c.id === p.accountCategoryId)?.name || 'Geral';
      const supplier = suppliers?.find(s => s.id === p.supplierId)?.name || 'N/A';
      const center = centers?.find(c => c.id === p.costCenterId)?.name || '-';
      
      if (reportType === 'pending') {
        return {
          'Vencimento': p.dueDate ? format(new Date(p.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : '-',
          'Emissão': p.issueDate ? format(parseISO(p.issueDate), 'dd/MM/yyyy') : '-',
          'Fornecedor': supplier,
          'Descrição': p.description,
          'Categoria': category,
          'Centro de Custo': center,
          'Valor (R$)': p.originalAmount,
          'Status': p.status === 'Overdue' ? 'Atrasado' : p.status === 'DueToday' ? 'Hoje' : 'A Vencer'
        };
      } else {
        const net = p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0);
        return {
          'Data Pagamento': p.paymentDate ? format(parseISO(p.paymentDate), 'dd/MM/yyyy') : '-',
          'Vencimento Original': p.dueDate ? format(new Date(p.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : '-',
          'Fornecedor': supplier,
          'Descrição': p.description,
          'Categoria': category,
          'Centro de Custo': center,
          'Valor Original (R$)': p.originalAmount,
          'Juros/Multa (+)': (p.interest || 0) + (p.fine || 0),
          'Desconto (-)': (p.discount || 0),
          'Valor Pago Líquido (R$)': net
        };
      }
    });

    const filename = reportType === 'pending' 
      ? `Pendencias_Pagar_${startDate}_a_${endDate}` 
      : `Contas_Pagas_Realizado_${startDate}_a_${endDate}`;

    exportToExcel({ 
      data: exportData, 
      filename, 
      sheetName: reportType === 'pending' ? 'Pendências' : 'Realizado',
      summary: { 
        [reportType === 'pending' ? 'Descrição' : 'Descrição']: 'TOTAL GERAL NO PERÍODO', 
        [reportType === 'pending' ? 'Valor (R$)' : 'Valor Pago Líquido (R$)']: totalValue 
      }
    });
  };

  if (!mounted || loadingPay) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileSpreadsheet className="text-primary w-8 h-8" />
            Relatórios Financeiros
          </h1>
          <p className="text-muted-foreground">Analise o planejado e o realizado com precisão profissional.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4" /> Configuração do Filtro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendências (Contas em Aberto)</SelectItem>
                  <SelectItem value="paid">Realizado (Contas Pagas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Inicial ({reportType === 'pending' ? 'Venc.' : 'Pagto'})</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Final ({reportType === 'pending' ? 'Venc.' : 'Pagto'})</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="pt-6 border-t">
              <Button 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md h-12"
                onClick={handleExportExcel}
                disabled={filteredData.length === 0}
              >
                <Download className="w-4 h-4" /> Gerar Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-primary/5 border-none">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={cn("p-3 rounded-full", reportType === 'pending' ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700")}>
                  {reportType === 'pending' ? <TrendingDown className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">{reportType === 'pending' ? 'Volume Pendente' : 'Volume Liquidado'}</p>
                  <p className={cn("text-2xl font-black", reportType === 'pending' ? "text-destructive" : "text-emerald-700")}>
                    {formatCurrency(totalValue)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-none">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 rounded-full bg-background text-primary">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Quantidade de Itens</p>
                  <p className="text-2xl font-black text-primary">{filteredData.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {reportType === 'pending' ? <ArrowDownCircle className="w-5 h-5 text-destructive" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {reportType === 'pending' ? 'Listagem de Pendências' : 'Listagem de Contas Pagas'}
                </CardTitle>
                <CardDescription>
                  {reportType === 'pending' 
                    ? `Contas vencendo entre ${format(parseISO(startDate), 'dd/MM/yy')} e ${format(parseISO(endDate), 'dd/MM/yy')}`
                    : `Pagamentos realizados entre ${format(parseISO(startDate), 'dd/MM/yy')} e ${format(parseISO(endDate), 'dd/MM/yy')}`
                  }
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{reportType === 'pending' ? 'Vencimento' : 'Pagamento'}</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor {reportType === 'paid' ? 'Líquido' : ''}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((p) => {
                      const net = reportType === 'paid' 
                        ? p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0)
                        : p.originalAmount;
                      
                      const dateToDisplay = reportType === 'pending' ? p.dueDate : p.paymentDate;
                      const dateObj = dateToDisplay ? (reportType === 'pending' ? new Date(dateToDisplay + 'T12:00:00') : parseISO(dateToDisplay)) : null;

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs font-medium">
                            {dateObj && isValid(dateObj) ? format(dateObj, 'dd/MM/yy') : '-'}
                          </TableCell>
                          <TableCell className="text-xs font-bold truncate max-w-[150px]">
                            {suppliers?.find(s => s.id === p.supplierId)?.name || '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span className="truncate max-w-[200px]">{p.description}</span>
                              <span className="text-[9px] text-muted-foreground uppercase">{categories?.find(c => c.id === p.accountCategoryId)?.name || 'Geral'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">
                            <div className="flex flex-col items-end">
                              <span className={cn(reportType === 'paid' ? "text-emerald-700" : "text-destructive")}>
                                {formatCurrency(net)}
                              </span>
                              {reportType === 'paid' && (p.interest || 0 + (p.fine || 0) - (p.discount || 0) !== 0) && (
                                <span className="text-[8px] text-muted-foreground italic">Orig: {formatCurrency(p.originalAmount)}</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-24 text-muted-foreground italic text-sm">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <AlertCircle className="w-12 h-12" />
                            Nenhum registro encontrado para os critérios selecionados.
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
      </div>

      <Card className="bg-primary/5 border-primary/10 border-dashed">
        <CardContent className="pt-6 flex gap-4 items-start">
          <div className="p-2 bg-primary/10 rounded-full">
            <RefreshCcw className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Diferença entre Pendente e Realizado</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Pendências (Fluxo Projetado):</strong> Filtra contas que ainda não foram pagas, usando a data de vencimento. Essencial para saber o quanto você precisa ter em caixa no futuro próximo.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Realizado (Fluxo Efetivado):</strong> Filtra apenas o que saiu do banco, usando a data de pagamento. É este relatório que bate com seu extrato e reflete o lucro real da empresa.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
