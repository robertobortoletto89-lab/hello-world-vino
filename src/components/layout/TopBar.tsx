"use client";

import { Search, RotateCcw, User, ChevronDown, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  isCollapsed: boolean;
}

const TopBar = ({ isCollapsed }: TopBarProps) => {
  const { data: session } = useSession();
  
  // Estrazione dati esclusivamente dalla sessione
  const nomeUtente = (session?.user as any)?.nome || "Utente";
  const ruolo = (session?.user as any)?.ruolo;
  const cantinaVisibile = (session?.user as any)?.cantinaVisibile;
  const isAdmin = ruolo === 'ADMIN' || session?.user?.email === "admin@antigravity.it";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-8">
        <span className="text-gray-500 font-medium whitespace-nowrap">Dashboard Overview</span>
        
        <div className="hidden lg:flex items-center bg-gray-100 rounded-md px-3 py-1.5 border border-gray-200">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input 
            type="text" 
            placeholder="Cerca vini o marketplace..." 
            className="bg-transparent border-none text-sm focus:ring-0 w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Winery Selector - Logica basata su Sessione */}
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md relative min-w-[150px]">
          <span className="text-xs font-semibold text-blue-700 uppercase">Cantina:</span>
          <select 
            value={isAdmin ? "all" : (cantinaVisibile || "")}
            disabled={!isAdmin}
            className={cn(
              "bg-transparent text-sm font-bold text-blue-900 border-none focus:ring-0 p-0 pr-8 cursor-pointer disabled:cursor-not-allowed appearance-none relative z-10"
            )}
          >
            {isAdmin ? (
              <option value="all">Tutte le Cantine</option>
            ) : (
              <option value={cantinaVisibile || ""}>{cantinaVisibile || "Nessuna"}</option>
            )}
          </select>
          <ChevronDown className="h-4 w-4 text-blue-500 absolute right-3 pointer-events-none" />
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset Filtri</span>
        </button>

        <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3 relative group">
          <span className="text-sm font-medium text-gray-700 hidden sm:block italic">Ciao, {nomeUtente}</span>
          
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded-md transition-colors">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
              <User className="h-5 w-5" />
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-white border border-gray-200 shadow-lg rounded-md py-1 w-48 z-50">
            <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
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
