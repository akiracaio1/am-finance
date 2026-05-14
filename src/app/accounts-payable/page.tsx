
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
  LayoutGrid
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { Supplier, AccountCategory, AccountsPayableEntry, EntryType, CostCenter, CostCenterGroup } from "@/lib/types";
import { 
  format, 
  isBefore,
  isSameDay,
  parseISO
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

  useEffect(() => {
    setMounted(true);
    setTodayStr(format(new Date(), "yyyy-MM-dd"));
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  
  const [filterDueDateStart, setFilterDueDateStart] = useState("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState("");

  const [paymentDate, setPaymentDate] = useState("");

  useEffect(() => {
    if (todayStr) setPaymentDate(todayStr);
  }, [todayStr]);

  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formCostCenterId, setFormCostCenterId] = useState("");

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

  // Centros de Custo Ativos Agrupados
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

  const calculateSettledValue = (entry: AccountsPayableEntry) => {
    return (entry.originalAmount || 0) + (entry.interest || 0) + (entry.fine || 0) - (entry.discount || 0);
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
  const totalPaid = allFilteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + calculateSettledValue(curr), 0);

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
      const id = `pay_${Date.now()}`;
      setDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", id), { ...baseData, id, status: 'Open', originalAmount: formAmount, dueDate: formDueDate, createdAt: new Date().toISOString() }, { merge: true });
      toast({ title: "Lançamento criado" });
    }
    setIsNewEntryOpen(false); setEditingEntry(null);
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
          <Button className="gap-2 shadow-lg" onClick={() => { setEditingEntry(null); setFormCostCenterId(""); setIsNewEntryOpen(true); }}><Plus className="w-4 h-4" /> Novo Lançamento</Button>
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
        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", selectedStatuses.includes('Overdue') ? "ring-2 ring-destructive" : "bg-destructive/5")}
          onClick={() => toggleStatusFilter('Overdue')}
        >
          <CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-destructive/70">Atrasado</CardHeader>
          <CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", selectedStatuses.includes('DueToday') ? "ring-2 ring-amber-500" : "bg-amber-50")}
          onClick={() => toggleStatusFilter('DueToday')}
        >
          <CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-amber-700">Hoje</CardHeader>
          <CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", selectedStatuses.includes('Open') ? "ring-2 ring-primary" : "bg-primary/5")}
          onClick={() => toggleStatusFilter('Open')}
        >
          <CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-primary/70">Em Aberto</CardHeader>
          <CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", selectedStatuses.includes('Paid') ? "ring-2 ring-emerald-500" : "bg-emerald-50")}
          onClick={() => toggleStatusFilter('Paid')}
        >
          <CardHeader className="p-4 pb-2 text-[10px] font-bold uppercase text-emerald-700">Total Pago</CardHeader>
          <CardContent className="p-4 pt-0 text-xl font-bold">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent>
        </Card>
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
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">{leafCategories.find(c => c.id === entry.accountCategoryId)?.name}</span>
                        {entry.costCenterId && (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 flex items-center gap-1 bg-muted/50 border-primary/20">
                            <LayoutGrid className="w-2 h-2" />
                            {centers?.find(c => c.id === entry.costCenterId)?.name}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm">{entry.description} {entry.installmentInfo && `(${entry.installmentInfo})`}</span>
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
                        {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => { setEntryToPay(entry); setIsPaymentOpen(true); }} className="text-emerald-600 font-bold">Liquidar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => { setEditingEntry(entry); setFormDescription(entry.description); setFormAmount(entry.originalAmount); setFormDueDate(entry.dueDate); setFormSupplierId(entry.supplierId); setFormCategoryId(entry.accountCategoryId); setFormCostCenterId(entry.costCenterId || ""); setIsNewEntryOpen(true); }}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "accountsPayableEntries", entry.id))} className="text-destructive">Excluir</DropdownMenuItem>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Descrição*</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required /></div>
                <div className="grid gap-2"><Label>Fornecedor*</Label><Select value={formSupplierId} onValueChange={setFormSupplierId} required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{sortedSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Valor*</Label><Input type="number" step="0.01" value={formAmount || ""} onChange={e => setFormAmount(Number(e.target.value))} required /></div>
                <div className="grid gap-2"><Label>Vencimento*</Label><Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required /></div>
                <div className="grid gap-2">
                  <Label>Centro de Custo</Label>
                  <Select value={formCostCenterId} onValueChange={setFormCostCenterId}>
                    <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {activeCentersByGroup.map(group => (
                        <SelectGroup key={group.id}>
                          <SelectLabel className="text-[10px] uppercase text-primary font-bold">{group.name}</SelectLabel>
                          {group.centers.map(center => (
                            <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Categoria (Despesa)*</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId} required>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar Lançamento</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          {entryToPay && (
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              updateDocumentNonBlocking(doc(db!, "users", user!.uid, "accountsPayableEntries", entryToPay.id), { status: 'Paid', paymentDate, updatedAt: new Date().toISOString() }); 
              setIsPaymentOpen(false); 
              toast({ title: "Conta liquidada!" });
            }}>
              <DialogHeader><DialogTitle>Liquidar: {entryToPay.description}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Data de Pagamento</Label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required /></div>
                <div className="bg-primary/5 p-4 rounded text-center font-bold text-xl">Total: R$ {entryToPay.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <DialogFooter><Button type="submit" className="w-full">Confirmar Pagamento</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
