"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Plus, 
  FolderTree, 
  ChevronRight, 
  ChevronDown
} from "lucide-react";
import { MOCK_CHART_OF_ACCOUNTS } from "@/lib/mock-data";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function ChartOfAccountsPage() {
  const [expanded, setExpanded] = useState<string[]>(['1', '2', '3', '4']);

  const toggle = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const renderItem = (id: string, level: number = 0) => {
    const item = MOCK_CHART_OF_ACCOUNTS.find(x => x.id === id);
    if (!item) return null;

    const children = MOCK_CHART_OF_ACCOUNTS.filter(x => x.parent === id);
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
          
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        
        {isExpanded && children.map(child => renderItem(child.id, level + 1))}
      </div>
    );
  };

  const roots = MOCK_CHART_OF_ACCOUNTS.filter(x => !x.parent);

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
        <Button className="gap-2 shadow-md">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderTree className="w-5 h-5 text-primary" />
              Estrutura Hierárquica
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-1">
              {roots.map(root => renderItem(root.id))}
            </div>
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
                A estrutura <strong>Grupo > Subgrupo > Item</strong> permite que você veja o macro (quanto gasto com Operacional) e o micro (quanto gasto com Gás GLP).
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
                  {MOCK_CHART_OF_ACCOUNTS.length}
                </Badge>
              </div>
              <div className="pt-4 border-t text-[10px] text-muted-foreground italic">
                Última atualização: {new Date().toLocaleDateString('pt-BR')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
