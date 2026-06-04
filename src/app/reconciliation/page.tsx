"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, 
  CheckCircle, 
  Upload, 
  Search,
  Check,
  X,
  PlusCircle,
  ArrowRightLeft,
  AlertTriangle,
  Settings,
  FileText,
  CircleOff,
  Calculator,
  LayoutGrid,
  UserPlus,
  Plus,
  CheckCircle2,
  Pencil,
  Split,
  CalendarDays
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { 
  BankAccount, 
  BankTransaction, 
  AccountsPayableEntry, 
  AccountsReceivableEntry, 
  AccountCategory,
  Supplier,
  CostCenter,
  CostCenterGroup,
  BankAccountType
} from "@/lib/types";
import { format, isBefore, parseISO, eachDayOfInterval, isValid } from "date-fns";
import { parseOFX, OFXTransaction } from "@/lib/ofx-parser";
import { cn } from "@/lib/utils";

type AdjustmentData = {
  interest: number;
  fine: number;
  discount: number;
  settlementAmount: number; 
};

export default function ReconciliationPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isDetailedCreateOpen, setIsDetailedCreateOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  
  const [matchingTransaction, setMatchingTransaction] = useState<BankTransaction | null>(null);
  const [selectedMatchEntryIds, setSelectedMatchEntries] = useState<string[]>([]);
  
  const [entryAdjustments, setEntryAdjustments] = useState<Record<string, AdjustmentData>>({});
  const [entryToAdjust, setEntryToAdjust] = useState<any>(null);
  
  const [tempAdjInterest, setTempAdjInterest] = useState<number>(0);
  const [tempAdjFine, setTempAdjFine] = useState<number>(0);
  const [tempAdjDiscount, setTempAdjDiscount] = useState<number>(0);
  const [tempSettlementAmount, setTempSettlementAmount] = useState<number>(0);

  const [ofxPreview, setOfxPreview] = useState<OFXTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [matchSearchTerm, setMatchSearchTerm] = useState("");
  const [matchDateStart, setMatchDateStart] = useState("");
  const [matchDateEnd, setMatchDateEnd] = useState("");
  const [matchMinValue, setMatchMinValue] = useState<string>("");
  const [matchMaxValue, setMatchMaxValue] = useState<string>("");

  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formCostCenterId, setFormCostCenterId] = useState("");

  const [quickSupName, setQuickSupName] = useState("");

  const [accName, setAccName] = useState("");
  const [accBank, setAccBank] = useState("");
  const [accType, setAccType] = useState<BankAccountType>("Corrente");
  const [accBalance, setAccBalance] = useState(0);

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "bankAccounts");
  }, [db, user]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedAccountId) return null;
    return collection(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions");
  }, [db, user, selectedAccountId]);

  const noMovementQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedAccountId) return null;
    return collection(db, "users", user.uid, "bankAccounts", selectedAccountId, "noMovementDays");
  }, [db, user, selectedAccountId]);

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

  const groupsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenterGroups");
  }, [db, user]);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const { data: accounts } = useCollection<BankAccount>(accountsQuery);
  const { data: allTransactions } = useCollection<BankTransaction>(transactionsQuery);
  const { data: noMovementDays } = useCollection<{date: string}>(noMovementQuery);
  const { data: allPayables } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: allReceivables } = useCollection<AccountsReceivableEntry>(receivablesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: costGroups } = useCollection<CostCenterGroup>(groupsQuery);
  const { data: costCenters } = useCollection<CostCenter>(centersQuery);

  const filteredCategories = useMemo(() => {
    if (!categories || !matchingTransaction) return [];
    const targetType = matchingTransaction.type === 'CREDIT' ? 'Revenue' : 'Expense';
    return categories.filter(cat => 
      cat.type === targetType && 
      !categories.some(child => child.parentCategoryId === cat.id)
    ).sort((a, b) => a.code.localeCompare(b.code));
  }, [categories, matchingTransaction]);

  const activeCentersByGroup = useMemo(() => {
    if (!costGroups || !costCenters) return [];
    return costGroups.sort((a,b) => a.name.localeCompare(b.name)).map(group => ({
      ...group,
      centers: costCenters.filter(c => c.groupId === group.id && c.status === 'Active').sort((a,b) => a.name.localeCompare(b.name))
    })).filter(g => g.centers.length > 0);
  }, [costGroups, costCenters]);

  useEffect(() => {
    if (accounts?.length === 1 && !selectedAccountId) setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId]);

  const dailyTransactions = useMemo(() => allTransactions?.filter(t => t.date === selectedDate) || [], [allTransactions, selectedDate]);

  const dailySystemEntries = useMemo(() => {
    const payables = allPayables?.filter(p => p.paymentDate === selectedDate && p.bankAccountId === selectedAccountId) || [];
    const receivables = allReceivables?.filter(r => r.paymentDate === selectedDate && r.bankAccountId === selectedAccountId) || [];
    return [
      ...payables.map(p => ({ ...p, type: 'DEBIT' as const, isPayable: true })),
      ...receivables.map(r => ({ ...r, type: 'CREDIT' as const, isPayable: false }))
    ];
  }, [allPayables, allReceivables, selectedDate, selectedAccountId]);

  const openSystemEntries = useMemo(() => {
    const payables = allPayables?.filter(p => p.status !== 'Paid') || [];
    const receivables = allReceivables?.filter(r => r.status !== 'Paid') || [];
    return [
      ...payables.map(p => ({ ...p, type: 'DEBIT' as const, isPayable: true })),
      ...receivables.map(r => ({ ...r, type: 'CREDIT' as const, isPayable: false }))
    ];
  }, [allPayables, allReceivables]);

  const filteredOpenEntries = useMemo(() => {
    if (!matchingTransaction) return [];
    return openSystemEntries.filter(e => {
      if (e.type !== matchingTransaction.type) return false;
      if (matchSearchTerm) {
        const term = matchSearchTerm.toLowerCase();
        const desc = e.description.toLowerCase();
        const customer = (e as any).customerName?.toLowerCase() || "";
        const supplier = suppliers?.find(s => s.id === (e as any).supplierId)?.name.toLowerCase() || "";
        if (!desc.includes(term) && !customer.includes(term) && !supplier.includes(term)) return false;
      }
      if (matchDateStart && e.dueDate < matchDateStart) return false;
      if (matchDateEnd && e.dueDate > matchDateEnd) return false;
      const val = (e as any).amount || (e as any).originalAmount || 0;
      if (matchMinValue && val < Number(matchMinValue)) return false;
      if (matchMaxValue && val > Number(matchMaxValue)) return false;
      return true;
    }).sort((a, b) => {
      const aVal = (a as any).amount || (a as any).originalAmount || 0;
      const bVal = (b as any).amount || (b as any).originalAmount || 0;
      const targetVal = Math.abs(matchingTransaction.amount);
      const aMatchVal = Math.abs(aVal - targetVal) < 0.01;
      const bMatchVal = Math.abs(bVal - targetVal) < 0.01;
      if (aMatchVal && !bMatchVal) return -1;
      if (!aMatchVal && bMatchVal) return 1;
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });
  }, [openSystemEntries, matchingTransaction, matchSearchTerm, matchDateStart, matchDateEnd, matchMinValue, matchMaxValue, suppliers]);

  const totalSelectedInMatch = useMemo(() => {
    return filteredOpenEntries
      .filter(e => selectedMatchEntryIds.includes(e.id))
      .reduce((acc, e) => {
        const base = ((e as any).amount || (e as any).originalAmount || 0);
        const adj = entryAdjustments[e.id];
        if (!adj) return acc + base;
        return acc + (adj.settlementAmount + adj.interest + adj.fine - adj.discount);
      }, 0);
  }, [filteredOpenEntries, selectedMatchEntryIds, entryAdjustments]);

  const diffInMatch = matchingTransaction ? (Math.abs(matchingTransaction.amount) - totalSelectedInMatch) : 0;

  const pendingDays = useMemo(() => {
    if (!selectedAccountId || !allTransactions || !noMovementDays || !allPayables || !allReceivables) return [];
    const start = new Date("2026-05-01T12:00:00");
    const today = new Date();
    const selDate = parseISO(selectedDate);
    let end = isBefore(selDate, today) ? today : selDate;
    const interval = eachDayOfInterval({ start, end });
    
    return interval.filter(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      if (noMovementDays.some(d => d.date === dateStr)) return false;
      const dayTransactions = allTransactions.filter(t => t.date === dateStr);
      if (dayTransactions.length === 0) return true;
      if (dayTransactions.some(t => !t.reconciled && !t.ignored)) return true;
      const daySystemIn = allReceivables.filter(r => r.paymentDate === dateStr && r.bankAccountId === selectedAccountId).reduce((acc, e) => acc + e.amount, 0);
      const daySystemOut = allPayables.filter(p => p.paymentDate === dateStr && p.bankAccountId === selectedAccountId).reduce((acc, p) => acc + (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0)), 0);
      const statementIn = dayTransactions.filter(t => t.type === 'CREDIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0);
      const statementOut = Math.abs(dayTransactions.filter(t => t.type === 'DEBIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0));
      return Math.abs(statementIn - daySystemIn) > 0.01 || Math.abs(statementOut - daySystemOut) > 0.01;
    }).map(day => format(day, "yyyy-MM-dd")).reverse();
  }, [allTransactions, noMovementDays, allPayables, allReceivables, selectedAccountId, selectedDate]);

  const summary = useMemo(() => {
    const statementIn = dailyTransactions.filter(t => t.type === 'CREDIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0);
    const statementOut = Math.abs(dailyTransactions.filter(t => t.type === 'DEBIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0));
    const systemIn = dailySystemEntries.filter(e => e.type === 'CREDIT').reduce((acc, e) => acc + ((e as any).amount || (e as any).originalAmount || 0), 0);
    const systemOut = dailySystemEntries.filter(e => e.type === 'DEBIT').reduce((acc, e) => {
      const p = e as any;
      return acc + (p.originalAmount !== undefined ? (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0)) : (p.amount || 0));
    }, 0);
    return { statementIn, statementOut, systemIn, systemOut, diffIn: statementIn - systemIn, diffOut: statementOut - systemOut, isBalanced: Math.abs(statementIn - systemIn) < 0.01 && Math.abs(statementOut - systemOut) < 0.01 };
  }, [dailyTransactions, dailySystemEntries]);

  const handleOFXFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const transactions = parseOFX(await file.text());
    setOfxPreview(transactions);
    setIsImportModalOpen(true);
  };

  const confirmImport = () => {
    if (!db || !user || !selectedAccountId) return;
    ofxPreview.forEach(t => {
      const id = `txn_${t.fitId}_${selectedAccountId}`;
      setDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", id), { id, date: t.date, amount: t.amount, description: t.memo, type: t.type, reconciled: false, reconciledEntryId: null, fitId: t.fitId, bankAccountId: selectedAccountId }, { merge: true });
    });
    setIsImportModalOpen(false);
  };

  const undoMatch = (transaction: BankTransaction) => {
    if (!db || !user || !selectedAccountId || !transaction.reconciledEntryId) return;
    
    const entryIds = transaction.reconciledEntryId.split(',');
    const isPayable = transaction.type === 'DEBIT';
    const col = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";
    
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", transaction.id), { reconciled: false, reconciledEntryId: null });
    
    entryIds.forEach(eid => {
      updateDocumentNonBlocking(doc(db, "users", user.uid, col, eid), { status: 'Open', paymentDate: null, bankAccountId: null });
    });
    
    toast({ title: `Conciliação desfeita (${entryIds.length} itens)` });
  };

  const confirmMatch = (entryIds: string[]) => {
    if (!db || !user || !selectedAccountId || !matchingTransaction) return;
    
    const finalEntryIds: string[] = [];
    const isPayable = matchingTransaction.type === 'DEBIT';
    const col = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";
    
    entryIds.forEach(entryId => {
      const originalEntry = filteredOpenEntries.find(e => e.id === entryId);
      if (!originalEntry) return;

      const currentAmount = (originalEntry as any).amount || (originalEntry as any).originalAmount || 0;
      const adjs = entryAdjustments[entryId] || { interest: 0, fine: 0, discount: 0, settlementAmount: currentAmount };
      
      const rootId = originalEntry.rootEntryId || originalEntry.id;

      if (adjs.settlementAmount < currentAmount) {
        const partId = `${entryId}_part_${Date.now()}`;
        const newPaidEntry: any = {
          ...originalEntry,
          id: partId,
          status: 'Paid',
          [isPayable ? "originalAmount" : "amount"]: adjs.settlementAmount,
          paymentDate: matchingTransaction.date,
          bankAccountId: selectedAccountId,
          interest: adjs.interest,
          fine: adjs.fine,
          discount: adjs.discount,
          rootEntryId: rootId,
          updatedAt: new Date().toISOString()
        };
        
        setDocumentNonBlocking(doc(db, "users", user.uid, col, partId), newPaidEntry, { merge: true });
        
        updateDocumentNonBlocking(doc(db, "users", user.uid, col, entryId), {
          [isPayable ? "originalAmount" : "amount"]: currentAmount - adjs.settlementAmount,
          rootEntryId: rootId,
          updatedAt: new Date().toISOString()
        });
        
        finalEntryIds.push(partId);
      } 
      else {
        const updateData: any = { 
          status: 'Paid', 
          paymentDate: matchingTransaction.date, 
          bankAccountId: selectedAccountId, 
          updatedAt: new Date().toISOString(),
          interest: adjs.interest,
          fine: adjs.fine,
          discount: adjs.discount,
          rootEntryId: rootId
        };
        updateDocumentNonBlocking(doc(db, "users", user.uid, col, entryId), updateData);
        finalEntryIds.push(entryId);
      }
    });
    
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", matchingTransaction.id), { 
      reconciled: true, 
      reconciledEntryId: finalEntryIds.join(',') 
    });
    
    setIsMatchModalOpen(false);
    setIsAdjustmentModalOpen(false);
    setSelectedMatchEntries([]);
    setEntryAdjustments({});
    toast({ title: `Conciliado com sucesso!` });
  };

  const saveDetailedEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !matchingTransaction) return;
    
    const isPayable = matchingTransaction.type === 'DEBIT';
    const col = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";
    const entryId = `${isPayable ? 'pay' : 'rec'}_${Date.now()}`;
    
    const entryData: any = { 
      id: entryId, 
      description: formDescription, 
      [isPayable ? "originalAmount" : "amount"]: Number(formAmount), 
      issueDate: formIssueDate || matchingTransaction.date,
      dueDate: formDueDate || matchingTransaction.date, 
      status: 'Paid', 
      paymentDate: matchingTransaction.date, 
      bankAccountId: selectedAccountId, 
      accountCategoryId: formCategoryId, 
      costCenterId: formCostCenterId === "none" || !formCostCenterId ? null : formCostCenterId,
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    };

    if (isPayable) { 
      entryData.supplierId = formSupplierId; 
      entryData.entryType = "Confirmed"; 
    } else { 
      entryData.customerName = formCustomerName; 
    }

    setDocumentNonBlocking(doc(db, "users", user.uid, col, entryId), entryData, { merge: true });
    
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", matchingTransaction.id), { 
      reconciled: true, 
      reconciledEntryId: entryId 
    });
    
    setIsDetailedCreateOpen(false);
    setIsMatchModalOpen(false);
    toast({ title: "Lançamento criado e conciliado com sucesso!" });
  };

  const handleSaveQuickSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !quickSupName) return;
    const id = `sup_${Date.now()}`;
    const data: Supplier = { id, name: quickSupName, personType: 'Pessoa Jurídica', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setDocumentNonBlocking(doc(db, "users", user.uid, "suppliers", id), data, { merge: true });
    setFormSupplierId(id);
    setQuickSupName("");
    setIsQuickSupplierOpen(false);
    toast({ title: "Fornecedor criado!" });
  };

  const handleSaveNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !accName || !accBank) return;
    const id = `acc_${Date.now()}`;
    const data: BankAccount = { 
      id, 
      name: accName, 
      bank: accBank, 
      type: accType, 
      initialBalance: accBalance, 
      openingDate: format(new Date(), "yyyy-MM-dd"),
      createdAt: new Date().toISOString() 
    };
    setDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", id), data, { merge: true });
    setSelectedAccountId(id);
    setAccName(""); setAccBank(""); setAccBalance(0);
    setIsNewAccountModalOpen(false);
    toast({ title: "Conta bancária criada!" });
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedMatchEntries(prev => 
      prev.includes(entryId) ? prev.filter(id => id !== entryId) : [...prev, entryId]
    );
  };

  const handleOpenAdjustment = (e: React.MouseEvent, entry: any) => {
    e.stopPropagation();
    const currentVal = entry.amount || entry.originalAmount || 0;
    const currentAdjs = entryAdjustments[entry.id] || { interest: 0, fine: 0, discount: 0, settlementAmount: currentVal };
    setEntryToAdjust(entry);
    setTempAdjInterest(currentAdjs.interest);
    setTempAdjFine(currentAdjs.fine);
    setTempAdjDiscount(currentAdjs.discount);
    setTempSettlementAmount(currentAdjs.settlementAmount);
    setIsAdjustmentModalOpen(true);
  };

  const saveSingleAdjustment = () => {
    if (!entryToAdjust) return;
    setEntryAdjustments(prev => ({
      ...prev,
      [entryToAdjust.id]: {
        interest: tempAdjInterest,
        fine: tempAdjFine,
        discount: tempAdjDiscount,
        settlementAmount: tempSettlementAmount
      }
    }));
    setIsAdjustmentModalOpen(false);
    if (!selectedMatchEntryIds.includes(entryToAdjust.id)) {
      setSelectedMatchEntries(prev => [...prev, entryToAdjust.id]);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Link2 className="text-primary w-8 h-8" />Conciliação Bancária</h1>
          <p className="text-muted-foreground">Sincronize seu extrato com o plano de contas.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>{accounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bank})</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setIsNewAccountModalOpen(true)} title="Nova Conta"><Plus className="w-4 h-4" /></Button>
          </div>
          <Button disabled={!selectedAccountId} onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" /> Importar OFX</Button>
          <input type="file" accept=".ofx" className="hidden" ref={fileInputRef} onChange={handleOFXFileChange} />
        </div>
      </div>

      {pendingDays.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-4 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-1" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900">Pendências Detectadas (Desde 01/05/2026)</h4>
              <p className="text-xs text-amber-700">Auditoria por calendário absoluto. Foram detectados {pendingDays.length} dias pendentes:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {pendingDays.slice(0, 30).map(date => {
                   const d = new Date(date + 'T12:00:00');
                   return (
                    <Badge key={date} variant="secondary" className="cursor-pointer hover:bg-amber-200" onClick={() => setSelectedDate(date)}>
                      {isValid(d) ? format(d, "dd/MM") : '-'}
                    </Badge>
                   );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm">Seletor de Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full" />
            <div className="pt-4 border-t space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Status do Dia</span>
                {summary.isBalanced && (dailyTransactions.length > 0 || noMovementDays?.some(d => d.date === selectedDate)) ? <Badge className="bg-emerald-100 text-emerald-700">Conciliado ✓</Badge> : <Badge variant="destructive">Pendente</Badge>}
              </div>
              <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => {
                if (!selectedAccountId) return;
                setDocumentNonBlocking(doc(db!, "users", user!.uid, "bankAccounts", selectedAccountId, "noMovementDays", selectedDate), { date: selectedDate }, { merge: true })
              }}><CircleOff className="w-3 h-3" /> Marcar sem movimento</Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/30"><CardHeader className="p-3 pb-0"><CardTitle className="text-[10px] uppercase text-muted-foreground">Entradas</CardTitle></CardHeader><CardContent className="p-3"><div className="text-sm font-bold text-emerald-600">R$ {summary.statementIn.toLocaleString('pt-BR')}</div></CardContent></Card>
            <Card className="bg-muted/30"><CardHeader className="p-3 pb-0"><CardTitle className="text-[10px] uppercase text-muted-foreground">Saídas</CardTitle></CardHeader><CardContent className="p-3"><div className="text-sm font-bold text-destructive">R$ {summary.statementOut.toLocaleString('pt-BR')}</div></CardContent></Card>
            <Card className={cn("transition-colors", summary.isBalanced ? "bg-emerald-50" : "bg-destructive/5")}><CardHeader className="p-3 pb-0"><CardTitle className="text-[10px] uppercase text-muted-foreground">Resultado Geral</CardTitle></CardHeader><CardContent className="p-3 flex items-center justify-between"><div className={cn("text-lg font-bold", summary.isBalanced ? "text-emerald-700" : "text-destructive")}>{summary.isBalanced ? "Conferido" : `Dif: R$ ${(summary.diffIn - summary.diffOut).toLocaleString('pt-BR')}`}</div>{summary.isBalanced ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}</CardContent></Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4 border-b bg-muted/20"><CardTitle className="text-xs uppercase flex items-center gap-2"><Upload className="w-3 h-3" /> Extrato Bancário</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dailyTransactions.map(txn => (
                      <TableRow key={txn.id} className={cn(txn.reconciled ? "bg-emerald-50/50" : "")}>
                        <TableCell className="p-3"><div className="flex flex-col"><span className="text-xs font-bold line-clamp-1">{txn.description}</span><span className="text-[10px] text-muted-foreground">{txn.type === 'CREDIT' ? 'Entrada' : 'Saída'}</span></div></TableCell>
                        <TableCell className={cn("p-3 text-right font-bold text-xs", txn.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>R$ {Math.abs(txn.amount).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="p-3 text-right">
                          {!txn.reconciled ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setMatchingTransaction(txn); setSelectedMatchEntries([]); setEntryAdjustments({}); setIsMatchModalOpen(true); }}><ArrowRightLeft className="w-3 h-3" /></Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => undoMatch(txn)}><X className="w-3 h-3" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 border-b bg-muted/20"><CardTitle className="text-xs uppercase flex items-center gap-2"><Settings className="w-3 h-3" /> Conciliados</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dailySystemEntries.map(entry => (
                      <TableRow key={entry.id} className="bg-emerald-50/50">
                        <TableCell className="p-3"><div className="flex flex-col"><span className="text-xs font-bold line-clamp-1">{entry.description}</span><span className="text-[10px] text-muted-foreground">{(entry as any).customerName || suppliers?.find(s => s.id === (entry as any).supplierId)?.name || 'Fornecedor'}</span></div></TableCell>
                        <TableCell className={cn("p-3 text-right font-bold text-xs", entry.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>R$ {((entry as any).amount || (entry as any).originalAmount).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="p-3 text-right"><Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-700">OK</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isMatchModalOpen} onOpenChange={setIsMatchModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 border-b bg-muted/20">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-primary" />Conciliar Lançamentos</DialogTitle>
              <DialogDescription className="font-bold text-primary">
                Transação no Extrato: <span className="text-foreground">{matchingTransaction?.description}</span>
                <br />
                Valor a Conciliar: <span className="text-xl">R$ {Math.abs(matchingTransaction?.amount || 0).toLocaleString('pt-BR')}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filtrar lançamentos..." className="pl-9 h-9 text-xs" value={matchSearchTerm} onChange={e => setMatchSearchTerm(e.target.value)} />
              </div>
              <Input type="date" value={matchDateStart} onChange={e => setMatchDateStart(e.target.value)} className="h-9 text-xs" />
              <Input type="date" value={matchDateEnd} onChange={e => setMatchDateEnd(e.target.value)} className="h-9 text-xs" />
              <div className="flex gap-2">
                <Input type="number" placeholder="Min" value={matchMinValue} onChange={e => setMatchMinValue(e.target.value)} className="h-9 text-xs" />
                <Input type="number" placeholder="Max" value={matchMaxValue} onChange={e => setMatchMaxValue(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Selecione e ajuste itens para compor o valor:</div>
            {filteredOpenEntries.map(entry => {
              const partyName = entry.isPayable 
                ? suppliers?.find(s => s.id === (entry as any).supplierId)?.name || "Fornecedor não encontrado"
                : (entry as any).customerName;
              
              const isSelected = selectedMatchEntryIds.includes(entry.id);
              const baseVal = ((entry as any).amount || (entry as any).originalAmount || 0);
              const adj = entryAdjustments[entry.id];
              const finalVal = adj ? (adj.settlementAmount + adj.interest + adj.fine - adj.discount) : baseVal;
              const hasAdj = adj && (adj.interest > 0 || adj.fine > 0 || adj.discount > 0 || adj.settlementAmount < baseVal);
              
              const d = entry.dueDate ? new Date(entry.dueDate + 'T12:00:00') : null;
                
              return (
                <div 
                  key={entry.id} 
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-lg hover:border-primary/50 transition-all cursor-pointer",
                    isSelected ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-card"
                  )} 
                  onClick={() => toggleEntrySelection(entry.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{entry.description}</span>
                      <span className="text-xs text-muted-foreground font-medium">{partyName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">Venc: {d && isValid(d) ? format(d, "dd/MM/yy") : '-'}</span>
                        {hasAdj && <Badge variant="secondary" className="text-[8px] h-3 px-1 flex items-center gap-1"><Settings className="w-2 h-2" /> Com Ajustes</Badge>}
                        {adj && adj.settlementAmount < baseVal && <Badge className="text-[8px] h-3 px-1 bg-amber-100 text-amber-700 border-none">Parcial</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right flex flex-col items-end">
                      <div className={cn("font-bold text-sm", hasAdj ? "text-primary" : "")}>
                        R$ {finalVal.toLocaleString('pt-BR')}
                      </div>
                      {hasAdj && <span className="text-[9px] text-muted-foreground line-through">Total: R$ {baseVal.toLocaleString('pt-BR')}</span>}
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-primary hover:bg-primary/10" 
                      onClick={(e) => handleOpenAdjustment(e, entry)}
                    >
                      <Calculator className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {filteredOpenEntries.length === 0 && <p className="text-center py-10 text-muted-foreground text-xs">Nenhum lançamento em aberto encontrado.</p>}
          </div>

          <div className="p-6 border-t bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Itens Selecionados (com ajustes)</p>
                <div className="text-lg font-bold text-primary flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  R$ {totalSelectedInMatch.toLocaleString('pt-BR')}
                </div>
                <p className="text-[10px] text-muted-foreground">{selectedMatchEntryIds.length} item(ns) marcados</p>
              </div>

              <div className={cn(
                "p-3 rounded-lg border-2 text-center animate-in zoom-in-95",
                Math.abs(diffInMatch) < 0.01 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
              )}>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Diferença Restante</p>
                <p className={cn("text-xl font-black", Math.abs(diffInMatch) < 0.01 ? "text-emerald-700" : "text-amber-700")}>
                  R$ {diffInMatch.toLocaleString('pt-BR')}
                </p>
                <p className="text-[9px] font-medium mt-0.5">
                  {Math.abs(diffInMatch) < 0.01 ? "✓ O valor bate perfeitamente!" : "Ajuste os itens ou use pagamentos parciais."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full h-12 gap-2 text-lg shadow-lg" 
                  disabled={selectedMatchEntryIds.length === 0 || Math.abs(diffInMatch) >= 0.01}
                  onClick={() => confirmMatch(selectedMatchEntryIds)}
                >
                  <CheckCircle2 className="w-5 h-5" /> Confirmar Match
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 text-[10px] h-8" 
                    onClick={() => { 
                      if (matchingTransaction) {
                        setFormDescription(matchingTransaction.description);
                        setFormAmount(Math.abs(matchingTransaction.amount));
                        setFormIssueDate(matchingTransaction.date);
                        setFormDueDate(matchingTransaction.date);
                        setFormCategoryId("");
                        setFormSupplierId("");
                        setFormCustomerName("");
                        setFormCostCenterId("");
                      }
                      setIsDetailedCreateOpen(true); 
                    }}
                  >
                    + Novo Detalhado
                  </Button>
                  <Button variant="ghost" className="flex-1 text-[10px] h-8" onClick={() => { setSelectedMatchEntries([]); setEntryAdjustments({}); }}>Limpar Tudo</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjustmentModalOpen} onOpenChange={setIsAdjustmentModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Ajustar e Liquidar</DialogTitle>
            <DialogDescription>Configure variações ou pagamentos parciais para este item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs font-bold text-muted-foreground mb-1">{entryToAdjust?.description}</p>
              <div className="flex justify-between text-sm"><span>Valor Total:</span><span className="font-bold">R$ {((entryToAdjust?.amount || entryToAdjust?.originalAmount || 0)).toLocaleString('pt-BR')}</span></div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] uppercase font-bold text-amber-700 flex items-center gap-1"><Split className="w-3 h-3" /> Valor a Liquidar Agora (Parcial)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={tempSettlementAmount || ""} 
                onChange={e => setTempSettlementAmount(Number(e.target.value))} 
                placeholder="Valor base" 
                className="border-amber-200 focus-visible:ring-amber-500"
              />
              <p className="text-[9px] text-muted-foreground italic">O saldo restante (R$ {((entryToAdjust?.amount || entryToAdjust?.originalAmount || 0) - tempSettlementAmount).toLocaleString('pt-BR')}) continuará em aberto.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-2 border-t">
              <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold">Juros (+)</Label><Input type="number" step="0.01" value={tempAdjInterest || ""} onChange={e => setTempAdjInterest(Number(e.target.value))} placeholder="0,00" /></div>
              <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold">Multa (+)</Label><Input type="number" step="0.01" value={tempAdjFine || ""} onChange={e => setTempAdjFine(Number(e.target.value))} placeholder="0,00" /></div>
              <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold text-destructive">Desconto (-)</Label><Input type="number" step="0.01" value={tempAdjDiscount || ""} onChange={e => setTempAdjDiscount(Number(e.target.value))} placeholder="0,00" /></div>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-center">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Efetivo para Conciliação</p>
              <p className="text-2xl font-black text-primary">R$ {(tempSettlementAmount + tempAdjInterest + tempAdjFine - tempAdjDiscount).toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-11" onClick={saveSingleAdjustment}>Aplicar Ajustes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailedCreateOpen} onOpenChange={setIsDetailedCreateOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={saveDetailedEntry}>
            <DialogHeader><DialogTitle>Novo Lançamento Detalhado</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Descrição*</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Valor*</Label><Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(Number(e.target.value))} required /></div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2"><CalendarDays className="w-3 h-3" /> Data Emissão*</Label>
                  <Input type="date" value={formIssueDate} onChange={e => setFormIssueDate(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <Label>Categoria (Plano de Contas)*</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId} required>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {matchingTransaction?.type === 'DEBIT' ? (
                <div className="grid gap-2">
                  <Label className="flex justify-between items-center">Fornecedor* <Button type="button" variant="ghost" className="h-5 px-1.5 text-[10px] text-primary" onClick={() => setIsQuickSupplierOpen(true)}><UserPlus className="w-3 h-3 mr-1" /> Novo</Button></Label>
                  <Select value={formSupplierId} onValueChange={setFormSupplierId} required>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2"><Label>Origem / Cliente*</Label><Input value={formCustomerName} onChange={e => setFormCustomerName(e.target.value)} placeholder="Ex: iFood, Cliente X" required /></div>
              )}
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar e Conciliar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickSupplierOpen} onOpenChange={setIsQuickSupplierOpen}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleSaveQuickSupplier}>
            <DialogHeader>
              <DialogTitle>Novo Fornecedor Rápido</DialogTitle>
              <DialogDescription>Cadastre para avançar na conciliação.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Nome do Fornecedor</Label>
              <Input value={quickSupName} onChange={e => setQuickSupName(e.target.value)} placeholder="Ex: Mercado Central" autoFocus required />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Criar e Selecionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewAccountModalOpen} onOpenChange={setIsNewAccountModalOpen}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleSaveNewAccount}>
            <DialogHeader>
              <DialogTitle>Nova Conta Bancária</DialogTitle>
              <DialogDescription>Cadastre a conta para realizar conciliações.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Nome Identificador (Apelido)</Label><Input value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ex: Conta Principal PJ" required /></div>
              <div className="grid gap-2"><Label>Banco</Label><Input value={accBank} onChange={e => setAccBank(e.target.value)} placeholder="Ex: Itaú, Nubank, Safra" required /></div>
              <div className="grid gap-2">
                <Label>Tipo de Conta</Label>
                <Select value={accType} onValueChange={(v: any) => setAccType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corrente">Corrente</SelectItem>
                    <SelectItem value="Poupança">Poupança</SelectItem>
                    <SelectItem value="Investimento">Investimento</SelectItem>
                    <SelectItem value="Caixinha">Caixinha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Saldo Inicial (Ajuste)</Label><Input type="number" step="0.01" value={accBalance} onChange={e => setAccBalance(Number(e.target.value))} /></div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Criar Conta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Prévia da Importação</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {ofxPreview.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{t.date}</TableCell>
                    <TableCell className="text-xs">{t.memo}</TableCell>
                    <TableCell className={cn("text-xs text-right font-bold", t.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>R$ {t.amount.toLocaleString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button onClick={confirmImport} className="w-full">Confirmar Importação</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
