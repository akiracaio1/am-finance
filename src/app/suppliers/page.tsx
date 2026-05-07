
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MoreVertical, Building2, Loader2, User, Edit2, Trash2, Upload, AlertCircle, Download, FileSpreadsheet } from "lucide-react";
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
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Supplier, PersonType } from "@/lib/types";
import * as XLSX from 'xlsx';

export default function SuppliersPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedPersonType, setSelectedPersonType] = useState<PersonType>("Pessoa Jurídica");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "suppliers");
  }, [db, user]);

  const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersQuery);

  const filteredSuppliers = suppliers?.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cnpj?.includes(searchTerm) ||
    s.pixKey?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const downloadTemplate = () => {
    const headers = ["Nome", "Tipo Pessoa", "CPF_CNPJ", "Email", "Telefone", "Categoria", "ChavePix"];
    const sampleData = [{
      "Nome": "Peixaria Central",
      "Tipo Pessoa": "Pessoa Jurídica",
      "CPF_CNPJ": "12.345.678/0001-90",
      "Email": "contato@peixariacentral.com",
      "Telefone": "(11) 98888-8888",
      "Categoria": "Insumos",
      "ChavePix": "12345678000190"
    }];
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
    XLSX.writeFile(wb, "modelo_fornecedores.xlsx");
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
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) throw new Error("Arquivo vazio.");

        const errors: string[] = [];
        const validData: Supplier[] = [];

        rows.forEach((row, index) => {
          const lineNum = index + 2;
          const nome = row["Nome"] || row["nome"];
          const type = row["Tipo Pessoa"] || row["tipopessoa"];

          if (!nome) {
            errors.push(`Linha ${lineNum}: Nome é obrigatório.`);
            return;
          }
          if (type !== "Pessoa Física" && type !== "Pessoa Jurídica") {
            errors.push(`Linha ${lineNum}: Tipo deve ser 'Pessoa Física' ou 'Pessoa Jurídica'.`);
            return;
          }

          validData.push({
            id: `sup_imp_${Date.now()}_${index}`,
            name: String(nome),
            personType: type as PersonType,
            cnpj: String(row["CPF_CNPJ"] || ""),
            email: String(row["Email"] || ""),
            phone: String(row["Telefone"] || ""),
            category: String(row["Categoria"] || "Geral"),
            pixKey: String(row["ChavePix"] || ""),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });

        if (errors.length > 0) {
          toast({ variant: "destructive", title: "Erro de Validação", description: errors.slice(0, 3).join(" | ") });
        } else {
          validData.forEach(s => setDocumentNonBlocking(doc(db, "users", user.uid, "suppliers", s.id), s, { merge: true }));
          toast({ title: "Importação concluída!", description: `${validData.length} fornecedores cadastrados.` });
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erro na leitura", description: err.message });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const supplierId = editingSupplier ? editingSupplier.id : `sup_${Date.now()}`;
    const data = {
      id: supplierId, name: formData.get("name") as string, personType: selectedPersonType,
      cnpj: formData.get("cnpj") as string, email: formData.get("email") as string,
      phone: formData.get("phone") as string, category: formData.get("category") as string,
      pixKey: formData.get("pixKey") as string, updatedAt: new Date().toISOString(),
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
    };
    setDocumentNonBlocking(doc(db, "users", user.uid, "suppliers", supplierId), data, { merge: true });
    setIsDialogOpen(false); setEditingSupplier(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">Base cadastral para gestão de pagamentos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}><Download className="w-4 h-4" /> Modelo</Button>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Importar Excel
          </Button>
          <Button className="gap-2 shadow-lg" onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
        </div>
      </div>

      <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-[10px] text-muted-foreground flex items-center gap-3">
        <AlertCircle className="w-4 h-4" />
        <span>Importante: Cadastre seus fornecedores aqui antes de importar o Contas a Pagar para garantir o vínculo correto.</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, Pix ou documento..." className="pl-9 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Documento / Pix</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-primary">
                        {supplier.personType === 'Pessoa Física' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col"><span className="text-sm">{supplier.name}</span><span className="text-[10px] text-muted-foreground">{supplier.personType}</span></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-[10px]">{supplier.cnpj || "-"}</p>
                    {supplier.pixKey && <p className="text-[9px] text-accent font-bold">PIX: {supplier.pixKey}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{supplier.category || "Geral"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingSupplier(supplier); setSelectedPersonType(supplier.personType); setIsDialogOpen(true); }}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db, "users", user.uid, "suppliers", supplier.id))} className="text-destructive">Arquivar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveSupplier}>
            <DialogHeader><DialogTitle>{editingSupplier ? 'Editar' : 'Novo'} Fornecedor</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Nome / Razão Social*</Label><Input name="name" defaultValue={editingSupplier?.name} required /></div>
              <div className="grid gap-2"><Label>Tipo</Label><Select value={selectedPersonType} onValueChange={(v: any) => setSelectedPersonType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pessoa Física">Pessoa Física</SelectItem><SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem></SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>CNPJ / CPF</Label><Input name="cnpj" defaultValue={editingSupplier?.cnpj} /></div>
                <div className="grid gap-2"><Label>Categoria</Label><Input name="category" defaultValue={editingSupplier?.category} /></div>
              </div>
              <div className="grid gap-2"><Label>Chave Pix</Label><Input name="pixKey" defaultValue={editingSupplier?.pixKey} /></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
