"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, RotateCcw, User, ChevronDown, LogOut, Calendar, X, Check } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TopBarProps {
  isCollapsed: boolean;
}

interface Product {
  ID_PRODOTTO: string;
  NOME_PRODOTTO: string;
  CANTINA: string;
}

const TopBar = ({ isCollapsed }: TopBarProps) => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Estrazione dati dalla sessione
  const nomeUtente = (session?.user as any)?.nome || "Utente";
  const ruolo = (session?.user as any)?.ruolo;
  const cantinaVisibile = (session?.user as any)?.cantinaVisibile;
  const isAdmin = ruolo === 'ADMIN' || session?.user?.email === "admin@antigravity.it";

  // Stati per i dati reali
  const [wines, setWines] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stati per i filtri (inizializzati da URL o default)
  const [selectedCantina, setSelectedCantina] = useState(searchParams.get("cantina") || (isAdmin ? "all" : (cantinaVisibile || "all")));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWineId, setSelectedWineId] = useState<string | null>(searchParams.get("id_prodotto"));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Stati per le date
  const [startDate, setStartDate] = useState(searchParams.get("data_inizio") || "");
  const [endDate, setEndDate] = useState(searchParams.get("data_fine") || "");
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Helper per aggiornare l'URL
  const updateURL = (params: Record<string, string | null>) => {
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
    router.push(`${pathname}${query}`);
  };

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

    if (session) {
      fetchProducts();
    }
  }, [session]);

  // Sincronizza stati con URL quando cambiano
  useEffect(() => {
    updateURL({
      cantina: selectedCantina === "all" ? null : selectedCantina,
      id_prodotto: selectedWineId,
      data_inizio: startDate || null,
      data_fine: endDate || null
    });
  }, [selectedCantina, selectedWineId, startDate, endDate]);

  const allCantine = useMemo(() => {
    return Array.from(new Set(wines.map(w => w.CANTINA))).sort();
  }, [wines]);

  // Chiudi il dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtraggio vini basato su cantina e query di ricerca
  const filteredWines = useMemo(() => {
    return wines.filter(wine => {
      const matchesCantina = selectedCantina === "all" || wine.CANTINA === selectedCantina;
      const matchesQuery = wine.NOME_PRODOTTO.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           wine.ID_PRODOTTO.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCantina && matchesQuery;
    });
  }, [selectedCantina, searchQuery, wines]);

  const handleResetFilters = () => {
    setSelectedCantina(isAdmin ? "all" : (cantinaVisibile || "all"));
    setSearchQuery("");
    setSelectedWineId(null);
    setStartDate("");
    setEndDate("");
  };

  const handleSelectAllDates = () => {
    setStartDate("");
    setEndDate("");
  };

  const selectedWineName = useMemo(() => {
    return wines.find(w => w.ID_PRODOTTO === selectedWineId)?.NOME_PRODOTTO || "";
  }, [selectedWineId, wines]);

  return (
    <header className="flex flex-row items-center justify-between w-full h-16 px-2 gap-4 bg-white border-b border-gray-200 z-20">
      {/* Combobox Ricerca Bottiglia - Flexible */}
      <div className="flex-1 min-w-[200px] max-w-md" ref={dropdownRef}>
        <div className="relative">
          <div className="flex items-center bg-gray-100 rounded-md px-3 py-1.5 border border-gray-200 w-full">
            <Search className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder={isLoading ? "Caricamento prodotti..." : "Cerca per nome o ID prodotto..."}
              className="bg-transparent border-none text-sm focus:ring-0 w-full p-0"
              value={isDropdownOpen ? searchQuery : (selectedWineName || searchQuery)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              disabled={isLoading}
            />
            {(searchQuery || selectedWineId) && (
              <button 
                onClick={() => { setSearchQuery(""); setSelectedWineId(null); }}
                className="ml-2 hover:bg-gray-200 rounded-full p-0.5"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
          </div>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
              {filteredWines.length > 0 ? (
                filteredWines.map(wine => (
                  <div 
                    key={wine.ID_PRODOTTO}
                    className={cn(
                      "px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between items-center",
                      selectedWineId === wine.ID_PRODOTTO && "bg-blue-50 text-blue-700 font-medium"
                    )}
                    onClick={() => {
                      setSelectedWineId(wine.ID_PRODOTTO);
                      setSearchQuery(wine.NOME_PRODOTTO);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{wine.NOME_PRODOTTO}</span>
                      <span className="text-[10px] text-gray-400">{wine.ID_PRODOTTO} • {wine.CANTINA}</span>
                    </div>
                    {selectedWineId === wine.ID_PRODOTTO && <Check className="h-4 w-4 text-blue-600" />}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500 italic">
                  {isLoading ? "Caricamento..." : "Nessun vino trovato per i criteri selezionati"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Date Picker Range - Responsive Collapse */}
      <div className="shrink-0 flex items-center justify-center">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md shrink-0">
          <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
          
          <div className="hidden xl:flex items-center gap-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-[11px] focus:ring-0 p-0 cursor-pointer"
            />
            <span className="text-gray-400 text-xs">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-[11px] focus:ring-0 p-0 cursor-pointer"
            />
          </div>

          <button 
            onClick={handleSelectAllDates}
            className={cn(
              "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold transition-colors ml-1",
              (!startDate && !endDate) 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            )}
            title="Mostra tutti i periodi"
          >
            All
          </button>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-4">
        {/* Winery Selector - Fixed */}
        <div className="flex-none w-48 flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md relative">
          <span className="text-[10px] font-bold text-blue-700 uppercase shrink-0">Cantina:</span>
          <select 
            value={selectedCantina}
            onChange={(e) => {
              setSelectedCantina(e.target.value);
              setSelectedWineId(null); // Resetta il vino quando cambia la cantina
              setSearchQuery("");
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

        <button 
          onClick={handleResetFilters}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap group"
        >
          <RotateCcw className="h-4 w-4 group-active:rotate-180 transition-transform duration-300" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <div className="h-8 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

        <div className="flex items-center gap-3 relative group">
          <span className="text-sm font-medium text-gray-700 hidden lg:block italic">Ciao, {nomeUtente}</span>
          
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded-md transition-colors">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
              <User className="h-5 w-5" />
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>

          <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-white border border-gray-200 shadow-lg rounded-md py-1 w-48 z-50">
            <div className="px-4 py-2 border-b border-gray-100 lg:hidden">
              <p className="text-sm font-medium text-gray-900">Ciao, {nomeUtente}</p>
            </div>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50 w-full text-left px-4 py-2 text-sm transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Esci / Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
