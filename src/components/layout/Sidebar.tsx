"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { TrendingUp, MessageSquare, Filter, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Estrazione dati esclusivamente dalla sessione
  const nomeUtente = (session?.user as any)?.nome || "Utente";
  const cantinaVisibile = (session?.user as any)?.cantinaVisibile;
  const cantinaDisplay = cantinaVisibile === "ALL" ? "Global Access" : cantinaVisibile || "Nessuna Cantina";
  
  const iniziali = nomeUtente.substring(0, 2).toUpperCase();

  const menuItems = [
    {
      title: "Dashboards",
      items: [
        { name: "Price Intelligence", href: "/price-intelligence", icon: TrendingUp },
        { name: "Sentiment Analysis", href: "/sentiment-analysis", icon: MessageSquare },
      ],
    },
    {
      title: "Filtri Globali",
      items: [
        { name: "Filtri Avanzati", href: "#", icon: Filter },
      ],
    },
    {
      title: "Contact",
      items: [
        { name: "Helpdesk", href: "/contact", icon: Mail },
      ],
    },
  ];

  return (
    <aside className={cn(
      "bg-sidebar-bg text-white flex flex-col h-full transition-all duration-300 relative z-30",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-xl font-bold tracking-tight">WINE OS</h1>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700",
            isCollapsed ? "mx-auto" : "absolute -right-3 top-6"
          )}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-8 overflow-y-auto overflow-x-hidden">
        {menuItems.map((section) => (
          <div key={section.title}>
            {!isCollapsed && (
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
                {section.title}
              </h2>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary-blue text-white"
                        : "text-gray-300 hover:bg-sidebar-hover hover:text-white",
                      isCollapsed && "justify-center px-0"
                    )}
                    title={isCollapsed ? item.name : ""}
                  >
                    <item.icon className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <div className={cn("flex items-center p-2", isCollapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center min-w-[32px] flex-shrink-0">
            <span className="text-xs font-bold">{iniziali}</span>
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium truncate">{nomeUtente}</p>
              <p className="text-xs text-gray-400 italic truncate">{cantinaDisplay}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
