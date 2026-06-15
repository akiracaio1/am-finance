'use client';

import React, { type ReactNode, useState, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * FirebaseClientProvider handles the initialization of Firebase services strictly on the client.
 * It prevents SSR (Server-Side Rendering) crashes by waiting for the mount event.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [firebaseServices, setFirebaseServices] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    // Initialize Firebase only once the component has mounted on the client
    const services = initializeFirebase();
    if (services && services.firebaseApp) {
      setFirebaseServices(services);
    }
  }, []);

  // Return a static fragment during SSR and while initializing to prevent Context errors
  if (!mounted || !firebaseServices) {
    return <>{children}</>;
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
