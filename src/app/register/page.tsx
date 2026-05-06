
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) {
      toast({
        variant: "destructive",
        title: "Erro de Configuração",
        description: "Serviços do Firebase não inicializados. Verifique as chaves de API.",
      });
      return;
    }

    if (!lgpdAccepted) {
      toast({
        variant: "destructive",
        title: "LGPD",
        description: "Você precisa aceitar os termos de uso e privacidade.",
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const companyId = `comp_${Date.now()}`;

      // Tenta criar a empresa
      const companyRef = doc(db, "companies", companyId);
      const companyData = {
        name: companyName,
        createdAt: serverTimestamp(),
        lgpdConsent: true,
      };

      setDoc(companyRef, companyData)
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: companyRef.path,
            operation: 'create',
            requestResourceData: companyData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      // Tenta criar o perfil do usuário
      const userRef = doc(db, "users", user.uid);
      const userData = {
        email,
        companyId,
        displayName: companyName,
      };

      setDoc(userRef, userData)
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'create',
            requestResourceData: userData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      toast({
        title: "Sucesso!",
        description: "Cadastro realizado. Redirecionando...",
      });
      
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (error: any) {
      console.error("Erro completo do Firebase:", error);
      
      let message = "Erro inesperado. Tente novamente.";
      
      if (error.code === 'auth/operation-not-allowed') {
        message = "O provedor 'E-mail/Senha' está desativado no Console do Firebase (Authentication > Sign-in method).";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "Este e-mail já está sendo utilizado por outra conta.";
      } else if (error.code === 'auth/weak-password') {
        message = "A senha é muito fraca. Use pelo menos 6 caracteres.";
      } else if (error.code === 'auth/invalid-email') {
        message = "O formato do e-mail é inválido.";
      } else if (error.code === 'auth/configuration-not-found' || error.code === 'auth/invalid-api-key') {
        message = "Configuração do Firebase inválida. Verifique o arquivo firebase/config.ts.";
      } else {
        message = error.message || message;
      }
      
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: `${message} [${error.code || 'unknown'}]`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Novo Cadastro AM Finance</CardTitle>
          <CardDescription>Crie sua conta para gerenciar múltiplas unidades com inteligência.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa / Unidade</Label>
              <Input 
                id="companyName" 
                placeholder="Minha Empresa Ltda" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail de Acesso</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha (mín. 6 caracteres)</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <div className="flex items-start space-x-2 pt-2">
              <Checkbox 
                id="lgpd" 
                checked={lgpdAccepted} 
                onCheckedChange={(checked) => setLgpdAccepted(checked as boolean)} 
              />
              <Label htmlFor="lgpd" className="text-xs text-muted-foreground leading-tight">
                Aceito que meus dados sejam processados conforme a LGPD para fins de gestão financeira e segurança do acesso no AM Finance.
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Registrar Empresa"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem uma conta? <Link href="/login" className="text-primary font-bold hover:underline">Entrar</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
