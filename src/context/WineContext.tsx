"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface WineContextType {
  selectedCantina: string;
  setSelectedCantina: (cantina: string) => void;
  selectedWineId: string | null;
  setSelectedWineId: (id: string | null) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  resetFilters: () => void;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

const INITIAL_WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Ciao, sono KYR-IA. In cosa ti posso aiutare oggi?"
};

export const WineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedCantina, setSelectedCantinaState] = useState<string>("all");
  const [selectedWineId, setSelectedWineIdState] = useState<string | null>(null);
  const [messages, setMessagesState] = useState<Message[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Caricamento iniziale dal client mount
  useEffect(() => {
    setIsMounted(true);
    
    // Carica cantina
    const savedCantina = sessionStorage.getItem("selectedCantina");
    const urlCantina = searchParams.get("cantina");
    if (urlCantina) {
      setSelectedCantinaState(urlCantina);
    } else if (savedCantina) {
      setSelectedCantinaState(savedCantina);
    }

    // Carica vino
    const savedWine = sessionStorage.getItem("selectedWineId");
    const urlWine = searchParams.get("id_prodotto");
    if (urlWine) {
      setSelectedWineIdState(urlWine);
    } else if (savedWine) {
      setSelectedWineIdState(savedWine);
    }

    // Carica messaggi
    const savedMessages = sessionStorage.getItem("chatMessages");
    if (savedMessages) {
      try {
        setMessagesState(JSON.parse(savedMessages));
      } catch {
        setMessagesState([INITIAL_WELCOME_MESSAGE]);
      }
    } else {
      setMessagesState([INITIAL_WELCOME_MESSAGE]);
    }
  }, []);

  // Sincronizza i cambiamenti di stato con sessionStorage e URL
  useEffect(() => {
    if (!isMounted) return;

    sessionStorage.setItem("selectedCantina", selectedCantina);
    if (selectedWineId) {
      sessionStorage.setItem("selectedWineId", selectedWineId);
    } else {
      sessionStorage.removeItem("selectedWineId");
    }
    sessionStorage.setItem("chatMessages", JSON.stringify(messages));

    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    if (selectedCantina && selectedCantina !== "all") {
      current.set("cantina", selectedCantina);
    } else {
      current.delete("cantina");
    }

    if (selectedWineId) {
      current.set("id_prodotto", selectedWineId);
    } else {
      current.delete("id_prodotto");
    }

    const search = current.toString();
    const query = search ? `?${search}` : "";
    
    const expectedUrl = `${pathname}${query}`;
    const currentUrl = `${pathname}${window.location.search}`;
    if (expectedUrl !== currentUrl) {
      router.replace(expectedUrl);
    }
  }, [selectedCantina, selectedWineId, messages, isMounted, pathname, router, searchParams]);

  const setSelectedCantina = (cantina: string) => {
    setSelectedCantinaState(cantina);
  };

  const setSelectedWineId = (id: string | null) => {
    setSelectedWineIdState(id);
  };

  const setMessages = (update: Message[] | ((prev: Message[]) => Message[])) => {
    setMessagesState(prev => {
      const next = typeof update === "function" ? update(prev) : update;
      sessionStorage.setItem("chatMessages", JSON.stringify(next));
      return next;
    });
  };

  const resetFilters = () => {
    setSelectedCantinaState("all");
    setSelectedWineIdState(null);
    setMessagesState([INITIAL_WELCOME_MESSAGE]);
    
    sessionStorage.setItem("selectedCantina", "all");
    sessionStorage.removeItem("selectedWineId");
    sessionStorage.setItem("chatMessages", JSON.stringify([INITIAL_WELCOME_MESSAGE]));

    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.delete("cantina");
    current.delete("id_prodotto");
    current.delete("data_inizio");
    current.delete("data_fine");
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.replace(`${pathname}${query}`);
  };

  return (
    <WineContext.Provider
      value={{
        selectedCantina,
        setSelectedCantina,
        selectedWineId,
        setSelectedWineId,
        messages,
        setMessages,
        resetFilters
      }}
    >
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
