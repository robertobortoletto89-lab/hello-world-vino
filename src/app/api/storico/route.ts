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

    const filePath = path.join(process.cwd(), "storico_prezzi.csv");
    const fileContent = await fs.readFile(filePath, "utf8");

    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      dynamicTyping: true,
    });

    const sanitizedData = parsed.data.map((row: any) => ({
      ...row,
      PREZZO_RILEVATO: parseFloat(row.PREZZO_RILEVATO?.toString().replace(',', '.') || "0"),
      PREZZO_SCONTATO: parseFloat(row.PREZZO_SCONTATO?.toString().replace(',', '.') || "0"),
    }));

    return NextResponse.json(sanitizedData);
  } catch (error) {
    console.error("Errore nel recupero storico prezzi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
