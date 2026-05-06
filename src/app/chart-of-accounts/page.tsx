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
  FolderPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

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

export default function ChartOfAccountsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [parentForNew, setParentForNew] = useState<AccountCategory | null>(null);

  // Firestore connection
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
      type: parentForNew?.type || "Expense", // Default or inherit from parent
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
    // Expand the parent automatically to show the new item
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
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenNew(item);
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        
        {isExpanded && children.map(child => renderItem(child.id, level + 1))}
      </div>
    );
  };

  const roots = categories?.filter(x => !x.parentCategoryId) || [];

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
        <Button className="gap-2 shadow-md" onClick={() => handleOpenNew()}>
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
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
                  Crie grupos principais como "Operacional" ou "Custos Fixos" para começar a organizar suas finanças.
                </p>
                <Button onClick={() => handleOpenNew()}>Criar Primeira Categoria</Button>
              </div>
            ) : (
              <div className="space-y-1">
                {roots.map(root => renderItem(root.id))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-sm">Por que isso importa?</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Um plano de contas bem estruturado permite uma análise granular dos custos do seu negócio. 
                Ao separar <strong>Insumos</strong> de <strong>Custos Fixos</strong>, a AM Finance consegue calcular sua Margem de Contribuição real.
              </p>
              <p>
                A estrutura <strong>Grupo &gt; Subgrupo &gt; Item</strong> permite que você veja o macro (quanto gasto com Operacional) e o micro (quanto gasto com Gás GLP).
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
    </div>
  );
}
