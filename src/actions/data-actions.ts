"use server";

import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getSecureData(fileName: string) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    throw new Error("Non autorizzato");
  }

  const ruoloUtente = (session.user as any).ruolo;
  const emailUtente = session.user.email;
  const cantinaVisibile = (session.user as any).cantinaVisibile; 
  
  const isEmailAdmin = emailUtente === "admin@antigravity.it";
  const isAdmin = ruoloUtente === 'ADMIN' || isEmailAdmin;

  const filePath = path.join(process.cwd(), "public", "data", fileName);
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: "", // Auto-detect
    });

    const allData = parsed.data as any[];

    // La bellezza della standardizzazione: questa singola riga filtra TUTTI i tuoi file futuri
    if (isAdmin || cantinaVisibile === 'ALL') {
      return allData;
    } else {
      return allData.filter((row: any) => row.CANTINA === cantinaVisibile);
    }
  } catch (error) {
    console.error(`Errore nella lettura del file ${fileName}:`, error);
    throw new Error("Errore nel recupero dati");
  }
}