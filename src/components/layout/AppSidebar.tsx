
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Link2, 
  PieChart, 
  CalendarClock,
  BookOpen,
  HelpCircle,
  FileSearch,
  Wallet,
  LayoutGrid,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const menuItems = [
  { name: "Painel", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Fornecedores", icon: Users, href: "/suppliers" },
  { name: "Contas a Pagar", icon: ArrowDownCircle, href: "/accounts-payable" },
  { name: "Contas a Receber", icon: ArrowUpCircle, href: "/accounts-receivable" },
  { name: "Conciliação", icon: Link2, href: "/reconciliation" },
  { name: "Planejamento", icon: CalendarClock, href: "/planning" },
  { name: "Relatórios & IA", icon: PieChart, href: "/reports" },
  { name: "Diagnóstico", icon: FileSearch, href: "/import-diagnosis" },
  { name: "Plano de Contas", icon: BookOpen, href: "/chart-of-accounts" },
  { name: "Centros de Custo", icon: LayoutGrid, href: "/cost-centers" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
      toast({
        title: "Até logo!",
        description: "Sua sessão foi encerrada com sucesso.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: "Não foi possível encerrar sua sessão no momento.",
      });
    }
  };

  return (
    <div className="w-64 bg-card border-r h-screen flex flex-col sticky top-0 shadow-sm transition-all">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          <span>AM Finance</span>
        </h1>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-bold">Controle Inteligente</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-data group",
              pathname === item.href
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5",
              pathname === item.href ? "text-primary-foreground" : "text-primary group-hover:text-primary transition-colors"
            )} />
            {item.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t space-y-2">
        <Link
          href="/help"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-data",
            pathname === "/help" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <HelpCircle className="w-4 h-4" />
          Central de Ajuda
        </Link>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 px-3 py-2 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sair do Sistema
        </Button>

        <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg mt-2">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold">
            AM
          </div>
          <div className="truncate">
            <p className="text-xs font-bold truncate">Administrador</p>
            <p className="text-[10px] text-muted-foreground">Conta Principal</p>
          </div>
        </div>
      </div>
    </div>
  );
}
