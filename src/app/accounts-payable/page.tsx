
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
  FilterX, 
  Loader2,
  Download,
  FileSpreadsheet,
  Pencil,
  Search,
  Check,
  ChevronDown,
  Calendar
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
  DialogFooter
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
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
  addYears,
  startOfYear,
  subMonths,
  endOfYear,
  isBefore,
  isSameDay,
  isValid
} from "date-fns";
import * as XLSX from 'xlsx';

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountsPayableEntry | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [entryToPay, setEntryToPay] = useState<AccountsPayableEntry | null>(null);
  const [todayStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showFilters, setShowFilters] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros Multi-seleção
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  
  // Datas
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");
  const [datePreset, setDatePreset] = useState("custom");

  // Liquidação
  const [interest, setInterest] = useState(0);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(todayStr);

  // Form State
  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Pix");
  const [formCostCenterId, setFormCostCenterId] = useState("none");

  // Repetição/Parcelamento
  const [repetitionType, setRepetitionType] = useState<"single" | "fixed" | "installments">("single");
  const [recurrenceInterval, setRecurrenceInterval] = useState<"weekly" | "biweekly" | "monthly" | "yearly">("monthly");
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

  const parseExcelDate = (raw: any): string => {
    if (!raw) return "";
    if (typeof raw === 'number') {
      const date = XLSX.utils.numdate(raw);
      return format(date, "yyyy-MM-dd");
    }
    if (raw instanceof Date) return format(raw, "yyyy-MM-dd");
    const dateStr = String(raw).trim();
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        let [d, m, y] = parts;
        const fullYear = y.length === 2 ? `20${y}` : y;
        const fullMonth = m.padStart(2, '0');
        const fullDay = d.padStart(2, '0');
        return `${fullYear}-${fullMonth}-${fullDay}`;
      }
    }
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    return "";
  };

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
        const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(e.dynamicStatus);
        const supplierMatch = selectedSupplierIds.length === 0 || selectedSupplierIds.includes(e.supplierId);
        const categoryMatch = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(e.accountCategoryId);
        const dueDateMatch = (!filterDueDateStart || e.dueDate >= filterDueDateStart) && (!filterDueDateEnd || e.dueDate <= filterDueDateEnd);
        
        const sName = suppliers?.find(s => s.id === e.supplierId)?.name.toLowerCase() || "";
        const cName = leafCategories.find(c => c.id === e.accountCategoryId)?.name.toLowerCase() || "";
        const desc = e.description.toLowerCase();
        const term = searchTerm.toLowerCase();
        const searchMatch = !searchTerm || desc.includes(term) || sName.includes(term) || cName.includes(term);

        return statusMatch && supplierMatch && categoryMatch && dueDateMatch && searchMatch;
      }) || [];
  }, [entries, selectedStatuses, selectedSupplierIds, selectedCategoryIds, filterDueDateStart, filterDueDateEnd, searchTerm, suppliers, leafCategories, todayStr]);

  const totalOverdue = filteredEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = filteredEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = filteredEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = filteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + calculateSettledValue(curr), 0);

  // Geração automática inicial de parcelas
  useEffect(() => {
    if (repetitionType === 'single') {
      setGeneratedInstallments([]);
      return;
    }
    const newInstallments = [];
    const baseDate = new Date(formDueDate + 'T12:00:00');
    for (let i = 0; i < numRepetitions; i++) {
      let installmentDate: Date;
      switch (recurrenceInterval) {
        case 'weekly': installmentDate = addWeeks(baseDate, i); break;
        case 'biweekly': installmentDate = addWeeks(baseDate, i * 2); break;
        case 'yearly': installmentDate = addYears(baseDate, i); break;
        case 'monthly':
        default: installmentDate = addMonths(baseDate, i); break;
      }

      const installmentAmount = repetitionType === 'installments' 
        ? Number((formAmount / numRepetitions).toFixed(2)) 
        : formAmount;
      newInstallments.push({
        date: format(installmentDate, "yyyy-MM-dd"),
        amount: installmentAmount
      });
    }
    setGeneratedInstallments(newInstallments);
  }, [repetitionType, numRepetitions, formAmount, formDueDate, recurrenceInterval]);

  const updateGeneratedInstallment = (index: number, field: 'date' | 'amount', value: any) => {
    setGeneratedInstallments(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    switch (preset) {
      case "today": start = today; end = today; break;
      case "thisWeek": start = startOfWeek(today, { weekStartsOn: 1 }); end = endOfWeek(today, { weekStartsOn: 1 }); break;
      case "thisMonth": start = startOfMonth(today); end = endOfMonth(today); break;
      case "lastMonth": const lastMonth = subMonths(today, 1); start = startOfMonth(lastMonth); end = endOfMonth(lastMonth); break;
      case "thisYear": start = startOfYear(today); end = endOfYear(today); break;
      default: return;
    }
    if (start && end) {
      setFilterDueDateStart(format(start, "yyyy-MM-dd"));
      setFilterDueDateEnd(format(end, "yyyy-MM-dd"));
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user) return;
    setIsImporting(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];
      if (rows.length === 0) throw new Error("O arquivo Excel está vazio.");
      const batchData: any[] = [];
      rows.forEach((row: any, index: number) => {
        const vencimentoRaw = row["Vencimento"] || row["vencimento"];
        const fornecedorNome = row["Fornecedor"] || row["fornecedor"];
        const categoriaNome = row["Categoria"] || row["categoria"];
        const valor = row["Valor"] || row["valor"];
        const emissaoRaw = row["Emissao"] || row["emissao"] || row["Emissão"] || row["emissão"];
        const tipoRaw = row["Tipo"] || row["tipo"];

        const supplier = suppliers?.find(s => s.name.toLowerCase().trim() === String(fornecedorNome).toLowerCase().trim());
        const category = leafCategories.find(c => c.name.toLowerCase().trim() === String(categoriaNome).toLowerCase().trim());
        
        if (supplier && category && vencimentoRaw && valor) {
          const statusTipo: EntryType = String(tipoRaw || "").toLowerCase().includes("provis") ? 'Provision' : 'Confirmed';
          batchData.push({
            id: `pay_imp_${Date.now()}_${index}`,
            supplierId: supplier.id,
            accountCategoryId: category.id,
            description: String(row["Descricao"] || row["Descrição"] || row["descrição"] || "Importado"),
            originalAmount: Number(valor),
            dueDate: parseExcelDate(vencimentoRaw),
            issueDate: parseExcelDate(emissaoRaw),
            status: 'Open',
            entryType: statusTipo,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
      batchData.forEach(d => setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", d.id), d, { merge: true }));
      toast({ title: "Importação Concluída", description: `${batchData.length} lançamentos importados.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: err.message });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          const entryData: any = { 
            ...baseData, 
            id, 
            status: 'Open', 
            originalAmount: inst.amount, 
            dueDate: inst.date, 
            createdAt: new Date().toISOString() 
          };
          
          if (repetitionType === 'installments') {
            entryData.installmentInfo = `${idx + 1}/${numRepetitions}`;
          }

          setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", id), entryData, { merge: true });
        });
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

  const toggleMultiSelect = (state: string[], setState: (s: string[]) => void, value: string) => {
    setState(state.includes(value) ? state.filter(v => v !== value) : [...state, value]);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowDownCircle className="text-destructive w-8 h-8" />Contas a Pagar</h1>
          <p className="text-muted-foreground">Gestão financeira profissional.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => {
            const ws = XLSX.utils.json_to_sheet([{"Vencimento": "25/12/2024", "Fornecedor": "Exemplo", "Categoria": "Aluguel", "Valor": 1500, "Tipo": "Confirmed", "Emissao": "20/12/2024"}]);
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Modelo"); XLSX.writeFile(wb, "modelo_pagar.xlsx");
          }}><Download className="w-4 h-4" /> Baixar Modelo</Button>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Importar Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4" /> Filtros</Button>
          <Button className="gap-2 shadow-lg" onClick={() => { setEditingEntry(null); setIsNewEntryOpen(true); }}><Plus className="w-4 h-4" /> Novo Lançamento</Button>
        </div>
      </div>

      <Collapsible header="" open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Busca Global</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Fornecedor, descrição ou categoria..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedStatuses.length === 0 ? "Todos" : `${selectedStatuses.length} selecionados`}
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Filtrar Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {['Open', 'Paid', 'Overdue', 'DueToday'].map(s => (
                        <DropdownMenuCheckboxItem 
                          key={s} 
                          checked={selectedStatuses.includes(s)}
                          onCheckedChange={() => toggleMultiSelect(selectedStatuses, setSelectedStatuses, s)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {s === 'Open' ? 'Aberto' : s === 'Paid' ? 'Pago' : s === 'Overdue' ? 'Atrasado' : 'Hoje'}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedSupplierIds.length === 0 ? "Todos" : `${selectedSupplierIds.length} selecionados`}
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-[300px] overflow-y-auto">
                      <DropdownMenuLabel>Filtrar Fornecedores</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {suppliers?.map(s => (
                        <DropdownMenuCheckboxItem 
                          key={s.id} 
                          checked={selectedSupplierIds.includes(s.id)}
                          onCheckedChange={() => toggleMultiSelect(selectedSupplierIds, setSelectedSupplierIds, s.id)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {s.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedCategoryIds.length === 0 ? "Todas" : `${selectedCategoryIds.length} selecionadas`}
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-[300px] overflow-y-auto">
                      <DropdownMenuLabel>Filtrar Categorias</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {leafCategories.map(c => (
                        <DropdownMenuCheckboxItem 
                          key={c.id} 
                          checked={selectedCategoryIds.includes(c.id)}
                          onCheckedChange={() => toggleMultiSelect(selectedCategoryIds, setSelectedCategoryIds, c.id)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {c.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <Label>Período Rápido</Label>
                  <Select value={datePreset} onValueChange={handleDatePresetChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizado</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="thisWeek">Esta Semana</SelectItem>
                      <SelectItem value="thisMonth">Este Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label>Intervalo de Datas</Label>
                  <div className="flex gap-2">
                    <Input type="date" value={filterDueDateStart} onChange={e => setFilterDueDateStart(e.target.value)} />
                    <Input type="date" value={filterDueDateEnd} onChange={e => setFilterDueDateEnd(e.target.value)} />
                    <Button variant="ghost" onClick={() => { 
                      setSelectedStatuses([]); setSelectedSupplierIds([]); setSelectedCategoryIds([]);
                      setFilterDueDateStart(""); setFilterDueDateEnd(""); setDatePreset("custom"); setSearchTerm("");
                    }}><FilterX className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-destructive/5"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-destructive/70">Atrasado</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-amber-50"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-amber-700">Hoje</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-primary/5"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-primary/70">Em Aberto</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-emerald-50"><CardHeader className="p-4 pb-2 text-xs font-bold uppercase text-emerald-700">Total Pago</CardHeader><CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredEntries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">
                    {format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}
                    {entry.entryType === 'Provision' && <Badge variant="secondary" className="block text-[8px] mt-1">PROVISÃO</Badge>}
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
                  <TableCell className="text-right font-bold">R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => { setEntryToPay(entry); setIsPaymentOpen(true); }} className="text-emerald-600 font-bold">Liquidar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => openEdit(entry)} className="gap-2"><Pencil className="w-4 h-4" /> Editar</DropdownMenuItem>
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

      <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEntry ? 'Editar' : 'Novo'} Lançamento</DialogTitle></DialogHeader>
          <Tabs defaultValue="main">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="main">Dados Principais</TabsTrigger>
              <TabsTrigger value="repetition" disabled={!!editingEntry}>Parcelar / Repetir</TabsTrigger>
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
                  <div className="grid gap-2"><Label>Pagamento</Label><Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pix">Pix</SelectItem><SelectItem value="Boleto">Boleto</SelectItem><SelectItem value="Cartão">Cartão</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Fornecedor*</Label><Select value={formSupplierId} onValueChange={setFormSupplierId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-2"><Label>Categoria*</Label><Select value={formCategoryId} onValueChange={setFormCategoryId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-2"><Label>Centro de Custo</Label><Select value={formCostCenterId} onValueChange={setFormCostCenterId}><SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{centers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </TabsContent>
              <TabsContent value="repetition" className="space-y-4 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Modo</Label>
                    <Select value={repetitionType} onValueChange={(v: any) => setRepetitionType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Único</SelectItem>
                        <SelectItem value="fixed">Fixo (Repete valor)</SelectItem>
                        <SelectItem value="installments">Parcelado (Divide valor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {repetitionType !== 'single' && (
                    <>
                      <div className="grid gap-2">
                        <Label>Frequência</Label>
                        <Select value={recurrenceInterval} onValueChange={(v: any) => setRecurrenceInterval(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Nº de Repetições</Label>
                        <Input type="number" min={1} value={numRepetitions} onChange={e => setNumRepetitions(Number(e.target.value))} />
                      </div>
                    </>
                  )}
                </div>

                {generatedInstallments.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <Label className="text-primary font-bold">Ajuste de Parcelas (Opcional)</Label>
                    <div className="border rounded-lg overflow-hidden bg-muted/20">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead className="w-16">Parc.</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Valor (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generatedInstallments.map((inst, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-bold text-xs">{i + 1}ª</TableCell>
                              <TableCell>
                                <Input 
                                  type="date" 
                                  className="h-8 text-xs" 
                                  value={inst.date} 
                                  onChange={e => updateGeneratedInstallment(i, 'date', e.target.value)} 
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  className="h-8 text-xs text-right" 
                                  value={inst.amount} 
                                  onChange={e => updateGeneratedInstallment(i, 'amount', Number(e.target.value))} 
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
              <DialogFooter className="mt-6">
                <Button type="submit" className="w-full">Salvar Lançamentos</Button>
              </DialogFooter>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          {entryToPay && (
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (!db || !user) return; 
              updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entryToPay.id), { status: 'Paid', interest, fine, discount, paymentDate, updatedAt: new Date().toISOString() }); 
              setIsPaymentOpen(false); 
              toast({ title: "Conta liquidada!" });
            }}>
              <DialogHeader><DialogTitle>Liquidar: {entryToPay.description}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Data de Pagamento</Label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-2"><Label className="text-[10px]">Juros</Label><Input type="number" value={interest} onChange={e => setInterest(Number(e.target.value))} /></div>
                  <div className="grid gap-2"><Label className="text-[10px]">Multa</Label><Input type="number" value={interest} onChange={e => setFine(Number(e.target.value))} /></div>
                  <div className="grid gap-2"><Label className="text-[10px]">Desc.</Label><Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
                </div>
                <div className="bg-primary/5 p-4 rounded text-center font-bold text-xl">Total: R$ {(entryToPay.originalAmount + interest + fine - discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <DialogFooter><Button type="submit" className="w-full">Confirmar Pagamento</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
