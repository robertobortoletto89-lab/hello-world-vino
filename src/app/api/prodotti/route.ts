import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";

interface SessionUser {
  nome?: string;
  ruolo?: string;
  cantinaVisibile?: string;
  email?: string | null;
}

interface ProductRow {
  ID_PRODOTTO: string;
  NOME_PRODOTTO: string;
  CANTINA: string;
  URL_IMMAGINE: string;
  PREZZO_BASE: string | number;
}

interface UniqueProduct {
  ID_PRODOTTO: string;
  NOME_PRODOTTO: string;
  CANTINA: string;
  URL_IMMAGINE: string;
  PREZZO_BASE: number;
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

    const filePath = path.join(process.cwd(), "public", "data", "database_vini.csv");
    const fileContent = await fs.readFile(filePath, "utf8");

    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });

    const prodotti = parsed.data as ProductRow[];

    // Rimuovi duplicati basati su ID_PRODOTTO
    const prodottiUnici = Array.from(new Map(prodotti.map(p => [p.ID_PRODOTTO, {
      ID_PRODOTTO: p.ID_PRODOTTO,
      NOME_PRODOTTO: p.NOME_PRODOTTO,
      CANTINA: p.CANTINA,
      URL_IMMAGINE: p.URL_IMMAGINE,
      PREZZO_BASE: parseFloat(p.PREZZO_BASE?.toString().replace(',', '.') || "0")
    }])).values()) as UniqueProduct[];

    let filteredProdotti: UniqueProduct[] = [];
    if (role !== "ADMIN") {
      filteredProdotti = prodottiUnici.filter((p) => p.CANTINA === cantinaVisibile);
    } else {
      filteredProdotti = prodottiUnici;
    }

    return NextResponse.json(filteredProdotti);
  } catch (error: unknown) {
    console.error("Errore nel recupero prodotti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
