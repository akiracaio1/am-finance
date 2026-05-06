
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
  ArrowDownCircle, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  Calendar,
  Plus,
  Loader2,
  Trash2,
  Check,
  ChevronDown,
  AlertTriangle,
  CreditCard,
  Clock,
  RotateCcw,
  Wallet,
  X,
  Search,
  FilterX,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { Supplier, AccountCategory, CostCenter, AccountsPayableEntry } from "@/lib/types";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear 
} from "date-fns";

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [entryToPay, setEntryToPay] = useState<AccountsPayableEntry | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Estados dos Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplierId, setFilterSupplierId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");
  const [filterIssueDateStart, setFilterIssueDateStart] = useState("");
  const [filterIssueDateEnd, setFilterIssueDateEnd] = useState("");
  const [datePreset, setDatePreset] = useState("custom");

  // Estados para cálculo dinâmico no modal de pagamento
  const [interest, setInterest] = useState(0);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    setTodayStr(format(new Date(), "yyyy-MM-dd"));
  }, []);

  // Aplicação de atalhos de data
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (preset) {
      case "today":
        start = today;
        end = today;
        break;
      case "thisWeek":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "nextWeek":
        const nextWeek = addWeeks(today, 1);
        start = startOfWeek(nextWeek, { weekStartsOn: 1 });
        end = endOfWeek(nextWeek, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case "thisYear":
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      default:
        // Se for "custom", não alteramos as datas manuais
        return;
    }

    if (start && end) {
      setFilterDueDateStart(format(start, "yyyy-MM-dd"));
      setFilterDueDateEnd(format(end, "yyyy-MM-dd"));
    }
  };

  // Firestore Queries
  const entriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsPayableEntries");
  }, [db, user]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "suppliers");
  }, [db, user]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const { data: entries, isLoading: entriesLoading } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);

  const getDynamicStatus = (entry: AccountsPayableEntry) => {
    if (entry.status === 'Paid') return 'Paid';
    if (!todayStr) return entry.status;
    if (entry.dueDate < todayStr) return 'Overdue';
    if (entry.dueDate === todayStr) return 'DueToday';
    return 'Open';
  };

  const processedEntries = entries?.map(entry => ({
    ...entry,
    dynamicStatus: getDynamicStatus(entry)
  })) || [];

  const filteredEntries = processedEntries.filter(e => {
    const statusMatch = filterStatus === 'all' || e.dynamicStatus.toLowerCase() === filterStatus.toLowerCase();
    const supplierMatch = filterSupplierId === 'all' || e.supplierId === filterSupplierId;
    const categoryMatch = filterCategoryId === 'all' || e.accountCategoryId === filterCategoryId;
    
    const dueDateMatch = (!filterDueDateStart || e.dueDate >= filterDueDateStart) && 
                         (!filterDueDateEnd || e.dueDate <= filterDueDateEnd);
    
    const issueDateMatch = !e.issueDate || (
      (!filterIssueDateStart || e.issueDate >= filterIssueDateStart) && 
      (!filterIssueDateEnd || e.issueDate <= filterIssueDateEnd)
    );

    return statusMatch && supplierMatch && categoryMatch && dueDateMatch && issueDateMatch;
  });

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterSupplierId("all");
    setFilterCategoryId("all");
    setFilterDueDateStart("");
    setFilterDueDateEnd("");
    setFilterIssueDateStart("");
    setFilterIssueDateEnd("");
    setDatePreset("custom");
  };

  const hasActiveFilters = filterStatus !== "all" || filterSupplierId !== "all" || filterCategoryId !== "all" || filterDueDateStart || filterDueDateEnd || filterIssueDateStart || filterIssueDateEnd;

  const totalOverdue = processedEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = processedEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = processedEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = processedEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + curr.originalAmount, 0);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    const entryId = `pay_${Date.now()}`;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryId);
    const newEntry: AccountsPayableEntry = {
      id: entryId,
      supplierId: formData.get("supplierId") as string,
      accountCategoryId: formData.get("categoryId") as string,
      costCenterId: (formData.get("costCenterId") as string) || "",
      description: formData.get("description") as string,
      originalAmount: Number(formData.get("amount")),
      issueDate: formData.get("issueDate") as string,
      dueDate: formData.get("dueDate") as string,
      paymentMethod: formData.get("paymentMethod") as string,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(entryRef, newEntry, { merge: true });
    toast({ title: "Lançamento criado", description: "A conta foi agendada com sucesso." });
    setIsNewEntryOpen(false);
  };

  const handleConfirmPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user || !entryToPay) return;
    
    const formData = new FormData(e.currentTarget);
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryToPay.id);
    
    const paymentData = {
      status: 'Paid',
      paymentDate: formData.get("paymentDate") as string,
      bankAccountId: formData.get("bankAccountId") as string,
      interest: interest,
      fine: fine,
      discount: discount,
      updatedAt: new Date().toISOString()
    };

    updateDocumentNonBlocking(entryRef, paymentData);
    
    toast({ 
      title: "Pagamento confirmado", 
      description: `A conta "${entryToPay.description}" foi marcada como paga.` 
    });
    
    setIsPaymentOpen(false);
    
    setTimeout(() => {
      setEntryToPay(null);
      setInterest(0);
      setFine(0);
      setDiscount(0);
    }, 300);
  };

  const undoPayment = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    updateDocumentNonBlocking(entryRef, { 
      status: 'Open', 
      paymentDate: null, 
      bankAccountId: null, 
      interest: 0, 
      fine: 0, 
      discount: 0,
      updatedAt: new Date().toISOString() 
    });
    toast({ title: "Pagamento desfeito", description: "O lançamento voltou para o status de aberto." });
  };

  const deleteEntry = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    deleteDocumentNonBlocking(entryRef);
    toast({ title: "Lançamento removido", description: "O registro foi excluído permanentemente." });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'Overdue':
        return <Badge variant="destructive" className="border-none animate-pulse"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
      case 'DueToday':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none"><Clock className="w-3 h-3 mr-1" /> Vence Hoje</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Calendar className="w-3 h-3 mr-1" /> Aberto</Badge>;
    }
  };

  const finalSettlementAmount = (entryToPay?.originalAmount || 0) + interest + fine - discount;

  const calculateSettledValue = (entry: AccountsPayableEntry) => {
    return entry.originalAmount + (entry.interest || 0) + (entry.fine || 0) - (entry.discount || 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowDownCircle className="text-destructive w-8 h-8" />
            Contas a Pagar
          </h1>
          <p className="text-muted-foreground">Gestão inteligente de despesas e prazos.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className={cn("gap-2", hasActiveFilters && "border-primary text-primary bg-primary/5")} onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4" /> 
            {hasActiveFilters ? "Filtros Ativos" : "Filtros"}
          </Button>
          <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSaveEntry}>
                <DialogHeader>
                  <DialogTitle>Novo Lançamento de Despesa</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descrição / Item *</Label>
                    <Input id="description" name="description" placeholder="Ex: Compra de Insumos" required />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Valor (R$) *</Label>
                      <Input id="amount" name="amount" type="number" step="0.01" placeholder="0,00" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                      <Select name="paymentMethod">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pix">Pix</SelectItem>
                          <SelectItem value="Boleto">Boleto</SelectItem>
                          <SelectItem value="Cartão">Cartão</SelectItem>
                          <SelectItem value="Transferência">Transferência</SelectItem>
                          <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="issueDate">Data de Emissão (Opcional)</Label>
                      <Input id="issueDate" name="issueDate" type="date" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dueDate">Vencimento *</Label>
                      <Input id="dueDate" name="dueDate" type="date" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="supplierId">Fornecedor *</Label>
                      <Select name="supplierId" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="categoryId">Categoria Financeira *</Label>
                      <Select name="categoryId" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ""}{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="costCenterId">Centro de Custo (Opcional)</Label>
                    <Select name="costCenterId">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {centers?.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Salvar Lançamento</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="DueToday">Vence Hoje</SelectItem>
                      <SelectItem value="Overdue">Atrasado</SelectItem>
                      <SelectItem value="Open">Aberto</SelectItem>
                      <SelectItem value="Paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Fornecedor</Label>
                  <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Fornecedores</SelectItem>
                      {suppliers?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Categoria</Label>
                  <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Categorias</SelectItem>
                      {categories?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-0.5">
                  <Button variant="ghost" className="w-full gap-2 text-muted-foreground hover:text-destructive" onClick={clearFilters}>
                    <FilterX className="w-4 h-4" /> Limpar Filtros
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 pt-4 border-t border-dashed">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Atalhos de Vencimento
                  </Label>
                  <Select value={datePreset} onValueChange={handleDatePresetChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Escolha um período..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizado</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="thisWeek">Essa Semana</SelectItem>
                      <SelectItem value="nextWeek">Semana que Vem</SelectItem>
                      <SelectItem value="thisMonth">Este Mês</SelectItem>
                      <SelectItem value="lastMonth">Mês Passado</SelectItem>
                      <SelectItem value="thisYear">Este Ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Vencimento entre</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={filterDueDateStart} onChange={(e) => { setFilterDueDateStart(e.target.value); setDatePreset("custom"); }} className="bg-background text-xs" />
                    <span className="text-muted-foreground text-xs">até</span>
                    <Input type="date" value={filterDueDateEnd} onChange={(e) => { setFilterDueDateEnd(e.target.value); setDatePreset("custom"); }} className="bg-background text-xs" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Emissão entre</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={filterIssueDateStart} onChange={(e) => setFilterIssueDateStart(e.target.value)} className="bg-background text-xs" />
                    <span className="text-muted-foreground text-xs">até</span>
                    <Input type="date" value={filterIssueDateEnd} onChange={(e) => setFilterIssueDateEnd(e.target.value)} className="bg-background text-xs" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-destructive/80 uppercase tracking-tighter">Em Atraso</p>
            <div className="text-2xl font-bold text-destructive">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-tighter">Vence Hoje</p>
            <div className="text-2xl font-bold text-amber-800">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-primary/80 uppercase tracking-tighter">Próximos Dias</p>
            <div className="text-2xl font-bold text-primary">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-tighter">Total Pago</p>
            <div className="text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
          <CardTitle className="text-lg">Fluxo de Despesas</CardTitle>
          <div className="text-xs text-muted-foreground">
            {filteredEntries.length} lançamento(s) encontrado(s)
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {entriesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando lançamentos...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Nenhum lançamento encontrado</h3>
              <p className="text-sm text-muted-foreground mt-2">Ajuste os filtros ou adicione uma nova conta.</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-primary">Limpar todos os filtros</Button>
              )}
            </div>
          ) : (
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
                {filteredEntries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                  <TableRow key={entry.id} className="group">
                    <TableCell className="font-mono text-sm">
                      <div className="flex flex-col">
                        <span>{new Date(entry.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        {entry.issueDate && (
                          <span className="text-[9px] text-muted-foreground">Em: {new Date(entry.issueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {suppliers?.find(s => s.id === entry.supplierId)?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                          {categories?.find(c => c.id === entry.accountCategoryId)?.name || 'Sem Categoria'}
                        </span>
                        <span>{entry.description}</span>
                        {entry.paymentMethod && (
                          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <CreditCard className="w-2 h-2" /> {entry.paymentMethod}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.dynamicStatus)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "font-bold",
                          entry.dynamicStatus === 'Overdue' ? "text-destructive" : "",
                          entry.dynamicStatus === 'DueToday' ? "text-amber-600" : ""
                        )}>
                          R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {entry.status === 'Paid' && (
                          <div className="flex flex-col items-end mt-1">
                            <span className="text-[10px] text-emerald-600 font-bold">
                              Liquidado: R$ {calculateSettledValue(entry).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {(entry.interest || entry.fine) ? (
                              <span className="text-[8px] text-muted-foreground">
                                (+ juros/multa)
                              </span>
                            ) : entry.discount ? (
                              <span className="text-[8px] text-muted-foreground">
                                (- desconto)
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status !== 'Paid' ? (
                            <DropdownMenuItem onClick={() => { setEntryToPay(entry); setIsPaymentOpen(true); }} className="text-emerald-600">
                              <Check className="w-4 h-4 mr-2" /> Marcar como Pago
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => undoPayment(entry)} className="text-amber-600">
                              <RotateCcw className="w-4 h-4 mr-2" /> Estornar Pagamento
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => deleteEntry(entry)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Pagamento */}
      <Dialog open={isPaymentOpen} onOpenChange={(open) => {
        if (!open) {
          setIsPaymentOpen(false);
          setTimeout(() => {
            setEntryToPay(null);
            setInterest(0);
            setFine(0);
            setDiscount(0);
          }, 300);
        } else {
          setIsPaymentOpen(true);
        }
      }}>
        <DialogContent className="max-w-md">
          {entryToPay && (
            <form onSubmit={handleConfirmPayment}>
              <DialogHeader>
                <DialogTitle>Confirmar Pagamento</DialogTitle>
                <div className="text-sm text-muted-foreground mt-2">
                  Liquidação de: <strong className="text-foreground">{entryToPay.description}</strong>
                </div>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="paymentDate">Data de Pagamento *</Label>
                    <Input id="paymentDate" name="paymentDate" type="date" defaultValue={todayStr} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bankAccountId">Conta Bancária *</Label>
                    <Select name="bankAccountId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="itau">Itaú (Principal)</SelectItem>
                        <SelectItem value="nubank">Nubank (Reserva)</SelectItem>
                        <SelectItem value="caixa">Caixa (Operacional)</SelectItem>
                        <SelectItem value="money">Caixinha (Dinheiro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="interest">Juros (R$)</Label>
                    <Input 
                      id="interest" 
                      name="interest" 
                      type="number" 
                      step="0.01" 
                      value={interest}
                      onChange={(e) => setInterest(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fine">Multa (R$)</Label>
                    <Input 
                      id="fine" 
                      name="fine" 
                      type="number" 
                      step="0.01" 
                      value={fine}
                      onChange={(e) => setFine(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="discount">Desconto (R$)</Label>
                    <Input 
                      id="discount" 
                      name="discount" 
                      type="number" 
                      step="0.01" 
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 border border-dashed mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Valor Original:</span>
                    <span>R$ {entryToPay.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Valor da Liquidação:</span>
                    <span className="text-primary">R$ {finalSettlementAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full gap-2 py-6">
                  <Wallet className="w-4 h-4" /> Confirmar Liquidação
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
