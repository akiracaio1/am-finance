
"use client";

import { useState, useRef, useMemo } from "react";
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
  Download,
  FileSpreadsheet
} from "lucide-react";
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
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AccountsReceivableEntry, AccountCategory } from "@/lib/types";
import { format, parseISO } from "date-fns";

export default function AccountsReceivablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);

  const entriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountsReceivableEntries");
  }, [db, user]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const { data: entries } = useCollection<AccountsReceivableEntry>(entriesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);

  // CRITICAL: Filter only for 'Revenue' type categories for this page
  const leafCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => 
      cat.type === 'Revenue' && 
      !categories.some(child => child.parentCategoryId === cat.id)
    ).sort((a, b) => a.code.localeCompare(b.code));
  }, [categories]);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    const entryId = `rec_${Date.now()}`;
    const data = {
      id: entryId, 
      customerName: formData.get("customerName"), 
      accountCategoryId: formData.get("categoryId"),
      description: formData.get("description"), 
      amount: Number(formData.get("amount")), 
      dueDate: formData.get("dueDate"),
      status: 'Open', 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entryId), data, { merge: true });
    setIsNewEntryOpen(false);
    toast({ title: "Recebimento registrado!" });
  };

  const totalOpen = entries?.filter(e => e.status === 'Open').reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const totalPaid = entries?.filter(e => e.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0) || 0;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowUpCircle className="text-emerald-600 w-8 h-8" />Contas a Receber</h1>
          <p className="text-muted-foreground">Gestão de entradas e faturamento por canal.</p>
        </div>
        <Button className="gap-2 bg-emerald-600 shadow-lg hover:bg-emerald-700" onClick={() => setIsNewEntryOpen(true)}><Plus className="w-4 h-4" /> Novo Recebimento</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-amber-50/50 border-amber-100"><CardHeader className="p-4 pb-2 text-[10px] font-bold text-amber-700 uppercase">A Receber</CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-amber-700">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-emerald-50/50 border-emerald-100"><CardHeader className="p-4 pb-2 text-[10px] font-bold text-emerald-700 uppercase">Total Recebido</CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Origem / Cliente</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {entries?.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}</TableCell>
                  <TableCell className="font-medium">{entry.customerName}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px] uppercase">{leafCategories.find(c => c.id === entry.accountCategoryId)?.name || 'Geral'}</Badge></TableCell>
                  <TableCell>
                    {entry.status === 'Paid' ? (
                      <div className="flex flex-col">
                        <Badge className="bg-emerald-100 text-emerald-700 border-none">Recebido</Badge>
                        {entry.paymentDate && <span className="text-[9px] text-emerald-600 font-bold mt-1">Em {format(parseISO(entry.paymentDate), "dd/MM/yy")}</span>}
                      </div>
                    ) : <Badge variant="outline">Em Aberto</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => {
                          updateDocumentNonBlocking(doc(db!, "users", user!.uid, "accountsReceivableEntries", entry.id), { status: 'Paid', paymentDate: format(new Date(), "yyyy-MM-dd"), updatedAt: new Date().toISOString() });
                          toast({ title: "Recebimento baixado" });
                        }} className="text-emerald-600 font-bold">Baixar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "accountsReceivableEntries", entry.id))} className="text-destructive">Excluir</DropdownMenuItem>
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
        <DialogContent>
          <form onSubmit={handleSaveEntry}>
            <DialogHeader><DialogTitle>Novo Recebimento</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Origem (Canal de Venda / Cliente)*</Label><Input name="customerName" placeholder="Ex: iFood, Balcão, WhatsApp..." required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Valor*</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div className="grid gap-2"><Label>Vencimento*</Label><Input name="dueDate" type="date" required /></div>
              </div>
              <div className="grid gap-2">
                <Label>Categoria (Receita)*</Label>
                <Select name="categoryId" required>
                  <SelectTrigger><SelectValue placeholder="Selecione o canal..." /></SelectTrigger>
                  <SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Descrição</Label><Input name="description" placeholder="Opcional..." /></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar Recebimento</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
