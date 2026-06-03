"use client";

import { useState, useMemo, useEffect } from "react";
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
  ArrowUpCircle, 
  Plus,
  Loader2,
  MoreHorizontal,
  Copy,
  Undo2,
  Pencil,
  Trash2,
  CheckCircle2,
  CalendarDays,
  History,
  Info,
  Layers
} from "lucide-react";
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
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AccountsReceivableEntry, AccountCategory } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export default function AccountsReceivablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [rootIdForHistory, setRootIdForHistory] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<AccountsReceivableEntry | null>(null);

  // Estados do formulário
  const [formCustomer, setFormCustomer] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const entriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsReceivableEntries");
  }, [db, user]);

  const historyQuery = useMemoFirebase(() => {
    if (!db || !user || !rootIdForHistory) return null;
    return query(
      collection(db, "users", user.uid, "accountsReceivableEntries"),
      where("rootEntryId", "==", rootIdForHistory)
    );
  }, [db, user, rootIdForHistory]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const { data: entries, isLoading: loadingEntries } = useCollection<AccountsReceivableEntry>(entriesQuery);
  const { data: historyItems } = useCollection<AccountsReceivableEntry>(historyQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);

  const leafCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => 
      cat.type === 'Revenue' && 
      !categories.some(child => child.parentCategoryId === cat.id)
    ).sort((a, b) => a.code.localeCompare(b.code));
  }, [categories]);

  const handleOpenNew = () => {
    setEditingEntry(null);
    setFormCustomer("");
    setFormAmount(0);
    setFormIssueDate(format(new Date(), "yyyy-MM-dd"));
    setFormDueDate("");
    setFormCategoryId("");
    setFormDescription("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (entry: AccountsReceivableEntry) => {
    setEditingEntry(entry);
    setFormCustomer(entry.customerName);
    setFormAmount(entry.amount);
    setFormIssueDate(entry.issueDate);
    setFormDueDate(entry.dueDate);
    setFormCategoryId(entry.accountCategoryId);
    setFormDescription(entry.description || "");
    setIsDialogOpen(true);
  };

  const handleDuplicate = (entry: AccountsReceivableEntry) => {
    setEditingEntry(null);
    setFormCustomer(`${entry.customerName} (Cópia)`);
    setFormAmount(entry.amount);
    setFormIssueDate(entry.issueDate);
    setFormDueDate(entry.dueDate);
    setFormCategoryId(entry.accountCategoryId);
    setFormDescription(entry.description || "");
    setIsDialogOpen(true);
    toast({ title: "Dados copiados para novo lançamento" });
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    const entryId = editingEntry ? editingEntry.id : `rec_${Date.now()}`;
    const data: any = {
      id: entryId, 
      customerName: formCustomer, 
      accountCategoryId: formCategoryId,
      description: formDescription, 
      amount: Number(formAmount), 
      issueDate: formIssueDate || format(new Date(), "yyyy-MM-dd"),
      dueDate: formDueDate,
      status: editingEntry ? editingEntry.status : 'Open', 
      updatedAt: new Date().toISOString(),
    };

    if (!editingEntry) {
      data.createdAt = new Date().toISOString();
    }

    setDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entryId), data, { merge: true });
    setIsDialogOpen(false);
    toast({ title: editingEntry ? "Recebimento atualizado!" : "Recebimento registrado!" });
  };

  const handleUnlinkPayment = (entry: AccountsReceivableEntry) => {
    if (!db || !user) return;
    if (!confirm("Deseja realmente estornar este recebimento? O status voltará para 'Em Aberto'.")) return;

    updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id), {
      status: 'Open',
      paymentDate: null,
      bankAccountId: null,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Recebimento estornado" });
  };

  const handleDelete = (entry: AccountsReceivableEntry) => {
    if (!db || !user) return;
    if (!confirm("Excluir permanentemente este registro?")) return;

    deleteDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id));
    toast({ title: "Recebimento excluído" });
  };

  const handleMarkAsPaid = (entry: AccountsReceivableEntry) => {
    if (!db || !user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id), {
      status: 'Paid',
      paymentDate: today,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Recebimento baixado com sucesso!" });
  };

  const totalOpen = entries?.filter(e => e.status === 'Open').reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const totalPaid = entries?.filter(e => e.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0) || 0;

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowUpCircle className="text-emerald-600 w-8 h-8" />
            Contas a Receber
          </h1>
          <p className="text-muted-foreground">Gestão de entradas e faturamento por canal.</p>
        </div>
        <Button className="gap-2 bg-emerald-600 shadow-lg hover:bg-emerald-700" onClick={handleOpenNew}>
          <Plus className="w-4 h-4" /> Novo Recebimento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-amber-50/50 border-amber-100">
          <CardHeader className="p-4 pb-2 text-[10px] font-bold text-amber-700 uppercase">A Receber</CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-amber-700">
            R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardHeader className="p-4 pb-2 text-[10px] font-bold text-emerald-700 uppercase">Total Recebido</CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-emerald-800">
            R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Origem / Cliente</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries?.sort((a,b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 font-bold">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        {entry.dueDate ? format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy") : '-'}
                      </div>
                      <span className="text-[9px] text-muted-foreground uppercase ml-5">Emissão: {entry.issueDate ? format(parseISO(entry.issueDate), "dd/MM") : '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span>{entry.customerName}</span>
                        {entry.rootEntryId && (
                          <Badge variant="outline" className="text-[8px] h-4 py-0 bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                            <Layers className="w-2 h-2" /> Parcial
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{entry.description}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold border-emerald-200 text-emerald-700">
                      {leafCategories.find(c => c.id === entry.accountCategoryId)?.name || 'Geral'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.status === 'Paid' ? (
                      <div className="flex flex-col">
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Recebido
                        </Badge>
                        {entry.paymentDate && (
                          <span className="text-[9px] text-emerald-600 font-bold mt-1 ml-1">
                            {format(parseISO(entry.paymentDate), "dd/MM/yy")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">Em Aberto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">
                    R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' ? (
                          <DropdownMenuItem onClick={() => handleMarkAsPaid(entry)} className="text-emerald-600 font-bold flex gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Baixar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleUnlinkPayment(entry)} className="text-amber-600 font-bold flex gap-2">
                            <Undo2 className="w-4 h-4" /> Estornar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => { setRootIdForHistory(entry.rootEntryId || entry.id); setIsHistoryOpen(true); }} className="flex gap-2">
                          <History className="w-4 h-4" /> Ver Histórico
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEdit(entry)} className="flex gap-2">
                          <Pencil className="w-4 h-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(entry)} className="flex gap-2">
                          <Copy className="w-4 h-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(entry)} className="text-destructive flex gap-2">
                          <Trash2 className="w-4 h-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!entries || entries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                    Nenhum recebimento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL DE HISTÓRICO DE PAGAMENTOS */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5 text-emerald-600" /> Histórico de Recebimentos</DialogTitle>
            <DialogDescription>Relação de todas as entradas vinculadas a este item.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / Venc.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems?.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span>Venc: {item.dueDate ? format(parseISO(item.dueDate), "dd/MM/yy") : '-'}</span>
                        {item.paymentDate && <span className="text-[10px] text-emerald-600 font-bold">Rec: {format(parseISO(item.paymentDate), "dd/MM/yy")}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'Paid' ? 'default' : 'outline'} className={cn(item.status === 'Paid' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none" : "")}>
                        {item.status === 'Paid' ? 'Recebido' : 'A Receber'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">
                      R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg flex items-start gap-3">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              O histórico mostra o desmembramento de um recebimento original quando ele é liquidado parcialmente. 
              As partes marcadas como "Recebido" já foram conciliadas no banco.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEntry}>
            <DialogHeader>
              <DialogTitle>{editingEntry ? 'Editar' : 'Novo'} Recebimento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Origem (Canal de Venda / Cliente)*</Label>
                <Input 
                  value={formCustomer} 
                  onChange={e => setFormCustomer(e.target.value)} 
                  placeholder="Ex: iFood, Balcão, WhatsApp..." 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor*</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formAmount || ""} 
                    onChange={e => setFormAmount(Number(e.target.value))} 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Data Emissão*</Label>
                  <Input 
                    type="date" 
                    value={formIssueDate} 
                    onChange={e => setFormIssueDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-2">
                  <Label>Vencimento*</Label>
                  <Input 
                    type="date" 
                    value={formDueDate} 
                    onChange={e => setFormDueDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Categoria (Receita)*</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leafCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Input 
                  value={formDescription} 
                  onChange={e => setFormDescription(e.target.value)} 
                  placeholder="Opcional..." 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                Salvar Recebimento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
