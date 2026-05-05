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
  const [expanded, setExpanded] = useState<string[]>(['1', '4']);

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
            "flex items-center gap-2 py-2 px-3 rounded-md transition-data cursor-pointer group",
            level === 0 ? "font-bold bg-muted/50 mt-4 first:mt-0" : "hover:bg-muted/30 ml-6",
            level > 1 ? "ml-12" : ""
          )}
          onClick={() => toggle(id)}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : <div className="w-4" />}
          
          <span className="text-xs font-mono text-muted-foreground w-12">{item.code}</span>
          <span className="flex-1">{item.name}</span>
          
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        
        {isExpanded && children.map(child => renderItem(child.id, level + 1))}
      </div>
    );
  };

  const roots = MOCK_CHART_OF_ACCOUNTS.filter(x => !x.parent);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-primary w-8 h-8" />
            Plano de Contas
          </h1>
          <p className="text-muted-foreground">A hierarquia estrutural das categorias do seu negócio.</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-primary" />
              Hierarquia de Contas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {roots.map(root => renderItem(root.id))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm">Por que isso importa?</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              Um plano de contas bem estruturado permite uma análise granular dos custos do seu negócio. 
              Ao separar "Peixe" de "Suprimentos" gerais, a Yumi Yumi pode identificar exatamente onde as margens brutas estão sendo impactadas.
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Estatísticas Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Grupos Principais</span>
                <Badge>2</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Subcategorias</span>
                <Badge>3</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Categorias Ativas</span>
                <Badge variant="outline" className="border-primary text-primary">5</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
