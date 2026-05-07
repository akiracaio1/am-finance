
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Wallet, 
  FilterX, 
  Edit2,
  RotateCcw,
  Upload,
  Loader2,
  AlertCircle
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { Supplier, AccountCategory, AccountsPayableEntry, EntryType, CostCenter } from "@/lib/types";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  startOfMonth, 
  endOfMonth, 
  addMonths,
  startOfYear,
  endOfYear,
  subMonths,
  parse
} from "date-fns";

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountsPayableEntry | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [entryToPay, setEntryToPay] = useState<AccountsPayableEntry | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplierId, setFilterSupplierId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");
  const [datePreset, setDatePreset] = useState("custom");

  // Estados para pagamento
  const [interest, setInterest] = useState(0);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);

  // ESTADOS DO FORMULÁRIO
  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState("");
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Pix");
  const [formCostCenterId, setFormCostCenterId] = useState("");

  const [repetitionType, setRepetitionType] = useState<"single" | "fixed" | "installments">("single");
  const [numRepetitions, setNumRepetitions] = useState(1);
  const [generatedInstallments, setGeneratedInstallments] = useState<{date: string, amount: number}[]>([]);

  useEffect(() => {
    const nowStr = format(new Date(), "yyyy-MM-dd");
    setTodayStr(nowStr);
  }, []);

  useEffect(() => {
    if (editingEntry) {
      setFormType(editingEntry.entryType);
      setFormDescription(editingEntry.description);
      setFormAmount(editingEntry.originalAmount);
      setFormDueDate(editingEntry.dueDate);
      setFormIssueDate(editingEntry.issueDate || "");
      setFormSupplierId(editingEntry.supplierId);
      setFormCategoryId(editingEntry.accountCategoryId);
      setFormPaymentMethod(editingEntry.paymentMethod || "Pix");
      setFormCostCenterId(editingEntry.costCenterId || "none");
    } else {
      setFormType("Confirmed");
      setFormDescription("");
      setFormAmount(0);
      setFormDueDate(format(new Date(), "yyyy-MM-dd"));
      setFormIssueDate("");
      setFormSupplierId("");
      setFormCategoryId("");
      setFormPaymentMethod("Pix");
      setFormCostCenterId("none");
    }
  }, [editingEntry, isNewEntryOpen]);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (preset) {
      case "today": start = today; end = today; break;
      case "thisWeek": start = startOfWeek(today, { weekStartsOn: 1 }); end = endOfWeek(today, { weekStartsOn: 1 }); break;
      case "thisMonth": start = startOfMonth(today); end = endOfMonth(today); break;
      case "nextWeek": const nextWeek = addWeeks(today, 1); start = startOfWeek(nextWeek, { weekStartsOn: 1 }); end = endOfWeek(nextWeek, { weekStartsOn: 1 }); break;
      case "lastMonth": const lastMonth = subMonths(today, 1); start = startOfMonth(lastMonth); end = endOfMonth(lastMonth); break;
      case "thisYear": start = startOfYear(today); end = endOfYear(today); break;
      default: return;
    }

    if (start && end) {
      setFilterDueDateStart(format(start, "yyyy-MM-dd"));
      setFilterDueDateEnd(format(end, "yyyy-MM-dd"));
    }
  };

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

  const { data: entries } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);

  const leafCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => !categories.some(child => child.parentCategoryId === cat.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [categories]);

  const getDynamicStatus = (entry: AccountsPayableEntry) => {
    if (entry.status === 'Paid') return 'Paid';
    if (!todayStr) return entry.status;
    if (entry.dueDate < todayStr) return 'Overdue';
    if (entry.dueDate === todayStr) return 'DueToday';
    return 'Open';
  };

  const calculateSettledValue = (entry: AccountsPayableEntry) => {
    return (entry.originalAmount || 0) + (entry.interest || 0) + (entry.fine || 0) - (entry.discount || 0);
  };

  const filteredEntries = entries?.map(entry => ({ ...entry, dynamicStatus: getDynamicStatus(entry) }))
    .filter(e => {
      const statusMatch = filterStatus === 'all' || e.dynamicStatus.toLowerCase() === filterStatus.toLowerCase();
      const supplierMatch = filterSupplierId === 'all' || e.supplierId === filterSupplierId;
      const categoryMatch = filterCategoryId === 'all' || e.accountCategoryId === filterCategoryId;
      const dueDateMatch = (!filterDueDateStart || e.dueDate >= filterDueDateStart) && (!filterDueDateEnd || e.dueDate <= filterDueDateEnd);
      return statusMatch && supplierMatch && categoryMatch && dueDateMatch;
    }) || [];

  const totalOverdue = filteredEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = filteredEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = filteredEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = filteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + calculateSettledValue(curr), 0);

  const clearFilters = () => {
    setFilterStatus("all"); setFilterSupplierId("all"); setFilterCategoryId("all");
    setFilterDueDateStart(""); setFilterDueDateEnd(""); setDatePreset("custom");
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
      if (lines.length < 2) {
        toast({ variant: "destructive", title: "Erro na importação", description: "Arquivo vazio." });
        setIsImporting(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows = lines.slice(1);
      const errors: string[] = [];
      const batchData: any[] = [];

      rows.forEach((row, index) => {
        const columns = row.split(",").map(c => c.trim());
        const data: any = {};
        headers.forEach((h, i) => { data[h] = columns[i]; });

        const line = index + 2;
        if (!data.vencimento || !data.fornecedor || !data.categoria || !data.descricao || !data.valor || !data.tipo) {
          errors.push(`Linha ${line}: Campos obrigatórios faltando.`);
        }

        const supplier = suppliers?.find(s => s.name.toLowerCase() === data.fornecedor?.toLowerCase());
        const category = leafCategories.find(c => c.name.toLowerCase() === data.categoria?.toLowerCase());
        const center = centers?.find(c => c.name.toLowerCase() === data.centrocusto?.toLowerCase());

        if (!supplier) errors.push(`Linha ${line}: Fornecedor '${data.fornecedor}' não encontrado.`);
        if (!category) errors.push(`Linha ${line}: Categoria '${data.categoria}' não encontrada ou não é um item folha.`);

        if (errors.length === 0) {
          const entryId = `pay_imp_${Date.now()}_${index}`;
          let formattedDate = data.vencimento;
          if (formattedDate.includes("/")) {
            try { formattedDate = format(parse(formattedDate, "dd/MM/yyyy", new Date()), "yyyy-MM-dd"); } catch (e) {}
          }

          batchData.push({
            id: entryId,
            supplierId: supplier!.id,
            accountCategoryId: category!.id,
            costCenterId: center?.id || null,
            description: data.descricao,
            originalAmount: parseFloat(data.valor.replace("R$", "").replace(".", "").replace(",", ".")),
            dueDate: formattedDate,
            issueDate: data.emissao || "",
            status: 'Open',
            entryType: (data.tipo === 'Provision' ? 'Provision' : 'Confirmed') as EntryType,
            paymentMethod: data.formapagamento || "Pix",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });

      if (errors.length > 0) {
        toast({ variant: "destructive", title: "Erro de Validação", description: errors.slice(0, 3).join(" | ") });
      } else {
        batchData.forEach(d => {
          const ref = doc(db, "users", user.uid, "accountsPayableEntries", d.id);
          setDocumentNonBlocking(ref, d, { merge: true });
        });
        toast({ title: "Importação concluída", description: `${batchData.length} itens importados.` });
      }
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (repetitionType === 'single' || !formDueDate) { setGeneratedInstallments([]); return; }
    const newInstallments = [];
    for (let i = 0; i < numRepetitions; i++) {
      const date = addMonths(new Date(formDueDate + 'T12:00:00'), i);
      const amount = repetitionType === 'installments' ? Number((formAmount / numRepetitions).toFixed(2)) : formAmount;
      newInstallments.push({ date: format(date, "yyyy-MM-dd"), amount: amount });
    }
    setGeneratedInstallments(newInstallments);
  }, [repetitionType, numRepetitions, formAmount, formDueDate]);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const baseData = {
      supplierId: formSupplierId, accountCategoryId: formCategoryId, costCenterId: formCostCenterId === "none" ? null : formCostCenterId,
      description: formDescription, issueDate: formIssueDate, paymentMethod: formPaymentMethod, entryType: formType, updatedAt: new Date().toISOString(),
    };

    if (editingEntry) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", editingEntry.id), { ...baseData, originalAmount: formAmount, dueDate: formDueDate });
      toast({ title: "Atualizado" });
    } else {
      if (repetitionType === 'single') {
        const id = `pay_${Date.now()}`;
        setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", id), { ...baseData, id, status: 'Open', originalAmount: formAmount, dueDate: formDueDate, createdAt: new Date().toISOString() }, { merge: true });
      } else {
        generatedInstallments.forEach((inst, i) => {
          const id = `pay_${Date.now()}_${i}`;
          setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", id), { ...baseData, id, status: 'Open', originalAmount: inst.amount, dueDate: inst.date, installmentInfo: `${i+1}/${numRepetitions}`, createdAt: new Date().toISOString() }, { merge: true });
        });
      }
      toast({ title: "Salvo" });
    }
    setIsNewEntryOpen(false); setEditingEntry(null);
  };

  const handleConfirmPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user || !entryToPay) return;
    const formData = new FormData(e.currentTarget);
    updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entryToPay.id), {
      status: 'Paid', entryType: 'Confirmed', paymentDate: formData.get("paymentDate"), bankAccountId: formData.get("bankAccountId"),
      interest, fine, discount, updatedAt: new Date().toISOString()
    });
    toast({ title: "Pago" }); setIsPaymentOpen(false); setEntryToPay(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowDownCircle className="text-destructive w-8 h-8" />Contas a Pagar</h1>
          <p className="text-muted-foreground">Gestão de despesas e provisões.</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Importar CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4" /> Filtros</Button>
          <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}><DialogTrigger asChild><Button className="gap-2 shadow-lg"><Plus className="w-4 h-4" /> Novo Lançamento</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSaveEntry}><DialogHeader><DialogTitle>{editingEntry ? 'Editar' : 'Novo'}</DialogTitle></DialogHeader>
                <Tabs defaultValue="basic" className="mt-4"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="basic">Dados</TabsTrigger><TabsTrigger value="repeat" disabled={!!editingEntry}>Repetir</TabsTrigger></TabsList>
                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2"><Label>Tipo</Label><Select value={formType} onValueChange={(v: any) => setFormType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Confirmed">Confirmado</SelectItem><SelectItem value="Provision">Provisão</SelectItem></SelectContent></Select></div>
                      <div className="grid gap-2"><Label>Descrição*</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2"><Label>Valor*</Label><Input type="number" step="0.01" value={formAmount || ""} onChange={e => setFormAmount(Number(e.target.value))} required /></div>
                      <div className="grid gap-2"><Label>Vencimento*</Label><Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required /></div>
                      <div className="grid gap-2"><Label>Emissão</Label><Input type="date" value={formIssueDate} onChange={e => setFormIssueDate(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2"><Label>Fornecedor*</Label><Select value={formSupplierId} onValueChange={setFormSupplierId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="grid gap-2"><Label>Categoria*</Label><Select value={formCategoryId} onValueChange={setFormCategoryId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  </TabsContent>
                  <TabsContent value="repeat" className="space-y-4 pt-4">
                    <div className="grid gap-2"><Label>Tipo</Label><Select value={repetitionType} onValueChange={(v: any) => setRepetitionType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">Único</SelectItem><SelectItem value="fixed">Fixo Mensal</SelectItem><SelectItem value="installments">Parcelado</SelectItem></SelectContent></Select></div>
                    {repetitionType !== 'single' && <div className="grid gap-2"><Label>Nº Parcelas/Meses</Label><Input type="number" min="2" value={numRepetitions} onChange={e => setNumRepetitions(Number(e.target.value))} /></div>}
                  </TabsContent>
                </Tabs>
                <DialogFooter className="mt-6"><Button type="submit" className="w-full">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-xs text-muted-foreground flex items-center gap-3">
        <AlertCircle className="w-4 h-4" /><span>Colunas CSV: <strong>Vencimento, Fornecedor, Categoria, Descricao, Valor, Tipo, Emissao, FormaPagamento, CentroCusto</strong>.</span>
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}><CollapsibleContent className="space-y-4"><Card className="bg-muted/30"><CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Status</Label><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="bg-background"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="DueToday">Hoje</SelectItem><SelectItem value="Overdue">Atrasado</SelectItem><SelectItem value="Open">Aberto</SelectItem><SelectItem value="Paid">Pago</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Vencimento</Label><Select value={datePreset} onValueChange={handleDatePresetChange}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="custom">Período</SelectItem><SelectItem value="today">Hoje</SelectItem><SelectItem value="thisWeek">Semana</SelectItem><SelectItem value="thisMonth">Mês</SelectItem><SelectItem value="lastMonth">Mês Ant.</SelectItem><SelectItem value="thisYear">Ano</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 md:col-span-3"><Label className="text-xs uppercase font-bold text-muted-foreground">Datas e Limpeza</Label><div className="flex gap-2"><Input type="date" value={filterDueDateStart} onChange={e => setFilterDueDateStart(e.target.value)} className="h-9" /><Input type="date" value={filterDueDateEnd} onChange={e => setFilterDueDateEnd(e.target.value)} className="h-9" /><Button variant="ghost" onClick={clearFilters} className="h-9"><FilterX className="w-4 h-4" /></Button></div></div>
        </div>
      </CardContent></Card></CollapsibleContent></Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-destructive/5"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-destructive/70">Atrasado</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-amber-50"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-amber-700">Hoje</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-primary/5"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-primary/70">Aberto</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-emerald-50"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-emerald-700">Pago</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
      </div>

      <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
        <TableBody>{filteredEntries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
          <TableRow key={entry.id} className={cn(entry.entryType === 'Provision' ? "bg-muted/10" : "")}>
            <TableCell className="text-sm">{format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}</TableCell>
            <TableCell className="font-medium">{suppliers?.find(s => s.id === entry.supplierId)?.name || 'N/A'}</TableCell>
            <TableCell><div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">{categories?.find(c => c.id === entry.accountCategoryId)?.name}</span><span className="text-sm">{entry.description}</span></div></TableCell>
            <TableCell><Badge variant={entry.entryType === 'Provision' ? 'outline' : 'secondary'} className="text-[10px]">{entry.entryType === 'Provision' ? 'Provisão' : 'Conf.'}</Badge></TableCell>
            <TableCell>{entry.dynamicStatus === 'Paid' ? <Badge className="bg-emerald-100 text-emerald-700">Pago</Badge> : entry.dynamicStatus === 'Overdue' ? <Badge variant="destructive">Atraso</Badge> : entry.dynamicStatus === 'DueToday' ? <Badge className="bg-amber-100 text-amber-700">Hoje</Badge> : <Badge variant="outline">Aberto</Badge>}</TableCell>
            <TableCell className="text-right font-bold">R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
            <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => { setEntryToPay(entry); setIsPaymentOpen(true); }} className="text-emerald-600"><Wallet className="w-4 h-4 mr-2" /> Pagar</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setEditingEntry(entry)}><Edit2 className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entry.id))} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu></TableCell>
          </TableRow>))}</TableBody></Table></CardContent></Card>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}><DialogContent className="max-w-md">
        {entryToPay && <form onSubmit={handleConfirmPayment}><DialogHeader><DialogTitle>Pagar: {entryToPay.description}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Data</Label><Input name="paymentDate" type="date" defaultValue={todayStr} required /></div><div className="grid gap-2"><Label>Conta</Label><Select name="bankAccountId" required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="itau">Itaú</SelectItem><SelectItem value="nubank">Nubank</SelectItem></SelectContent></Select></div></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2"><Label className="text-[10px]">Juros</Label><Input type="number" step="0.01" value={interest} onChange={e => setInterest(Number(e.target.value))} /></div>
              <div className="grid gap-2"><Label className="text-[10px]">Multa</Label><Input type="number" step="0.01" value={fine} onChange={e => setFine(Number(e.target.value))} /></div>
              <div className="grid gap-2"><Label className="text-[10px]">Desc.</Label><Input type="number" step="0.01" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
            </div>
            <div className="bg-primary/5 p-4 rounded-lg text-center font-bold text-xl">R$ {(entryToPay.originalAmount + interest + fine - discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div><DialogFooter><Button type="submit" className="w-full">Confirmar</Button></DialogFooter></form>}
      </Dialog></Dialog>
    </div>
  );
}
