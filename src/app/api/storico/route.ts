import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";

interface PriceHistoryRow {
  PREZZO_RILEVATO?: string | number | null;
  PREZZO_SCONTATO?: string | number | null;
  [key: string]: string | number | boolean | undefined | null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      const demoCookie = req.cookies.get("kyria_demo_session")?.value;
      if (demoCookie !== "admin_demo") {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
      }
    }

    const filePath = path.join(process.cwd(), "public", "data", "storico_prezzi.csv");
    const fileContent = await fs.readFile(filePath, "utf8");

    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      dynamicTyping: true,
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });

    const parsedData = parsed.data as PriceHistoryRow[];
    const sanitizedData = parsedData.map((row) => ({
      ...row,
      PREZZO_RILEVATO: parseFloat(row.PREZZO_RILEVATO?.toString().replace(',', '.') || "0"),
      PREZZO_SCONTATO: parseFloat(row.PREZZO_SCONTATO?.toString().replace(',', '.') || "0"),
    }));

    return NextResponse.json(sanitizedData);
  } catch (error: unknown) {
    console.error("Errore nel recupero storico prezzi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
