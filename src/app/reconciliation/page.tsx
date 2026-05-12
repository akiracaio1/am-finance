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
  SearchIcon
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
  Supplier
} from "@/lib/types";
import { format, addDays, isBefore, isSameDay, subDays, parseISO, eachDayOfInterval } from "date-fns";
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
  const [matchingTransaction, setMatchingTransaction] = useState<BankTransaction | null>(null);
  
  const [ofxPreview, setOfxPreview] = useState<OFXTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Selecionar conta automaticamente se houver apenas uma
  useEffect(() => {
    if (accounts?.length === 1 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = useMemo(() => accounts?.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  // Filtrar dados do dia selecionado
  const dailyTransactions = useMemo(() => {
    return allTransactions?.filter(t => t.date === selectedDate) || [];
  }, [allTransactions, selectedDate]);

  const dailySystemEntries = useMemo(() => {
    const payables = allPayables?.filter(p => p.dueDate === selectedDate) || [];
    const receivables = allReceivables?.filter(r => r.dueDate === selectedDate) || [];
    return [
      ...payables.map(p => ({ ...p, type: 'DEBIT' as const, isPayable: true })),
      ...receivables.map(r => ({ ...r, type: 'CREDIT' as const, isPayable: false }))
    ];
  }, [allPayables, allReceivables, selectedDate]);

  // Identificar dias pendentes
  const pendingDays = useMemo(() => {
    if (!selectedAccount || !allTransactions || !noMovementDays) return [];
    
    const today = new Date();
    const start = parseISO(selectedAccount.openingDate);
    const end = subDays(today, 1);
    
    if (isBefore(end, start)) return [];

    const interval = eachDayOfInterval({ start, end });
    return interval.filter(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const hasTransactions = allTransactions.some(t => t.date === dateStr);
      const isMarkedNoMovement = noMovementDays.some(d => d.date === dateStr);
      return !hasTransactions && !isMarkedNoMovement;
    }).map(day => format(day, "yyyy-MM-dd")).reverse().slice(0, 5); // Mostrar os últimos 5
  }, [selectedAccount, allTransactions, noMovementDays]);

  // Totais e Diferenças
  const summary = useMemo(() => {
    const statementIn = dailyTransactions.filter(t => t.type === 'CREDIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0);
    const statementOut = Math.abs(dailyTransactions.filter(t => t.type === 'DEBIT' && !t.ignored).reduce((acc, t) => acc + t.amount, 0));
    
    const systemIn = dailySystemEntries.filter(e => e.type === 'CREDIT').reduce((acc, e) => acc + (e.amount || (e as any).originalAmount || 0), 0);
    const systemOut = dailySystemEntries.filter(e => e.type === 'DEBIT').reduce((acc, e) => acc + (e.amount || (e as any).originalAmount || 0), 0);

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

  // OFX Import Handlers
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

  // Conciliation Actions
  const handleIgnore = (txn: BankTransaction) => {
    if (!db || !user || !selectedAccountId) return;
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", txn.id), { 
      ignored: !txn.ignored 
    });
  };

  const openMatchSearch = (txn: BankTransaction) => {
    setMatchingTransaction(txn);
    setIsMatchModalOpen(true);
  };

  const confirmMatch = (entryId: string) => {
    if (!db || !user || !selectedAccountId || !matchingTransaction) return;

    // Atualizar transação bancária
    updateDocumentNonBlocking(doc(db, "users", user.uid, "bankAccounts", selectedAccountId, "bankTransactions", matchingTransaction.id), {
      reconciled: true,
      reconciledEntryId: entryId
    });

    // Atualizar lançamento no sistema
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
                  const formData = new FormData(e.currentTarget);
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
                  e.currentTarget.reset();
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
              <p className="text-xs text-amber-700">Os seguintes dias não possuem OFX importado nem marcação de movimento:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {pendingDays.map(date => (
                  <Badge key={date} variant="secondary" className="cursor-pointer hover:bg-amber-200" onClick={() => setSelectedDate(date)}>
                    {format(parseISO(date), "dd/MM")}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Seletor de Data</CardTitle>
          </CardHeader>
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
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-xs uppercase flex items-center gap-2">
                  <Upload className="w-3 h-3" /> Extrato Bancário (OFX)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dailyTransactions.length === 0 ? (
                      <TableRow><TableCell className="text-center py-10 text-muted-foreground italic text-xs">Sem transações de extrato para este dia.</TableCell></TableRow>
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
                              <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">OK</Badge>
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
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-xs uppercase flex items-center gap-2">
                  <Settings className="w-3 h-3" /> Lançamentos no Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {dailySystemEntries.length === 0 ? (
                      <TableRow><TableCell className="text-center py-10 text-muted-foreground italic text-xs">Sem lançamentos registrados neste dia.</TableCell></TableRow>
                    ) : (
                      dailySystemEntries.map(entry => (
                        <TableRow key={entry.id} className={cn(entry.status === 'Paid' ? "bg-emerald-50/50" : "")}>
                          <TableCell className="p-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold line-clamp-1">{entry.description}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {(entry as any).customerName || suppliers?.find(s => s.id === (entry as any).supplierId)?.name || 'Outros'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={cn("p-3 text-right font-bold text-xs", entry.type === 'CREDIT' ? "text-emerald-600" : "text-destructive")}>
                            R$ {(entry.amount || (entry as any).originalAmount || 0).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="p-3 text-right">
                            {entry.status === 'Paid' ? (
                              <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-700">Baixado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">Aberto</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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

      <Dialog open={isMatchModalOpen} onOpenChange={setIsMatchModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conciliar: {matchingTransaction?.description}</DialogTitle>
            <DialogDescription>
              Valor: R$ {Math.abs(matchingTransaction?.amount || 0).toLocaleString('pt-BR')} | 
              Data: {matchingTransaction ? format(parseISO(matchingTransaction.date), "dd/MM/yyyy") : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground border-b pb-2">Sugestões e Busca</h4>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {dailySystemEntries
                .filter(e => e.status !== 'Paid' && e.type === matchingTransaction?.type)
                .map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => confirmMatch(entry.id)}>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{entry.description}</span>
                      <span className="text-[10px] text-muted-foreground">{entry.type === 'CREDIT' ? 'Receber' : 'Pagar'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">R$ {(entry.amount || (entry as any).originalAmount || 0).toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-primary flex items-center justify-end gap-1">Clique para vincular <ArrowRightLeft className="w-3 h-3" /></p>
                    </div>
                  </div>
                ))}
              
              <div className="pt-6 border-t">
                <p className="text-xs text-center text-muted-foreground mb-4">Ou crie um novo lançamento com esses dados:</p>
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
                    };
                    
                    if (isPayable) {
                      data.supplierId = "none";
                      data.accountCategoryId = "none";
                      data.entryType = "Confirmed";
                    } else {
                      data.customerName = "Venda Rápida";
                      data.accountCategoryId = "none";
                    }

                    setDocumentNonBlocking(doc(db, "users", user.uid, col, id), data, { merge: true });
                    confirmMatch(id);
                  }}>
                    <PlusCircle className="w-4 h-4" /> Criar Lançamento Rápido
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
