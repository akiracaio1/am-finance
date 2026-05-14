
"use client";

import { useState, useEffect, useMemo } from "react";
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
  Search,
  Loader2,
  RotateCcw,
  LayoutGrid,
  CheckCircle2,
  Clock,
  Copy,
  Undo2,
  CalendarDays,
  Repeat,
  Calculator
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
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { Supplier, AccountCategory, AccountsPayableEntry, EntryType, CostCenter, CostCenterGroup } from "@/lib/types";
import { 
  format, 
  isBefore,
  isSameDay,
  parseISO,
  addMonths,
  addWeeks
} from "date-fns";

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountsPayableEntry | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [entryToPay, setEntryToPay] = useState<AccountsPayableEntry | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Estados do Formulário de Cadastro
  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formCostCenterId, setFormCostCenterId] = useState("");
  
  // Estados de Parcelamento
  const [isRecurring, setIsRecurring] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [recurrenceInterval, setRecurrenceInterval] = useState<"monthly" | "weekly">("monthly");

  // Estados de Liquidação (Ajustes)
  const [payDate, setPayDate] = useState("");
  const [payInterest, setPayInterest] = useState<number>(0);
  const [payFine, setPayFine] = useState<number>(0);
  const [payDiscount, setPayDiscount] = useState<number>(0);

  // Filtros da Tabela
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setTodayStr(format(now, "yyyy-MM-dd"));
    setPayDate(format(now, "yyyy-MM-dd"));
  }, []);

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

  const groupsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenterGroups");
  }, [db, user]);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const { data: entries } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: groups } = useCollection<CostCenterGroup>(groupsQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);

  const sortedSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const leafCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => 
      cat.type === 'Expense' && 
      !categories.some(child => child.parentCategoryId === cat.id)
    ).sort((a, b) => a.code.localeCompare(b.code));
  }, [categories]);

  const activeCentersByGroup = useMemo(() => {
    if (!groups || !centers) return [];
    return groups.sort((a,b) => a.name.localeCompare(b.name)).map(group => ({
      ...group,
      centers: centers.filter(c => c.groupId === group.id && c.status === 'Active').sort((a,b) => a.name.localeCompare(b.name))
    })).filter(g => g.centers.length > 0);
  }, [groups, centers]);

  const getDynamicStatus = (entry: AccountsPayableEntry) => {
    if (entry.status === 'Paid') return 'Paid';
    if (!todayStr) return 'Open';
    const dueDate = new Date(entry.dueDate + 'T12:00:00');
    const today = new Date(todayStr + 'T12:00:00');
    if (isBefore(dueDate, today) && !isSameDay(dueDate, today)) return 'Overdue';
    if (isSameDay(dueDate, today)) return 'DueToday';
    return 'Open';
  };

  const allFilteredEntries = useMemo(() => {
    if (!mounted) return [];
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
      }).sort((a,b) => a.dueDate.localeCompare(b.dueDate)) || [];
  }, [entries, selectedStatuses, selectedSupplierIds, selectedCategoryIds, filterDueDateStart, filterDueDateEnd, searchTerm, suppliers, leafCategories, todayStr, mounted]);

  const totalOverdue = allFilteredEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = allFilteredEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = allFilteredEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = allFilteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + (curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0)), 0);

  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatuses([]);
    setSelectedSupplierIds([]);
    setSelectedCategoryIds([]);
    setFilterDueDateStart("");
    setFilterDueDateEnd("");
    toast({ title: "Filtros limpos" });
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const baseData: any = {
      supplierId: formSupplierId, 
      accountCategoryId: formCategoryId, 
      costCenterId: formCostCenterId || null,
      description: formDescription, 
      entryType: formType, 
      updatedAt: new Date().toISOString(),
    };
    
    if (editingEntry) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", editingEntry.id), { ...baseData, originalAmount: formAmount, dueDate: formDueDate });
      toast({ title: "Lançamento atualizado" });
    } else {
      const count = isRecurring ? installmentsCount : 1;
      const startDate = parseISO(formDueDate);

      for (let i = 0; i < count; i++) {
        const id = `pay_${Date.now()}_${i}`;
        const currentDueDate = recurrenceInterval === 'monthly' ? addMonths(startDate, i) : addWeeks(startDate, i);
        const installmentInfo = count > 1 ? `${i + 1}/${count}` : "";
        
        setDocumentNonBlocking(
          doc(db, "users", user.uid, "accountsPayableEntries", id), 
          { 
            ...baseData, 
            id, 
            status: 'Open', 
            originalAmount: formAmount, 
            dueDate: format(currentDueDate, "yyyy-MM-dd"), 
            installmentInfo,
            createdAt: new Date().toISOString() 
          }, 
          { merge: true }
        );
      }
      toast({ title: count > 1 ? `${count} parcelas geradas` : "Lançamento salvo" });
    }
    setIsNewEntryOpen(false); setEditingEntry(null);
  };

  const handleUnlinkPayment = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    if (!confirm("Estornar este pagamento? O lançamento voltará para o status Em Aberto.")) return;

    updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entry.id), {
      status: 'Open',
      paymentDate: null,
      bankAccountId: null,
      interest: 0,
      fine: 0,
      discount: 0,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Pagamento estornado" });
  };

  const handleDuplicateEntry = (entry: AccountsPayableEntry) => {
    setEditingEntry(null); 
    setFormDescription(`${entry.description} (Cópia)`);
    setFormAmount(entry.originalAmount);
    setFormDueDate(entry.dueDate);
    setFormSupplierId(entry.supplierId);
    setFormCategoryId(entry.accountCategoryId);
    setFormCostCenterId(entry.costCenterId || "");
    setFormType(entry.entryType || "Confirmed");
    setIsRecurring(false);
    setIsNewEntryOpen(true);
    toast({ title: "Dados copiados para o formulário" });
  };

  const handlePayConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !entryToPay) return;
    
    updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", entryToPay.id), { 
      status: 'Paid', 
      paymentDate: payDate,
      interest: payInterest,
      fine: payFine,
      discount: payDiscount,
      updatedAt: new Date().toISOString() 
    });
    
    setIsPaymentOpen(false);
    setEntryToPay(null);
    toast({ title: "Conta liquidada com sucesso!" });
  };

  if (!mounted) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowDownCircle className="text-destructive w-8 h-8" />Contas a Pagar</h1>
          <p className="text-muted-foreground">Gestão profissional de despesas e custos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4" /> Filtros</Button>
          <Button className="gap-2 shadow-lg" onClick={() => { 
            setEditingEntry(null); 
            setFormDescription("");
            setFormAmount(0);
            setFormDueDate("");
            setFormSupplierId("");
            setFormCategoryId("");
            setFormCostCenterId(""); 
            setFormType("Confirmed");
            setIsRecurring(false);
            setIsNewEntryOpen(true); 
          }}><Plus className="w-4 h-4" /> Novo Lançamento</Button>
        </div>
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
                <div className="space-y-2 md:col-span-2">
                  <Label>Busca Global</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Fornecedor, descrição..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Select value={selectedSupplierIds[0] || "all"} onValueChange={v => setSelectedSupplierIds(v === "all" ? [] : [v])}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem>{sortedSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategoryIds[0] || "all"} onValueChange={v => setSelectedCategoryIds(v === "all" ? [] : [v])}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas</SelectItem>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Início Venc.</Label>
                  <Input type="date" value={filterDueDateStart} onChange={e => setFilterDueDateStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim Venc.</Label>
                  <Input type="date" value={filterDueDateEnd} onChange={e => setFilterDueDateEnd(e.target.value)} />
                </div>
                <div>
                  <Button variant="ghost" className="w-full gap-2 text-muted-foreground hover:text-primary" onClick={clearFilters}>
                    <RotateCcw className="w-4 h-4" /> Limpar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['Overdue', 'DueToday', 'Open', 'Paid'].map((status) => {
          const labels: Record<string, string> = { Overdue: 'Atrasado', DueToday: 'Hoje', Open: 'Em Aberto', Paid: 'Total Pago' };
          const values: Record<string, number> = { Overdue: totalOverdue, DueToday: totalDueToday, Open: totalOpen, Paid: totalPaid };
          const colors: Record<string, string> = { Overdue: 'text-destructive bg-destructive/5 ring-destructive', DueToday: 'text-amber-700 bg-amber-50 ring-amber-500', Open: 'text-primary bg-primary/5 ring-primary', Paid: 'text-emerald-700 bg-emerald-50 ring-emerald-500' };
          
          return (
            <Card 
              key={status}
              className={cn("cursor-pointer transition-all hover:shadow-md", selectedStatuses.includes(status) ? `ring-2 ${colors[status]}` : colors[status].split(' ')[1])}
              onClick={() => toggleStatusFilter(status)}
            >
              <CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase opacity-70">{labels[status]}</CardHeader>
              <CardContent className="p-4 pt-0 text-xl font-bold">R$ {values[status].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição / Centro de Custo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {allFilteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}</TableCell>
                  <TableCell className="font-medium">{suppliers?.find(s => s.id === entry.supplierId)?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">{leafCategories.find(c => c.id === entry.accountCategoryId)?.name}</span>
                        {entry.costCenterId && (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 flex items-center gap-1 bg-muted/50 border-primary/20">
                            <LayoutGrid className="w-2 h-2" />
                            {centers?.find(c => c.id === entry.costCenterId)?.name}
                          </Badge>
                        )}
                        {entry.entryType === 'Confirmed' ? (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 bg-primary/5 text-primary border-primary/20 flex items-center gap-1">
                            <CheckCircle2 className="w-2 h-2" /> Confirmado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                            <Clock className="w-2 h-2" /> Provisão
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm">{entry.description} {entry.installmentInfo && <Badge variant="secondary" className="text-[9px] h-3 px-1 ml-1">{entry.installmentInfo}</Badge>}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.dynamicStatus === 'Paid' ? (
                      <div className="flex flex-col">
                        <Badge className="bg-emerald-100 text-emerald-700 border-none">Pago</Badge>
                        {entry.paymentDate && <span className="text-[9px] text-emerald-600 font-bold mt-1">Em {format(parseISO(entry.paymentDate), "dd/MM/yy")}</span>}
                      </div>
                    ) : entry.dynamicStatus === 'Overdue' ? (
                      <Badge variant="destructive">Atrasado</Badge>
                    ) : entry.dynamicStatus === 'DueToday' ? (
                      <Badge className="bg-amber-100 text-amber-700 border-none">Hoje</Badge>
                    ) : (
                      <Badge variant="outline">Aberto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => { setEntryToPay(entry); setPayInterest(0); setPayFine(0); setPayDiscount(0); setPayDate(format(new Date(), "yyyy-MM-dd")); setIsPaymentOpen(true); }} className="text-emerald-600 font-bold">Liquidar</DropdownMenuItem>}
                        {entry.status === 'Paid' && <DropdownMenuItem onClick={() => handleUnlinkPayment(entry)} className="text-amber-600 font-bold flex gap-2"><Undo2 className="w-4 h-4" /> Estornar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => handleDuplicateEntry(entry)} className="flex gap-2"><Copy className="w-4 h-4" /> Duplicar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { 
                          setEditingEntry(entry); 
                          setFormDescription(entry.description); 
                          setFormAmount(entry.originalAmount); 
                          setFormDueDate(entry.dueDate); 
                          setFormSupplierId(entry.supplierId); 
                          setFormCategoryId(entry.accountCategoryId); 
                          setFormCostCenterId(entry.costCenterId || ""); 
                          setFormType(entry.entryType || "Confirmed");
                          setIsRecurring(false);
                          setIsNewEntryOpen(true); 
                        }}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          if (confirm("Excluir este lançamento permanentemente?")) {
                            deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "accountsPayableEntries", entry.id));
                            toast({ title: "Lançamento excluído" });
                          }
                        }} className="text-destructive">Excluir</DropdownMenuItem>
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
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSaveEntry}>
            <DialogHeader><DialogTitle>{editingEntry ? 'Editar' : 'Novo'} Lançamento de Despesa</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="grid gap-2 col-span-3"><Label>Descrição*</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required /></div>
                <div className="grid gap-2">
                  <Label>Tipo*</Label>
                  <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Confirmed">Confirmado</SelectItem><SelectItem value="Provision">Provisão</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Fornecedor*</Label><Select value={formSupplierId} onValueChange={setFormSupplierId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{sortedSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>Categoria (Despesa)*</Label><Select value={formCategoryId} onValueChange={setFormCategoryId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Valor Unitário*</Label><Input type="number" step="0.01" value={formAmount || ""} onChange={e => setFormAmount(Number(e.target.value))} required /></div>
                <div className="grid gap-2"><Label>Primeiro Vencimento*</Label><Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required /></div>
                <div className="grid gap-2"><Label>Centro de Custo</Label><Select value={formCostCenterId} onValueChange={setFormCostCenterId}><SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{activeCentersByGroup.map(group => (<SelectGroup key={group.id}><SelectLabel className="text-[10px] uppercase text-primary font-bold">{group.name}</SelectLabel>{group.centers.map(center => (<SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>))}</SelectGroup>))}</SelectContent></Select></div>
              </div>

              {!editingEntry && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="recurring" checked={isRecurring} onCheckedChange={(c) => setIsRecurring(!!c)} />
                    <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer"><Repeat className="w-4 h-4 text-primary" /> Esta conta se repete (Parcelamento/Recorrência)</Label>
                  </div>
                  
                  {isRecurring && (
                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                      <div className="grid gap-2">
                        <Label>Quantidade de Parcelas</Label>
                        <Input type="number" min={2} max={60} value={installmentsCount} onChange={e => setInstallmentsCount(Number(e.target.value))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Frequência</Label>
                        <Select value={recurrenceInterval} onValueChange={(v: any) => setRecurrenceInterval(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar Lançamento</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          {entryToPay && (
            <form onSubmit={handlePayConfirm}>
              <DialogHeader>
                <DialogTitle>Liquidar: {entryToPay.description}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Data de Pagamento</Label>
                  <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold">Juros (+)</Label>
                    <Input type="number" step="0.01" value={payInterest || ""} onChange={e => setPayInterest(Number(e.target.value))} placeholder="0,00" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold">Multa (+)</Label>
                    <Input type="number" step="0.01" value={payFine || ""} onChange={e => setPayFine(Number(e.target.value))} placeholder="0,00" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold text-destructive">Desc. (-)</Label>
                    <Input type="number" step="0.01" value={payDiscount || ""} onChange={e => setPayDiscount(Number(e.target.value))} placeholder="0,00" />
                  </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 flex flex-col items-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total a Pagar</p>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    R$ {(entryToPay.originalAmount + payInterest + payFine - payDiscount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Valor Original: R$ {entryToPay.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 text-lg shadow-lg">Confirmar Pagamento</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
