
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
  Calculator,
  UserPlus,
  ArrowRight,
  Trash2,
  AlertCircle,
  Divide,
  Layers,
  History,
  Info,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wallet,
  X,
  CalendarClock,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { Supplier, AccountCategory, AccountsPayableEntry, EntryType, CostCenter, CostCenterGroup, BankAccount, PlanningStatus } from "@/lib/types";
import { 
  format, 
  isBefore,
  isSameDay,
  parseISO,
  addMonths,
  addWeeks,
  addDays,
  isValid
} from "date-fns";

type InstallmentDraft = {
  date: string;
  expectedDate: string;
  amount: number;
};

type SortConfig = {
  key: 'dueDate' | 'supplier' | 'description' | 'dynamicStatus' | 'amount';
  direction: 'asc' | 'desc';
};

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountsPayableEntry | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [entryToPay, setEntryToPay] = useState<AccountsPayableEntry | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [rootIdForHistory, setRootIdForHistory] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Estados do Formulário de Cadastro
  const [formType, setFormType] = useState<EntryType>("Confirmed");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formExpectedDate, setFormExpectedDate] = useState("");
  const [formPlanningStatus, setFormPlanningStatus] = useState<PlanningStatus>("Programmed");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formCostCenterId, setFormCostCenterId] = useState("");
  
  // Estados de Parcelamento/Recorrência Avançado
  const [isMultiEntry, setIsMultiEntry] = useState(false);
  const [multiMode, setMultiMode] = useState<"installment" | "recurrence">("installment");
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [recurrenceInterval, setRecurrenceInterval] = useState<"monthly" | "weekly" | "fortnightly" | "daily">("monthly");
  const [installmentsDraft, setInstallmentsDraft] = useState<InstallmentDraft[]>([]);

  // Estado de Cadastro Rápido de Fornecedor
  const [quickSupName, setQuickSupplierName] = useState("");

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

  // Estado de Ordenação
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dueDate', direction: 'asc' });

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setTodayStr(format(now, "yyyy-MM-dd"));
    setPayDate(format(now, "yyyy-MM-dd"));
  }, []);

  // Efeito para gerar rascunho de parcelas/recorrência
  useEffect(() => {
    if (!isMultiEntry || installmentsCount < 1 || !formDueDate || formAmount <= 0) {
      setInstallmentsDraft([]);
      return;
    }

    const drafts: InstallmentDraft[] = [];
    const startDate = parseISO(formDueDate);
    const startExpectedDate = formExpectedDate ? parseISO(formExpectedDate) : startDate;
    
    if (!isValid(startDate)) {
      setInstallmentsDraft([]);
      return;
    }

    let baseValue = 0;
    if (multiMode === 'installment') {
      baseValue = Number((formAmount / installmentsCount).toFixed(2));
    } else {
      baseValue = formAmount;
    }

    let totalAssigned = 0;

    for (let i = 0; i < installmentsCount; i++) {
      let currentDueDate: Date;
      let currentExpectedDate: Date;
      switch(recurrenceInterval) {
        case 'weekly': 
          currentDueDate = addWeeks(startDate, i); 
          currentExpectedDate = addWeeks(startExpectedDate, i);
          break;
        case 'fortnightly': 
          currentDueDate = addDays(startDate, i * 14); 
          currentExpectedDate = addDays(startExpectedDate, i * 14);
          break;
        case 'daily': 
          currentDueDate = addDays(startDate, i); 
          currentExpectedDate = addDays(startExpectedDate, i);
          break;
        default: 
          currentDueDate = addMonths(startDate, i);
          currentExpectedDate = addMonths(startExpectedDate, i);
      }

      let installmentValue = baseValue;
      if (multiMode === 'installment') {
        installmentValue = i === installmentsCount - 1 
          ? Number((formAmount - totalAssigned).toFixed(2)) 
          : baseValue;
      }
      
      totalAssigned += installmentValue;

      drafts.push({
        date: format(currentDueDate, "yyyy-MM-dd"),
        expectedDate: format(currentExpectedDate, "yyyy-MM-dd"),
        amount: installmentValue
      });
    }
    setInstallmentsDraft(drafts);
  }, [isMultiEntry, multiMode, installmentsCount, recurrenceInterval, formAmount, formDueDate, formExpectedDate]);

  const updateDraftItem = (index: number, field: keyof InstallmentDraft, value: any) => {
    const newDrafts = [...installmentsDraft];
    newDrafts[index] = { ...newDrafts[index], [field]: value };
    setInstallmentsDraft(newDrafts);
  };

  const totalDraftValue = installmentsDraft.reduce((acc, curr) => acc + curr.amount, 0);

  const entriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsPayableEntries");
  }, [db, user]);

  const historyQuery = useMemoFirebase(() => {
    if (!db || !user || !rootIdForHistory) return null;
    return query(
      collection(db, "users", user.uid, "accountsPayableEntries"),
      where("rootEntryId", "==", rootIdForHistory)
    );
  }, [db, user, rootIdForHistory]);

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

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "bankAccounts");
  }, [db, user]);

  const { data: entries } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: historyItems } = useCollection<AccountsPayableEntry>(historyQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: groups } = useCollection<CostCenterGroup>(groupsQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);
  const { data: accounts } = useCollection<BankAccount>(accountsQuery);

  const sortedSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const groupedLeafCategories = useMemo(() => {
    if (!categories) return [];
    
    const validRoots = categories.filter(c => c.type === 'Expense' && (!c.parentCategoryId || c.parentCategoryId === ""));
    const childrenMap: Record<string, string[]> = {};
    categories.forEach(c => {
      if (c.parentCategoryId) {
        if (!childrenMap[c.parentCategoryId]) childrenMap[c.parentCategoryId] = [];
        childrenMap[c.parentCategoryId].push(c.id);
      }
    });

    const reachableIds = new Set<string>();
    const checkReachable = (id: string) => {
      reachableIds.add(id);
      (childrenMap[id] || []).forEach(childId => checkReachable(childId));
    };
    validRoots.forEach(r => checkReachable(r.id));

    const leaves = categories.filter(cat => 
      reachableIds.has(cat.id) && 
      !categories.some(child => child.parentCategoryId === cat.id)
    );

    const groupMap: Record<string, { parent: AccountCategory | undefined, items: AccountCategory[] }> = {};

    leaves.forEach(cat => {
      const parent = categories.find(p => p.id === cat.parentCategoryId);
      const parentId = parent?.id || "raiz";
      if (!groupMap[parentId]) {
        groupMap[parentId] = { parent, items: [] };
      }
      groupMap[parentId].items.push(cat);
    });

    return Object.entries(groupMap)
      .sort((a, b) => (a[1].parent?.code || "0").localeCompare(b[1].parent?.code || "0"))
      .map(([_, data]) => ({
        parentName: data.parent ? `${data.parent.code} - ${data.parent.name}` : "Geral",
        items: data.items.sort((a, b) => a.code.localeCompare(b.code))
      }));
  }, [categories]);

  const leafCategoriesFlat = useMemo(() => {
    return groupedLeafCategories.flatMap(g => g.items).sort((a, b) => a.code.localeCompare(b.code));
  }, [groupedLeafCategories]);

  const activeCentersByGroup = useMemo(() => {
    if (!groups || !centers) return [];
    return groups.sort((a,b) => a.name.localeCompare(b.name)).map(group => ({
      ...group,
      centers: centers.filter(c => c.groupId === group.id && c.status === 'Active').sort((a,b) => a.name.localeCompare(b.name))
    })).filter(g => g.centers.length > 0);
  }, [groups, centers]);

  const getDynamicStatus = (entry: AccountsPayableEntry) => {
    if (entry.status === 'Paid') return 'Paid';
    if (!todayStr || !entry.dueDate) return 'Open';
    const dueDate = new Date(entry.dueDate + 'T12:00:00');
    const today = new Date(todayStr + 'T12:00:00');
    if (isValid(dueDate) && isValid(today)) {
      if (isBefore(dueDate, today) && !isSameDay(dueDate, today)) return 'Overdue';
      if (isSameDay(dueDate, today)) return 'DueToday';
    }
    return 'Open';
  };

  const toggleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortConfig['key'] }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  const allFilteredEntries = useMemo(() => {
    if (!mounted) return [];
    return (entries?.map(entry => ({ ...entry, dynamicStatus: getDynamicStatus(entry) }))
      .filter(e => {
        const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(e.dynamicStatus);
        const supplierMatch = selectedSupplierIds.length === 0 || selectedSupplierIds.includes(e.supplierId);
        const categoryMatch = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(e.accountCategoryId);
        const dueDateMatch = (!filterDueDateStart || (e.dueDate && e.dueDate >= filterDueDateStart)) && (!filterDueDateEnd || (e.dueDate && e.dueDate <= filterDueDateEnd));
        
        const sName = suppliers?.find(s => s.id === e.supplierId)?.name.toLowerCase() || "";
        const cName = categories?.find(c => c.id === e.accountCategoryId)?.name.toLowerCase() || "";
        const desc = e.description.toLowerCase();
        const term = searchTerm.toLowerCase();
        const searchMatch = !searchTerm || desc.includes(term) || sName.includes(term) || cName.includes(term);

        return statusMatch && supplierMatch && categoryMatch && dueDateMatch && searchMatch;
      }) || []).sort((a, b) => {
        const { key, direction } = sortConfig;
        let comparison = 0;

        if (key === 'dueDate') {
          comparison = (a.dueDate || "").localeCompare(b.dueDate || "");
        } else if (key === 'supplier') {
          const nameA = suppliers?.find(s => s.id === a.supplierId)?.name || "";
          const nameB = suppliers?.find(s => s.id === b.supplierId)?.name || "";
          comparison = nameA.localeCompare(nameB);
        } else if (key === 'description') {
          comparison = a.description.localeCompare(b.description);
        } else if (key === 'dynamicStatus') {
          comparison = a.dynamicStatus.localeCompare(b.dynamicStatus);
        } else if (key === 'amount') {
          comparison = a.originalAmount - b.originalAmount;
        }

        return direction === 'asc' ? comparison : -comparison;
      });
  }, [entries, selectedStatuses, selectedSupplierIds, selectedCategoryIds, filterDueDateStart, filterDueDateEnd, searchTerm, suppliers, categories, todayStr, mounted, sortConfig]);

  const hasActiveFilters = searchTerm !== "" || selectedStatuses.length > 0 || selectedSupplierIds.length > 0 || selectedCategoryIds.length > 0 || filterDueDateStart !== "" || filterDueDateEnd !== "";

  const totalOverdue = allFilteredEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = allFilteredEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = allFilteredEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  
  const totalPaid = allFilteredEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => {
    const netValue = curr.originalAmount + (curr.interest || 0) + (curr.fine || 0) - (curr.discount || 0);
    return acc + netValue;
  }, 0);

  const handleSaveQuickSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !quickSupName) return;
    const id = `sup_${Date.now()}`;
    const data: Supplier = {
      id,
      name: quickSupName,
      personType: 'Pessoa Jurídica',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, "users", user.uid, "suppliers", id), data, { merge: true });
    setFormSupplierId(id);
    setQuickSupplierName("");
    setIsQuickSupplierOpen(false);
    toast({ title: "Fornecedor criado e selecionado!" });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatuses([]);
    setSelectedSupplierIds([]);
    setSelectedCategoryIds([]);
    setFilterDueDateStart("");
    setFilterDueDateEnd("");
    setSortConfig({ key: 'dueDate', direction: 'asc' });
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const baseData: any = {
      supplierId: formSupplierId, 
      accountCategoryId: formCategoryId, 
      costCenterId: formCostCenterId === "none" || !formCostCenterId ? null : formCostCenterId,
      description: formDescription, 
      issueDate: formIssueDate || format(new Date(), "yyyy-MM-dd"),
      expectedPaymentDate: formExpectedDate || null,
      planningStatus: formPlanningStatus,
      entryType: formType, 
      updatedAt: new Date().toISOString(),
    };
    
    if (editingEntry) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsPayableEntries", editingEntry.id), { ...baseData, originalAmount: formAmount, dueDate: formDueDate });
      toast({ title: "Lançamento atualizado" });
    } else {
      if (isMultiEntry && installmentsDraft.length > 0) {
        const batchTimestamp = Date.now();
        installmentsDraft.forEach((draft, i) => {
          const id = `pay_${batchTimestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`;
          setDocumentNonBlocking(
            doc(db, "users", user.uid, "accountsPayableEntries", id), 
            { 
              ...baseData, 
              id, 
              status: 'Open', 
              originalAmount: draft.amount, 
              dueDate: draft.date, 
              expectedPaymentDate: draft.expectedDate,
              installmentInfo: `${i + 1}/${installmentsDraft.length}`,
              createdAt: new Date().toISOString() 
            }, 
            { merge: true }
          );
        });
        toast({ title: `${installmentsDraft.length} lançamentos gerados!` });
      } else {
        const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        setDocumentNonBlocking(
          doc(db, "users", user.uid, "accountsPayableEntries", id), 
          { 
            ...baseData, 
            id, 
            status: 'Open', 
            originalAmount: formAmount, 
            dueDate: formDueDate, 
            createdAt: new Date().toISOString() 
          }, 
          { merge: true }
        );
        toast({ title: "Lançamento salvo!" });
      }
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
    setFormIssueDate(entry.issueDate || format(new Date(), "yyyy-MM-dd"));
    setFormDueDate(entry.dueDate || "");
    setFormExpectedDate(entry.expectedPaymentDate || "");
    setFormPlanningStatus(entry.planningStatus || "Programmed");
    setFormSupplierId(entry.supplierId);
    setFormCategoryId(entry.accountCategoryId);
    setFormCostCenterId(entry.costCenterId || "");
    setFormType(entry.entryType || "Confirmed");
    setIsMultiEntry(false);
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

  const handleToggleMultiEntry = (checked: boolean) => {
    setIsMultiEntry(checked);
    if (checked && installmentsCount <= 1) {
      setInstallmentsCount(2); 
    }
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
            setFormIssueDate(format(new Date(), "yyyy-MM-dd"));
            setFormDueDate("");
            setFormExpectedDate("");
            setFormPlanningStatus("Programmed");
            setFormSupplierId("");
            setFormCategoryId("");
            setFormCostCenterId(""); 
            setFormType("Confirmed");
            setIsMultiEntry(false);
            setInstallmentsCount(1);
            setMultiMode("installment");
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
                    <SelectContent><SelectItem value="all">Todas</SelectItem>{leafCategoriesFlat.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent>
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
                    <RotateCcw className="w-4 h-4" /> Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { key: 'Overdue', label: 'Atrasado', value: totalOverdue, icon: AlertCircle, color: 'text-destructive bg-destructive/5 ring-destructive' },
          { key: 'DueToday', label: 'Hoje', value: totalDueToday, icon: Clock, color: 'text-amber-700 bg-amber-50 ring-amber-500' },
          { key: 'Open', label: 'Em Aberto', value: totalOpen, icon: TrendingDown, color: 'text-primary bg-primary/5 ring-primary' },
          { key: 'Paid', label: 'Total Pago (Líquido)', value: totalPaid, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 ring-emerald-500' }
        ].map((status) => (
          <Card 
            key={status.key}
            className={cn("cursor-pointer transition-all hover:shadow-md", selectedStatuses.includes(status.key) ? `ring-2 ${status.color}` : status.color.split(' ')[1])}
            onClick={() => setSelectedStatuses(prev => prev.includes(status.key) ? prev.filter(s => s !== status.key) : [...prev, status.key])}
          >
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-[10px] font-bold uppercase opacity-70">{status.label}</span>
              <status.icon className="w-3 h-3 opacity-40" />
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xl font-bold">R$ {status.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent>
          </Card>
        ))}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-amber-800 text-sm">
            <Filter className="w-4 h-4" />
            <span>Filtros ativos estão reduzindo a lista abaixo.</span>
            <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-200">
              Exibindo {allFilteredEntries.length} de {entries?.length || 0} lançamentos
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-amber-900 hover:bg-amber-100 gap-1 h-7">
            <X className="w-3 h-3" /> Limpar Filtros
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('dueDate')}>
                  <div className="flex items-center">Vencimento <SortIcon column="dueDate" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('supplier')}>
                  <div className="flex items-center">Fornecedor <SortIcon column="supplier" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('description')}>
                  <div className="flex items-center">Descrição / Centro de Custo <SortIcon column="description" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('dynamicStatus')}>
                  <div className="flex items-center">Status <SortIcon column="dynamicStatus" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors text-right" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center justify-end">Valor <SortIcon column="amount" /></div>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allFilteredEntries.map((entry) => {
                const isPaid = entry.dynamicStatus === 'Paid';
                const effectivePaid = entry.originalAmount + (entry.interest || 0) + (entry.fine || 0) - (entry.discount || 0);
                const hasAdjustments = (entry.interest || 0) > 0 || (entry.fine || 0) > 0 || (entry.discount || 0) > 0;
                const category = categories?.find(c => c.id === entry.accountCategoryId);
                const dueDateObj = entry.dueDate ? new Date(entry.dueDate + 'T12:00:00') : null;
                const bankAccount = accounts?.find(a => a.id === entry.bankAccountId);

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold">{dueDateObj && isValid(dueDateObj) ? format(dueDateObj, "dd/MM/yy") : '-'}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">Emissão: {entry.issueDate ? format(parseISO(entry.issueDate), "dd/MM/yy") : '-'}</span>
                        {entry.expectedPaymentDate && (
                          <span className="text-[9px] text-primary font-bold mt-0.5 flex items-center gap-1">
                            <CalendarClock className="w-2.5 h-2.5" /> Previsão: {format(parseISO(entry.expectedPaymentDate), "dd/MM/yy")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs truncate max-w-[150px]">{suppliers?.find(s => s.id === entry.supplierId)?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("text-[9px] uppercase font-bold", !category ? "text-destructive" : "text-muted-foreground")}>
                            {category?.name || 'Categoria não encontrada'}
                          </span>
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
                          {entry.planningStatus === 'Programmed' && (
                            <Badge variant="outline" className="text-[8px] h-4 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                              <Target className="w-2 h-2" /> Programado
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
                          {entry.paymentDate && (
                            <div className="flex flex-col mt-1">
                              <span className="text-[9px] text-emerald-600 font-bold">Em {format(parseISO(entry.paymentDate), "dd/MM/yy")}</span>
                              {bankAccount && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-1 italic">
                                  <Wallet className="w-2 h-2" /> via {bankAccount.name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : entry.dynamicStatus === 'Overdue' ? (
                        <Badge variant="destructive">Atrasado</Badge>
                      ) : entry.dynamicStatus === 'DueToday' ? (
                        <Badge className="bg-amber-100 text-amber-700 border-none">Hoje</Badge>
                      ) : (
                        <Badge variant="outline">Aberto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("font-bold text-sm", isPaid && hasAdjustments ? "text-emerald-700" : "")}>
                          R$ {(isPaid ? effectivePaid : entry.originalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {isPaid && hasAdjustments && (
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground italic">
                            <Calculator className="w-2 h-2" />
                            Lançado: R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => { setEntryToPay(entry); setPayInterest(0); setPayFine(0); setPayDiscount(0); setPayDate(format(new Date(), "yyyy-MM-dd")); setIsPaymentOpen(true); }} className="text-emerald-600 font-bold">Liquidar</DropdownMenuItem>}
                          {entry.status === 'Paid' && <DropdownMenuItem onClick={() => handleUnlinkPayment(entry)} className="text-amber-600 font-bold flex gap-2"><Undo2 className="w-4 h-4" /> Estornar</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => handleDuplicateEntry(entry)} className="flex gap-2"><Copy className="w-4 h-4" /> Duplicar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setRootIdForHistory(entry.rootEntryId || entry.id); setIsHistoryOpen(true); }} className="flex gap-2"><History className="w-4 h-4" /> Ver Histórico</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { 
                            setEditingEntry(entry); 
                            setFormDescription(entry.description); 
                            setFormAmount(entry.originalAmount); 
                            setFormIssueDate(entry.issueDate || "");
                            setFormDueDate(entry.dueDate || ""); 
                            setFormExpectedDate(entry.expectedPaymentDate || "");
                            setFormPlanningStatus(entry.planningStatus || "Programmed");
                            setFormSupplierId(entry.supplierId); 
                            setFormCategoryId(entry.accountCategoryId); 
                            setFormCostCenterId(entry.costCenterId || ""); 
                            setFormType(entry.entryType || "Confirmed");
                            setIsMultiEntry(false);
                            setIsNewEntryOpen(true); 
                          }}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            if (confirm("Excluir este lançamento permanentemente?")) {
                              deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "accountsPayableEntries", entry.id), entry);
                              toast({ title: "Lançamento excluído" });
                            }
                          }} className="text-destructive">Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Histórico de Movimentações</DialogTitle>
            <DialogDescription>Todos os registros vinculados a esta negociação (pagamentos parciais e saldos).</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / Venc.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Pago (Líquido)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems?.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => {
                  const itemPaidValue = item.originalAmount + (item.interest || 0) + (item.fine || 0) - (item.discount || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span>Venc: {item.dueDate ? format(parseISO(item.dueDate), "dd/MM/yy") : '-'}</span>
                          {item.paymentDate && <span className="text-[10px] text-emerald-600 font-bold">Pago: {format(parseISO(item.paymentDate), "dd/MM/yy")}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'Paid' ? 'default' : 'outline'} className={cn(item.status === 'Paid' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none" : "")}>
                          {item.status === 'Paid' ? 'Liquidado' : 'Saldo Aberto'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        R$ {(item.status === 'Paid' ? itemPaidValue : item.originalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {item.status === 'Paid' && (item.interest || 0) > 0 && <span className="block text-[8px] text-emerald-600">Inclui Juros/Multa</span>}
                        {item.status === 'Paid' && (item.discount || 0) > 0 && <span className="block text-[8px] text-emerald-600">Com Desconto</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!historyItems || historyItems.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">
                      Nenhum outro registro vinculado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <form onSubmit={handleSaveEntry}>
            <div className="p-6 border-b bg-muted/20">
              <DialogHeader>
                <DialogTitle>{editingEntry ? 'Editar' : 'Novo'} Lançamento de Despesa</DialogTitle>
                <DialogDescription>Preencha os dados básicos ou configure lançamentos múltiplos nas abas abaixo.</DialogDescription>
              </DialogHeader>
            </div>

            <Tabs defaultValue="basic" className="w-full">
              <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2 h-11">
                  <TabsTrigger value="basic" className="gap-2"><CalendarDays className="w-4 h-4" /> Informações da Conta</TabsTrigger>
                  <TabsTrigger value="recurrence" disabled={!!editingEntry} className="gap-2"><Repeat className="w-4 h-4" /> Parcelas / Recorrência</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="basic" className="p-6 pt-4 space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2 col-span-2"><Label>Descrição*</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required /></div>
                  <div className="grid gap-2">
                    <Label>Natureza*</Label>
                    <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Confirmed">Confirmado</SelectItem><SelectItem value="Provision">Provisão</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1 text-primary"><Target className="w-3 h-3" /> Planejamento*</Label>
                    <Select value={formPlanningStatus} onValueChange={(v: any) => setFormPlanningStatus(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Programmed">Programado</SelectItem>
                        <SelectItem value="Negotiating">Em Negociação</SelectItem>
                        <SelectItem value="Suspended">Suspenso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="flex justify-between items-center">Fornecedor* <Button type="button" variant="ghost" className="h-5 px-1.5 text-[10px] text-primary" onClick={() => setIsQuickSupplierOpen(true)}><UserPlus className="w-3 h-3 mr-1" /> Novo</Button></Label>
                    <Select value={formSupplierId} onValueChange={setFormSupplierId} required>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {sortedSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Categoria (Plano de Contas)*</Label>
                    <Select value={formCategoryId} onValueChange={setFormCategoryId} required>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {groupedLeafCategories.map(group => (
                          <SelectGroup key={group.parentName}>
                            <SelectLabel className="text-[10px] uppercase text-primary font-bold">{group.parentName}</SelectLabel>
                            {group.items.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{isMultiEntry && multiMode === 'installment' ? 'Valor Total*' : 'Valor*'}</Label>
                    <Input type="number" step="0.01" value={formAmount || ""} onChange={e => setFormAmount(Number(e.target.value))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1 font-bold text-accent"><CalendarDays className="w-3 h-3" /> Data de Emissão*</Label>
                    <Input type="date" value={formIssueDate} onChange={e => setFormIssueDate(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Data de Vencimento*</Label><Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required /></div>
                  <div className="grid gap-2">
                    <Label className="text-primary flex items-center gap-1 font-bold"><CalendarClock className="w-3 h-3" /> Data Prevista (Forecast)</Label>
                    <Input type="date" value={formExpectedDate} onChange={e => setFormExpectedDate(e.target.value)} className="border-primary/30" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Centro de Custo</Label>
                    <Select value={formCostCenterId} onValueChange={setFormCostCenterId}>
                      <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {activeCentersByGroup.map(group => (
                          <SelectGroup key={group.id}>
                            <SelectLabel className="text-[10px] uppercase text-primary font-bold">{group.name}</SelectLabel>
                            {group.centers.map(center => (<SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1"><Info className="w-3 h-3" /> A <strong>Data de Emissão</strong> registra a competência. A <strong>Data Prevista</strong> é o dia real que você planeja pagar (alimenta o Forecast).</p>
              </TabsContent>

              <TabsContent value="recurrence" className="p-6 pt-4">
                <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 space-y-6">
                  <div className="flex items-center space-x-3">
                    <Checkbox id="recurring" checked={isMultiEntry} onCheckedChange={(c) => handleToggleMultiEntry(!!c)} className="w-5 h-5" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="recurring" className="text-sm font-bold cursor-pointer">Ativar Lançamento Múltiplo</Label>
                      <p className="text-xs text-muted-foreground">Gere automaticamente várias contas para os próximos períodos.</p>
                    </div>
                  </div>
                  
                  {isMultiEntry && (
                    <div className="space-y-6 animate-in slide-in-from-top-2">
                      {!formDueDate || formAmount <= 0 ? (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex items-start gap-3">
                          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-700 leading-relaxed">
                            <p className="font-bold">Atenção!</p>
                            <p>Preencha o <strong>Valor</strong> e a <strong>Data de Vencimento</strong> na aba anterior para visualizar a projeção das parcelas.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Escolha o Modo</Label>
                            <RadioGroup value={multiMode} onValueChange={(v: any) => setMultiMode(v)} className="grid grid-cols-2 gap-4">
                              <Label
                                htmlFor="opt-installment"
                                className={cn(
                                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-background p-4 hover:bg-muted/50 cursor-pointer",
                                  multiMode === 'installment' && "border-primary bg-primary/5"
                                )}
                              >
                                <RadioGroupItem value="installment" id="opt-installment" className="sr-only" />
                                <Divide className="mb-3 h-6 w-6" />
                                <div className="text-center">
                                  <p className="text-sm font-bold">Parcelamento</p>
                                  <p className="text-[10px] text-muted-foreground">Divide o valor total em X partes.</p>
                                </div>
                              </Label>
                              <Label
                                htmlFor="opt-recurrence"
                                className={cn(
                                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-background p-4 hover:bg-muted/50 cursor-pointer",
                                  multiMode === 'recurrence' && "border-primary bg-primary/5"
                                )}
                              >
                                <RadioGroupItem value="recurrence" id="opt-recurrence" className="sr-only" />
                                <Layers className="mb-3 h-6 w-6" />
                                <div className="text-center">
                                  <p className="text-sm font-bold">Recorrência</p>
                                  <p className="text-[10px] text-muted-foreground">Repete o valor unitário X vezes.</p>
                                </div>
                              </Label>
                            </RadioGroup>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="grid gap-2">
                              <Label>Quantidade total de Lançamentos</Label>
                              <div className="flex items-center gap-3">
                                <Input type="number" min={1} max={120} value={installmentsCount} onChange={e => setInstallmentsCount(Number(e.target.value))} className="bg-background" />
                                <span className="text-xs text-muted-foreground font-medium">vezes</span>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label>Frequência / Intervalo</Label>
                              <Select value={recurrenceInterval} onValueChange={(v: any) => setRecurrenceInterval(v)}>
                                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Mensal (Todo mês)</SelectItem>
                                  <SelectItem value="fortnightly">Quinzenal (A cada 14 dias)</SelectItem>
                                  <SelectItem value="weekly">Semanal (Toda semana)</SelectItem>
                                  <SelectItem value="daily">Diário (Todo dia)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {installmentsDraft.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs uppercase font-bold text-primary">Prévia dos Lançamentos (Editável)</Label>
                                {multiMode === 'installment' && (
                                  <div className={cn("text-xs font-bold px-2 py-1 rounded", Math.abs(totalDraftValue - formAmount) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive")}>
                                    Soma: R$ {totalDraftValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    {Math.abs(totalDraftValue - formAmount) >= 0.01 && <span className="ml-1 flex items-center gap-1 inline-flex"><AlertCircle className="w-3 h-3" /> Divergente do Total</span>}
                                  </div>
                                )}
                              </div>
                              
                              <div className="max-h-[250px] overflow-y-auto border rounded-lg bg-background">
                                <Table>
                                  <TableHeader className="bg-muted/50">
                                    <TableRow>
                                      <TableHead className="w-12 text-center h-8">#</TableHead>
                                      <TableHead className="h-8">Vencimento</TableHead>
                                      <TableHead className="h-8">Data Prevista</TableHead>
                                      <TableHead className="h-8 text-right">Valor</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {installmentsDraft.map((draft, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-center py-1 text-xs">{idx + 1}</TableCell>
                                        <TableCell className="py-1">
                                          <Input 
                                            type="date" 
                                            value={draft.date} 
                                            onChange={(e) => updateDraftItem(idx, 'date', e.target.value)}
                                            className="h-8 text-[10px]"
                                          />
                                        </TableCell>
                                        <TableCell className="py-1">
                                          <Input 
                                            type="date" 
                                            value={draft.expectedDate} 
                                            onChange={(e) => updateDraftItem(idx, 'expectedDate', e.target.value)}
                                            className="h-8 text-[10px] border-primary/30"
                                          />
                                        </TableCell>
                                        <TableCell className="py-1">
                                          <Input 
                                            type="number" 
                                            step="0.01" 
                                            value={draft.amount} 
                                            onChange={(e) => updateDraftItem(idx, 'amount', Number(e.target.value))}
                                            className="h-8 text-[10px] text-right"
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="button" variant="outline" onClick={() => setIsNewEntryOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isMultiEntry && multiMode === 'installment' && Math.abs(totalDraftValue - formAmount) >= 0.01}>Salvar Lançamento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isQuickSupplierOpen} onOpenChange={setIsQuickSupplierOpen}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleSaveQuickSupplier}>
            <DialogHeader>
              <DialogTitle>Novo Fornecedor Rápido</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Nome do Fornecedor</Label>
              <Input value={quickSupName} onChange={e => setQuickSupplierName(e.target.value)} placeholder="Ex: Mercado Central" autoFocus required />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Criar e Selecionar</Button>
            </DialogFooter>
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
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Confirmar Pagamento</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
