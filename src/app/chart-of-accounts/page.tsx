
"use client";

import { useState } from "react";
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
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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
import { toast } from "@/hooks/use-toast";
import { utils, writeFile } from 'xlsx';

interface AccountCategory {
  id: string;
  name: string;
  description: string;
  type: string;
  code: string;
  parentCategoryId?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_STRUCTURE = [
  // 1.0 Operacional
  { id: "1", code: "1.0", name: "Operacional (Custos Variáveis e Insumos)", type: "Expense", description: "Este grupo concentra os gastos que variam diretamente de acordo com o volume de produção ou vendas." },
  { id: "1.1", code: "1.1", name: "Insumos e Materiais Diretos", parentCategoryId: "1", type: "Expense" },
  { id: "1.1.1", code: "1.1.1", name: "Materiais para Revenda", parentCategoryId: "1.1", type: "Expense" },
  { id: "1.1.2", code: "1.1.2", name: "Materiais Aplicados na Prestação de Serviços", parentCategoryId: "1.1", type: "Expense" },
  { id: "1.1.3", code: "1.1.3", name: "Embalagens", parentCategoryId: "1.1", type: "Expense" },
  { id: "1.1.4", code: "1.1.4", name: "Gás GLP (Combustível de Produção)", parentCategoryId: "1.1", type: "Expense" },
  { id: "1.2", code: "1.2", name: "Impostos sobre Vendas", parentCategoryId: "1", type: "Expense" },
  { id: "1.2.1", code: "1.2.1", name: "Simples Nacional - DAS", parentCategoryId: "1.2", type: "Expense" },
  { id: "1.2.2", code: "1.2.2", name: "ICMS ST sobre Vendas", parentCategoryId: "1.2", type: "Expense" },
  { id: "1.3", code: "1.3", name: "Logística e Vendas", parentCategoryId: "1", type: "Expense" },
  { id: "1.3.1", code: "1.3.1", name: "Fretes pagos", parentCategoryId: "1.3", type: "Expense" },
  { id: "1.3.2", code: "1.3.2", name: "Transporte de Mercadorias Vendidas", parentCategoryId: "1.3", type: "Expense" },
  { id: "1.3.3", code: "1.3.3", name: "Descontos incondicionais concedidos", parentCategoryId: "1.3", type: "Expense" },
  
  // 2.0 Custos Fixos
  { id: "2", code: "2.0", name: "Custos Fixos (Despesas Administrativas e Estruturais)", type: "Expense", description: "Gastos recorrentes necessários para manter a empresa aberta, independentemente do volume de vendas." },
  { id: "2.1", code: "2.1", name: "Ocupação e Utilidades", parentCategoryId: "2", type: "Expense" },
  { id: "2.1.1", code: "2.1.1", name: "Aluguel", parentCategoryId: "2.1", type: "Expense" },
  { id: "2.1.2", code: "2.1.2", name: "Energia Elétrica", parentCategoryId: "2.1", type: "Expense" },
  { id: "2.1.3", code: "2.1.3", name: "Água e Saneamento", parentCategoryId: "2.1", type: "Expense" },
  { id: "2.1.4", code: "2.1.4", name: "Telefonia e Internet", parentCategoryId: "2.1", type: "Expense" },
  { id: "2.2", code: "2.2", name: "Pessoal e Honorários", parentCategoryId: "2", type: "Expense" },
  { id: "2.2.1", code: "2.2.1", name: "Salários", parentCategoryId: "2.2", type: "Expense" },
  { id: "2.2.2", code: "2.2.2", name: "Remuneração de Autônomos", parentCategoryId: "2.2", type: "Expense" },
  { id: "2.2.3", code: "2.2.3", name: "Honorários Contábeis", parentCategoryId: "2.2", type: "Expense" },
  { id: "2.3", code: "2.3", name: "Manutenção e Administrativo", parentCategoryId: "2", type: "Expense" },
  { id: "2.3.1", code: "2.3.1", name: "Copa e Cozinha", parentCategoryId: "2.3", type: "Expense" },
  { id: "2.3.2", code: "2.3.2", name: "Utensílios e Equipamentos de Cozinha", parentCategoryId: "2.3", type: "Expense" },
  { id: "2.3.3", code: "2.3.3", name: "Materiais de Escritório", parentCategoryId: "2.3", type: "Expense" },
  { id: "2.3.4", code: "2.3.4", name: "Software / Licença de Uso", parentCategoryId: "2.3", type: "Expense" },
  { id: "2.3.5", code: "2.3.5", name: "Combustíveis (uso administrativo/veículos)", parentCategoryId: "2.3", type: "Expense" },

  // 3.0 Marketing
  { id: "3", code: "3.0", name: "Marketing e Desenvolvimento", type: "Expense", description: "Investimentos voltados para o crescimento da marca e aquisição de clientes." },
  { id: "3.1", code: "3.1", name: "Promoção e Publicidade", parentCategoryId: "3", type: "Expense" },
  { id: "3.1.1", code: "3.1.1", name: "Marketing e Publicidade", parentCategoryId: "3.1", type: "Expense" },
  { id: "3.1.2", code: "3.1.2", name: "Tráfego Pago", parentCategoryId: "3.1", type: "Expense" },
  { id: "3.2", code: "3.2", name: "Treinamento e Eventos", parentCategoryId: "3", type: "Expense" },
  { id: "3.2.1", code: "3.2.1", name: "Cursos e Treinamentos", parentCategoryId: "3.2", type: "Expense" },
  { id: "3.2.2", code: "3.2.2", name: "Taxas de Participação em Eventos", parentCategoryId: "3.2", type: "Expense" },

  // 4.0 Investimentos
  { id: "4", code: "4.0", name: "Investimentos e Movimentações de Sócios", type: "Asset", description: "Contas relacionadas ao patrimônio e transações com os proprietários." },
  { id: "4.1", code: "4.1", name: "Ativos Imobilizados", parentCategoryId: "4", type: "Asset" },
  { id: "4.1.1", code: "4.1.1", name: "Máquinas, Equipamentos e Instalações Industriais", parentCategoryId: "4.1", type: "Asset" },
  { id: "4.2", code: "4.2", name: "Fluxo de Sócios", parentCategoryId: "4", type: "Equity" },
  { id: "4.2.1", code: "4.2.1", name: "Antecipação de Lucros", parentCategoryId: "4.2", type: "Equity" },
  { id: "4.2.2", code: "4.2.2", name: "Empréstimos de Sócios", parentCategoryId: "4.2", type: "Equity" },
];

export default function ChartOfAccountsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<AccountCategory | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [parentForNew, setParentForNew] = useState<AccountCategory | null>(null);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "accountCategories");
  }, [db, user]);

  const { data: categories, isLoading } = useCollection<AccountCategory>(categoriesQuery);

  const toggle = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleOpenNew = (parent?: AccountCategory) => {
    setParentForNew(parent || null);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (category: AccountCategory) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!db || !user || !categoryToDelete) return;
    const categoryRef = doc(db, "users", user.uid, "accountCategories", categoryToDelete.id);
    deleteDocumentNonBlocking(categoryRef);
    toast({
      title: "Categoria excluída",
      description: `${categoryToDelete.name} foi removida com sucesso.`,
    });
    setIsDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleExportExcel = () => {
    if (!categories) return;

    const exportData: any[] = [];
    const roots = categories.filter(c => !c.parentCategoryId || c.parentCategoryId === "").sort((a, b) => a.code.localeCompare(b.code));

    roots.forEach(root => {
      const level1s = categories.filter(c => c.parentCategoryId === root.id).sort((a, b) => a.code.localeCompare(b.code));
      
      if (level1s.length === 0) {
        exportData.push({
          "Grupo Principal": root.name,
          "Subgrupo": "",
          "Subsubgrupo (Item)": "",
          "Código": root.code,
          "Tipo": root.type
        });
      }

      level1s.forEach(l1 => {
        const level2s = categories.filter(c => c.parentCategoryId === l1.id).sort((a, b) => a.code.localeCompare(b.code));
        
        if (level2s.length === 0) {
          exportData.push({
            "Grupo Principal": root.name,
            "Subgrupo": l1.name,
            "Subsubgrupo (Item)": "",
            "Código": l1.code,
            "Tipo": l1.type
          });
        }

        level2s.forEach(l2 => {
          exportData.push({
            "Grupo Principal": root.name,
            "Subgrupo": l1.name,
            "Subsubgrupo (Item)": l2.name,
            "Código": l2.code,
            "Tipo": l2.type
          });
        });
      });
    });

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Plano de Contas");
    writeFile(wb, "plano_de_contas_am_finance.xlsx");
    
    toast({
      title: "Exportação concluída",
      description: "Seu plano de contas foi baixado em formato Excel.",
    });
  };

  const handleProvisionDefaults = async () => {
    if (!db || !user) return;
    setIsProvisioning(true);
    
    try {
      for (const item of DEFAULT_STRUCTURE) {
        const categoryRef = doc(db, "users", user.uid, "accountCategories", item.id);
        const data: AccountCategory = {
          ...item,
          description: item.description || "",
          parentCategoryId: item.parentCategoryId || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDocumentNonBlocking(categoryRef, data, { merge: true });
      }
      
      toast({
        title: "Plano provisionado",
        description: "A estrutura profissional foi carregada com sucesso.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro ao provisionar",
        description: "Não foi possível carregar a estrutura padrão.",
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSaveCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;

    const formData = new FormData(e.currentTarget);
    const categoryId = `cat_${Date.now()}`;
    const categoryRef = doc(db, "users", user.uid, "accountCategories", categoryId);

    const newCategory: AccountCategory = {
      id: categoryId,
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      description: (formData.get("description") as string) || "",
      type: parentForNew?.type || "Expense",
      parentCategoryId: parentForNew?.id || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(categoryRef, newCategory, { merge: true });
    
    toast({
      title: "Categoria criada",
      description: `${newCategory.name} foi adicionada ao plano de contas.`,
    });

    setIsDialogOpen(false);
    if (parentForNew) {
      setExpanded(prev => prev.includes(parentForNew.id) ? prev : [...prev, parentForNew.id]);
    }
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
            level === 0 ? "font-bold bg-primary/5 border-primary/10 mt-6 first:mt-0 text-primary" : "hover:bg-muted/50",
            level === 1 ? "ml-6 font-semibold" : "",
            level === 2 ? "ml-12 text-muted-foreground text-sm" : ""
          )}
          onClick={() => toggle(id)}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : <div className="w-4 shrink-0" />}
          
          <span className={cn(
            "text-[10px] font-mono shrink-0",
            level === 0 ? "text-primary/70" : "text-muted-foreground/50"
          )}>
            {item.code}
          </span>
          <span className="flex-1 truncate">{item.name}</span>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenNew(item);
              }}
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                openDeleteDialog(item);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        {isExpanded && children.map(child => renderItem(child.id, level + 1))}
      </div>
    );
  };

  const roots = categories?.filter(x => !x.parentCategoryId || x.parentCategoryId === "") || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-primary w-8 h-8" />
            Plano de Contas
          </h1>
          <p className="text-muted-foreground">A hierarquia estrutural das categorias do seu negócio.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExportExcel} disabled={isLoading || roots.length === 0}>
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
          {roots.length === 0 && !isLoading && (
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={handleProvisionDefaults} disabled={isProvisioning}>
              {isProvisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Importar Estrutura Padrão
            </Button>
          )}
          <Button className="gap-2 shadow-md" onClick={() => handleOpenNew()}>
            <Plus className="w-4 h-4" /> Nova Categoria
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm min-h-[400px]">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderTree className="w-5 h-5 text-primary" />
              Estrutura Hierárquica
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Carregando plano de contas...</p>
              </div>
            ) : roots.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <FolderPlus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">Seu plano de contas está vazio</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Comece criando um grupo principal ou use nossa estrutura profissional pré-definida.
                </p>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={handleProvisionDefaults} disabled={isProvisioning}>
                    {isProvisioning ? "Importando..." : "Importar Plano Padrão"}
                  </Button>
                  <Button onClick={() => handleOpenNew()}>Criar Manualmente</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {roots.sort((a,b) => a.code.localeCompare(b.code)).map(root => renderItem(root.id))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-sm">Dica de Gestão</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                A estrutura <strong>Grupo &gt; Subgrupo &gt; Item</strong> permite que você veja o macro (quanto gasto com Operacional) e o micro (quanto gasto com Gás GLP).
              </p>
              <p>
                Isso é fundamental para calcular sua Margem de Contribuição e identificar onde estão os gargalos do seu caixa.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Estatísticas do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Grupos Principais</span>
                <Badge variant="outline">{roots.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Categorias Totais</span>
                <Badge variant="outline" className="border-primary text-primary">
                  {categories?.length || 0}
                </Badge>
              </div>
              <div className="pt-4 border-t text-[10px] text-muted-foreground italic">
                Última atualização: {new Date().toLocaleDateString('pt-BR')}
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
                {parentForNew ? `Nova Subcategoria em "${parentForNew.name}"` : "Nova Categoria Principal"}
              </DialogTitle>
              <DialogDescription>
                {parentForNew 
                  ? "Esta categoria herdará o tipo financeiro do grupo pai." 
                  : "Defina um grupo principal para organizar seus lançamentos."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Código</Label>
                <Input id="code" name="code" placeholder="Ex: 1.1" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Aluguel" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Descrição</Label>
                <Textarea id="description" name="description" placeholder="Opcional..." className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Salvar Categoria</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{categoryToDelete?.name}</strong>. 
              Esta ação não pode ser desfeita e pode afetar a visualização de lançamentos vinculados a esta categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
