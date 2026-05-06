
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
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Wallet, 
  FilterX, 
  Edit2,
  RotateCcw
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
import { Supplier, AccountCategory, AccountsPayableEntry, EntryType } from "@/lib/types";
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
  subMonths
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

  // ESTADOS DO FORMULÁRIO (CONTROLADOS)
  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState("");
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Pix");
  const [formCostCenterId, setFormCostCenterId] = useState("");

  // Estados para Repetição/Parcelamento
  const [repetitionType, setRepetitionType] = useState<"single" | "fixed" | "installments">("single");
  const [numRepetitions, setNumRepetitions] = useState(1);
  const [generatedInstallments, setGeneratedInstallments] = useState<{date: string, amount: number}[]>([]);

  useEffect(() => {
    const nowStr = format(new Date(), "yyyy-MM-dd");
    setTodayStr(nowStr);
  }, []);

  // Sincroniza formulário ao abrir para edição ou novo
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
      setFormCostCenterId(editingEntry.costCenterId || "");
    } else {
      setFormType("Confirmed");
      setFormDescription("");
      setFormAmount(0);
      setFormDueDate(format(new Date(), "yyyy-MM-dd"));
      setFormIssueDate("");
      setFormSupplierId("");
      setFormCategoryId("");
      setFormPaymentMethod("Pix");
      setFormCostCenterId("");
    }
  }, [editingEntry, isNewEntryOpen]);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (preset) {
      case "today": 
        start = today; end = today; 
        break;
      case "thisWeek":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "nextWeek":
        const nextWeek = addWeeks(today, 1);
        start = startOfWeek(nextWeek, { weekStartsOn: 1 });
        end = endOfWeek(nextWeek, { weekStartsOn: 1 });
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

  const { data: entries } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);

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

  const processedEntries = entries?.map(entry => ({
    ...entry,
    dynamicStatus: getDynamicStatus(entry)
  })) || [];

  const filteredEntries = processedEntries.filter(e => {
    const statusMatch = filterStatus === 'all' || e.dynamicStatus.toLowerCase() === filterStatus.toLowerCase();
    const supplierMatch = filterSupplierId === 'all' || e.supplierId === filterSupplierId;
    const categoryMatch = filterCategoryId === 'all' || e.accountCategoryId === filterCategoryId;
    const dueDateMatch = (!filterDueDateStart || e.dueDate >= filterDueDateStart) && (!filterDueDateEnd || e.dueDate <= filterDueDateEnd);
    return statusMatch && supplierMatch && categoryMatch && dueDateMatch;
  });

  const totalOverdue = filteredEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = filteredEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = filteredEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = filteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + calculateSettledValue(curr), 0);

  const clearFilters = () => {
    setFilterStatus("all"); 
    setFilterSupplierId("all"); 
    setFilterCategoryId("all");
    setFilterDueDateStart(""); 
    setFilterDueDateEnd(""); 
    setDatePreset("custom");
  };

  const hasActiveFilters = filterStatus !== "all" || filterSupplierId !== "all" || filterCategoryId !== "all" || filterDueDateStart || filterDueDateEnd;

  // Lógica de geração de parcelas reativa
  useEffect(() => {
    if (repetitionType === 'single' || !formDueDate) {
      setGeneratedInstallments([]);
      return;
    }
    
    const newInstallments = [];
    for (let i = 0; i < numRepetitions; i++) {
      const date = addMonths(new Date(formDueDate + 'T12:00:00'), i);
      const amount = repetitionType === 'installments' 
        ? Number((formAmount / numRepetitions).toFixed(2)) 
        : formAmount;

      newInstallments.push({
        date: format(date, "yyyy-MM-dd"),
        amount: amount
      });
    }
    setGeneratedInstallments(newInstallments);
  }, [repetitionType, numRepetitions, formAmount, formDueDate]);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const baseData = {
      supplierId: formSupplierId,
      accountCategoryId: formCategoryId,
      costCenterId: formCostCenterId,
      description: formDescription,
      issueDate: formIssueDate,
      paymentMethod: formPaymentMethod,
      entryType: formType,
      updatedAt: new Date().toISOString(),
    };

    if (editingEntry) {
      const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", editingEntry.id);
      updateDocumentNonBlocking(entryRef, {
        ...baseData,
        originalAmount: formAmount,
        dueDate: formDueDate,
      });
      toast({ title: "Lançamento atualizado" });
    } else {
      if (repetitionType === 'single') {
        const entryId = `pay_${Date.now()}`;
        const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryId);
        setDocumentNonBlocking(entryRef, {
          ...baseData,
          id: entryId,
          status: 'Open',
          originalAmount: formAmount,
          dueDate: formDueDate,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      } else {
        generatedInstallments.forEach((inst, index) => {
          const entryId = `pay_${Date.now()}_${index}`;
          const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryId);
          setDocumentNonBlocking(entryRef, {
            ...baseData,
            id: entryId,
            status: 'Open',
            originalAmount: inst.amount,
            dueDate: inst.date,
            installmentInfo: repetitionType === 'installments' ? `${index + 1}/${numRepetitions}` : `Mensalidade ${index + 1}/${numRepetitions}`,
            createdAt: new Date().toISOString(),
          }, { merge: true });
        });
      }
      toast({ title: "Lançamento(s) criado(s)" });
    }

    setIsNewEntryOpen(false);
    setEditingEntry(null);
  };

  const handleConfirmPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user || !entryToPay) return;
    const formData = new FormData(e.currentTarget);
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryToPay.id);
    
    updateDocumentNonBlocking(entryRef, {
      status: 'Paid',
      entryType: 'Confirmed', 
      paymentDate: formData.get("paymentDate") as string,
      bankAccountId: formData.get("bankAccountId") as string,
      interest, fine, discount,
      updatedAt: new Date().toISOString()
    });
    
    toast({ title: "Pagamento confirmado" });
    setIsPaymentOpen(false);
    setEntryToPay(null);
  };

  const toggleConfirmed = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    const newType = entry.entryType === 'Provision' ? 'Confirmed' : 'Provision';
    updateDocumentNonBlocking(entryRef, { entryType: newType, updatedAt: new Date().toISOString() });
    toast({ title: newType === 'Confirmed' ? "Lançamento Confirmado" : "Lançamento marcado como Provisão" });
  };

  const undoPayment = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    updateDocumentNonBlocking(entryRef, { 
      status: 'Open', paymentDate: null, bankAccountId: null, 
      interest: 0, fine: 0, discount: 0, updatedAt: new Date().toISOString() 
    });
    toast({ title: "Pagamento Estornado", description: "O lançamento voltou a ficar em aberto." });
  };

  const deleteEntry = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    deleteDocumentNonBlocking(entryRef);
    toast({ title: "Lançamento excluído" });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowDownCircle className="text-destructive w-8 h-8" />
            Contas a Pagar
          </h1>
          <p className="text-muted-foreground">Gestão de despesas, provisões e parcelamentos.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className={cn("gap-2", hasActiveFilters && "border-primary text-primary bg-primary/5")} onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4" /> Filtros
          </Button>
          
          <Dialog open={isNewEntryOpen} onOpenChange={(open) => {
            setIsNewEntryOpen(open);
            if (!open) {
              setEditingEntry(null);
              setRepetitionType("single");
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg">
                <Plus className="w-4 h-4" /> Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
              <form onSubmit={handleSaveEntry}>
                <DialogHeader>
                  <DialogTitle>{editingEntry ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="basic" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Dados Principais</TabsTrigger>
                    <TabsTrigger value="repeat" disabled={!!editingEntry}>Repetir / Parcelar</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Tipo de Lançamento</Label>
                        <Select value={formType} onValueChange={(v: EntryType) => setFormType(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Confirmed">Confirmado (Boleto/Fatura)</SelectItem>
                            <SelectItem value="Provision">Provisão (Estimativa)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Descrição *</Label>
                        <Input 
                          placeholder="Ex: Conta de Luz" 
                          value={formDescription} 
                          onChange={e => setFormDescription(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Valor (R$) *</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          required 
                          value={formAmount || ""}
                          onChange={(e) => setFormAmount(Number(e.target.value))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Vencimento *</Label>
                        <Input 
                          type="date" 
                          required 
                          value={formDueDate}
                          onChange={(e) => setFormDueDate(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Emissão</Label>
                        <Input 
                          type="date" 
                          value={formIssueDate} 
                          onChange={e => setFormIssueDate(e.target.value)} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Fornecedor *</Label>
                        <Select value={formSupplierId} onValueChange={setFormSupplierId} required>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Categoria *</Label>
                        <Select value={formCategoryId} onValueChange={setFormCategoryId} required>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Forma de Pagamento</Label>
                        <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue />
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
                      <div className="grid gap-2">
                        <Label>Centro de Custo (Opcional)</Label>
                        <Select value={formCostCenterId} onValueChange={setFormCostCenterId}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">Nenhum</SelectItem>
                            <SelectItem value="cozinha">Cozinha</SelectItem>
                            <SelectItem value="salao">Salão</SelectItem>
                            <SelectItem value="admin">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="repeat" className="space-y-4 pt-4">
                    <div className="bg-muted/50 p-4 rounded-lg border space-y-4">
                      <div className="grid gap-2">
                        <Label>Tipo de Repetição</Label>
                        <Select value={repetitionType} onValueChange={(v: any) => setRepetitionType(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Lançamento Único</SelectItem>
                            <SelectItem value="fixed">Fixo Mensal (Repetir Valor R$ {formAmount})</SelectItem>
                            <SelectItem value="installments">Parcelado (Dividir Valor R$ {formAmount})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {repetitionType !== 'single' && (
                        <div className="grid gap-2">
                          <Label>{repetitionType === 'installments' ? 'Número de Parcelas' : 'Número de Repetições (Meses)'}</Label>
                          <Input type="number" min="2" max="60" value={numRepetitions} onChange={e => setNumRepetitions(Number(e.target.value))} />
                        </div>
                      )}

                      {generatedInstallments.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Pré-visualização das Parcelas</Label>
                          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                            {generatedInstallments.map((inst, i) => (
                              <div key={i} className="flex gap-2 items-center bg-background p-2 rounded border text-sm">
                                <span className="w-8 text-muted-foreground">{i + 1}</span>
                                <Input 
                                  type="date" 
                                  value={inst.date} 
                                  onChange={e => {
                                    const copy = [...generatedInstallments];
                                    copy[i].date = e.target.value;
                                    setGeneratedInstallments(copy);
                                  }} 
                                  className="h-8 text-xs"
                                />
                                <Input 
                                  type="number" 
                                  value={inst.amount} 
                                  onChange={e => {
                                    const copy = [...generatedInstallments];
                                    copy[i].amount = Number(e.target.value);
                                    setGeneratedInstallments(copy);
                                  }} 
                                  className="h-8 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-6">
                  <Button type="submit" className="w-full">
                    {editingEntry ? 'Salvar Alterações' : repetitionType === 'single' ? 'Salvar Lançamento' : `Salvar ${numRepetitions} Lançamentos`}
                  </Button>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="DueToday">Hoje</SelectItem>
                      <SelectItem value="Overdue">Atrasado</SelectItem>
                      <SelectItem value="Open">Aberto</SelectItem>
                      <SelectItem value="Paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Fornecedor</Label>
                  <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Vencimento</Label>
                  <Select value={datePreset} onValueChange={handleDatePresetChange}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Período Personalizado</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="thisWeek">Essa Semana</SelectItem>
                      <SelectItem value="thisMonth">Este Mês</SelectItem>
                      <SelectItem value="lastMonth">Mês Passado</SelectItem>
                      <SelectItem value="thisYear">Este Ano</SelectItem>
                      <SelectItem value="nextWeek">Próxima Semana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Datas</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={filterDueDateStart} onChange={e => setFilterDueDateStart(e.target.value)} className="bg-background text-xs h-9" />
                    <Input type="date" value={filterDueDateEnd} onChange={e => setFilterDueDateEnd(e.target.value)} className="bg-background text-xs h-9" />
                    <Button variant="ghost" className="gap-2 text-muted-foreground h-9 px-2" onClick={clearFilters}>
                      <FilterX className="w-4 h-4" /> Limpar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-destructive/5 border-destructive/20 shadow-none">
          <CardHeader className="p-4 pb-2"><p className="text-xs font-bold uppercase text-destructive/70">Atrasado</p><div className="text-xl font-bold">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardHeader>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-none">
          <CardHeader className="p-4 pb-2"><p className="text-xs font-bold uppercase text-amber-700">Vence Hoje</p><div className="text-xl font-bold">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20 shadow-none">
          <CardHeader className="p-4 pb-2"><p className="text-xs font-bold uppercase text-primary/70">Próximos Dias</p><div className="text-xl font-bold">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardHeader>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 shadow-none">
          <CardHeader className="p-4 pb-2"><p className="text-xs font-bold uppercase text-emerald-700">Total Liquidado</p><div className="text-xl font-bold">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                <TableRow key={entry.id} className={cn(entry.entryType === 'Provision' ? "bg-muted/10 opacity-80" : "")}>
                  <TableCell className="text-sm font-mono">
                    {format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {suppliers?.find(s => s.id === entry.supplierId)?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground uppercase">{categories?.find(c => c.id === entry.accountCategoryId)?.name}</span>
                      <span className="text-sm">{entry.description}</span>
                      {entry.installmentInfo && <Badge variant="outline" className="w-fit text-[9px] mt-1">{entry.installmentInfo}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.entryType === 'Provision' ? 'outline' : 'secondary'} className="text-[10px]">
                      {entry.entryType === 'Provision' ? 'Provisão' : 'Confirmado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.dynamicStatus === 'Paid' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-none"><Check className="w-3 h-3 mr-1" /> Pago</Badge>
                    ) : entry.dynamicStatus === 'Overdue' ? (
                      <Badge variant="destructive" className="animate-pulse"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</Badge>
                    ) : entry.dynamicStatus === 'DueToday' ? (
                      <Badge className="bg-amber-100 text-amber-700 border-none">Hoje</Badge>
                    ) : <Badge variant="outline">Aberto</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className={cn("font-bold", entry.entryType === 'Provision' ? "italic text-muted-foreground" : "")}>
                        R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {entry.status === 'Paid' && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          Pago: R$ {calculateSettledValue(entry).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' && (
                          <DropdownMenuItem onClick={() => { setEntryToPay(entry); setIsPaymentOpen(true); }} className="text-emerald-600">
                            <Wallet className="w-4 h-4 mr-2" /> Pagar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setEditingEntry(entry)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleConfirmed(entry)}>
                          <RotateCcw className="w-4 h-4 mr-2" /> {entry.entryType === 'Provision' ? 'Confirmar' : 'Marcar Provisão'}
                        </DropdownMenuItem>
                        {entry.status === 'Paid' && (
                          <DropdownMenuItem onClick={() => undoPayment(entry)} className="text-amber-600">Estornar Pagamento</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => deleteEntry(entry)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          {entryToPay && (
            <form onSubmit={handleConfirmPayment}>
              <DialogHeader>
                <DialogTitle>Liquidar: {entryToPay.description}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Data Pagamento</Label>
                    <Input name="paymentDate" type="date" defaultValue={todayStr} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Conta Bancária</Label>
                    <Select name="bankAccountId" required>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="itau">Itaú Principal</SelectItem>
                        <SelectItem value="nubank">Nubank Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-2">
                    <Label className="text-[10px]">Juros (R$)</Label>
                    <Input type="number" step="0.01" value={interest} onChange={e => setInterest(Number(e.target.value))} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px]">Multa (R$)</Label>
                    <Input type="number" step="0.01" value={fine} onChange={e => setFine(Number(e.target.value))} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px]">Desconto (R$)</Label>
                    <Input type="number" step="0.01" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
                  </div>
                </div>
                <div className="bg-primary/5 p-4 rounded-lg border border-dashed text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Total a Desembolsar</p>
                  <p className="text-2xl font-bold text-primary">R$ {((entryToPay.originalAmount || 0) + interest + fine - discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Confirmar Liquidação</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
