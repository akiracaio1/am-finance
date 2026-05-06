
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
import { Plus, Loader2, Trash2, LayoutGrid, Info } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CostCenter } from "@/lib/types";

export default function CostCentersPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const centersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "costCenters");
  }, [db, user]);

  const { data: centers, isLoading } = useCollection<CostCenter>(centersQuery);

  const handleSaveCenter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;

    const formData = new FormData(e.currentTarget);
    const centerId = `cc_${Date.now()}`;
    const centerRef = doc(db, "users", user.uid, "costCenters", centerId);

    const newCenter: CostCenter = {
      id: centerId,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(centerRef, newCenter, { merge: true });
    toast({ title: "Centro de Custo criado", description: `${newCenter.name} foi adicionado.` });
    setIsDialogOpen(false);
  };

  const deleteCenter = (center: CostCenter) => {
    if (!db || !user) return;
    const centerRef = doc(db, "users", user.uid, "costCenters", center.id);
    deleteDocumentNonBlocking(centerRef);
    toast({ title: "Centro de Custo removido", description: "O registro foi excluído." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutGrid className="text-primary w-8 h-8" />
            Centros de Custo
          </h1>
          <p className="text-muted-foreground">Defina os departamentos ou unidades de custo do seu negócio.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Centro de Custo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSaveCenter}>
              <DialogHeader>
                <DialogTitle>Novo Centro de Custo</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" name="name" placeholder="Ex: Cozinha, Administrativo, Filial 01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição (Opcional)</Label>
                  <Input id="description" name="description" placeholder="Breve detalhamento..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar Centro de Custo</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Unidades Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : centers?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhum centro de custo cadastrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centers?.map((center) => (
                    <TableRow key={center.id}>
                      <TableCell className="font-medium">{center.name}</TableCell>
                      <TableCell>{center.description || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteCenter(center)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/10">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              O que é um Centro de Custo?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-3">
            <p>
              Centros de Custo permitem que você separe suas despesas por departamentos, projetos ou filiais.
            </p>
            <p>
              <strong>Exemplo:</strong> Você pode ter uma categoria "Insumos", mas quer saber quanto dessa despesa foi para a "Cozinha" e quanto foi para o "Bar".
            </p>
            <p>
              Ao vincular lançamentos a Centros de Custo, seus relatórios de rentabilidade tornam-se muito mais precisos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
