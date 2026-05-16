import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const user = session.user as any;
    const role = user.ruolo;
    const cantinaVisibile = user.cantinaVisibile;

    const filePath = path.join(process.cwd(), "database_vini.csv");
    const fileContent = await fs.readFile(filePath, "utf8");

    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
    });

    let prodotti = parsed.data as any[];

    // Rimuovi duplicati basati su ID_PRODOTTO (il CSV sembra avere righe multiple per lo stesso prodotto ma siti diversi)
    // Se l'obiettivo è avere una lista di prodotti UNICI per il filtro
    const prodottiUnici = Array.from(new Map(prodotti.map(p => [p.ID_PRODOTTO, p])).values());

    if (role !== "ADMIN") {
      prodotti = prodottiUnici.filter((p) => p.CANTINA === cantinaVisibile);
    } else {
      prodotti = prodottiUnici;
    }

    return NextResponse.json(prodotti);
  } catch (error) {
    console.error("Errore nel recupero prodotti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
