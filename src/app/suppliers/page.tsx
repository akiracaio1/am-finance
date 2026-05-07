
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
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
    const sampleData = [
      {
        "Nome": "Exemplo Empresa LTDA",
        "Tipo Pessoa": "Pessoa Jurídica",
        "CPF_CNPJ": "00.000.000/0001-00",
        "Email": "contato@exemplo.com",
        "Telefone": "(11) 99999-9999",
        "Categoria": "Insumos",
        "ChavePix": "00000000000100"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fornecedores");
    XLSX.writeFile(workbook, "modelo_fornecedores.xlsx");
  };

  const handleSaveSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;

    const formData = new FormData(e.currentTarget);
    const supplierId = editingSupplier ? editingSupplier.id : `sup_${Date.now()}`;
    const supplierRef = doc(db, "users", user.uid, "suppliers", supplierId);
    
    const supplierData: Supplier = {
      id: supplierId,
      name: formData.get("name") as string,
      personType: selectedPersonType,
      cnpj: (formData.get("cnpj") as string) || "",
      email: (formData.get("email") as string) || "",
      phone: (formData.get("phone") as string) || "",
      category: (formData.get("category") as string) || "",
      pixKey: (formData.get("pixKey") as string) || "",
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingSupplier) {
      updateDocumentNonBlocking(supplierRef, supplierData);
      toast({ title: "Fornecedor atualizado" });
    } else {
      setDocumentNonBlocking(supplierRef, supplierData, { merge: true });
      toast({ title: "Fornecedor adicionado" });
    }

    setIsDialogOpen(false);
    setEditingSupplier(null);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (rows.length === 0) {
          toast({ variant: "destructive", title: "Erro na importação", description: "O arquivo está vazio." });
          setIsImporting(false);
          return;
        }

        const errors: string[] = [];
        const validData: Supplier[] = [];

        rows.forEach((row, index) => {
          const lineNum = index + 2;
          const nome = row["Nome"] || row["nome"];
          const type = row["Tipo Pessoa"] || row["Tipo de Pessoa"] || row["tipopessoa"];

          if (!nome) errors.push(`Linha ${lineNum}: Nome é obrigatório.`);
          if (!type || (type !== "Pessoa Física" && type !== "Pessoa Jurídica")) {
            errors.push(`Linha ${lineNum}: Tipo Pessoa deve ser 'Pessoa Física' ou 'Pessoa Jurídica'.`);
          }

          if (errors.length === 0) {
            const id = `sup_imp_${Date.now()}_${index}`;
            validData.push({
              id,
              name: String(nome),
              personType: type as PersonType,
              cnpj: String(row["CPF_CNPJ"] || row["cnpj"] || ""),
              email: String(row["Email"] || row["email"] || ""),
              phone: String(row["Telefone"] || row["telefone"] || ""),
              category: String(row["Categoria"] || row["categoria"] || "Importado"),
              pixKey: String(row["ChavePix"] || row["chavepix"] || ""),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });

        if (errors.length > 0) {
          toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: `Corrija os erros: ${errors.slice(0, 3).join(" | ")}${errors.length > 3 ? "..." : ""}`,
          });
        } else {
          validData.forEach(s => {
            const ref = doc(db, "users", user.uid, "suppliers", s.id);
            setDocumentNonBlocking(ref, s, { merge: true });
          });
          toast({ title: "Importação concluída!", description: `${validData.length} fornecedores importados.` });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Erro técnico", description: "Não foi possível ler o arquivo Excel." });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSelectedPersonType(supplier.personType);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!db || !user || !supplierToDelete) return;
    const supplierRef = doc(db, "users", user.uid, "suppliers", supplierToDelete.id);
    deleteDocumentNonBlocking(supplierRef);
    toast({ title: "Fornecedor arquivado" });
    setIsDeleteDialogOpen(false);
    setSupplierToDelete(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie suas parcerias e prestadores de serviço.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
            <Download className="w-4 h-4" /> Baixar Modelo
          </Button>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Importar Excel
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingSupplier(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg">
                <Plus className="w-4 h-4" /> Novo Fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSaveSupplier}>
                <DialogHeader>
                  <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome / Razão Social *</Label>
                    <Input id="name" name="name" placeholder="Ex: Peixaria Central" defaultValue={editingSupplier?.name} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="personType">Tipo de Pessoa *</Label>
                    <Select value={selectedPersonType} onValueChange={(v) => setSelectedPersonType(v as PersonType)}>
                      <SelectTrigger id="personType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                        <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pixKey">Chave Pix</Label>
                    <Input id="pixKey" name="pixKey" placeholder="E-mail, CPF, CNPJ..." defaultValue={editingSupplier?.pixKey} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cnpj">{selectedPersonType === 'Pessoa Física' ? 'CPF' : 'CNPJ'}</Label>
                      <Input id="cnpj" name="cnpj" placeholder="000.000.000-00" defaultValue={editingSupplier?.cnpj} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Input id="category" name="category" placeholder="Ex: Insumos" defaultValue={editingSupplier?.category} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">{editingSupplier ? "Atualizar" : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-xs text-muted-foreground flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-primary" />
        <span>Para importação, use o modelo Excel (.xlsx) com as colunas: <strong>Nome, Tipo Pessoa, CPF_CNPJ, Email, Telefone, Categoria, ChavePix</strong>.</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, Pix ou CNPJ..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-muted-foreground">Nenhum fornecedor cadastrado.</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Documento / Pix</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-primary">
                          {supplier.personType === 'Pessoa Física' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <p>{supplier.name}</p>
                          <p className="text-[10px] text-muted-foreground">{supplier.personType}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-xs">{supplier.cnpj || "-"}</p>
                      {supplier.pixKey && <p className="text-[10px] text-accent font-bold">Pix: {supplier.pixKey}</p>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="bg-primary/5 text-primary">{supplier.category || "Geral"}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{supplier.email || supplier.phone || "-"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(supplier)}><Edit2 className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDeleteDialog(supplier)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Arquivar</DropdownMenuItem>
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>Deseja remover <strong>{supplierToDelete?.name}</strong> da lista ativa?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
