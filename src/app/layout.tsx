
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { initializeFirebase, FirebaseClientProvider } from "@/firebase";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseData, setFirebaseData] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = initializeFirebase();
    setFirebaseData(data);

    const unsubscribe = onAuthStateChanged(data.auth, (user) => {
      if (!user && pathname !== "/login" && pathname !== "/register") {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (loading) {
    return (
      <html lang="pt-BR">
        <body className="flex items-center justify-center min-h-screen bg-background">
          <div className="animate-pulse text-2xl font-bold text-primary">Carregando Yumi Yumi... 🍣</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <title>Yumi Yumi 🍣 Finanças</title>
      </head>
      <body className="font-body antialiased bg-background">
        {firebaseData && (
          <FirebaseClientProvider
            firebaseApp={firebaseData.firebaseApp}
            firestore={firebaseData.firestore}
            auth={firebaseData.auth}
          >
            <div className="flex min-h-screen">
              {!isAuthPage && <AppSidebar />}
              <main className={cn("flex-1 overflow-auto", !isAuthPage ? "p-8" : "")}>
                {children}
              </main>
            </div>
            <Toaster />
          </FirebaseClientProvider>
        )}
      </body>
    </html>
  );
}
