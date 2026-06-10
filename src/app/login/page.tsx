"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      // Imposta il cookie demo fittizio kyria_demo_session con valore admin_demo
      document.cookie = "kyria_demo_session=admin_demo; path=/; max-age=86400; SameSite=Lax";
      
      // Redirect alla root
      router.push("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Decorative background blur shapes */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-40 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-md p-8 relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-50 text-blue-600 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Accedi a KYRIA
          </h1>
          <p className="text-sm text-gray-500">
            Inserisci le tue credenziali per accedere al Command Center
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Indirizzo Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@cantina.it"
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
              />
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
              />
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Verifica in corso...</span>
              </>
            ) : (
              <span>Accedi</span>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">
          Wine OS PoC Demo - Accesso con sessione simulata
        </div>
      </div>
    </div>
  );
}
