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
  HelpCircle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    description: "Gestão detalhada de saídas. Controle tudo o que sai do seu caixa, desde o peixe diário até os custos fixos.",
    instructions: [
      "Filtre por status para focar no que está 'Atrasado'.",
      "Diferencie 'Aberto' de 'Pago' para manter o fluxo de caixa atualizado.",
      "Acompanhe o 'Total em Atraso' no topo para priorizar pagamentos."
    ]
  },
  {
    title: "Contas a Receber",
    icon: ArrowUpCircle,
    color: "text-accent",
    description: "Controle de entradas. Importante para conferir se os repasses de plataformas (iFood, Rappi) e vendas de balcão estão entrando conforme o esperado.",
    instructions: [
      "Analise os canais de venda para ver qual é mais lucrativo.",
      "Importe CSVs de faturamento para automação.",
      "Monitore o 'Ticket Médio' para entender o comportamento do cliente."
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
      "Apenas confirme ('Confirmar') se o registro bancário bate com sua conta a pagar/receber."
    ]
  },
  {
    title: "Planejamento Diário",
    icon: CalendarClock,
    color: "text-primary",
    description: "Sua 'bola de cristal'. Simula como estará seu saldo nos próximos 7 dias com base no que já está agendado para entrar e sair.",
    instructions: [
      "Veja se algum dia o saldo ficará negativo (vermelho).",
      "Simule despesas futuras para ver o impacto no caixa antes de comprar.",
      "Ajuda na decisão de qual dia é melhor para pagar grandes fornecedores."
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
      "Aplique as recomendações da IA para otimizar custos de insumos (como salmão e arroz)."
    ]
  },
  {
    title: "Plano de Contas",
    icon: BookOpen,
    color: "text-primary",
    description: "A árvore de organização. Define as categorias de onde o dinheiro vem e para onde vai.",
    instructions: [
      "Mantenha a hierarquia limpa (ex: Operacional -> Insumos -> Peixe).",
      "Categorias bem definidas permitem saber exatamente onde você gasta mais.",
      "Não mude com frequência para não perder histórico comparativo."
    ]
  }
];

export default function HelpPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <HelpCircle className="text-primary w-8 h-8" />
          Central de Instruções
        </h1>
        <p className="text-muted-foreground">Guia detalhado para dominar a gestão financeira da Yumi Yumi 🍣.</p>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4" />
        <AlertTitle>Dica de Ouro</AlertTitle>
        <AlertDescription>
          O sistema foi desenhado para ser alimentado diariamente. Quanto mais precisos forem os lançamentos em "Contas a Pagar", melhor será a análise da nossa IA nos Relatórios.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => (
          <Card key={mod.title} className="hover:shadow-md transition-data">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted", mod.color)}>
                <mod.icon className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{mod.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mod.description}
              </p>
              <div className="bg-muted/30 p-3 rounded-md">
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
    </div>
  );
}
