
"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { 
  Link2, 
  CheckCircle, 
  Upload, 
  RefreshCw,
  Search,
  Check,
  X,
  PlusCircle,
  ArrowRightLeft
} from "lucide-react";
import { MOCK_OFX_ITEMS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

export default function ReconciliationPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState(MOCK_OFX_ITEMS);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMatch = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, matchedEntryId: 'matched' } : item
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Link2 className="text-primary w-8 h-8" />
            Conciliação Bancária
          </h1>
          <p className="text-muted-foreground">Sincronize seu extrato bancário com o sistema financeiro.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Auto-Match
          </Button>
          <Button className="gap-2">
            <Upload className="w-4 h-4" /> Importar OFX
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-primary uppercase">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 itens</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-emerald-700 uppercase">Conciliados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-800">1 item</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-destructive uppercase">Divergência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ 0,00</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conferência de Extrato</CardTitle>
          <CardDescription>Corresponda transações bancárias com seus lançamentos ou crie novos registros.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição Bancária</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Lançamento Correspondente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className={cn(item.matchedEntryId ? "bg-emerald-50/40" : "")}>
                  <TableCell className="font-mono text-xs">
                    {mounted ? new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR') : '...'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{item.description}</TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    item.amount < 0 ? "text-destructive" : "text-emerald-600"
                  )}>
                    R$ {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {item.matchedEntryId ? (
                      <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" /> 
                        Conciliado
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-[10px] uppercase text-muted-foreground border-dashed">
                          Sugestão de Match (Confiança: 85%)
                        </Badge>
                        <p className="text-xs font-bold text-primary">
                          {item.amount < 0 ? "Fornecedor: Peixaria Central" : "Receita: iFood Brasil"}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!item.matchedEntryId ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1 text-xs" 
                            onClick={() => toast({ title: "Nova Receita", description: "Iniciando criação a partir do extrato..." })}
                          >
                            <PlusCircle className="w-3 h-3" /> Criar Lançamento
                          </Button>
                          <Button 
                            onClick={() => handleMatch(item.id)} 
                            size="sm" 
                            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Check className="w-3 h-3" /> Confirmar
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Desfazer">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="p-4 bg-muted/30 rounded-lg border border-dashed flex items-start gap-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold">Próximo passo: Automação</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Na próxima fase, ao clicar em "Criar Lançamento", o sistema abrirá o formulário já pré-preenchido com o valor e a data do extrato, 
            garantindo que sua contabilidade e seu banco estejam sempre em sintonia perfeita.
          </p>
        </div>
      </div>
    </div>
  );
}
