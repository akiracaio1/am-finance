
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
import { format } from "date-fns";
import * as XLSX from 'xlsx';

export default function AccountsReceivablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const leafCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => !categories.some(child => child.parentCategoryId === cat.id));
  }, [categories]);

  const downloadTemplate = () => {
    const headers = ["Vencimento", "Cliente", "Categoria", "Descricao", "Valor"];
    const sampleData = [{
      "Vencimento": "25/12/2024",
      "Cliente": "iFood Brasil",
      "Categoria": "Vendas iFood",
      "Descricao": "Repasse Semanal",
      "Valor": 8400.00
    }];
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
    XLSX.writeFile(wb, "modelo_contas_receber.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user) return;
    setIsImporting(true);
    
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      const errors: string[] = [];
      const validData: any[] = [];

      rows.forEach((row, index) => {
        const line = index + 2;
        const vencimentoRaw = row["Vencimento"] || row["vencimento"];
        const cliente = row["Cliente"] || row["cliente"];
        const categoriaNome = row["Categoria"] || row["categoria"];
        const valor = row["Valor"] || row["valor"];

        if (!vencimentoRaw || !cliente || !categoriaNome || !valor) {
          errors.push(`Linha ${line}: Todos os campos são obrigatórios.`);
          return;
        }

        const category = leafCategories.find(c => c.name.toLowerCase().trim() === String(categoriaNome).toLowerCase().trim());
        if (!category) { 
          errors.push(`Linha ${line}: Categoria '${categoriaNome}' não cadastrada ou não é um Item (Folha).`); 
          return; 
        }

        let formattedDueDate = "";
        if (typeof vencimentoRaw === 'number') {
          formattedDueDate = format(XLSX.utils.numdate(vencimentoRaw), "yyyy-MM-dd");
        } else {
          const dateStr = String(vencimentoRaw);
          if (dateStr.includes("/")) {
            const [d, m, y] = dateStr.split("/");
            formattedDueDate = `${y}-${m}-${d}`;
          } else {
            formattedDueDate = dateStr;
          }
        }

        validData.push({
          id: `rec_imp_${Date.now()}_${index}`,
          customerName: String(cliente),
          accountCategoryId: category.id,
          description: String(row["Descricao"] || row["descricao"] || "Receita Importada"),
          amount: Number(valor),
          dueDate: formattedDueDate,
          status: 'Open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      if (errors.length > 0) {
        toast({ 
          variant: "destructive", 
          title: "Erro na Importação", 
          description: "A importação foi bloqueada por erros: " + errors.slice(0, 2).join(" | ") 
        });
      } else {
        validData.forEach(d => {
          setDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", d.id), d, { merge: true });
        });
        toast({ title: "Importação Concluída", description: `${validData.length} recebimentos importados.` });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao ler arquivo", description: "Certifique-se de que é um arquivo Excel (.xlsx) válido." });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
    toast({ title: "Recebimento salvo" });
  };

  const totalOpen = entries?.filter(e => e.status === 'Open').reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const totalPaid = entries?.filter(e => e.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0) || 0;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowUpCircle className="text-accent w-8 h-8" />Contas a Receber</h1>
          <p className="text-muted-foreground">Gestão de entradas e faturamento.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}><Download className="w-4 h-4" /> Baixar Modelo</Button>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Importar Excel
          </Button>
          <Button className="gap-2 bg-accent shadow-lg text-accent-foreground hover:bg-accent/90" onClick={() => setIsNewEntryOpen(true)}><Plus className="w-4 h-4" /> Novo Recebimento</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-accent/5"><CardHeader className="p-4 pb-2 text-xs font-bold text-accent uppercase">A Receber</CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-accent">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-emerald-50"><CardHeader className="p-4 pb-2 text-xs font-bold text-emerald-700 uppercase">Recebido</CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {entries?.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{format(new Date(entry.dueDate + 'T12:00:00'), "dd/MM/yy")}</TableCell>
                  <TableCell className="font-medium">{entry.customerName}</TableCell>
                  <TableCell>{entry.status === 'Paid' ? <Badge className="bg-emerald-100 text-emerald-700">Recebido</Badge> : <Badge variant="outline">Aberto</Badge>}</TableCell>
                  <TableCell className="text-right font-bold text-accent">R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {entry.status !== 'Paid' && <DropdownMenuItem onClick={() => {
                          if (!db || !user) return;
                          updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id), { status: 'Paid', paymentDate: format(new Date(), "yyyy-MM-dd"), updatedAt: new Date().toISOString() });
                          toast({ title: "Recebimento baixado" });
                        }} className="text-emerald-600 font-bold">Baixar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => {
                          if (!db || !user) return;
                          deleteDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id));
                          toast({ title: "Recebimento excluído" });
                        }} className="text-destructive">Excluir</DropdownMenuItem>
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
              <div className="grid gap-2"><Label>Origem (Cliente)*</Label><Input name="customerName" placeholder="Ex: iFood, Balcão..." required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Valor*</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div className="grid gap-2"><Label>Vencimento*</Label><Input name="dueDate" type="date" required /></div>
              </div>
              <div className="grid gap-2"><Label>Descrição</Label><Input name="description" placeholder="Opcional..." /></div>
              <div className="grid gap-2"><Label>Categoria*</Label><Select name="categoryId" required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{leafCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
