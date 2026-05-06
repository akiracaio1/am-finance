
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
  CheckCircle2, 
  Calendar,
  Plus,
  Loader2,
  Trash2,
  Check,
  ChevronDown,
  AlertTriangle,
  CreditCard,
  Clock
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
import { toast } from "@/hooks/use-toast";
import { Supplier, AccountCategory, CostCenter, AccountsPayableEntry } from "@/lib/types";

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [filterStatus, setFilterStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    // Definir a data de hoje no formato YYYY-MM-DD para comparações consistentes
    setTodayStr(new Date().toISOString().split('T')[0]);
  }, []);

  // Firestore Queries
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

  const { data: entries, isLoading: entriesLoading } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);
  const { data: centers } = useCollection<CostCenter>(centersQuery);

  // Função para calcular o status dinamicamente
  const getDynamicStatus = (entry: AccountsPayableEntry) => {
    if (entry.status === 'Paid') return 'Paid';
    if (!todayStr) return entry.status;

    if (entry.dueDate < todayStr) return 'Overdue';
    if (entry.dueDate === todayStr) return 'DueToday';
    return 'Open';
  };

  const processedEntries = entries?.map(entry => ({
    ...entry,
    dynamicStatus: getDynamicStatus(entry)
  })) || [];

  const filteredEntries = processedEntries.filter(e => {
    if (filterStatus === 'all') return true;
    return e.dynamicStatus.toLowerCase() === filterStatus.toLowerCase();
  });

  // Cálculos baseados nos status dinâmicos
  const totalOverdue = processedEntries.filter(e => e.dynamicStatus === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalDueToday = processedEntries.filter(e => e.dynamicStatus === 'DueToday').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalOpen = processedEntries.filter(e => e.dynamicStatus === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0);
  const totalPaid = processedEntries.filter(e => e.dynamicStatus === 'Paid').reduce((acc, curr) => acc + curr.originalAmount, 0);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;

    const formData = new FormData(e.currentTarget);
    const entryId = `pay_${Date.now()}`;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryId);

    const newEntry: AccountsPayableEntry = {
      id: entryId,
      supplierId: formData.get("supplierId") as string,
      accountCategoryId: formData.get("categoryId") as string,
      costCenterId: (formData.get("costCenterId") as string) || "",
      description: formData.get("description") as string,
      originalAmount: Number(formData.get("amount")),
      issueDate: formData.get("issueDate") as string,
      dueDate: formData.get("dueDate") as string,
      paymentMethod: formData.get("paymentMethod") as string,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(entryRef, newEntry, { merge: true });
    toast({ title: "Lançamento criado", description: "A conta foi agendada com sucesso." });
    setIsDialogOpen(false);
  };

  const markAsPaid = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    updateDocumentNonBlocking(entryRef, { status: 'Paid', updatedAt: new Date().toISOString() });
    toast({ title: "Conta Paga", description: `Pagamento de ${entry.description} registrado.` });
  };

  const deleteEntry = (entry: AccountsPayableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entry.id);
    deleteDocumentNonBlocking(entryRef);
    toast({ title: "Lançamento removido", description: "O registro foi excluído permanentemente." });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'Overdue':
        return <Badge variant="destructive" className="border-none animate-pulse"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
      case 'DueToday':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none"><Clock className="w-3 h-3 mr-1" /> Vence Hoje</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Calendar className="w-3 h-3 mr-1" /> Aberto</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowDownCircle className="text-destructive w-8 h-8" />
            Contas a Pagar
          </h1>
          <p className="text-muted-foreground">Gestão inteligente de despesas e prazos.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSaveEntry}>
              <DialogHeader>
                <DialogTitle>Novo Lançamento de Despesa</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição / Item *</Label>
                  <Input id="description" name="description" placeholder="Ex: Compra de Insumos" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Valor (R$) *</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" placeholder="0,00" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                    <Select name="paymentMethod">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="issueDate">Data de Emissão (Opcional)</Label>
                    <Input id="issueDate" name="issueDate" type="date" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">Vencimento *</Label>
                    <Input id="dueDate" name="dueDate" type="date" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="supplierId">Fornecedor *</Label>
                    <Select name="supplierId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="categoryId">Categoria Financeira *</Label>
                    <Select name="categoryId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ""}{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="costCenterId">Centro de Custo (Opcional)</Label>
                  <Select name="costCenterId">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {centers?.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar Lançamento</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-destructive/80 uppercase tracking-tighter">Em Atraso</p>
            <div className="text-2xl font-bold text-destructive">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-tighter">Vence Hoje</p>
            <div className="text-2xl font-bold text-amber-800">R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-primary/80 uppercase tracking-tighter">Próximos Dias</p>
            <div className="text-2xl font-bold text-primary">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardHeader className="pt-6 pb-2">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-tighter">Total Pago</p>
            <div className="text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
          <CardTitle className="text-lg">Fluxo de Despesas</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Status: {filterStatus === 'all' ? 'Todos' : filterStatus}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DueToday")}>Vence Hoje</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Overdue")}>Atrasado</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Open")}>Aberto (Futuro)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Paid")}>Pago</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {entriesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando lançamentos...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Nenhum lançamento nesta categoria</h3>
              <p className="text-sm text-muted-foreground mt-2">Altere o filtro ou adicione uma nova conta.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                  <TableRow key={entry.id} className="group">
                    <TableCell className="font-mono text-sm">
                      {new Date(entry.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {suppliers?.find(s => s.id === entry.supplierId)?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                          {categories?.find(c => c.id === entry.accountCategoryId)?.name || 'Sem Categoria'}
                        </span>
                        <span>{entry.description}</span>
                        {entry.paymentMethod && (
                          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <CreditCard className="w-2 h-2" /> {entry.paymentMethod}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.dynamicStatus)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      entry.dynamicStatus === 'Overdue' ? "text-destructive" : "",
                      entry.dynamicStatus === 'DueToday' ? "text-amber-600" : ""
                    )}>
                      R$ {entry.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status !== 'Paid' && (
                            <DropdownMenuItem onClick={() => markAsPaid(entry)} className="text-emerald-600">
                              <Check className="w-4 h-4 mr-2" /> Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => deleteEntry(entry)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
