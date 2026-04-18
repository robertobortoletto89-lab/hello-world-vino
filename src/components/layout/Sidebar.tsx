"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, MessageSquare, Filter, Mail } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const pathname = usePathname();

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
    <aside className="w-64 bg-sidebar-bg text-white flex flex-col h-full overflow-y-auto">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">WINE OS</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-8">
        {menuItems.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
              {section.title}
            </h2>
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
                        : "text-gray-300 hover:bg-sidebar-hover hover:text-white"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center p-2">
          <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center mr-3">
            <span className="text-xs font-bold">ADM</span>
          </div>
          <div>
            <p className="text-sm font-medium">Administrator</p>
            <p className="text-xs text-gray-400 italic">Antigravity Lab</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
