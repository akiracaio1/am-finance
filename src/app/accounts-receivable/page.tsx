
"use client";

import { useState, useRef } from "react";
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
  Trash2,
  CheckCircle2,
  Calendar,
  Wallet,
  MoreHorizontal,
  AlertCircle,
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

  const { data: entries, isLoading: entriesLoading } = useCollection<AccountsReceivableEntry>(entriesQuery);
  const { data: categories } = useCollection<AccountCategory>(categoriesQuery);

  const downloadTemplate = () => {
    const headers = ["Vencimento", "Cliente", "Categoria", "Descricao", "Valor"];
    const sampleData = [
      {
        "Vencimento": "25/12/2024",
        "Cliente": "iFood Brasil",
        "Categoria": "Vendas iFood Semanal",
        "Descricao": "Repasse Semanal",
        "Valor": 8400.00
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contas a Receber");
    XLSX.writeFile(workbook, "modelo_contas_receber.xlsx");
  };

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    const entryId = `rec_${Date.now()}`;
    const entryRef = doc(db, "users", user.uid, "accountsReceivableEntries", entryId);
    
    setDocumentNonBlocking(entryRef, {
      id: entryId,
      customerName: formData.get("customerName"),
      accountCategoryId: formData.get("categoryId"),
      description: formData.get("description"),
      amount: Number(formData.get("amount")),
      dueDate: formData.get("dueDate"),
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    toast({ title: "Receita agendada" });
    setIsNewEntryOpen(false);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dataBuffer = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (rows.length === 0) {
          toast({ variant: "destructive", title: "Erro na importação", description: "Arquivo vazio." });
          setIsImporting(false);
          return;
        }

        const errors: string[] = [];
        const validData: any[] = [];

        rows.forEach((row, index) => {
          const line = index + 2;
          const vencimento = row["Vencimento"] || row["vencimento"];
          const cliente = row["Cliente"] || row["cliente"];
          const categoriaNome = row["Categoria"] || row["categoria"];
          const valor = row["Valor"] || row["valor"];

          if (!vencimento || !cliente || !categoriaNome || !valor) {
            errors.push(`Linha ${line}: Campos obrigatórios (Vencimento, Cliente, Categoria, Valor) faltando.`);
          }

          const category = categories?.find(c => c.name.toLowerCase() === String(categoriaNome).toLowerCase());
          if (!category) errors.push(`Linha ${line}: Categoria '${categoriaNome}' não cadastrada.`);

          if (errors.length === 0) {
            let formattedDate = String(vencimento);
            if (typeof vencimento === 'number') {
              formattedDate = format(XLSX.utils.numdate(vencimento), "yyyy-MM-dd");
            } else if (formattedDate.includes("/")) {
              const [d, m, y] = formattedDate.split("/");
              formattedDate = `${y}-${m}-${d}`;
            }

            validData.push({
              id: `rec_imp_${Date.now()}_${index}`,
              customerName: String(cliente),
              accountCategoryId: category!.id,
              description: String(row["Descricao"] || row["descricao"] || "Venda Importada"),
              amount: Number(valor),
              dueDate: formattedDate,
              status: 'Open',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });

        if (errors.length > 0) {
          toast({ variant: "destructive", title: "Erro na Planilha", description: errors.slice(0, 3).join(" | ") });
        } else {
          validData.forEach(d => {
            setDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", d.id), d, { merge: true });
          });
          toast({ title: "Importação concluída!", description: `${validData.length} receitas importadas.` });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Erro técnico", description: "Falha ao processar arquivo Excel." });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const totalOpen = entries?.filter(e => e.status === 'Open').reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const totalPaid = entries?.filter(e => e.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><ArrowUpCircle className="text-accent w-8 h-8" />Contas a Receber</h1>
          <p className="text-muted-foreground">Monitore o faturamento.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
            <Download className="w-4 h-4" /> Baixar Modelo
          </Button>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}Importar Excel
          </Button>
          <Dialog open={isNewEntryOpen} onOpenChange={setIsNewEntryOpen}><DialogTrigger asChild><Button className="gap-2 bg-accent"><Plus className="w-4 h-4" /> Novo Recebimento</Button></DialogTrigger>
            <DialogContent><form onSubmit={handleSaveEntry}><DialogHeader><DialogTitle>Nova Receita</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Origem / Cliente*</Label><Input name="customerName" required /></div>
                <div className="grid gap-2"><Label>Descrição*</Label><Input name="description" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Valor*</Label><Input name="amount" type="number" step="0.01" required /></div>
                  <div className="grid gap-2"><Label>Vencimento*</Label><Input name="dueDate" type="date" required /></div>
                </div>
                <div className="grid gap-2"><Label>Categoria*</Label><Select name="categoryId" required><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" className="bg-accent">Salvar</Button></DialogFooter>
            </form></DialogContent></Dialog>
        </div>
      </div>

      <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-xs text-muted-foreground flex items-center gap-3">
        <AlertCircle className="w-4 h-4" /><span>Colunas Excel: <strong>Vencimento, Cliente, Categoria, Descricao, Valor</strong>.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-accent/5"><CardHeader className="pb-2 text-xs font-bold text-accent uppercase">A Receber</CardHeader><CardContent className="text-2xl font-bold text-accent">R$ {totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-emerald-50"><CardHeader className="pb-2 text-xs font-bold text-emerald-700 uppercase">Recebido</CardHeader><CardContent className="text-2xl font-bold text-emerald-800">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
        <Card className="bg-muted/50"><CardHeader className="pb-2 text-xs font-bold text-muted-foreground uppercase">Projeção</CardHeader><CardContent className="text-2xl font-bold">R$ {(totalOpen + totalPaid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardContent></Card>
      </div>

      <Card><CardContent className="pt-6">
        {entriesLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : !entries || entries.length === 0 ? <div className="text-center py-20 border-2 border-dashed rounded-lg text-muted-foreground">Nenhuma receita lançada.</div> : (
          <Table><TableHeader><TableRow><TableHead>Previsão</TableHead><TableHead>Origem</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
            <TableBody>{entries.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((entry) => (
              <TableRow key={entry.id}><TableCell className="text-sm">{new Date(entry.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell><TableCell className="font-medium">{entry.customerName}</TableCell><TableCell className="text-muted-foreground text-sm">{entry.description}</TableCell><TableCell>{entry.status === 'Paid' ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge> : <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" /> Aberto</Badge>}</TableCell><TableCell className="text-right font-bold text-accent">R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">{entry.status !== 'Paid' && <DropdownMenuItem onClick={() => updateDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id), { status: 'Paid', paymentDate: format(new Date(), "yyyy-MM-dd"), updatedAt: new Date().toISOString() })} className="text-emerald-600"><Wallet className="w-4 h-4 mr-2" /> Confirmar</DropdownMenuItem>}<DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db, "users", user.uid, "accountsReceivableEntries", entry.id))} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
              </TableRow>))}</TableBody></Table>)}
      </CardContent></Card>
    </div>
  );
}
