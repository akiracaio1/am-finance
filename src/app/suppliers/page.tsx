
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MoreVertical, Mail, Building2, Loader2, CreditCard, User, Edit2, FileText, Trash2 } from "lucide-react";
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
import { useRouter } from "next/navigation";

export default function SuppliersPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [selectedPersonType, setSelectedPersonType] = useState<PersonType>("Pessoa Jurídica");

  // Memoize the collection reference based on the logged-in user
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
      toast({
        title: "Fornecedor atualizado",
        description: `${supplierData.name} foi atualizado com sucesso.`,
      });
    } else {
      setDocumentNonBlocking(supplierRef, supplierData, { merge: true });
      toast({
        title: "Fornecedor adicionado",
        description: `${supplierData.name} foi cadastrado com sucesso.`,
      });
    }

    setIsDialogOpen(false);
    setEditingSupplier(null);
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
    toast({
      title: "Fornecedor arquivado",
      description: `${supplierToDelete.name} foi removido da sua lista ativa.`,
    });
    setIsDeleteDialogOpen(false);
    setSupplierToDelete(null);
  };

  const handleViewStatement = (supplier: Supplier) => {
    // Redireciona para contas a pagar filtrando pelo fornecedor
    router.push(`/accounts-payable?supplierId=${supplier.id}`);
    toast({
      title: "Abrindo extrato",
      description: `Filtrando movimentações de ${supplier.name}.`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie suas parcerias e prestadores de serviço.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar Fornecedor
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
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="Ex: Peixaria Central" 
                    defaultValue={editingSupplier?.name} 
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="personType">Tipo de Pessoa *</Label>
                  <Select 
                    value={selectedPersonType} 
                    onValueChange={(v) => setSelectedPersonType(v as PersonType)}
                  >
                    <SelectTrigger id="personType">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                      <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pixKey">Chave Pix</Label>
                  <Input 
                    id="pixKey" 
                    name="pixKey" 
                    placeholder="E-mail, CPF, CNPJ ou Aleatória" 
                    defaultValue={editingSupplier?.pixKey}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">{selectedPersonType === 'Pessoa Física' ? 'CPF' : 'CNPJ'}</Label>
                    <Input 
                      id="cnpj" 
                      name="cnpj" 
                      placeholder="000.000.000-00" 
                      defaultValue={editingSupplier?.cnpj}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input 
                      id="category" 
                      name="category" 
                      placeholder="Ex: Insumos" 
                      defaultValue={editingSupplier?.category}
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail de Contato</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="contato@empresa.com" 
                    defaultValue={editingSupplier?.email}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    placeholder="(00) 00000-0000" 
                    defaultValue={editingSupplier?.phone}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingSupplier ? "Atualizar Fornecedor" : "Salvar Fornecedor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, Pix ou CNPJ..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Carregando seus fornecedores...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Nenhum fornecedor encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">Comece adicionando seu primeiro fornecedor no botão acima.</p>
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
                  <TableRow key={supplier.id} className="group transition-data">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-primary">
                          {supplier.personType === 'Pessoa Física' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <p>{supplier.name}</p>
                          <p className="text-[10px] text-muted-foreground font-normal">{supplier.personType}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-mono text-xs">{supplier.cnpj || "-"}</p>
                        {supplier.pixKey && (
                          <div className="flex items-center gap-1 text-[10px] text-accent font-bold">
                            <CreditCard className="w-3 h-3" /> Pix: {supplier.pixKey}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        {supplier.category || "Geral"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-muted-foreground text-xs">
                        {supplier.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {supplier.email}</div>}
                        {supplier.phone && <p>{supplier.phone}</p>}
                        {!supplier.email && !supplier.phone && "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                            <Edit2 className="w-4 h-4 mr-2" /> Editar Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewStatement(supplier)}>
                            <FileText className="w-4 h-4 mr-2" /> Ver Extrato
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive" 
                            onClick={() => openDeleteDialog(supplier)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Arquivar
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a arquivar <strong>{supplierToDelete?.name}</strong>. 
              Isso removerá o fornecedor da sua lista ativa, mas não afetará lançamentos financeiros já existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
