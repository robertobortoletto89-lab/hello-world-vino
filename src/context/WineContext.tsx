"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface WineContextType {
  selectedWineId: string | null;
  setSelectedWineId: (id: string | null) => void;
  resetWine: () => void;
  resetTrigger: number;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

export const WineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [selectedWineId, setSelectedWineIdState] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Sincronizza lo stato del contesto con il parametro dell'URL o sessionStorage
  useEffect(() => {
    const urlWineId = searchParams.get("id_prodotto");
    if (urlWineId) {
      if (urlWineId !== selectedWineId) {
        setSelectedWineIdState(urlWineId);
        sessionStorage.setItem("vinoSelezionato", urlWineId);
      }
    } else {
      const persistedWineId = sessionStorage.getItem("vinoSelezionato");
      if (persistedWineId && pathname !== "/" && pathname !== "/login") {
        setSelectedWineIdState(persistedWineId);
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set("id_prodotto", persistedWineId);
        const search = current.toString();
        const query = search ? `?${search}` : "";
        router.push(`${pathname}${query}`);
      } else if (selectedWineId !== null) {
        setSelectedWineIdState(null);
      }
    }
  }, [searchParams, pathname, router, selectedWineId]);

  const setSelectedWineId = (id: string | null) => {
    setSelectedWineIdState(id);
    
    // Persistenza in sessionStorage per compatibilità
    if (id) {
      sessionStorage.setItem("vinoSelezionato", id);
    } else {
      sessionStorage.removeItem("vinoSelezionato");
    }

    // Sincronizza con i parametri dell'URL
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (id) {
      current.set("id_prodotto", id);
    } else {
      current.delete("id_prodotto");
    }
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);

    // Dispatche un evento custom per i componenti che ascoltano eventi globali
    window.dispatchEvent(new CustomEvent("vino-persistito-cambiato", { detail: id }));
  };

  const resetWine = () => {
    setSelectedWineIdState(null);
    sessionStorage.removeItem("vinoSelezionato");

    // Svuota i parametri dell'URL relativi al vino
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.delete("id_prodotto");
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);

    // Dispatche l'evento di reset
    window.dispatchEvent(new CustomEvent("vino-persistito-cambiato", { detail: null }));
    
    // Incrementa il trigger di reset per allertare il Chatbot
    setResetTrigger((prev) => prev + 1);
  };

  return (
    <WineContext.Provider value={{ selectedWineId, setSelectedWineId, resetWine, resetTrigger }}>
      {children}
    </WineContext.Provider>
  );
};

export const useWine = () => {
  const context = useContext(WineContext);
  if (!context) {
    throw new Error("useWine must be used within a WineProvider");
  }
  return context;
};
