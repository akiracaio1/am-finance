
"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useCompany() {
  const { user } = useUser();
  const db = useFirestore();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserCompany() {
      if (!user || !db) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setCompanyId(userDoc.data().companyId);
        }
      } catch (error) {
        console.error("Erro ao buscar empresa do usuário:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserCompany();
  }, [user, db]);

  return { companyId, loading };
}
