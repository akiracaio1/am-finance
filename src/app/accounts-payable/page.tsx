
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  AlertTriangle, 
  Calendar,
  Plus,
  Loader2,
  Trash2,
  Check,
  Search,
  ChevronDown
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
import { Supplier, AccountCategory, CostCenter, AccountsPayableEntry } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// Searchable component for selection
function SearchableList<T extends { id: string; name: string; code?: string }>({ 
  items, 
  onSelect, 
  placeholder,
  label,
  value
}: { 
  items: T[]; 
  onSelect: (item: T | null) => void; 
  placeholder: string;
  label: string;
  value: T | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      (item.code && item.code.toLowerCase().includes(search.toLowerCase()))
    );
  }, [items, search]);

  // Clear search when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          {value ? (
            <span className="truncate">{value.code ? `${value.code} - ` : ""}{value.name}</span>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-60">
          <div className="p-1">
            {filteredItems.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
            )}
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  value?.id === item.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value?.id === item.id ? "opacity-100" : "opacity-0")} />
                {item.code ? `${item.code} - ` : ""}{item.name}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function AccountsPayablePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [filterStatus, setFilterStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form selections state
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AccountCategory | null>(null);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);

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
    if (!db || !user || !selectedSupplier || !selectedCategory) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha os campos obrigatórios." });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const entryId = `pay_${Date.now()}`;
    const entryRef = doc(db, "users", user.uid, "accountsPayableEntries", entryId);

    const newEntry: AccountsPayableEntry = {
      id: entryId,
      supplierId: selectedSupplier.id,
      accountCategoryId: selectedCategory.id,
      costCenterId: selectedCostCenter?.id || "",
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
    
    // Reset selections
    setSelectedSupplier(null);
    setSelectedCategory(null);
    setSelectedCostCenter(null);
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
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedSupplier(null);
              setSelectedCategory(null);
              setSelectedCostCenter(null);
            }
          }}>
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
                      <Label htmlFor="paymentMethod">Forma de Pagamento (Opcional)</Label>
                      <Input id="paymentMethod" name="paymentMethod" placeholder="Ex: Pix, Boleto, Cartão" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="issueDate">Data de Emissão</Label>
                      <Input id="issueDate" name="issueDate" type="date" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dueDate">Vencimento *</Label>
                      <Input id="dueDate" name="dueDate" type="date" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Fornecedor *</Label>
                      <SearchableList 
                        items={suppliers || []} 
                        onSelect={setSelectedSupplier} 
                        placeholder="Pesquisar fornecedor..." 
                        label="Selecione o fornecedor"
                        value={selectedSupplier}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Categoria Financeira *</Label>
                      <SearchableList 
                        items={categories || []} 
                        onSelect={setSelectedCategory} 
                        placeholder="Pesquisar categoria..." 
                        label="Selecione a categoria"
                        value={selectedCategory}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Centro de Custo (Opcional)</Label>
                    <SearchableList 
                      items={centers || []} 
                      onSelect={setSelectedCostCenter} 
                      placeholder="Pesquisar centro de custo..." 
                      label="Selecione o centro de custo"
                      value={selectedCostCenter}
                    />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Status: {filterStatus === 'all' ? 'Todos' : filterStatus}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Open")}>Aberto</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Paid")}>Pago</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Overdue")}>Atrasado</DropdownMenuItem>
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
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                          {categories?.find(c => c.id === entry.accountCategoryId)?.name || 'Sem Categoria'}
                        </span>
                        <span>{entry.description}</span>
                        {entry.costCenterId && (
                          <span className="text-[10px] text-primary/70">
                            CC: {centers?.find(c => c.id === entry.costCenterId)?.name}
                          </span>
                        )}
                      </div>
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
