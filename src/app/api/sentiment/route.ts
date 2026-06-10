import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

interface SessionUser {
  nome?: string;
  ruolo?: string;
  cantinaVisibile?: string;
  email?: string | null;
}

interface ReviewData {
  CANTINA: string;
  ID_PRODOTTO: string;
  SITO_ECOMMERCE?: string;
  SITO_ORIGINE?: string;
  [key: string]: string | number | undefined | null;
}

interface ProductData {
  CANTINA: string;
  ID_PRODOTTO: string;
  [key: string]: string | number | undefined | null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let user = session?.user as SessionUser | undefined;

    if (!session) {
      const demoCookie = req.cookies.get("kyria_demo_session")?.value;
      if (demoCookie === "admin_demo") {
        user = {
          nome: "Admin Demo",
          ruolo: "ADMIN",
          cantinaVisibile: "ALL"
        };
      } else {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const role = user.ruolo;
    const cantinaVisibile = user.cantinaVisibile;
    const isAdmin = role === 'ADMIN' || user.email === "admin@antigravity.it";

    const { searchParams } = new URL(req.url);
    const idProdotto = searchParams.get("id_prodotto");

    // Lettura Sentiment
    const sentimentPath = path.join(process.cwd(), "public", "data", "sentiment_vini_elaborato.csv");
    const sentimentContent = fs.readFileSync(sentimentPath, "utf8");
    const sentimentResult = Papa.parse(sentimentContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ';',
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    
    const parsedReviews = sentimentResult.data as ReviewData[];
    let reviews = parsedReviews.map((r) => ({
      ...r,
      SITO_ORIGINE: r.SITO_ECOMMERCE || r.SITO_ORIGINE || ""
    }));

    // Sicurezza: Filtro per Cantina
    if (!isAdmin && cantinaVisibile !== 'ALL') {
      reviews = reviews.filter((r) => r.CANTINA === cantinaVisibile);
    }

    // Filtro per ID_PRODOTTO
    const filteredReviews = idProdotto && idProdotto !== "all"
      ? reviews.filter((r) => 
          String(r.ID_PRODOTTO).trim() === String(idProdotto).trim()
        )
      : reviews;

    // Lettura Prodotti (per i metadati nel client)
    const productsPath = path.join(process.cwd(), "public", "data", "database_vini.csv");
    const productsContent = fs.readFileSync(productsPath, "utf8");
    const productsResult = Papa.parse(productsContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ';',
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    
    let products = productsResult.data as ProductData[];
    if (!isAdmin && cantinaVisibile !== 'ALL') {
      products = products.filter((p) => p.CANTINA === cantinaVisibile);
    }

    return NextResponse.json({
      reviews: filteredReviews,
      products: products
    });
  } catch (error: unknown) {
    console.error("Sentiment API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Errore nel recupero dati sentiment";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
