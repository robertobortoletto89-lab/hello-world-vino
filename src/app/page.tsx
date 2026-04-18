export default function Home() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Benvenuto in Antigravity Wine OS</h1>
        <p className="text-gray-500">Seleziona un modulo dalla sidebar per iniziare l'analisi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <div className="bento-box flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase">Price Intelligence</h3>
            <p className="text-2xl font-bold mt-1 text-blue-900">Monitoraggio Prezzi</p>
          </div>
          <a href="/price-intelligence" className="text-blue-600 text-sm font-medium hover:underline">Vai al modulo &rarr;</a>
        </div>

        <div className="bento-box flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase">Sentiment Analysis</h3>
            <p className="text-2xl font-bold mt-1 text-blue-900">Analisi Recensioni</p>
          </div>
          <a href="/sentiment-analysis" className="text-blue-600 text-sm font-medium hover:underline">Vai al modulo &rarr;</a>
        </div>
      </div>
    </div>
  );
}
