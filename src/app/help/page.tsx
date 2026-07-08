"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Link2, 
  PieChart, 
  CalendarClock, 
  BookOpen,
  Sparkles,
  Info,
  HelpCircle,
  Zap,
  Globe,
  ShieldCheck
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const modules = [
  {
    title: "Painel (Dashboard)",
    icon: LayoutDashboard,
    color: "text-primary",
    description: "Sua visão 360º do negócio. Aqui você acompanha o saldo consolidado de todas as contas, o total que ainda tem a receber e o que precisa pagar com urgência. O gráfico de evolução mostra se sua receita está crescendo mês a mês.",
    instructions: [
      "Monitore o 'Saldo em Caixa' para saúde imediata.",
      "Fique atento ao alerta de 'Itens em Atraso' para evitar juros.",
      "Use os atalhos rápidos para lançar novas despesas."
    ]
  },
  {
    title: "Fornecedores",
    icon: Users,
    color: "text-primary",
    description: "Base de dados de todos os seus parceiros. Essencial para organizar para quem você deve pagar e manter o contato centralizado.",
    instructions: [
      "Cadastre o CNPJ corretamente para emissão de relatórios fiscais.",
      "Categorize por tipo (Insumos, Aluguel, Serviços) para análise no Plano de Contas.",
      "Acesse o extrato individual para ver histórico de compras."
    ]
  },
  {
    title: "Contas a Pagar",
    icon: ArrowDownCircle,
    color: "text-destructive",
    description: "Gestão detalhada de saídas. Controle tudo o que sai do seu caixa de forma organizada com filtros inteligentes e multi-seleção.",
    instructions: [
      "Use os filtros múltiplos para ver 'Atrasado' e 'Hoje' ao mesmo tempo.",
      "Importe planilhas Excel (formatos Serial, Brasileiro ou ISO).",
      "Liquide contas informando a data exata do pagamento."
    ]
  },
  {
    title: "Contas a Receber",
    icon: ArrowUpCircle,
    color: "text-accent",
    description: "Controle de entradas. Importante para conferir se os repasses de vendas estão entrando conforme o esperado.",
    instructions: [
      "Analise os canais de venda para ver qual é mais lucrativo.",
      "Importe arquivos Excel de faturamento para automação.",
      "Acompanhe o 'Ticket Médio' para entender o faturamento."
    ]
  },
  {
    title: "Conciliação Bancária",
    icon: Link2,
    color: "text-primary",
    description: "O momento da verdade. Cruza o que o banco diz (Arquivo OFX) com o que você registrou no sistema.",
    instructions: [
      "Importe seu arquivo OFX do banco.",
      "O sistema sugere correspondências automáticas baseadas em valor e data.",
      "Apenas confirme se o registro bancário bate com sua conta."
    ]
  },
  {
    title: "Relatórios & IA",
    icon: PieChart,
    color: "text-accent",
    description: "Módulo estratégico. O DRE mostra o lucro real após todos os custos. A IA analisa esses números e dá consultoria personalizada.",
    instructions: [
      "Gere o DRE mensal para ver sua margem líquida.",
      "Use o botão 'Analisar com IA' para descobrir riscos ocultos.",
      "Exporte o Plano de Contas estruturado para Excel."
    ]
  }
];

export default function HelpPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <HelpCircle className="text-primary w-8 h-8" />
            Central de Instruções
          </h1>
          <p className="text-muted-foreground">Guia detalhado para dominar a gestão financeira com o AM Finance.</p>
        </div>
        <Badge variant="outline" className="gap-1 border-primary text-primary">
          <Globe className="w-3 h-3" /> Sistema Web Ativo
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4" />
          <AlertTitle>Dica de Ouro</AlertTitle>
          <AlertDescription>
            O sistema foi desenhado para ser alimentado diariamente. Com os novos filtros de multi-seleção e a importação de Excel corrigida, você ganha velocidade na gestão.
          </AlertDescription>
        </Alert>

        <Alert className="bg-accent/5 border-accent/20">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <AlertTitle>Acesso Seguro na Web</AlertTitle>
          <AlertDescription>
            Sua empresa está protegida. O acesso é restrito via login e senha, com os dados criptografados e hospedados na infraestrutura Google Cloud.
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod) => (
          <Card key={mod.title} className="hover:shadow-md transition-data flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted", mod.color)}>
                <mod.icon className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{mod.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mod.description}
              </p>
              <div className="bg-muted/30 p-3 rounded-md mt-auto">
                <h4 className="text-xs font-bold uppercase mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" /> Como usar:
                </h4>
                <ul className="text-xs space-y-1.5 list-disc list-inside text-foreground/80">
                  {mod.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 text-white border-none overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-3 bg-white/10 rounded-full">
            <Globe className="w-6 h-6 text-accent" />
          </div>
          <div>
            <CardTitle>AM Finance: Sua Empresa na Web</CardTitle>
            <p className="text-slate-400 text-sm">Disponível em qualquer dispositivo, em qualquer lugar.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-300">
          <p>
            O AM Finance é uma aplicação <strong>Cloud-Native</strong>. Isso significa que ele não precisa ser instalado. 
            Você pode acessar o endereço do seu sistema de um computador no escritório ou de um celular em casa.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <ul className="list-disc list-inside space-y-2">
              <li>Sincronização em tempo real</li>
              <li>Backups automáticos no Google Cloud</li>
              <li>Acesso via Celular, Tablet ou PC</li>
            </ul>
            <ul className="list-disc list-inside space-y-2">
              <li>Segurança via Firebase Auth</li>
              <li>Relatórios de IA processados na nuvem</li>
              <li>Importação de Excel Multi-formato</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
