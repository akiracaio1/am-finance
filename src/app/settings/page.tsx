
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  ShieldCheck, 
  History, 
  UserCircle, 
  Bell, 
  Lock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  UserCog
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { AuditLog } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("audit");

  const auditQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Pega os últimos 100 eventos para não sobrecarregar
    return query(
      collection(db, "users", user.uid, "auditLogs"),
      orderBy("timestamp", "desc"),
      limit(100)
    );
  }, [db, user]);

  const { data: logs, isLoading } = useCollection<AuditLog>(auditQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="text-primary w-8 h-8" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground">Gerencie usuários, permissões e audite atividades.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] h-11">
          <TabsTrigger value="profile" className="gap-2"><UserCircle className="w-4 h-4" /> Perfil</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><UserCog className="w-4 h-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><History className="w-4 h-4" /> Auditoria</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" /> Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Meu Perfil</CardTitle>
              <CardDescription>Informações da sua conta pessoal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome de Exibição</Label>
                  <Input defaultValue={user?.displayName || "Administrador"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input defaultValue={user?.email || ""} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="pt-4">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Sua conta está ativa e protegida.
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="pt-6">
          <Card className="border-dashed">
            <CardHeader className="text-center py-10">
              <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                <UserCog className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Gestão de Equipe (Em Breve)</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Estamos preparando o módulo para que você possa convidar sócios e colaboradores, definindo quem pode apenas ver ou quem pode editar os dados.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="pt-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div className="w-full md:max-w-sm space-y-2">
              <Label>Buscar nos Logs</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Ação, item ou data..." 
                  className="pl-9" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium bg-muted/30 px-4 py-2 rounded-lg border border-dashed">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Apenas administradores podem ver este histórico completo.</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-[180px]">Data e Hora</TableHead>
                    <TableHead className="w-[120px]">Ação</TableHead>
                    <TableHead>Descrição da Atividade</TableHead>
                    <TableHead className="w-[200px]">Realizado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const date = parseISO(log.timestamp);
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {log.action === 'CREATE' && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none gap-1 py-0 px-2 h-5">
                              <CheckCircle2 className="w-3 h-3" /> Criou
                            </Badge>
                          )}
                          {log.action === 'UPDATE' && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none gap-1 py-0 px-2 h-5">
                              <Clock className="w-3 h-3" /> Editou
                            </Badge>
                          )}
                          {log.action === 'DELETE' && (
                            <Badge variant="destructive" className="gap-1 py-0 px-2 h-5 border-none">
                              <Trash2 className="w-3 h-3" /> Excluiu
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{log.description}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Entidade: {log.entityType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] text-accent-foreground font-bold">
                              {log.userEmail.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[150px]">{log.userEmail}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredLogs.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                        Nenhum registro de auditoria encontrado para este filtro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6 flex gap-4 items-start">
              <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Por que logs são importantes?</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Os logs de auditoria garantem a integridade dos dados da sua empresa. Se um lançamento sumir, você poderá ver aqui exatamente quem o removeu e quando. Isso evita falhas de comunicação e aumenta a confiança na gestão financeira.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Segurança da Conta</CardTitle>
              <CardDescription>Gerencie sua senha e acessos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-between border">
                <div>
                  <p className="text-sm font-bold">Alterar Senha</p>
                  <p className="text-xs text-muted-foreground">Recomendamos trocar sua senha a cada 90 dias.</p>
                </div>
                <Button variant="outline" size="sm">Trocar agora</Button>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-between border">
                <div>
                  <p className="text-sm font-bold">Autenticação de Dois Fatores</p>
                  <p className="text-xs text-muted-foreground">Adicione uma camada extra de segurança ao seu login.</p>
                </div>
                <Badge variant="secondary">Em Breve</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
