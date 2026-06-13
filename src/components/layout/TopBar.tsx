"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { RotateCcw, User, ChevronDown, LogOut, Calendar, X } from "lucide-react";
// import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWine } from "@/context/WineContext";

interface TopBarProps {
  isCollapsed: boolean;
  nomeUtente?: string;
}

interface Product {
  ID_PRODOTTO: string;
  NOME_PRODOTTO: string;
  CANTINA: string;
}

const TopBar = ({ nomeUtente: nomeUtenteProp }: TopBarProps) => {
  // const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const isHomePage = pathname === "/";
  
  const [isMounted, setIsMounted] = useState(false);
  const [demoUser, setDemoUser] = useState<{ nome?: string; ruolo?: string; cantinaVisibile?: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/user")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Errore nel recupero utente");
      })
      .then((data) => {
        if (data && data.nome) {
          setDemoUser({
            nome: data.nome,
            ruolo: data.ruolo,
            cantinaVisibile: data.cantinaVisibile
          });
        }
      })
      .catch((err) => {
        console.error("Errore nel recupero utente dal database:", err);
        const cookiesList = document.cookie.split(";").map(c => c.trim());
        const demoCookie = cookiesList.find(c => c.startsWith("kyria_demo_session="));
        if (demoCookie && demoCookie.split("=")[1] === "admin_demo") {
          setDemoUser({
            nome: "Admin",
            ruolo: "ADMIN",
            cantinaVisibile: "ALL"
          });
        }
      });
  }, []);

  // Estrazione dati dalla sessione
  // const sessionUser = session?.user as unknown as { nome?: string; ruolo?: string; cantinaVisibile?: string } | null | undefined;
  const user = demoUser;

  const nomeUtente = nomeUtenteProp || user?.nome || "Utente";
  const ruolo = user?.ruolo;
  const cantinaVisibile = user?.cantinaVisibile;
  const isAdmin = ruolo === 'ADMIN';

  // Stati per i dati reali
  const [wines, setWines] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { selectedCantina, setSelectedCantina, selectedWineId, setSelectedWineId, resetFilters } = useWine();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Stati per le date
  const [startDate, setStartDate] = useState(searchParams.get("data_inizio") || "");
  const [endDate, setEndDate] = useState(searchParams.get("data_fine") || "");
  
  const calendarRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Helper per aggiornare l'URL per le date
  const updateURL = useCallback((params: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });

    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.replace(`${pathname}${query}`);
  }, [searchParams, pathname, router]);

  // Caricamento prodotti dall'API
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/prodotti');
        if (response.ok) {
          const data = await response.json();
          setWines(data);
        }
      } catch (error) {
        console.error("Errore nel caricamento prodotti:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isMounted && demoUser) {
      fetchProducts();
    }
  }, [isMounted, demoUser]);

  // Sincronizza date con URL quando cambiano
  useEffect(() => {
    updateURL({
      data_inizio: startDate || null,
      data_fine: endDate || null
    });
  }, [startDate, endDate, updateURL]);

  // Sincronizza selectedCantina con i permessi dell'utente una volta montato
  useEffect(() => {
    if (isMounted && !searchParams.get("cantina")) {
      setSelectedCantina(isAdmin ? "all" : (cantinaVisibile || "all"));
    }
  }, [isMounted, isAdmin, cantinaVisibile]);

  const allCantine = useMemo(() => {
    return Array.from(new Set(wines.map(w => w.CANTINA))).sort();
  }, [wines]);

  // Chiudi i dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Vini filtrati per la cantina selezionata (cascading)
  const winesOfSelectedCantina = useMemo(() => {
    return wines.filter(wine => selectedCantina === "all" || wine.CANTINA === selectedCantina);
  }, [wines, selectedCantina]);

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    resetFilters();
  };

  const handleSelectAllDates = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <header className="flex flex-row items-center justify-between w-full h-16 px-4 gap-4 bg-white border-b border-gray-200 z-20">
      {isHomePage && (
        <div className="text-sm font-bold text-gray-800 uppercase tracking-wider pl-2">
          Wine OS Command Center
        </div>
      )}

      {/* Cascading Filter Dropdowns */}
      {!isHomePage && (
        <div className="flex items-center gap-3">
          {/* Dropdown 1: Cantina */}
          <div className="flex-none w-48 flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md relative">
            <span className="text-[10px] font-bold text-blue-700 uppercase shrink-0">Cantina:</span>
            <select 
              value={selectedCantina}
              onChange={(e) => {
                setSelectedCantina(e.target.value);
                setSelectedWineId(null); // Resetta il vino quando cambia la cantina
              }}
              disabled={!isAdmin}
              className={cn(
                "bg-transparent text-sm font-bold text-blue-900 border-none focus:ring-0 p-0 pr-6 cursor-pointer disabled:cursor-not-allowed appearance-none relative z-10 w-full truncate"
              )}
            >
              {isAdmin ? (
                <>
                  <option value="all">Tutte le Cantine</option>
                  {allCantine.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </>
              ) : (
                <option value={cantinaVisibile || "all"}>{cantinaVisibile || "Nessuna"}</option>
              )}
            </select>
            <ChevronDown className="h-4 w-4 text-blue-500 absolute right-3 pointer-events-none" />
          </div>

          {/* Dropdown 2: Vino */}
          <div className="flex-none w-64 flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md relative">
            <span className="text-[10px] font-bold text-blue-700 uppercase shrink-0">Vino:</span>
            <select 
              value={selectedWineId || ""}
              onChange={(e) => {
                setSelectedWineId(e.target.value || null);
              }}
              disabled={isLoading}
              className={cn(
                "bg-transparent text-sm font-bold text-blue-900 border-none focus:ring-0 p-0 pr-6 cursor-pointer disabled:cursor-not-allowed appearance-none relative z-10 w-full truncate"
              )}
            >
              <option value="">Tutti i Vini</option>
              {winesOfSelectedCantina.map(wine => (
                <option key={wine.ID_PRODOTTO} value={wine.ID_PRODOTTO}>
                  {wine.NOME_PRODOTTO}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-blue-500 absolute right-3 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Date Picker Range - Compact Popover */}
      {!isHomePage && (
        <div className="shrink-0 flex items-center gap-2 relative" ref={calendarRef}>
        <button 
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className={cn(
            "p-2 rounded-md border transition-colors relative hover:bg-gray-50 flex items-center justify-center bg-white",
            (startDate || endDate) ? "border-blue-300 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500"
          )}
          title="Filtra per data"
        >
          <Calendar className="h-4 w-4" />
          {(startDate || endDate) && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
          )}
        </button>

        <button 
          onClick={handleSelectAllDates}
          className={cn(
            "text-xs px-2.5 py-1.5 rounded-md font-bold transition-colors border",
            (!startDate && !endDate) 
              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          )}
          title="Mostra tutti i periodi"
        >
          ALL
        </button>

        {isCalendarOpen && (
          <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50 min-w-[240px] space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-700 uppercase">Filtra per Date</span>
              <button 
                onClick={() => setIsCalendarOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Da:</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">A:</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button 
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setIsCalendarOpen(false);
                }}
                className="text-[10px] font-bold text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              >
                Reset
              </button>
              <button 
                onClick={() => setIsCalendarOpen(false)}
                className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                Applica
              </button>
            </div>
          </div>
        )}
        </div>
      )}
      {isHomePage && <div className="flex-1" />}

      <div className="shrink-0 flex items-center gap-4">
        {!isHomePage && (
          <>
            <button 
              onClick={handleResetFilters}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap group"
            >
              <RotateCcw className="h-4 w-4 group-active:rotate-180 transition-transform duration-300" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <div className="h-8 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>
          </>
        )}

        <div className="flex items-center gap-3 relative" ref={profileRef}>
          <span className="text-sm font-medium text-gray-700 hidden lg:block italic">Ciao, {!isMounted ? "Utente" : nomeUtente}</span>
          
          <div className="flex items-center gap-2 p-1 rounded-md">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
              <User className="h-5 w-5" />
            </div>
            <ChevronDown 
              className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600 hover:bg-gray-100 p-0.5 rounded transition-colors" 
              onClick={() => setIsProfileOpen(prev => !prev)}
            />
          </div>

          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 shadow-lg rounded-md py-1 w-48 z-50">
              <div className="px-4 py-2 border-b border-gray-100 lg:hidden">
                <p className="text-sm font-medium text-gray-900">Ciao, {!isMounted ? "Utente" : nomeUtente}</p>
              </div>
              <button 
                onClick={() => {
                  document.cookie = "kyria_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
                  router.push("/login");
                }}
                className="flex items-center gap-2 text-red-600 hover:bg-red-50 w-full text-left px-4 py-2 text-sm transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci / Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
