import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import EmailProvider from "next-auth/providers/email";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    EmailProvider({
      server: {
        host: "localhost",
        port: 25,
        auth: { user: "", pass: "" }
      },
      from: "noreply@antigravity.it",
      async sendVerificationRequest({ identifier: email, url }) {
        console.log("\n--- 🔐 MAGIC LINK DI ACCESSO ---");
        console.log(`COPIA QUESTO URL: ${url}`);
        console.log("--------------------------------\n");
      },
    }),
  ],
  callbacks: {
    async signIn({ user }: { user: { email?: string | null } }) {
      if (!user.email) return false;
      const filePath = path.join(process.cwd(), "utenti.csv");
      const fileContent = await fs.readFile(filePath, "utf8");
      const parsed = Papa.parse(fileContent, { 
        header: true, 
        skipEmptyLines: true, 
        delimiter: ";",
        transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
      });
      const utenti = parsed.data as any[];
      return !!utenti.find((u) => u.EMAIL.toLowerCase() === user.email?.toLowerCase());
    },
    async jwt({ token, user }: any) {
      if (user) {
        const filePath = path.join(process.cwd(), "utenti.csv");
        const fileContent = await fs.readFile(filePath, "utf8");
        const parsed = Papa.parse(fileContent, { 
          header: true, 
          skipEmptyLines: true, 
          delimiter: ";",
          transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
        });
        const utenteDati = (parsed.data as any[]).find(u => u.EMAIL.toLowerCase() === user.email.toLowerCase());
        if (utenteDati) {
          token.ruolo = utenteDati.RUOLO;
          token.nome = utenteDati.NOME;
          token.cantinaVisibile = utenteDati.CANTINA_VISIBILE;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).ruolo = token.ruolo;
        (session.user as any).nome = token.nome;
        (session.user as any).cantinaVisibile = token.cantinaVisibile;
      }
      return session;
    }
  },
};
