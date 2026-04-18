"use client";

import { Search, RotateCcw, User, ChevronDown } from "lucide-react";

const TopBar = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-8">
        <span className="text-gray-500 font-medium">Dashboard Overview</span>
        
        <div className="hidden md:flex items-center bg-gray-100 rounded-md px-3 py-1.5 border border-gray-200">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input 
            type="text" 
            placeholder="Cerca vini o marketplace..." 
            className="bg-transparent border-none text-sm focus:ring-0 w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Admin Winery Selector */}
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md">
          <span className="text-xs font-semibold text-blue-700 uppercase">Cantina:</span>
          <select className="bg-transparent text-sm font-bold text-blue-900 border-none focus:ring-0 p-0 cursor-pointer">
            <option value="all">Tutte le Cantine</option>
            <option value="antigravity">Antigravity Wines</option>
            <option value="bolgheri">Bolgheri Estate</option>
          </select>
        </div>

        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset Filtri</span>
        </button>

        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>

        <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded-md transition-colors">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
            <User className="h-5 w-5" />
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
