
'use client';

import React, { type ReactNode, useState, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * O FirebaseClientProvider gerencia a inicialização dos serviços do Firebase estritamente no cliente.
 * Ele evita erros de contexto garantindo que os componentes filhos (que usam hooks do Firebase)
 * só sejam renderizados quando o provedor estiver ativo e com os serviços prontos.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [firebaseServices, setFirebaseServices] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    // Inicializa o Firebase apenas uma vez após a montagem do componente no cliente
    const services = initializeFirebase();
    if (services && services.firebaseApp) {
      setFirebaseServices(services);
    }
  }, []);

  // CRITICAL: Não renderiza os filhos até que o componente esteja montado E os serviços do Firebase estejam prontos.
  // Isso evita o erro "useFirebase must be used within a FirebaseProvider" em componentes como AppSidebar.
  if (!mounted || !firebaseServices) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
