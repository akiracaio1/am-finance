
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Plus, 
  FolderTree, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  FolderPlus,
  Sparkles,
  Trash2,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { utils, writeFile } from 'xlsx';
import { AccountCategory } from "@/lib/types";

const DEFAULT_STRUCTURE = [
  // 1.0 Operacional (Despesas)
  { id: "1", code: "1.0", name: "Operacional (Custos Variáveis e Insumos)", type: "Expense", description: "Gastos que variam de acordo com o volume de produção." },
  { id: "1.1", code: "1.1", name: "Insumos e Materiais Diretos", parentCategoryId: "1", type: "Expense" },
  { id: "1.1.1", code: "1.1.1", name: "Materiais para Revenda", parentCategoryId: "1.1", type: "Expense" },
  { id: "1.1.4", code: "1.1.4", name: "Gás GLP", parentCategoryId: "1.1", type: "Expense" },
  
  // 2.0 Custos Fixos (Despesas)
  { id: "2", code: "2.0", name: "Custos Fixos (Despesas Administrativas)", type: "Expense", description: "Gastos recorrentes para manter a empresa aberta." },
  { id: "2.1", code: "2.1", name: "Ocupação e Utilidades", parentCategoryId: "2", type: "Expense" },
  { id: "2.1.1", code: "2.1.1", name: "Aluguel", parentCategoryId: "2.1", type: "Expense" },
  { id: "2.1.2", code: "2.1.2", name: "Energia Elétrica", parentCategoryId: "2.1", type: "Expense" },
  { id: "2.2", code: "2.2", name: "Pessoal", parentCategoryId: "2", type: "Expense" },
  { id: "2.2.1", code: "2.2.1", name: "Salários", parentCategoryId: "2.2", type: "Expense" },

  // 5.0 Receitas (A RECEBER)
  { id: "5", code: "5.0", name: "Receitas Operacionais (Vendas)", type: "Revenue", description: "Entradas provenientes da atividade principal da empresa." },
  { id: "5.1", code: "5.1", name: "Vendas de Produtos", parentCategoryId: "5", type: "Revenue" },
  { id: "5.1.1", code: "5.1.1", name: "Vendas iFood", parentCategoryId: "5.1", type: "Revenue" },
  { id: "5.1.2", code: "5.1.2", name: "Vendas Balcão / Loja", parentCategoryId: "5.1", type: "Revenue" },
  { id: "5.1.3", code: "5.1.3", name: "Vendas WhatsApp / Site", parentCategoryId: "5.1", type: "Revenue" },
  { id: "5.2", code: "5.2", name: "Receitas Financeiras / Outras", parentCategoryId: "5", type: "Revenue" },
  { id: "5.2.1", code: "5.2.1", name: "Rendimentos de Aplicação", parentCategoryId: "5.2", type: "Revenue" },
];

