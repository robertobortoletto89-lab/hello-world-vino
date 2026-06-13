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

interface UserRow {
  NOME: string;
  COGNOME: string;
  EMAIL: string;
  RUOLO: string;
  CANTINA_VISIBILE: string;
  APP_VISIBILE: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let user = session?.user as SessionUser | undefined;

    // Gestione sessione demo/fittizia
    const demoCookie = req.cookies.get("kyria_demo_session")?.value;
    if (!user && demoCookie === "admin_demo") {
      user = {
        email: "admin@antigravity.it",
        ruolo: "ADMIN",
        cantinaVisibile: "ALL"
      };
    }

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Prova a leggere database_utenti.csv, con fallback su utenti.csv
    let filePath = path.join(process.cwd(), "database_utenti.csv");
    try {
      await fs.access(filePath);
    } catch {
      filePath = path.join(process.cwd(), "utenti.csv");
    }

    const fileContent = await fs.readFile(filePath, "utf8");
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });

    const utenti = parsed.data as UserRow[];

    // Trova l'utente per email
    let matchedUser = utenti.find(
      (u) => u.EMAIL.toLowerCase() === user?.email?.toLowerCase()
    );

    // Se non trova corrispondenza diretta per email (es. utente finto admin@antigravity.it), 
    // associa all'amministratore reale definito nel file CSV (o al primo utente)
    if (!matchedUser && demoCookie === "admin_demo") {
      matchedUser = utenti.find((u) => u.RUOLO.toUpperCase() === "ADMIN") || utenti[0];
    }

    if (!matchedUser) {
      return NextResponse.json({
        nome: "Utente",
        ruolo: user.ruolo || "USER",
        cantinaVisibile: user.cantinaVisibile || ""
      });
    }

    return NextResponse.json({
      nome: matchedUser.NOME,
      cognome: matchedUser.COGNOME,
      email: matchedUser.EMAIL,
      ruolo: matchedUser.RUOLO,
      cantinaVisibile: matchedUser.CANTINA_VISIBILE
    });
  } catch (error: unknown) {
    console.error("Errore nel recupero profilo utente:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
