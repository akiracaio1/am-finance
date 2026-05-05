"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Link2, 
  PieChart, 
  CalendarClock,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Suppliers", icon: Users, href: "/suppliers" },
  { name: "Accounts Payable", icon: ArrowDownCircle, href: "/accounts-payable" },
  { name: "Accounts Receivable", icon: ArrowUpCircle, href: "/accounts-receivable" },
  { name: "Reconciliation", icon: Link2, href: "/reconciliation" },
  { name: "Planning", icon: CalendarClock, href: "/planning" },
  { name: "Reports & AI", icon: PieChart, href: "/reports" },
  { name: "Chart of Accounts", icon: BookOpen, href: "/chart-of-accounts" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-card border-r h-screen flex flex-col sticky top-0 shadow-sm transition-all">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span>Yumi Yumi</span>
          <span className="text-xl">🍣</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Finance Suite</p>
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
      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold">
            YY
          </div>
          <div>
            <p className="text-xs font-bold">Chef Yumi</p>
            <p className="text-[10px] text-muted-foreground">Owner</p>
          </div>
        </div>
      </div>
    </div>
  );
}
