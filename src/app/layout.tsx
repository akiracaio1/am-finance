
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { initializeFirebase, FirebaseClientProvider } from "@/firebase";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { cn } from "@/lib/utils";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [firebaseData, setFirebaseData] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const data = initializeFirebase();
    setFirebaseData(data);

    const unsubscribe = onAuthStateChanged(data.auth, (user) => {
      const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";
      
      // Se não houver usuário e não estiver em uma página de auth, vai para login
      if (!user && !isAuthPage) {
        router.push("/login");
      } 
      // Se estiver logado e tentar acessar a raiz ou login, vai para dashboard
      else if (user && (pathname === "/" || isAuthPage)) {
        router.push("/dashboard");
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

  // Prevenção de Hydration Mismatch: renderiza apenas o básico no servidor
  if (!mounted) {
    return (
      <html lang="pt-BR">
        <body className="bg-background">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-primary font-bold">Iniciando AM Finance...</div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <title>AM Finance - Controle financeiro inteligente</title>
      </head>
      <body className="font-body antialiased bg-background" suppressHydrationWarning>
        <FirebaseClientProvider>
          <div className="flex min-h-screen">
            {!isAuthPage && <AppSidebar />}
            <main className={cn("flex-1 overflow-auto", !isAuthPage ? "p-8" : "")}>
              {loading && !isAuthPage ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : children}
            </main>
          </div>
          <FirebaseErrorListener />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
