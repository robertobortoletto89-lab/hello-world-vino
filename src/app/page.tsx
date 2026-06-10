import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TrendingUp, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeHero from "@/components/HomeHero";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("kyria_demo_session");
  if (!sessionCookie) {
    redirect("/login");
  }

  const session = await getServerSession(authOptions);
  let user = session?.user as unknown as { email?: string; ruolo?: string; nome?: string; cantinaVisibile?: string } | null | undefined;

  // Se non esiste una sessione reale ma il cookie demo è presente, usiamo i dati demo per il rendering
  if (!user && sessionCookie.value === "admin_demo") {
    user = {
      email: "admin@antigravity.it",
      ruolo: "ADMIN",
      nome: "Admin Demo",
      cantinaVisibile: "ALL"
    };
  }

  const isEmailAdmin = user?.email === "admin@antigravity.it"; 
  const isAdmin = user?.ruolo === 'ADMIN' || isEmailAdmin;
  const nomeUtente = user?.nome || "Utente";
  const cantinaVisibile = user?.cantinaVisibile;
  const cantinaDisplay = cantinaVisibile === "ALL" ? "Accesso Globale" : cantinaVisibile || "Nessuna Cantina";

  return (
    <div className="min-h-full bg-gray-50 py-4 px-2 flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        <HomeHero isAdmin={isAdmin} cantinaDisplay={cantinaDisplay} nomeUtente={nomeUtente} />

        {/* Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Price Intelligence */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-200 group">
            <div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-100 transition-colors">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Price Intelligence</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Monitora il posizionamento dei tuoi prodotti sui vari canali, rileva anomalie di mercato ed analizza i prezzi storici.
              </p>
            </div>
            <Link 
              href="/price-intelligence" 
              className="text-blue-600 text-sm font-semibold hover:text-blue-700 mt-6 flex items-center group-hover:translate-x-1 transition-transform"
            >
              Esplora Modulo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </div>

          {/* Card Sentiment Analysis */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-indigo-100 transition-all duration-200 group">
            <div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-100 transition-colors">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Sentiment Analysis</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Elabora e interpreta le recensioni dei clienti tramite l&apos;IA. Ottieni insights preziosi sulla percezione del brand.
              </p>
            </div>
            <Link 
              href="/sentiment-analysis" 
              className="text-blue-600 text-sm font-semibold hover:text-blue-700 mt-6 flex items-center group-hover:translate-x-1 transition-transform"
            >
              Esplora Modulo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </div>

          {/* Card KYRIA Chat Helper */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-violet-100 transition-all duration-200 group md:col-span-1">
            <div>
              <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 mb-4 group-hover:bg-violet-100 transition-colors">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">KYRIA AI Assistant</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                L&apos;assistente virtuale basato su modelli generativi avanzati. Sempre disponibile in basso a destra per supportarti.
              </p>
            </div>
            <div className="text-gray-400 text-xs font-medium mt-6 italic flex items-center">
              Usa il widget di chat per iniziare
            </div>
          </div>
        </section>

      </div>
      
      {/* Footer / Info */}
      <div className="max-w-6xl mx-auto w-full text-center text-xs text-gray-400 mt-12 pt-6 border-t border-gray-100">
        Wine OS &copy; {new Date().getFullYear()} - Antigravity Software
      </div>
    </div>
  );
}
