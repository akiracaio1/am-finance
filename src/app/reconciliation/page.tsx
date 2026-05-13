
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
  RefreshCw,
  Search,
  Check,
  X,
  PlusCircle,
  ArrowRightLeft,
  Loader2,
  Calendar,
  AlertTriangle,
  Settings,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  CircleOff,
  SearchIcon,
  UserPlus,
  FileText,
  Filter,
  RotateCcw
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
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
  EntryType
} from "@/lib/types";
import { format, addDays, isBefore, isSameDay, subDays, parseISO, eachDayOfInterval, isAfter, max } from "date-fns";
import { parseOFX, OFXTransaction } from "@/lib/ofx-parser";
import { cn } from "@/lib/utils";

export default function ReconciliationPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isDetailedCreateOpen, setIsDetailedCreateOpen] = useState(false);
  const [matchingTransaction, setMatchingTransaction] = useState<BankTransaction | null>(null);
  
  const [ofxPreview, setOfxPreview] = useState<OFXTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos Filtros do Modal
  const [matchSearchTerm, setMatchSearchTerm] = useState("");
  const [matchDateStart, setMatchDateStart] = useState("");
  const [matchDateEnd, setMatchDateEnd] = useState("");
  const [matchMinValue, setMatchMinValue] = useState<string>("");
  const [matchMaxValue, setMatchMaxValue] = useState<string>("");

  // Form states for detailed creation
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");

  // Queries
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

  const { data: accounts, isLoading: accountsLoading } = useCollection<BankAccount>(accountsQuery);
  const { data: allTransactions } = useCollection<BankTransaction>(transactionsQuery);
  const { data: noMovementDays } = useCollection<{date: string}>(noMovementQuery);
  const { data: allPayables } = useCollection<AccountsPayableEntry>(payablesQuery);
  const { data: allReceivables } = useCollection<AccountsReceivableEntry>(receivablesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const leafCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => !categories.some(child => child.parentCategoryId === cat.id));
  }, [categories]);

  useEffect(() => {
    if (accounts?.length === 1 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = useMemo(() => accounts?.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  const dailyTransactions = useMemo(() => {
    return allTransactions?.filter(t => t.date === selectedDate) || [];
  }, [allTransactions, selectedDate]);

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

  // Aplicação dos filtros do Modal
  const filteredOpenEntries = useMemo(() => {
    if (!matchingTransaction) return [];
    return openSystemEntries.filter(e => {
      // Filtro de Tipo (Sempre obrigatório)
      if (e.type !== matchingTransaction.type) return false;

      // Filtro de Texto (Busca na descrição ou nomes)
      if (matchSearchTerm) {
        const term = matchSearchTerm.toLowerCase();
        const desc = e.description.toLowerCase();
        const customer = (e as any).customerName?.toLowerCase() || "";
        const supplier = suppliers?.find(s => s.id === (e as any).supplierId)?.name.toLowerCase() || "";
        if (!desc.includes(term) && !customer.includes(term) && !supplier.includes(term)) return false;
      }

      // Filtro de Datas
      if (matchDateStart && e.dueDate < matchDateStart) return false;
      if (matchDateEnd && e.dueDate > matchDateEnd) return false;

      // Filtro de Valores
      const val = e.amount || (e as any).originalAmount || 0;
      if (matchMinValue && val < Number(matchMinValue)) return false;
      if (matchMaxValue && val > Number(matchMaxValue)) return false;

      return true;
    }).sort((a, b) => {
      // Prioridade 1: Mesmo valor exato
      const aVal = a.amount || (a as any).originalAmount || 0;
      const bVal = b.amount || (b as any).originalAmount || 0;
      const targetVal = Math.abs(matchingTransaction.amount);
      const aMatchVal = Math.abs(aVal - targetVal) < 0.01;
      const bMatchVal = Math.abs(bVal - targetVal) < 0.01;
      if (aMatchVal && !bMatchVal) return -1;
      if (!aMatchVal && bMatchVal) return 1;

      // Prioridade 2: Mesma data
      if (a.dueDate === matchingTransaction.date && b.dueDate !== matchingTransaction.date) return -1;
      if (a.dueDate !== matchingTransaction.date && b.dueDate === matchingTransaction.date) return 1;

      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [openSystemEntries, matchingTransaction, matchSearchTerm, matchDateStart, matchDateEnd, matchMinValue, matchMaxValue, suppliers]);

  const pendingDays = useMemo(() => {
    if (!selectedAccount || !allTransactions || !noMovementDays || !allPayables || !allReceivables) return [];
    
    // Marco inicial solicitado pelo usuário: 01/05/2026
    const alertStart = new Date("2026-05-01T12:00:00");
    const accountStart = parseISO(selectedAccount.openingDate);
    const start = max([alertStart, accountStart]);
    
    // O fim da análise deve ser a maior data entre (hoje - 1) e a última transação importada (para suportar testes em 2026)
    const today = new Date();
    let lastActivityDate = subDays(today, 1);

    if (allTransactions.length > 0) {
      const allDates = allTransactions.map(t => parseISO(t.date));
      const maxTxnDate = max(allDates);
      if (isAfter(maxTxnDate, lastActivityDate)) {
        lastActivityDate = maxTxnDate;
      }
    }

    const end = lastActivityDate;
    
    if (isBefore(end, start)) return [];

    const interval = eachDayOfInterval({ start, end });
    return interval.filter(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isMarkedNoMovement = noMovementDays.some(d => d.date === dateStr);
      const dayTransactions = allTransactions.filter(t => t.date === dateStr);
      const hasTransactions = dayTransactions.length > 0;

      // Pendência 1: Sem dados (OFX ou Marcação)
      if (!hasTransactions && !isMarkedNoMovement) return true;

      // Pendência 2: OFX Importado mas não balanceado (Resultado Geral não é Conferido)
      if (hasTransactions) {
        const statementIn = dayTransactions.filter(t => t.type === 'CREDIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0);
        const statementOut = Math.abs(dayTransactions.filter(t => t.type === 'DEBIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0));
        
        const systemIn = allReceivables.filter(r => r.paymentDate === dateStr && r.bankAccountId === selectedAccountId && r.status === 'Paid')
          .reduce((acc, e) => acc + e.amount, 0);
        
        const systemOut = allPayables.filter(p => p.paymentDate === dateStr && p.bankAccountId === selectedAccountId && p.status === 'Paid')
          .reduce((acc, p) => acc + (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0)), 0);

        const isBalanced = Math.abs(statementIn - systemIn) < 0.01 && Math.abs(statementOut - systemOut) < 0.01;
        return !isBalanced;
      }

      return false;
    }).map(day => format(day, "yyyy-MM-dd")).reverse();
  }, [selectedAccount, allTransactions, noMovementDays, allPayables, allReceivables, selectedAccountId]);

  const summary = useMemo(() => {
    const statementIn = dailyTransactions.filter(t => t.type === 'CREDIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0);
    const statementOut = Math.abs(dailyTransactions.filter(t => t.type === 'DEBIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0));
    
    const systemIn = dailySystemEntries.filter(e => e.type === 'CREDIT').reduce((acc, e) => acc + (e.amount || (e as any).originalAmount || 0), 0);
    const systemOut = dailySystemEntries.filter(e => e.type === 'DEBIT').reduce((acc, e) => {
      const p = e as any;
      const value = p.originalAmount !== undefined 
        ? (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0))
        : (p.amount || 0);
      return acc + value;
    }, 0);

    return {
      statementIn,
      statementOut,
      systemIn,
      systemOut,
      diffIn: statementIn - systemIn,
      diffOut: statementOut - systemOut,
      isBalanced: Math.abs(statementIn - systemIn) < 0.01 && Math.abs(statementOut - systemOut) < 0.01
    };
  }, [dailyTransactions, dailySystemEntries]);

  const handleOFXFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const transactions = parseOFX(text);
    setOfxPreview(transactions);
    setIsImportModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmImport = () => {
    if (!db || !user || !selectedAccountId) return;
    ofxPreview.forEach(t => {
      const transactionId = `txn_${t.fitId}_${selectedAccountId}`;
      const data: BankTransaction = {
        id: transactionId,
        date: t.date,
        amount: t.amount,
        description: t.memo,
        type: t.type,
        reconciled: false,
        reconciledEntryId: null,
        fitId: t.fitId,
        bankAccountId: selectedAccountId
      };
      setDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", transactionId), data, { merge: true });
    });
    setIsImportModalOpen(false);
    toast({ title: "Importação concluída", description: `${ofxPreview.length} transações processadas.` });
  };

  const handleIgnore = (txn: BankTransaction) => {
    if (!db || !user || !selectedAccountId) return;
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", txn.id), { 
      ignored: !txn.ignored 
    });
  };

  const handleUndoReconciliation = (txn: BankTransaction) => {
    if (!db || !user || !selectedAccountId || !txn.reconciledEntryId) return;

    const entryId = txn.reconciledEntryId;
    const isPayable = txn.type === 'DEBIT';
    const col = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";

    // 1. Atualizar transação bancária
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", txn.id), {
      reconciled: false,
      reconciledEntryId: null
    });

    // 2. Atualizar lançamento no sistema
    updateDocumentNonBlocking(doc(db, "users", user.uid, col, entryId), {
      status: 'Open',
      paymentDate: null,
      bankAccountId: null
    });

    toast({ title: "Conciliação desfeita", description: "O lançamento voltou ao status 'Em Aberto'." });
  };

  const openMatchSearch = (txn: BankTransaction) => {
    setMatchingTransaction(txn);
    setMatchSearchTerm("");
    setMatchDateStart("");
    setMatchDateEnd("");
    setMatchMinValue("");
    setMatchMaxValue("");
    setIsMatchModalOpen(true);
  };

  const confirmMatch = (entryId: string) => {
    if (!db || !user || !selectedAccountId || !matchingTransaction) return;

    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", matchingTransaction.id), {
      reconciled: true,
      reconciledEntryId: entryId
    });

    const isPayable = matchingTransaction.type === 'DEBIT';
    const collectionName = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";
    updateDocumentNonBlocking(doc(db, "users", user.uid, collectionName, entryId), {
      status: 'Paid',
      paymentDate: matchingTransaction.date,
      bankAccountId: selectedAccountId
    });

    setIsMatchModalOpen(false);
    toast({ title: "Conciliado com sucesso!" });
  };

  const handleDetailedCreate = () => {
    if (!matchingTransaction) return;
    setFormDescription(matchingTransaction.description);
    setFormAmount(Math.abs(matchingTransaction.amount));
    setFormDueDate(matchingTransaction.date);
    setFormSupplierId("");
    setFormCustomerName("");
    setFormCategoryId("");
    setIsDetailedCreateOpen(true);
  };

  const saveDetailedEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !matchingTransaction) return;

    const id = `pay_${Date.now()}`;
    const isPayable = matchingTransaction.type === 'DEBIT';
    const col = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";
    
    const data: any = {
      id,
      description: formDescription,
      [isPayable ? "originalAmount" : "amount"]: formAmount,
      dueDate: formDueDate,
      status: 'Paid',
      paymentDate: matchingTransaction.date,
      bankAccountId: selectedAccountId,
      accountCategoryId: formCategoryId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isPayable) {
      data.supplierId = formSupplierId;
      data.entryType = "Confirmed" as EntryType;
    } else {
      data.customerName = formCustomerName;
    }

    setDocumentNonBlocking(doc(db, "users", user.uid, col, id), data, { merge: true });
    confirmMatch(id);
    setIsDetailedCreateOpen(false);
  };

  const handleNoMovement = () => {
    if (!db || !user || !selectedAccountId) return;
    const dateRef = doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "noMovementDays", selectedDate);
    setDocumentNonBlocking(dateRef, { date: selectedDate }, { merge: true });
    toast({ title: "Dia marcado como sem movimento." });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Link2 className="text-primary w-8 h-8" />
            Conciliação Bancária
          </h1>
          <p className="text-muted-foreground">Sincronia profissional entre extrato e gestão.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bank})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isAccountManagerOpen} onOpenChange={setIsAccountManagerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon"><Settings className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Gerenciar Contas Bancárias</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget as HTMLFormElement);
                  const accId = `acc_${Date.now()}`;
                  const data = {
                    id: accId,
                    name: formData.get("name"),
                    bank: formData.get("bank"),
                    type: formData.get("type"),
                    initialBalance: Number(formData.get("balance")),
                    openingDate: formData.get("date"),
                    createdAt: new Date().toISOString()
                  };
                  setDocumentNonBlocking(doc(db!, "users", user!.uid, "bankAccounts", accId), data, { merge: true });
                  toast({ title: "Conta cadastrada!" });
                  (e.currentTarget as HTMLFormElement).reset();
                }} className="space-y-3 p-3 bg-muted rounded-lg">
                  <Input name="name" placeholder="Nome da Conta (ex: Principal)" required />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="bank" placeholder="Banco (ex: Itaú)" required />
                    <Select name="type" defaultValue="Corrente">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Corrente">Corrente</SelectItem>
                        <SelectItem value="Poupança">Poupança</SelectItem>
                        <SelectItem value="Investimento">Investimento</SelectItem>
                        <SelectItem value="Caixinha">Caixinha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="balance" type="number" step="0.01" placeholder="Saldo Inicial" required />
                    <Input name="date" type="date" required />
                  </div>
                  <Button type="submit" className="w-full">Adicionar Conta</Button>
                </form>
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {accounts?.map(acc => (
                    <div key={acc.id} className="flex justify-between items-center p-2 border rounded">
                      <div className="text-xs">
                        <p className="font-bold">{acc.name} - {acc.bank}</p>
                        <p className="text-muted-foreground">Saldo: R$ {acc.initialBalance.toLocaleString('pt-BR')}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "bankAccounts", acc.id))}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button disabled={!selectedAccountId} onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" /> Importar OFX
          </Button>
          <input type="file" accept=".ofx" className="hidden" ref={fileInputRef} onChange={handleOFXFileChange} />
        </div>
      </div>

      {pendingDays.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-4 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-1" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900">Pendências Detectadas</h4>
              <p className="text-xs text-amber-700">Os seguintes dias possuem pendências (falta OFX ou saldo divergente):</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {pendingDays.slice(0, 15).map(date => (
                  <Badge key={date} variant="secondary" className="cursor-pointer hover:bg-amber-200" onClick={() => setSelectedDate(date)}>
                    {format(parseISO(date), "dd/MM")}
                  </Badge>
                ))}
                {pendingDays.length > 15 && <span className="text-[10px] text-muted-foreground self-center">... e mais {pendingDays.length - 15} dias</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm">Seletor de Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dia para conciliação</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full" />
            </div>
            <div className="pt-4 border-t space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Status do Dia</span>
                {summary.isBalanced ? (
                  <Badge className="bg-emerald-100 text-emerald-700">Conciliado ✓</Badge>
                ) : (
                  <Badge variant="destructive">Pendente</Badge>
                )}
              </div>
              <Button variant="outline" className="w-full gap-2 text-xs" onClick={handleNoMovement}>
                <CircleOff className="w-3 h-3" /> Marcar sem movimento
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/30">
              <CardHeader className="p-3 pb-0"><CardTitle className="text-[10px] uppercase text-muted-foreground">Entradas</CardTitle></CardHeader>
              <CardContent className="p-3">
                <div className="flex justify-between items-end">
                  <div className="text-sm font-bold text-emerald-600">B: R$ {summary.statementIn.toLocaleString('pt-BR')}</div>
                  <div className="text-[10px] text-muted-foreground">S: R$ {summary.systemIn.toLocaleString('pt-BR')}</div>
                </div>
                {Math.abs(summary.diffIn) > 0.01 && <div className="text-[10px] font-bold text-destructive mt-1">Dif: R$ {summary.diffIn.toLocaleString('pt-BR')}</div>}
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardHeader className="p-3 pb-0"><CardTitle className="text-[10px] uppercase text-muted-foreground">Saídas</CardTitle></CardHeader>
              <CardContent className="p-3">
                <div className="flex justify-between items-end">
                  <div className="text-sm font-bold text-destructive">B: R$ {summary.statementOut.toLocaleString('pt-BR')}</div>
                  <div className="text-[10px] text-muted-foreground">S: R$ {summary.systemOut.toLocaleString('pt-BR')}</div>
                </div>
                {Math.abs(summary.diffOut) > 0.01 && <div className="text-[10px] font-bold text-destructive mt-1">Dif: R$ {summary.diffOut.toLocaleString('pt-BR')}</div>}
              </CardContent>
            </Card>
            <Card className={cn("transition-colors", summary.isBalanced ? "bg-emerald-50" : "bg-destructive/5")}>
              <CardHeader className="p-3 pb-0"><CardTitle className="text-[10px] uppercase text-muted-foreground">Resultado Geral</CardTitle></CardHeader>
              <CardContent className="p-3 flex items-center justify-between">
                <div className={cn("text-lg font-bold", summary.isBalanced ? "text-emerald-700" : "text-destructive")}>
                  {summary.isBalanced ? "Conferido" : `R$ ${(summary.diffIn - summary.diffOut).toLocaleString('pt-BR')}`}
                </div>
                {summary.isBalanced ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4 border-b bg-muted/20"><CardTitle className="text-xs uppercase flex items-center gap-2"><Upload className="w-3 h-3" /> Extrato Bancário (OFX)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dailyTransactions.length === 0 ? (
                      <TableRow><TableCell className="text-center py-10 text-muted-foreground italic text-xs">Sem transações para este dia.</TableCell></TableRow>
                    ) : (
                      dailyTransactions.map(txn => (
                        <TableRow key={txn.id} className={cn(txn.reconciled ? "bg-emerald-50/50" : txn.ignored ? "opacity-40" : "")}>
                          <TableCell className="p-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold line-clamp-1">{txn.description}</span>
                              <span className="text-[10px] text-muted-foreground">{txn.type === 'CREDIT' ? 'Entrada' : 'Saída'}</span>
                            </div>
                          </TableCell>
                          <TableCell className={cn("p-3 text-right font-bold text-xs", txn.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>
                            R$ {Math.abs(txn.amount).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="p-3 text-right">
                            {!txn.reconciled && !txn.ignored ? (
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openMatchSearch(txn)} title="Conciliar"><ArrowRightLeft className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleIgnore(txn)} title="Ignorar"><CircleOff className="w-3 h-3" /></Button>
                              </div>
                            ) : txn.reconciled ? (
                              <div className="flex justify-end items-center gap-2">
                                <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">OK</Badge>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleUndoReconciliation(txn)} title="Desfazer Conciliação"><X className="w-3 h-3" /></Button>
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleIgnore(txn)}><RefreshCw className="w-3 h-3" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 border-b bg-muted/20"><CardTitle className="text-xs uppercase flex items-center gap-2"><Settings className="w-3 h-3" /> Conciliados no Dia</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dailySystemEntries.length === 0 ? (
                      <TableRow><TableCell className="text-center py-10 text-muted-foreground italic text-xs">Sem baixas conciliadas nesta data.</TableCell></TableRow>
                    ) : (
                      dailySystemEntries.map(entry => {
                        const p = entry as any;
                        const value = p.originalAmount !== undefined 
                          ? (p.originalAmount + (p.interest || 0) + (p.fine || 0) - (p.discount || 0))
                          : (p.amount || 0);
                          
                        return (
                          <TableRow key={entry.id} className="bg-emerald-50/50">
                            <TableCell className="p-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold line-clamp-1">{entry.description}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {(entry as any).customerName || suppliers?.find(s => s.id === (entry as any).supplierId)?.name || 'Outros'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className={cn("p-3 text-right font-bold text-xs", entry.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>
                              R$ {value.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="p-3 text-right">
                              <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-700">OK</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de Busca para Conciliação com Filtros */}
      <Dialog open={isMatchModalOpen} onOpenChange={setIsMatchModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 border-b bg-muted/20">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Conciliar: {matchingTransaction?.description}
              </DialogTitle>
              <DialogDescription className="font-bold text-primary">
                Valor do Extrato: R$ {Math.abs(matchingTransaction?.amount || 0).toLocaleString('pt-BR')} | 
                Data: {matchingTransaction ? format(parseISO(matchingTransaction.date), "dd/MM/yy") : ''}
              </DialogDescription>
            </DialogHeader>

            {/* Sessão de Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6 p-4 bg-background border rounded-lg shadow-sm">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Busca Rápida</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Descrição, fornecedor..." className="pl-8 h-9" value={matchSearchTerm} onChange={e => setMatchSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Valor Mín.</Label>
                <Input type="number" placeholder="R$ 0,00" className="h-9" value={matchMinValue} onChange={e => setMatchMinValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Valor Máx.</Label>
                <Input type="number" placeholder="R$ 0,00" className="h-9" value={matchMaxValue} onChange={e => setMatchMaxValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Início Venc.</Label>
                <Input type="date" className="h-9" value={matchDateStart} onChange={e => setMatchDateStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fim Venc.</Label>
                <Input type="date" className="h-9" value={matchDateEnd} onChange={e => setMatchDateEnd(e.target.value)} />
              </div>
              <div className="flex items-end md:col-span-2 gap-2">
                <Button variant="ghost" className="h-9 gap-2 text-xs" onClick={() => {
                  setMatchSearchTerm(""); setMatchDateStart(""); setMatchDateEnd(""); setMatchMinValue(""); setMatchMaxValue("");
                }}><RotateCcw className="w-3 h-3" /> Limpar Filtros</Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Filter className="w-3 h-3" /> Itens Disponíveis ({filteredOpenEntries.length})
            </h4>
            <div className="grid gap-2">
              {filteredOpenEntries.map(entry => {
                const entryVal = entry.amount || (entry as any).originalAmount || 0;
                const isExactMatch = Math.abs(entryVal - Math.abs(matchingTransaction?.amount || 0)) < 0.01;
                
                return (
                  <div key={entry.id} className={cn(
                    "flex items-center justify-between p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 cursor-pointer group transition-all",
                    isExactMatch ? "bg-emerald-50/30 border-emerald-200" : ""
                  )} onClick={() => confirmMatch(entry.id)}>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{entry.description}</span>
                        {isExactMatch && <Badge className="bg-emerald-100 text-emerald-700 text-[8px] h-4">Valor Exato</Badge>}
                        {entry.dueDate === matchingTransaction?.date && <Badge className="bg-primary/10 text-primary text-[8px] h-4">Mesmo Dia</Badge>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Vencimento: {format(parseISO(entry.dueDate), "dd/MM/yy")} | {entry.type === 'CREDIT' ? 'Receber' : 'Pagar'}</span>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold", isExactMatch ? "text-emerald-700" : "")}>R$ {entryVal.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">Clique para vincular <ArrowRightLeft className="w-3 h-3" /></p>
                    </div>
                  </div>
                );
              })}
              
              {filteredOpenEntries.length === 0 && (
                <div className="text-center py-10 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">Nenhum lançamento em aberto encontrado para os filtros aplicados.</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t bg-muted/10 space-y-4">
             <div className="flex flex-col gap-2">
                <p className="text-xs text-center text-muted-foreground">Não encontrou o lançamento? Crie um agora:</p>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" variant="outline" onClick={() => {
                    if (!db || !user || !matchingTransaction) return;
                    const id = `pay_${Date.now()}`;
                    const isPayable = matchingTransaction.type === 'DEBIT';
                    const col = isPayable ? "accountsPayableEntries" : "accountsReceivableEntries";
                    const data: any = {
                      id,
                      description: matchingTransaction.description,
                      [isPayable ? "originalAmount" : "amount"]: Math.abs(matchingTransaction.amount),
                      dueDate: matchingTransaction.date,
                      status: 'Paid',
                      paymentDate: matchingTransaction.date,
                      bankAccountId: selectedAccountId,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      accountCategoryId: "none"
                    };
                    if (isPayable) { data.supplierId = "none"; data.entryType = "Confirmed"; } 
                    else { data.customerName = "Venda Rápida"; }
                    setDocumentNonBlocking(doc(db, "users", user.uid, col, id), data, { merge: true });
                    confirmMatch(id);
                  }}>
                    <PlusCircle className="w-4 h-4" /> Lançamento Rápido
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleDetailedCreate}>
                    <FileText className="w-4 h-4" /> Lançamento Detalhado
                  </Button>
                </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailedCreateOpen} onOpenChange={setIsDetailedCreateOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={saveDetailedEntry}>
            <DialogHeader>
              <DialogTitle>Novo Lançamento Detalhado</DialogTitle>
              <DialogDescription>Preencha os dados para salvar e conciliar com o extrato.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Descrição*</Label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor*</Label>
                  <Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(Number(e.target.value))} required />
                </div>
                <div className="grid gap-2">
                  <Label>Vencimento*</Label>
                  <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Categoria*</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId} required>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {matchingTransaction?.type === 'DEBIT' ? (
                <div className="grid gap-2">
                  <Label>Fornecedor*</Label>
                  <Select value={formSupplierId} onValueChange={setFormSupplierId} required>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.sort((a,b) => a.name.localeCompare(b.name)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Origem / Cliente*</Label>
                  <Input value={formCustomerName} onChange={e => setFormCustomerName(e.target.value)} placeholder="Ex: iFood, Cliente X" required />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDetailedCreateOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar e Conciliar</Button>
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
                    <TableCell className="text-xs">{format(parseISO(t.date), "dd/MM/yy")}</TableCell>
                    <TableCell className="text-xs font-medium">{t.memo}</TableCell>
                    <TableCell className={cn("text-xs text-right font-bold", t.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>
                      R$ {t.amount.toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmImport}>Confirmar Importação de {ofxPreview.length} Itens</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
