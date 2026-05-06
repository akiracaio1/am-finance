
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
  ArrowUpCircle, 
  Upload, 
  Download, 
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  Calendar,
  Wallet,
  MoreHorizontal
} from "lucide-react";
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
import { AccountsReceivableEntry, AccountCategory } from "@/lib/types";
import { format } from "date-fns";

export default function AccountsReceivablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);

  // Firestore Queries
  const entriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsReceivableEntries");
  }, [db, user]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const { data: entries, isLoading: entriesLoading } = useCollection<AccountsReceivableEntry>(entriesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    const entryId = `rec_${Date.now()}`;
    const entryRef = doc(db, "users", user.uid, "accountsReceivableEntries", entryId);
    
    const newEntry: AccountsReceivableEntry = {
      id: entryId,
      customerName: formData.get("customerName") as string,
      accountCategoryId: formData.get("categoryId") as string,
      description: formData.get("description") as string,
      amount: Number(formData.get("amount")),
      dueDate: formData.get("dueDate") as string,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(entryRef, newEntry, { merge: true });
    toast({ title: "Lançamento de Receita criado", description: "A entrada foi agendada." });
    setIsNewEntryOpen(false);
  };

  const markAsPaid = (entry: AccountsReceivableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsReceivableEntries", entry.id);
    updateDocumentNonBlocking(entryRef, {
      status: 'Paid',
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Receita Confirmada", description: "O valor foi marcado como recebido." });
  };

  const deleteEntry = (entry: AccountsReceivableEntry) => {
    if (!db || !user) return;
    const entryRef = doc(db, "users", user.uid, "accountsReceivableEntries", entry.id);
    deleteDocumentNonBlocking(entryRef);
    toast({ title: "Lançamento removido", description: "A receita foi excluída." });
  };

  const totalOpen = entries?.filter(e => e.status === 'Open').reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const totalPaid = entries?.filter(e => e.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowUpCircle className="text-accent w-8 h-8" />
            Contas a Receber
          </h1>
          <p className="text-muted-foreground">Monitore o faturamento e gerencie entradas manuais ou automáticas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" /> Importar CSV
          </Button>
          <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-accent hover:bg-accent/90">
                <Plus className="w-4 h-4" /> Novo Recebimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSaveEntry}>
                <DialogHeader>
                  <DialogTitle>Novo Lançamento de Receita</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="customerName">Origem / Cliente *</Label>
                    <Input id="customerName" name="customerName" placeholder="Ex: iFood, Venda Balcão" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Input id="description" name="description" placeholder="Ex: Vendas do Fim de Semana" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Valor (R$) *</Label>
                      <Input id="amount" name="amount" type="number" step="0.01" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dueDate">Vencimento / Previsão *</Label>
                      <Input id="dueDate" name="dueDate" type="date" required />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="categoryId">Categoria *</Label>
                    <Select name="categoryId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-accent hover:bg-accent/90">Salvar Receita</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-accent/5 border-accent/20">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold text-accent uppercase tracking-tighter">Total a Receber</p>
            <div className="text-2xl font-bold text-accent">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-tighter">Total Recebido (Mês)</p>
            <div className="text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Projeção Final</p>
            <div className="text-2xl font-bold">R$ {(totalOpen + totalPaid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {entriesLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg">
              <ArrowUpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Nenhuma receita lançada</h3>
              <p className="text-sm text-muted-foreground mt-2">Clique em "Novo Recebimento" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Previsão</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(entry.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">{entry.customerName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.description}</TableCell>
                    <TableCell>
                      {entry.status === 'Paid' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Recebido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Calendar className="w-3 h-3 mr-1" /> Aberto
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-accent">
                      R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                              <Wallet className="w-4 h-4 mr-2" /> Confirmar Recebimento
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
