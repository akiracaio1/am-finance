
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
  RotateCcw
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { CostCenter, CostCenterGroup, CostCenterStatus } from "@/lib/types";

export default function CostCentersPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isCenterDialogOpen, setIsCenterDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroupId, setFilterGroupId] = useState<string>("all");
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
    const id = `ccg_${Date.now()}`;
    const data: CostCenterGroup = {
      id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      createdAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, "users", user.uid, "costCenterGroups", id), data, { merge: true });
    toast({ title: "Grupo criado", description: data.name });
    setIsGroupDialogOpen(false);
  };

  const handleSaveCenter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.currentTarget);
    const id = `cc_${Date.now()}`;
    const data: CostCenter = {
      id,
      groupId: formData.get("groupId") as string,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, "users", user.uid, "costCenters", id), data, { merge: true });
    toast({ title: "Centro de Custo criado", description: data.name });
    setIsCenterDialogOpen(false);
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

  const filteredData = useMemo(() => {
    if (!centers || !groups) return [];
    
    return centers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchGroup = filterGroupId === "all" || c.groupId === filterGroupId;
      const matchStatus = filterStatus === "all" || c.status === filterStatus;
      return matchSearch && matchGroup && matchStatus;
    });
  }, [centers, groups, searchTerm, filterGroupId, filterStatus]);

  const groupedCenters = useMemo(() => {
    const map: Record<string, CostCenter[]> = {};
    filteredData.forEach(c => {
      if (!map[c.groupId]) map[c.groupId] = [];
      map[c.groupId].push(c);
    });
    return map;
  }, [filteredData]);

  if (loadingGroups || loadingCenters) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutGrid className="text-primary w-8 h-8" />
            Centros de Custo
          </h1>
          <p className="text-muted-foreground">Estrutura organizacional para análise de rentabilidade e custos.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FolderPlus className="w-4 h-4" /> Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSaveGroup}>
                <DialogHeader>
                  <DialogTitle>Novo Grupo Organizacional</DialogTitle>
                  <DialogDescription>Crie categorias como "Delivery", "Eventos" ou "Administrativo".</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="gname">Nome do Grupo *</Label>
                    <Input id="gname" name="name" placeholder="Ex: Operação Interna" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gdesc">Descrição</Label>
                    <Input id="gdesc" name="description" placeholder="Breve resumo do grupo..." />
                  </div>
                </div>
                <DialogFooter><Button type="submit" className="w-full">Criar Grupo</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCenterDialogOpen} onOpenChange={setIsCenterDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg" disabled={!groups || groups.length === 0}>
                <Plus className="w-4 h-4" /> Novo Centro de Custo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSaveCenter}>
                <DialogHeader>
                  <DialogTitle>Novo Centro de Custo</DialogTitle>
                  <DialogDescription>Vincule este centro a um grupo para melhor organização.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Grupo Pai *</Label>
                    <Select name="groupId" required>
                      <SelectTrigger><SelectValue placeholder="Selecione o grupo..." /></SelectTrigger>
                      <SelectContent>
                        {groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cname">Nome do Centro *</Label>
                    <Input id="cname" name="name" placeholder="Ex: Unidade Shopping" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cdesc">Descrição</Label>
                    <Input id="cdesc" name="description" placeholder="Opcional..." />
                  </div>
                </div>
                <DialogFooter><Button type="submit" className="w-full">Salvar Centro</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Busca</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome do centro..." 
                  className="pl-9 bg-background" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={filterGroupId} onValueChange={setFilterGroupId}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Grupos</SelectItem>
                  {groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
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
        {groups?.sort((a,b) => a.name.localeCompare(b.name)).map(group => {
          const groupCenters = groupedCenters[group.id] || [];
          if (groupCenters.length === 0 && filterGroupId !== "all") return null;
          if (groupCenters.length === 0 && searchTerm) return null;

          const isExpanded = expandedGroups.includes(group.id) || searchTerm !== "" || filterGroupId !== "all";

          return (
            <div key={group.id} className="space-y-2">
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full flex items-center justify-between p-4 h-auto bg-card border hover:bg-muted/50 transition-all",
                  isExpanded ? "rounded-b-none border-b-0" : ""
                )}
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-bold text-sm uppercase tracking-tight">{group.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{groupCenters.length} centros</Badge>
                </div>
              </Button>
              
              {isExpanded && (
                <div className="border rounded-b-lg overflow-hidden bg-background">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="w-[300px]">Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupCenters.sort((a,b) => a.name.localeCompare(b.name)).map((center) => (
                        <TableRow key={center.id} className={cn(center.status === 'Archived' ? "opacity-60 bg-muted/10" : "")}>
                          <TableCell className="font-medium">{center.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{center.description || "-"}</TableCell>
                          <TableCell>
                            {center.status === 'Active' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none flex w-fit items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex w-fit items-center gap-1">
                                <Archive className="w-3 h-3" /> Arquivado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => toggleStatus(center)}
                                title={center.status === 'Active' ? "Arquivar" : "Ativar"}
                              >
                                {center.status === 'Active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm("Deseja realmente excluir permanentemente este centro?")) {
                                    deleteDocumentNonBlocking(doc(db!, "users", user!.uid, "costCenters", center.id));
                                    toast({ title: "Excluído", variant: "destructive" });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {groupCenters.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs italic">
                            Nenhum centro ativo neste grupo com os filtros atuais.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}

        {groups?.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-4">
            <LayoutGrid className="w-12 h-12 text-muted-foreground/20 mx-auto" />
            <div>
              <p className="font-bold text-muted-foreground">Nenhuma estrutura cadastrada.</p>
              <p className="text-xs text-muted-foreground">Comece criando um Grupo (ex: Operação) e depois adicione seus Centros.</p>
            </div>
            <Button onClick={() => setIsGroupDialogOpen(true)} variant="outline" className="gap-2">
              <FolderPlus className="w-4 h-4" /> Criar Primeiro Grupo
            </Button>
          </div>
        )}
      </div>

      <Card className="bg-primary/5 border-primary/10">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Guia de Gestão Pro
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-3">
          <p>
            <strong>Arquivamento Inteligente:</strong> Ao encerrar um projeto ou evento, utilize o botão de arquivar. 
            O centro deixará de poluir seus novos lançamentos, mas continuará 100% visível em seus relatórios de DRE e histórico.
          </p>
          <p>
            <strong>Hierarquia:</strong> Use os Grupos para separar grandes unidades de negócio (ex: Revenda vs. Delivery) e os Centros para unidades específicas (ex: Cliente X, Festival Y).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
