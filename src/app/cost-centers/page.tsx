
"use client";

import { useState, useMemo } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Loader2, 
  Trash2, 
  LayoutGrid, 
  Info, 
  Archive, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Pencil,
  MoreVertical
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
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { CostCenter, CostCenterGroup, CostCenterStatus } from "@/lib/types";

export default function CostCentersPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isCenterDialogOpen, setIsCenterDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  
  // Estados para Edição
  const [editingGroup, setEditingGroup] = useState<CostCenterGroup | null>(null);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("Active");

  const groupsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenterGroups");
  }, [db, user]);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const { data: groups, isLoading: loadingGroups } = useCollection<CostCenterGroup>(groupsQuery);
  const { data: centers, isLoading: loadingCenters } = useCollection<CostCenter>(centersQuery);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSaveGroup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    
    const id = editingGroup ? editingGroup.id : `ccg_${Date.now()}`;
    const parentId = formData.get("parentGroupId") as string;
    
    const data: CostCenterGroup = {
      id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      parentGroupId: parentId === "none" ? undefined : parentId,
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setDocumentNonBlocking(doc(db, "users", user.uid, "costCenterGroups", id), data, { merge: true });
    toast({ title: editingGroup ? "Grupo atualizado" : "Grupo criado" });
    setIsGroupDialogOpen(false);
    setEditingGroup(null);
  };

  const handleSaveCenter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    
    const id = editingCenter ? editingCenter.id : `cc_${Date.now()}`;
    
    const data: CostCenter = {
      id,
      groupId: formData.get("groupId") as string,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      status: editingCenter ? editingCenter.status : 'Active',
      createdAt: editingCenter ? editingCenter.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setDocumentNonBlocking(doc(db, "users", user.uid, "costCenters", id), data, { merge: true });
    toast({ title: editingCenter ? "Centro atualizado" : "Centro criado" });
    setIsCenterDialogOpen(false);
    setEditingCenter(null);
  };

  const toggleStatus = (center: CostCenter) => {
    if (!db || !user) return;
    const newStatus: CostCenterStatus = center.status === 'Active' ? 'Archived' : 'Active';
    updateDocumentNonBlocking(doc(db, "users", user.uid, "costCenters", center.id), {
      status: newStatus,
      archivedAt: newStatus === 'Archived' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    });
    toast({ 
      title: newStatus === 'Archived' ? "Arquivado" : "Ativado", 
      description: `${center.name} agora está ${newStatus === 'Archived' ? 'arquivado' : 'ativo'}.` 
    });
  };

  const handleDeleteGroup = (group: CostCenterGroup) => {
    if (!db || !user) return;
    const hasChildren = centers?.some(c => c.groupId === group.id) || groups?.some(g => g.parentGroupId === group.id);
    if (hasChildren) {
      alert("Não é possível excluir um grupo que possui centros de custo ou subgrupos vinculados.");
      return;
    }
    if (confirm(`Excluir o grupo "${group.name}" permanentemente?`)) {
      deleteDocumentNonBlocking(doc(db, "users", user.uid, "costCenterGroups", group.id));
      toast({ title: "Grupo removido" });
    }
  };

  // Lógica de Renderização Recursiva para Grupos e Centros
  const renderTree = (parentGroupId: string | undefined = undefined, level: number = 0) => {
    if (!groups) return null;

    const filteredGroups = groups
      .filter(g => g.parentGroupId === parentGroupId)
      .sort((a, b) => a.name.localeCompare(b.name));

    return filteredGroups.map(group => {
      const groupCenters = centers?.filter(c => 
        c.groupId === group.id && 
        (filterStatus === "all" || c.status === filterStatus) &&
        (searchTerm === "" || c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      ).sort((a, b) => a.name.localeCompare(b.name)) || [];

      const subGroups = groups.filter(g => g.parentGroupId === group.id);
      const isExpanded = expandedGroups.includes(group.id) || searchTerm !== "";
      const hasContent = groupCenters.length > 0 || subGroups.length > 0;

      return (
        <div key={group.id} className="space-y-1">
          <div 
            className={cn(
              "flex items-center justify-between group py-2 px-3 rounded-md transition-all hover:bg-muted/40 border border-transparent",
              level === 0 ? "bg-muted/20 font-bold" : "ml-6 text-sm border-l-muted-foreground/20"
            )}
          >
            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleGroup(group.id)}>
              {hasContent ? (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : <div className="w-4" />}
              <LayoutGrid className={cn("w-3 h-3 text-primary/60", level === 0 ? "w-4 h-4" : "")} />
              <span>{group.name}</span>
              {groupCenters.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4">{groupCenters.length}</Badge>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={() => { setEditingGroup(group); setIsGroupDialogOpen(true); }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive"
                onClick={() => handleDeleteGroup(group)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-1">
              {/* Subgrupos */}
              {renderTree(group.id, level + 1)}

              {/* Centros de Custo (Folhas) */}
              {groupCenters.map(center => (
                <div 
                  key={center.id} 
                  className={cn(
                    "ml-12 flex items-center justify-between py-2 px-3 rounded-md border border-dashed hover:border-primary/30 transition-all group/center",
                    center.status === 'Archived' ? "opacity-60 bg-muted/30" : "bg-background"
                  )}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{center.name}</span>
                      {center.status === 'Archived' && (
                        <Badge variant="secondary" className="text-[8px] h-3 uppercase">Arquivado</Badge>
                      )}
                    </div>
                    {center.description && (
                      <span className="text-[10px] text-muted-foreground">{center.description}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover/center:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => { setEditingCenter(center); setIsCenterDialogOpen(true); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => toggleStatus(center)}
                      title={center.status === 'Active' ? "Arquivar" : "Ativar"}
                    >
                      {center.status === 'Active' ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir o centro "${center.name}" permanentemente?`)) {
                          deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "costCenters", center.id));
                          toast({ title: "Excluído" });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  if (loadingGroups || loadingCenters) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutGrid className="text-primary w-8 h-8" />
            Centros de Custo
          </h1>
          <p className="text-muted-foreground">Estrutura organizacional multinível para análise de rentabilidade.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => { setEditingGroup(null); setIsGroupDialogOpen(true); }}>
            <FolderPlus className="w-4 h-4" /> Novo Grupo / Subgrupo
          </Button>
          <Button className="gap-2 shadow-lg" disabled={!groups || groups.length === 0} onClick={() => { setEditingCenter(null); setIsCenterDialogOpen(true); }}>
            <Plus className="w-4 h-4" /> Novo Centro de Custo
          </Button>
        </div>
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2 md:col-span-3">
              <Label>Busca por Nome</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filtrar centros ou grupos..." 
                  className="pl-9 bg-background" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status dos Centros</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Ativos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="Active">Somente Ativos</SelectItem>
                  <SelectItem value="Archived">Arquivados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {renderTree()}

        {groups?.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-4">
            <LayoutGrid className="w-12 h-12 text-muted-foreground/20 mx-auto" />
            <div>
              <p className="font-bold text-muted-foreground">Nenhuma estrutura cadastrada.</p>
              <p className="text-xs text-muted-foreground">Comece criando um Grupo Raiz (ex: Operação) e depois seus Centros.</p>
            </div>
            <Button onClick={() => setIsGroupDialogOpen(true)} variant="outline" className="gap-2">
              <FolderPlus className="w-4 h-4" /> Criar Primeiro Grupo
            </Button>
          </div>
        )}
      </div>

      {/* MODAL GRUPOS / SUBGRUPOS */}
      <Dialog open={isGroupDialogOpen} onOpenChange={(open) => { setIsGroupDialogOpen(open); if(!open) setEditingGroup(null); }}>
        <DialogContent>
          <form onSubmit={handleSaveGroup}>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo ou Subgrupo'}</DialogTitle>
              <DialogDescription>Grupos organizam seus centros de custo de forma hierárquica.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Grupo Pai (opcional para Subgrupos)</Label>
                <Select name="parentGroupId" defaultValue={editingGroup?.parentGroupId || "none"}>
                  <SelectTrigger><SelectValue placeholder="Sem grupo pai (Raiz)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Este é um Grupo Raiz)</SelectItem>
                    {groups?.filter(g => g.id !== editingGroup?.id).map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gname">Nome do Grupo *</Label>
                <Input id="gname" name="name" defaultValue={editingGroup?.name} placeholder="Ex: Operação Interna" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gdesc">Descrição</Label>
                <Input id="gdesc" name="description" defaultValue={editingGroup?.description} placeholder="Opcional..." />
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">{editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CENTROS DE CUSTO */}
      <Dialog open={isCenterDialogOpen} onOpenChange={(open) => { setIsCenterDialogOpen(open); if(!open) setEditingCenter(null); }}>
        <DialogContent>
          <form onSubmit={handleSaveCenter}>
            <DialogHeader>
              <DialogTitle>{editingCenter ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</DialogTitle>
              <DialogDescription>O centro de custo é a unidade final onde as despesas são lançadas.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Grupo / Subgrupo Pai *</Label>
                <Select name="groupId" defaultValue={editingCenter?.groupId} required>
                  <SelectTrigger><SelectValue placeholder="Selecione o grupo..." /></SelectTrigger>
                  <SelectContent>
                    {groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cname">Nome do Centro *</Label>
                <Input id="cname" name="name" defaultValue={editingCenter?.name} placeholder="Ex: Unidade Shopping" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cdesc">Descrição</Label>
                <Input id="cdesc" name="description" defaultValue={editingCenter?.description} placeholder="Opcional..." />
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">{editingCenter ? 'Salvar Alterações' : 'Criar Centro'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="bg-primary/5 border-primary/10">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Estrutura Hierárquica Premium
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-3">
          <p>
            <strong>Sub-subgrupos:</strong> Agora você pode criar níveis infinitos de organização. Por exemplo: <em>Eventos > Sociais > Casamentos > Noiva X</em>.
          </p>
          <p>
            <strong>Flexibilidade:</strong> Use os botões de edição para mover grupos ou centros de lugar conforme sua operação evolui. 
            O arquivamento permite manter o histórico intacto em relatórios sem poluir os novos lançamentos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
