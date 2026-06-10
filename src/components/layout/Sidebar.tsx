"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, MessageSquare, Mail, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const pathname = usePathname();

  const menuItems = [
    {
      title: "Navigazione",
      items: [
        { name: "Home", href: "/", icon: Home },
      ],
    },
    {
      title: "Dashboards",
      items: [
        { name: "Price Intelligence", href: "/price-intelligence", icon: TrendingUp },
        { name: "Sentiment Analysis", href: "/sentiment-analysis", icon: MessageSquare },
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
      "bg-sidebar-bg text-white flex flex-col h-full transition-all duration-300 relative z-30 flex-shrink-0",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Area Placeholder Logo Aziendale */}
      <div className="px-4 pt-4 pb-2">
        <div className={cn(
          "border border-dashed border-gray-700 rounded-lg flex items-center justify-center bg-gray-900/30 transition-all duration-300",
          isCollapsed ? "h-10 w-10 mx-auto" : "h-14 w-full"
        )}>
          {isCollapsed ? (
            <span className="text-xs font-semibold text-gray-500">Logo</span>
          ) : (
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Logo Aziendale</span>
          )}
        </div>
      </div>

      <div className="p-4 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-xl font-bold tracking-tight">WINE OS</h1>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700",
            isCollapsed ? "mx-auto" : "absolute -right-3 top-4"
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
    </aside>
  );
};

export default Sidebar;