export default function ChartOfAccountsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<AccountCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [parentForNew, setParentForNew] = useState<AccountCategory | null>(null);
  const [rootType, setRootType] = useState<string>("Expense");

  // Form states
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const { data: categories, isLoading } = useCollection<AccountCategory>(categoriesQuery);

  const toggle = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleOpenNew = (parent?: AccountCategory) => {
    setEditingCategory(null);
    setParentForNew(parent || null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    if (!parent) setRootType("Expense");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: AccountCategory) => {
    setEditingCategory(category);
    setParentForNew(categories?.find(c => c.id === category.parentCategoryId) || null);
    setFormName(category.name);
    setFormCode(category.code);
    setFormDescription(category.description || "");
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (category: AccountCategory) => {
    setCategoryToDelete(category);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!db || !user || !categoryToDelete) return;
    const categoryRef = doc(db, "users", user.uid, "accountCategories", categoryToDelete.id);
    deleteDocumentNonBlocking(categoryRef);
    toast({ title: "Categoria excluída" });
    setIsConfirmDeleteOpen(false);
  };

  const handleProvisionDefaults = async () => {
    if (!db || !user) return;
    setIsProvisioning(true);
    try {
      for (const item of DEFAULT_STRUCTURE) {
        const categoryRef = doc(db, "users", user.uid, "accountCategories", item.id);
        const data = {
          ...item,
          description: item.description || "",
          parentCategoryId: item.parentCategoryId || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDocumentNonBlocking(categoryRef, data, { merge: true });
      }
      toast({ title: "Plano provisionado com Receitas e Despesas!" });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleExportExcel = () => {
    if (!categories) return;

    const exportData = categories.map(cat => ({
      'Código': cat.code,
      'Nome': cat.name,
      'Natureza': cat.type === 'Revenue' ? 'Receita' : 'Despesa',
      'Descrição': cat.description || '',
      'Grupo Pai': categories.find(p => p.id === cat.parentCategoryId)?.name || 'Raiz'
    })).sort((a, b) => a['Código'].localeCompare(b['Código']));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Plano de Contas");
    writeFile(wb, `Plano_de_Contas_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Excel gerado com sucesso!" });
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    if (editingCategory) {
      const categoryRef = doc(db, "users", user.uid, "accountCategories", editingCategory.id);
      updateDocumentNonBlocking(categoryRef, {
        name: formName,
        code: formCode,
        description: formDescription,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Categoria atualizada" });
    } else {
      const categoryId = `cat_${Date.now()}`;
      const newCategory: AccountCategory = {
        id: categoryId,
        name: formName,
        code: formCode,
        description: formDescription,
        type: parentForNew ? parentForNew.type : rootType,
        parentCategoryId: parentForNew?.id || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDocumentNonBlocking(doc(db, "users", user.uid, "accountCategories", categoryId), newCategory, { merge: true });
      if (parentForNew) setExpanded(prev => [...new Set([...prev, parentForNew.id])]);
      toast({ title: "Categoria criada" });
    }
    
    setIsDialogOpen(false);
  };

  const renderItem = (id: string, level: number = 0) => {
    const item = categories?.find(x => x.id === id);
    if (!item) return null;
    const children = categories?.filter(x => x.parentCategoryId === id) || [];
    const isExpanded = expanded.includes(id);

    return (
      <div key={id} className="select-none">
        <div 
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-md transition-all cursor-pointer group border border-transparent",
            level === 0 ? "font-bold bg-muted/40 border-muted mt-6 first:mt-0" : "hover:bg-muted/50",
            item.type === 'Revenue' && level === 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "",
            item.type === 'Expense' && level === 0 ? "text-destructive bg-destructive/5 border-destructive/10" : "",
            level === 1 ? "ml-6 font-semibold" : "",
            level === 2 ? "ml-12 text-muted-foreground text-sm" : ""
          )}
          onClick={() => toggle(id)}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />
          ) : <div className="w-4 shrink-0" />}
          
          <span className="text-[10px] font-mono shrink-0 opacity-50">{item.code}</span>
          <span className="flex-1 truncate">{item.name}</span>
          
          <div className="flex items-center gap-2">
            {level === 0 && (
              <Badge variant="outline" className={cn("text-[8px] uppercase", item.type === 'Revenue' ? "border-emerald-200 text-emerald-600" : "border-destructive/20 text-destructive")}>
                {item.type === 'Revenue' ? 'Receita' : 'Despesa'}
              </Badge>
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleOpenNew(item); }} title="Adicionar Subcategoria"><Plus className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }} title="Editar Categoria"><Pencil className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item); }} title="Excluir Categoria"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
        {isExpanded && children.sort((a,b) => a.code.localeCompare(b.code)).map(child => renderItem(child.id, level + 1))}
      </div>
    );
  };

  const roots = categories?.filter(x => !x.parentCategoryId || x.parentCategoryId === "") || [];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><BookOpen className="text-primary w-8 h-8" />Plano de Contas</h1>
          <p className="text-muted-foreground">Organize suas Receitas e Despesas de forma estratégica.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExportExcel} disabled={!categories || categories.length === 0}>
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleProvisionDefaults} disabled={isProvisioning}>
            {isProvisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Estrutura Padrão
          </Button>
          <Button className="gap-2" onClick={() => handleOpenNew()}><Plus className="w-4 h-4" /> Novo Grupo Raiz</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-8">
          <Card>
            <CardHeader className="bg-emerald-50/50 border-b"><CardTitle className="text-sm flex items-center gap-2 text-emerald-700"><TrendingUp className="w-4 h-4" /> Grupos de Receitas</CardTitle></CardHeader>
            <CardContent className="pt-6">
              {roots.filter(r => r.type === 'Revenue').sort((a,b) => a.code.localeCompare(b.code)).map(root => renderItem(root.id))}
              {roots.filter(r => r.type === 'Revenue').length === 0 && <p className="text-center py-10 text-muted-foreground text-xs">Nenhum grupo de receita cadastrado.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-destructive/5 border-b"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><TrendingDown className="w-4 h-4" /> Grupos de Despesas</CardTitle></CardHeader>
            <CardContent className="pt-6">
              {roots.filter(r => r.type === 'Expense').sort((a,b) => a.code.localeCompare(b.code)).map(root => renderItem(root.id))}
              {roots.filter(r => r.type === 'Expense').length === 0 && <p className="text-center py-10 text-muted-foreground text-xs">Nenhum grupo de despesa cadastrado.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader><CardTitle className="text-xs uppercase font-bold">Importante</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>Ao separar <strong>Receitas</strong> de <strong>Despesas</strong> no Plano de Contas, o sistema consegue filtrar as opções corretas em cada tela de lançamento.</p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p><strong>Cuidado:</strong> Se você excluir um plano de conta que já possui lançamentos vinculados, eles aparecerão como "Categoria não encontrada" nos relatórios.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveCategory}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Editar Categoria" : parentForNew ? `Nova Subcategoria em "${parentForNew.name}"` : "Novo Grupo Principal"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!parentForNew && !editingCategory && (
                <div className="grid gap-2">
                  <Label>Natureza do Grupo</Label>
                  <Select value={rootType} onValueChange={setRootType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Expense">Despesas (Contas a Pagar)</SelectItem>
                      <SelectItem value="Revenue">Receitas (Contas a Receber)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right text-xs">Código</Label>
                <Input id="code" value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="Ex: 5.1" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right text-xs">Nome</Label>
                <Input id="name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Vendas iFood" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right text-xs">Descrição</Label>
                <Textarea id="description" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Opcional..." className="col-span-3 h-20" />
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Salvar Categoria</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Esta ação não pode ser desfeita.</p>
              <p className="bg-destructive/10 p-3 rounded-lg text-destructive font-medium text-xs flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Lançamentos financeiros já realizados nesta categoria perderão o vínculo e poderão afetar seus relatórios de DRE.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir Permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
