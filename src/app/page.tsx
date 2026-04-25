import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isEmailAdmin = session?.user?.email === "admin@antigravity.it"; // Fallback extra
  const isAdmin = (session?.user as any)?.ruolo === 'ADMIN' || isEmailAdmin;

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Panoramica Globale</h1>
          <p className="text-gray-500">
            Benvenuto, Amministratore. Hai il pieno controllo su tutte le cantine e i dati del sistema.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Cantina</h1>
          <p className="text-gray-500">
            Ciao, <span className="font-semibold text-blue-600">{(session?.user as any)?.nome || "Utente"}</span>. Qui puoi monitorare esclusivamente i dati relativi alla tua cantina.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Price Intelligence</h3>
            <p className="text-2xl font-bold mt-1 text-blue-900">Monitoraggio Prezzi</p>
            <p className="text-sm text-gray-500 mt-2">
              Analizza il posizionamento dei tuoi vini sui vari marketplace.
            </p>
          </div>
          <a href="/price-intelligence" className="text-blue-600 text-sm font-medium hover:underline mt-4 flex items-center">
            Vai al modulo <span className="ml-1">&rarr;</span>
          </a>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Sentiment Analysis</h3>
            <p className="text-2xl font-bold mt-1 text-blue-900">Analisi Recensioni</p>
            <p className="text-sm text-gray-500 mt-2">
              Scopri cosa pensano i consumatori dei tuoi vini attraverso l'IA.
            </p>
          </div>
          <a href="/sentiment-analysis" className="text-blue-600 text-sm font-medium hover:underline mt-4 flex items-center">
            Vai al modulo <span className="ml-1">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}
