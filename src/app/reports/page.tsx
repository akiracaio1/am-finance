
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  Filter,
  Download,
  Loader2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  TrendingDown,
  TrendingUp,
  Clock,
  LayoutGrid,
  Wallet
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
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase
} from "@/firebase";
import { collection } from "firebase/firestore";
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

type ReportType = "payable_pending" | "payable_paid" | "receivable_pending" | "receivable_paid";

export default function ReportsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("payable_pending");

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

  const receivablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsReceivableEntries");
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

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "bankAccounts");
  }, [db, user]);

  const { data: payables, isLoading: loadingPay } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: receivables, isLoading: loadingRec } = useCollection<AccountsReceivableEntry>(receivablesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);
  const { data: accounts } = useCollection<BankAccount>(accountsQuery);

  // Lógica de Filtragem Unificada
  const filteredData = useMemo(() => {
    if (!payables || !receivables) return [];

    const isReceivable = reportType.startsWith("receivable");
    const isPaid = reportType.endsWith("_paid");
    const source = isReceivable ? receivables : payables;

    return source.filter(item => {
      const itemDate = isPaid ? item.paymentDate : item.dueDate;
      const statusMatch = isPaid ? item.status === 'Paid' : item.status !== 'Paid';
      
      if (!itemDate || !statusMatch) return false;
      return itemDate >= startDate && itemDate <= endDate;
    }).sort((a, b) => {
      const dateA = isPaid ? a.paymentDate! : a.dueDate;
      const dateB = isPaid ? b.paymentDate! : b.dueDate;
      return dateA.localeCompare(dateB);
    });
  }, [payables, receivables, reportType, startDate, endDate]);

  const totalValue = filteredData.reduce((acc, curr: any) => {
    if (reportType === 'payable_paid') {
      const net = curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0);
      return acc + net;
    }
    return acc + (curr.amount || curr.originalAmount || 0);
  }, 0);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    const isReceivable = reportType.startsWith("receivable");
    const isPaid = reportType.endsWith("_paid");

    const exportData = filteredData.map((item: any) => {
      const category = categories?.find(c => c.id === item.accountCategoryId)?.name || 'Geral';
      const centerName = centers?.find(c => c.id === item.costCenterId)?.name || '-';
      const bankAccountName = accounts?.find(a => a.id === item.bankAccountId)?.name || 'N/A';
      const entityLabel = isReceivable ? 'Cliente' : 'Fornecedor';
      const entityName = isReceivable ? item.customerName : (suppliers?.find(s => s.id === item.supplierId)?.name || 'N/A');
      const dateLabel = isPaid ? 'Data Pagamento/Recebimento' : 'Vencimento';
      const dateValue = isPaid ? item.paymentDate : item.dueDate;
      const formattedDate = dateValue ? format(isPaid ? parseISO(dateValue) : new Date(dateValue + 'T12:00:00'), 'dd/MM/yyyy') : '-';
      const formattedIssueDate = item.issueDate ? format(parseISO(item.issueDate), 'dd/MM/yyyy') : '-';

      const baseValue = item.amount || item.originalAmount;

      if (reportType === 'payable_paid') {
        const net = baseValue + (item.interest || 0) + (item.fine || 0) - (item.discount || 0);
        return {
          [dateLabel]: formattedDate,
          'Data de Emissão': formattedIssueDate,
          'Conta Bancária': bankAccountName,
          'Vencimento Original': item.dueDate ? format(new Date(item.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : '-',
          [entityLabel]: entityName,
          'Descrição': item.description,
          'Categoria': category,
          'Centro de Custo': centerName,
          'Valor Original (R$)': baseValue,
          'Juros/Multa (+)': (item.interest || 0) + (item.fine || 0),
          'Desconto (-)': (item.discount || 0),
          'Valor Pago Líquido (R$)': net
        };
      }

      return {
        [dateLabel]: formattedDate,
        'Data de Emissão': formattedIssueDate,
        'Conta Bancária': isPaid ? bankAccountName : 'Pendente',
        [entityLabel]: entityName,
        'Descrição': item.description,
        'Categoria': category,
        'Centro de Custo': centerName,
        'Valor (R$)': baseValue,
        'Status': item.status === 'Paid' ? 'Liquidado' : 'Pendente'
      };
    });

    const filename = `Relatorio_${reportType}_${startDate}_a_${endDate}`;
    const valueColumn = reportType === 'payable_paid' ? 'Valor Pago Líquido (R$)' : 'Valor (R$)';

    exportToExcel({ 
      data: exportData, 
      filename, 
      sheetName: 'Relatório Financeiro',
      summary: { 
        'Descrição': 'TOTAL GERAL NO PERÍODO', 
        [valueColumn]: totalValue 
      }
    });
  };

  if (!mounted || loadingPay || loadingRec) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const isReceivableReport = reportType.startsWith("receivable");
  const isPaidReport = reportType.endsWith("_paid");

  // Helper para formatar data de forma segura durante a digitação
  const safeFormatDate = (dateStr: string) => {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : '...';
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileSpreadsheet className="text-primary w-8 h-8" />
            Relatórios Estratégicos
          </h1>
          <p className="text-muted-foreground">Visão completa de fluxo e pendências (Pagar e Receber).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros de Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Módulo e Natureza</Label>
              <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payable_pending">Contas a Pagar (Pendentes)</SelectItem>
                  <SelectItem value="payable_paid">Contas a Pagar (Pagas)</SelectItem>
                  <SelectItem value="receivable_pending">Contas a Receber (Pendentes)</SelectItem>
                  <SelectItem value="receivable_paid">Contas Receber (Recebidas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Inicial ({isPaidReport ? 'Pagto/Rec.' : 'Venc.'})</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Final ({isPaidReport ? 'Pagto/Rec.' : 'Venc.'})</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="pt-6 border-t">
              <Button 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md h-12"
                onClick={handleExportExcel}
                disabled={filteredData.length === 0}
              >
                <Download className="w-4 h-4" /> Exportar para Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-primary/5 border-none">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-full", 
                  isReceivableReport ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
                )}>
                  {isReceivableReport ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Volume do Período</p>
                  <p className={cn("text-2xl font-black", isReceivableReport ? "text-emerald-700" : "text-destructive")}>
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
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Itens Listados</p>
                  <p className="text-2xl font-black text-primary">{filteredData.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {isReceivableReport ? <ArrowUpCircle className="w-5 h-5 text-emerald-600" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                  {reportType === 'payable_pending' && 'Contas a Pagar Pendentes'}
                  {reportType === 'payable_paid' && 'Contas Pagas (Realizado)'}
                  {reportType === 'receivable_pending' && 'Contas a Receber Pendentes'}
                  {reportType === 'receivable_paid' && 'Contas Recebidas (Entradas)'}
                </CardTitle>
                <CardDescription>
                  Período: {safeFormatDate(startDate)} até {safeFormatDate(endDate)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isPaidReport ? (isReceivableReport ? 'Recebimento' : 'Pagamento') : 'Vencimento'}</TableHead>
                      <TableHead>{isReceivableReport ? 'Cliente / Origem' : 'Fornecedor'}</TableHead>
                      <TableHead>Descrição / Categoria</TableHead>
                      <TableHead>Centro de Custo / Conta</TableHead>
                      <TableHead className="text-right">Valor {isPaidReport ? 'Líquido' : ''}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item: any) => {
                      const baseVal = item.amount || item.originalAmount;
                      const net = reportType === 'payable_paid' 
                        ? baseVal + (item.interest || 0) + (item.fine || 0) - (item.discount || 0)
                        : baseVal;
                      
                      const dateToDisplay = isPaidReport ? item.paymentDate : item.dueDate;
                      const dateObj = dateToDisplay ? (isPaidReport ? parseISO(dateToDisplay) : new Date(dateToDisplay + 'T12:00:00')) : null;
                      const center = centers?.find(c => c.id === item.costCenterId);
                      const bankAccount = accounts?.find(a => a.id === item.bankAccountId);

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-medium">
                            {dateObj && isValid(dateObj) ? format(dateObj, 'dd/MM/yy') : '-'}
                          </TableCell>
                          <TableCell className="text-xs font-bold truncate max-w-[150px]">
                            {isReceivableReport ? item.customerName : (suppliers?.find(s => s.id === item.supplierId)?.name || '-')}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span className="truncate max-w-[180px]">{item.description}</span>
                              <span className="text-[9px] text-muted-foreground uppercase">{categories?.find(c => c.id === item.accountCategoryId)?.name || 'Geral'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-1">
                              {center && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <LayoutGrid className="w-3 h-3" />
                                  {center.name}
                                </div>
                              )}
                              {bankAccount && (
                                <div className="flex items-center gap-1.5 text-primary italic font-medium">
                                  <Wallet className="w-3 h-3" />
                                  {bankAccount.name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">
                            <div className="flex flex-col items-end">
                              <span className={cn(isReceivableReport ? "text-emerald-700" : "text-destructive")}>
                                {formatCurrency(net)}
                              </span>
                              {reportType === 'payable_paid' && ((item.interest || 0) + (item.fine || 0) - (item.discount || 0) !== 0) && (
                                <span className="text-[8px] text-muted-foreground italic">Orig: {formatCurrency(item.originalAmount)}</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24 text-muted-foreground italic text-sm">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <AlertCircle className="w-12 h-12" />
                            Nenhum registro encontrado para este filtro.
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
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Dica de Auditoria</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Análise por Conta Bancária:</strong> Os relatórios de itens pagos agora mostram por qual conta o dinheiro transitou, facilitando o batimento com seus extratos físicos ou de PDF.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Exportação Inteligente:</strong> Ao exportar para Excel, a nova coluna "Conta Bancária" permitirá que você faça tabelas dinâmicas para ver o faturamento total por banco ou canal de recebimento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
