import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const user = session.user as any;
    const role = user.ruolo;
    const cantinaVisibile = user.cantinaVisibile;
    const isAdmin = role === 'ADMIN' || session.user?.email === "admin@antigravity.it";

    const { searchParams } = new URL(req.url);
    const idProdotto = searchParams.get("id_prodotto");

    // Lettura Sentiment
    const sentimentPath = path.join(process.cwd(), "public", "data", "sentiment_vini_elaborato.csv");
    const sentimentContent = fs.readFileSync(sentimentPath, "utf8");
    const sentimentResult = Papa.parse(sentimentContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ';' 
    });
    
    let reviews = sentimentResult.data as any[];

    // Sicurezza: Filtro per Cantina
    if (!isAdmin && cantinaVisibile !== 'ALL') {
      reviews = reviews.filter((r: any) => r.CANTINA === cantinaVisibile);
    }

    // Filtro per ID_PRODOTTO
    const filteredReviews = idProdotto && idProdotto !== "all"
      ? reviews.filter((r: any) => 
          String(r.ID_PRODOTTO).trim() === String(idProdotto).trim()
        )
      : reviews;

    // Lettura Prodotti (per i metadati nel client)
    const productsPath = path.join(process.cwd(), "public", "data", "database_vini.csv");
    const productsContent = fs.readFileSync(productsPath, "utf8");
    const productsResult = Papa.parse(productsContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ';' 
    });
    
    let products = productsResult.data as any[];
    if (!isAdmin && cantinaVisibile !== 'ALL') {
      products = products.filter((p: any) => p.CANTINA === cantinaVisibile);
    }

    return NextResponse.json({
      reviews: filteredReviews,
      products: products
    });
  } catch (error: any) {
    console.error("Sentiment API Error:", error);
    return NextResponse.json(
      { error: error.message || "Errore nel recupero dati sentiment" },
      { status: 500 }
    );
  }
}
