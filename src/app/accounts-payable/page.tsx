
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
  Wallet, 
  FilterX, 
  Edit2,
  Loader2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Calendar,
  Split
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, addDoc, serverTimestamp } from "firebase/firestore";
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
  subMonths,
  endOfYear,
  isBefore,
  isAfter,
  isSameDay
} from "date-fns";
import * as XLSX from 'xlsx';

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountsPayableEntry | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [entryToPay, setEntryToPay] = useState<AccountsPayableEntry | null>(null);
  const [todayStr, setTodayStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showFilters, setShowFilters] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplierId, setFilterSupplierId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");
  const [datePreset, setDatePreset] = useState("custom");

  // Pagamento
  const [interest, setInterest] = useState(0);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);

  // Form State (Controlled)
  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Pix");
  const [formCostCenterId, setFormCostCenterId] = useState("none");

  const [repetitionType, setRepetitionType] = useState<"single" | "fixed" | "installments">("single");
  const [numRepetitions, setNumRepetitions] = useState(1);
  const [generatedInstallments, setGeneratedInstallments] = useState<{date: string, amount: number}[]>([]);

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
    const dueDate = new Date(entry.dueDate + 'T12:00:00');
    const today = new Date(todayStr + 'T12:00:00');
    
    if (isBefore(dueDate, today) && !isSameDay(dueDate, today)) return 'Overdue';
    if (isSameDay(dueDate, today)) return 'DueToday';
    return 'Open';
  };

  const calculateSettledValue = (entry: AccountsPayableEntry) => {
    return (entry.originalAmount || 0) + (entry.interest || 0) + (entry.fine || 0) - (entry.discount || 0);
  };

  const filteredEntries = useMemo(() => {
    return entries?.map(entry => ({ ...entry, dynamicStatus: getDynamicStatus(entry) }))
      .filter(e => {
        const statusMatch = filterStatus === 'all' || e.dynamicStatus.toLowerCase() === filterStatus.toLowerCase();
        const supplierMatch = filterSupplierId === 'all' || e.supplierId === filterSupplierId;
        const categoryMatch = filterCategoryId === 'all' || e.accountCategoryId === filterCategoryId;
        const dueDateMatch = (!filterDueDateStart || e.dueDate >= filterDueDateStart) && (!filterDueDateEnd || e.dueDate <= filterDueDateEnd);
        return statusMatch && supplierMatch && categoryMatch && dueDateMatch;
      }) || [];
  }, [entries, filterStatus, filterSupplierId, filterCategoryId, filterDueDateStart, filterDueDateEnd, todayStr]);

  // Totais baseados nos filtros
  const totalOverdue = filteredEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = filteredEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = filteredEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = filteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + calculateSettledValue(curr), 0);

  // Logic to generate installments preview
  useEffect(() => {
    if (repetitionType === 'single') {
      setGeneratedInstallments([]);
      return;
    }

    const newInstallments = [];
    const baseDate = new Date(formDueDate + 'T12:00:00');
    
    for (let i = 0; i < numRepetitions; i++) {
      const installmentDate = addMonths(baseDate, i);
      const installmentAmount = repetitionType === 'installments' 
        ? Number((formAmount / numRepetitions).toFixed(2)) 
        : formAmount;

      newInstallments.push({
        date: format(installmentDate, "yyyy-MM-dd"),
        amount: installmentAmount
      });
    }
    setGeneratedInstallments(newInstallments);
  }, [repetitionType, numRepetitions, formAmount, formDueDate]);

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

  const clearFilters = () => {
    setFilterStatus("all"); setFilterSupplierId("all"); setFilterCategoryId("all");
    setFilterDueDateStart(""); setFilterDueDateEnd(""); setDatePreset("custom");
  };

  const downloadTemplate = () => {
    const headers = ["Vencimento", "Fornecedor", "Categoria", "Descricao", "Valor", "Tipo", "Emissao", "FormaPagamento", "CentroCusto"];
    const sampleData = [{
      "Vencimento": "25/12/2024",
      "Fornecedor": "Peixaria Central",
      "Categoria": "Materiais para Revenda",
      "Descricao": "Compra Salmão",
      "Valor": 1500.00,
      "Tipo": "Confirmed",
      "Emissao": "20/12/2024",
      "FormaPagamento": "Pix",
      "CentroCusto": "Cozinha"
    }];
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, "modelo_contas_pagar.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dataBuffer = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) throw new Error("Arquivo vazio.");

        const errors: string[] = [];
        const batchData: any[] = [];

        rows.forEach((row, index) => {
          const line = index + 2;
          const vencimento = row["Vencimento"] || row["vencimento"];
          const fornecedorNome = row["Fornecedor"] || row["fornecedor"];
          const categoriaNome = row["Categoria"] || row["categoria"];
          const valor = row["Valor"] || row["valor"];

          if (!vencimento || !fornecedorNome || !categoriaNome || !valor) {
            errors.push(`Linha ${line}: Campos obrigatórios faltando.`);
            return;
          }

          const supplier = suppliers?.find(s => s.name.toLowerCase().trim() === String(fornecedorNome).toLowerCase().trim());
          const category = leafCategories.find(c => c.name.toLowerCase().trim() === String(categoriaNome).toLowerCase().trim());
          
          if (!supplier) {
            errors.push(`Linha ${line}: Fornecedor '${fornecedorNome}' não cadastrado.`);
            return;
          }
          if (!category) {
            errors.push(`Linha ${line}: Categoria '${categoriaNome}' não cadastrada.`);
            return;
          }

          let formattedDate = String(vencimento);
          if (typeof vencimento === 'number') {
            formattedDate = format(XLSX.utils.numdate(vencimento), "yyyy-MM-dd");
          } else if (formattedDate.includes("/")) {
            const [d, m, y] = formattedDate.split("/");
            formattedDate = `${y}-${m}-${d}`;
          }

          batchData.push({
            id: `pay_imp_${Date.now()}_${index}`,
            supplierId: supplier.id,
            accountCategoryId: category.id,
            description: String(row["Descricao"] || "Importado"),
            originalAmount: Number(valor),
            dueDate: formattedDate,
            status: 'Open',
            entryType: (row["Tipo"] === 'Provision' ? 'Provision' : 'Confirmed') as EntryType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });

        if (errors.length > 0) {
          toast({ variant: "destructive", title: "Erro de Integridade", description: errors.slice(0, 3).join(" | ") });
        } else {
          batchData.forEach(d => setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", d.id), d, { merge: true }));
          toast({ title: "Importação concluída", description: `${batchData.length} registros adicionados.` });
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erro na leitura", description: err.message });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    const baseData = {
      supplierId: formSupplierId, 
      accountCategoryId: formCategoryId, 
      costCenterId: formCostCenterId === "none" ? null : formCostCenterId,
      description: formDescription, 
      issueDate: formIssueDate, 
      paymentMethod: formPaymentMethod, 
      entryType: formType, 
      updatedAt: new Date().toISOString(),
    };

    if (editingEntry) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", editingEntry.id), { ...baseData, originalAmount: formAmount, dueDate: formDueDate });
      toast({ title: "Lançamento atualizado" });
    } else {
      if (repetitionType === 'single') {
        const id = `pay_${Date.now()}`;
        setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", id), { ...baseData, id, status: 'Open', originalAmount: formAmount, dueDate: formDueDate, createdAt: new Date().toISOString() }, { merge: true });
      } else {
        generatedInstallments.forEach((inst, idx) => {
          const id = `pay_${Date.now()}_${idx}`;
          setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", id), { 
            ...baseData, 
            id, 
            status: 'Open', 
            originalAmount: inst.amount, 
            dueDate: inst.date, 
            installmentInfo: repetitionType === 'installments' ? `${idx + 1}/${numRepetitions}` : undefined,
            createdAt: new Date().toISOString() 
          }, { merge: true });
        });
        toast({ title: `${generatedInstallments.length} lançamentos gerados` });
      }
    }
    setIsNewEntryOpen(false); setEditingEntry(null);
  };

  const openEdit = (entry: AccountsPayableEntry) => {
    setEditingEntry(entry);
    setFormType(entry.entryType);
    setFormDescription(entry.description);
    setFormAmount(entry.originalAmount);
    setFormDueDate(entry.dueDate);
    setFormIssueDate(entry.issueDate || "");
    setFormSupplierId(entry.supplierId);
    setFormCategoryId(entry.accountCategoryId);
    setFormPaymentMethod(entry.paymentMethod || "Pix");
    setFormCostCenterId(entry.costCenterId || "none");
    setRepetitionType("single");
    setIsNewEntryOpen(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormType("Confirmed");
    setFormDescription("");
    setFormAmount(0);
    setFormDueDate(format(new Date(), "yyyy-MM-dd"));
    setFormIssueDate("");
    setFormSupplierId("");
    setFormCategoryId("");
    setFormPaymentMethod("Pix");
    setFormCostCenterId("none");
    setRepetitionType("single");
    setNumRepetitions(1);
    setIsNewEntryOpen(true);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowDownCircle className="text-destructive w-8 h-8" />Contas a Pagar</h1>
          <p className="text-muted-foreground">Gestão financeira com foco em planejamento.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}><Download className="w-4 h-4" /> Modelo</Button>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Importar Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4" /> Filtros</Button>
          <Button className="gap-2 shadow-lg" onClick={resetForm}><Plus className="w-4 h-4" /> Novo Lançamento</Button>
        </div>
      </div>

      <Collapsible title="Filtros" open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="DueToday">Hoje</SelectItem>
                      <SelectItem value="Overdue">Atrasado</SelectItem>
                      <SelectItem value="Open">Em Aberto</SelectItem>
                      <SelectItem value="Paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Vencimento Rápido</Label>
                  <Select value={datePreset} onValueChange={handleDatePresetChange}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizado</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="thisWeek">Esta Semana</SelectItem>
                      <SelectItem value="thisMonth">Este Mês</SelectItem>
                      <SelectItem value="lastMonth">Mês Passado</SelectItem>
                      <SelectItem value="thisYear">Este Ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Período e Limpeza</Label>
                  <div className="flex gap-2">
                    <Input type="date" value={filterDueDateStart} onChange={e => setFilterDueDateStart(e.target.value)} className="h-9" />
                    <Input type="date" value={filterDueDateEnd} onChange={e => setFilterDueDateEnd(e.target.value)} className="h-9" />
                    <Button variant="ghost" onClick={clearFilters} className="h-9"><FilterX className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-destructive/5"><CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-destructive/70">Atrasado</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-amber-50"><CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-amber-700">Hoje</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-primary/5"><CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-primary/70">Em Aberto</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-emerald-50"><CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-emerald-700">Total Pago</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredEntries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                <TableRow key={entry.id} className={cn(entry.entryType === 'Provision' && "bg-muted/30 border-dashed border-2")}>
                  <TableCell className="text-xs">
                    {format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}
                    {entry.entryType === 'Provision' && <Badge variant="secondary" className="block text-[8px] mt-1 scale-90 -ml-1">PROVISÃO</Badge>}
                  </TableCell>
                  <TableCell className="font-medium">{suppliers?.find(s => s.id === entry.supplierId)?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase">{leafCategories.find(c => c.id === entry.accountCategoryId)?.name}</span>
                      <span className="text-sm">{entry.description} {entry.installmentInfo && `(${entry.installmentInfo})`}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.dynamicStatus === 'Paid' ? <Badge className="bg-emerald-100 text-emerald-700">Pago</Badge> : 
                     entry.dynamicStatus === 'Overdue' ? <Badge variant="destructive">Atrasado</Badge> : 
                     entry.dynamicStatus === 'DueToday' ? <Badge className="bg-amber-100 text-amber-700">Hoje</Badge> : 
                     <Badge variant="outline">Aberto</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {entry.status === 'Paid' && (
                      <div className="text-[10px] text-emerald-600 font-normal">Liquidado: R$ {calculateSettledValue(entry).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => { setEntryToPay(entry); setIsPaymentOpen(true); }} className="text-emerald-600 font-bold">Liquidar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => openEdit(entry)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entry.id))} className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Novo/Editar */}
      <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editingEntry ? 'Editar' : 'Novo'} Lançamento</DialogTitle></DialogHeader>
          <Tabs defaultValue="main" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="main">Dados Principais</TabsTrigger>
              <TabsTrigger value="repetition" disabled={!!editingEntry}>Repetir / Parcelar</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSaveEntry}>
              <TabsContent value="main" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Tipo</Label><Select value={formType} onValueChange={(v: any) => setFormType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Confirmed">Confirmado</SelectItem><SelectItem value="Provision">Provisão</SelectItem></SelectContent></Select></div>
                  <div className="grid gap-2"><Label>Descrição*</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required /></div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2"><Label>Valor*</Label><Input type="number" step="0.01" value={formAmount || ""} onChange={e => setFormAmount(Number(e.target.value))} required /></div>
                  <div className="grid gap-2"><Label>Vencimento*</Label><Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required /></div>
                  <div className="grid gap-2"><Label>Emissão</Label><Input type="date" value={formIssueDate} onChange={e => setFormIssueDate(e.target.value)} /></div>
                  <div className="grid gap-2"><Label>Forma Pagto.</Label><Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pix">Pix</SelectItem><SelectItem value="Boleto">Boleto</SelectItem><SelectItem value="Cartão">Cartão</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Fornecedor*</Label><Select value={formSupplierId} onValueChange={setFormSupplierId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-2"><Label>Categoria*</Label><Select value={formCategoryId} onValueChange={setFormCategoryId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-2"><Label>Centro de Custo</Label><Select value={formCostCenterId} onValueChange={setFormCostCenterId}><SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{centers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </TabsContent>

              <TabsContent value="repetition" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Tipo de Repetição</Label><Select value={repetitionType} onValueChange={(v: any) => setRepetitionType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">Lançamento Único</SelectItem><SelectItem value="fixed">Fixo Mensal (Repetir valor)</SelectItem><SelectItem value="installments">Parcelado (Dividir valor total)</SelectItem></SelectContent></Select></div>
                  {repetitionType !== 'single' && (
                    <div className="grid gap-2"><Label>Nº de Meses / Parcelas</Label><Input type="number" min={1} max={60} value={numRepetitions} onChange={e => setNumRepetitions(Number(e.target.value))} /></div>
                  )}
                </div>
                {generatedInstallments.length > 0 && (
                  <div className="border rounded-md p-4 bg-muted/20">
                    <Label className="text-xs font-bold uppercase mb-2 block">Prévia dos Lançamentos:</Label>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {generatedInstallments.map((inst, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-background border rounded">
                          <span>{idx + 1}ª - {format(new Date(inst.date + 'T12:00:00'), "dd/MM/yyyy")}</span>
                          <span className="font-bold">R$ {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              <DialogFooter className="mt-4"><Button type="submit" className="w-full">Salvar Lançamento(s)</Button></DialogFooter>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          {entryToPay && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!db || !user) return;
              updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entryToPay.id), {
                status: 'Paid', interest, fine, discount, paymentDate: todayStr, updatedAt: new Date().toISOString()
              });
              setIsPaymentOpen(false); setEntryToPay(null);
            }}>
              <DialogHeader><DialogTitle>Liquidação: {entryToPay.description}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-2"><Label className="text-[10px]">Juros (+)</Label><Input type="number" step="0.01" value={interest} onChange={e => setInterest(Number(e.target.value))} /></div>
                  <div className="grid gap-2"><Label className="text-[10px]">Multa (+)</Label><Input type="number" step="0.01" value={fine} onChange={e => setFine(Number(e.target.value))} /></div>
                  <div className="grid gap-2"><Label className="text-[10px]">Desc. (-)</Label><Input type="number" step="0.01" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
                </div>
                <div className="bg-primary/5 p-4 rounded-lg text-center font-bold text-xl">R$ {(entryToPay.originalAmount + interest + fine - discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <DialogFooter><Button type="submit" className="w-full">Confirmar Pagamento</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
