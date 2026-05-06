
"use client";

import { useState } from "react";
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  ArrowDownCircle, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  FileText,
  Plus,
  Loader2,
  Trash2,
  Check
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Supplier } from "@/lib/types";

interface AccountCategory {
  id: string;
  name: string;
  code: string;
}

interface AccountsPayableEntry {
  id: string;
  supplierId: string;
  accountCategoryId: string;
  description: string;
  originalAmount: number;
  dueDate: string;
  status: 'Open' | 'Paid' | 'Overdue';
  createdAt: string;
  updatedAt: string;
}

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [filterStatus, setFilterStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const { data: entries, isLoading: entriesLoading } = useCollection<AccountsPayableEntry>(entriesQuery);
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);

  const filteredEntries = entries?.filter(e => {
    if (filterStatus === 'all') return true;
    return e.status.toLowerCase() === filterStatus.toLowerCase();
  }) || [];

  // Stats calculation
  const totalOverdue = entries?.filter(e => e.status === 'Overdue').reduce((acc, curr) => acc + curr.originalAmount, 0) || 0;
  const totalOpen = entries?.filter(e => e.status === 'Open').reduce((acc, curr) => acc + curr.originalAmount, 0) || 0;
  const totalPaid = entries?.filter(e => e.status === 'Paid').reduce((acc, curr) => acc + curr.originalAmount, 0) || 0;

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
      description: formData.get("description") as string,
      originalAmount: Number(formData.get("amount")),
      dueDate: formData.get("dueDate") as string,
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
    switch (status.toLowerCase()) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="border-none"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
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
          <p className="text-muted-foreground">Acompanhe e gerencie suas próximas despesas e contas.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <FileText className="w-4 h-4" /> Importar Lote
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                      <Label htmlFor="dueDate">Vencimento *</Label>
                      <Input id="dueDate" name="dueDate" type="date" required />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="supplierId">Fornecedor *</Label>
                    <Select name="supplierId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="categoryId">Categoria Financeira *</Label>
                    <Select name="categoryId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive/80">Total em Atraso</p>
            <div className="text-2xl font-bold text-destructive">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-primary/80">Total em Aberto</p>
            <div className="text-2xl font-bold text-primary">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-emerald-700">Total Pago</p>
            <div className="text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
          <CardTitle className="text-lg">Lista de Despesas</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Open">Aberto</SelectItem>
                <SelectItem value="Paid">Pago</SelectItem>
                <SelectItem value="Overdue">Atrasado</SelectItem>
              </SelectContent>
            </Select>
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
              <h3 className="text-lg font-medium text-muted-foreground">Nenhum lançamento encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                Use o botão acima para cadastrar sua primeira conta a pagar.
              </p>
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
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="group">
                    <TableCell className="font-mono text-sm">
                      {new Date(entry.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {suppliers?.find(s => s.id === entry.supplierId)?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <span className="text-muted-foreground text-[10px] block uppercase tracking-wider">
                        {categories?.find(c => c.id === entry.accountCategoryId)?.name || 'Sem Categoria'}
                      </span>
                      {entry.description}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.status)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      entry.status === 'Overdue' ? "text-destructive" : ""
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
