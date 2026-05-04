import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../../lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt" as const,
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
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true, delimiter: ";" });
      const utenti = parsed.data as any[];
      return !!utenti.find((u) => u.EMAIL.toLowerCase() === user.email?.toLowerCase());
    },
    async jwt({ token, user }: any) {
      if (user) {
        const filePath = path.join(process.cwd(), "utenti.csv");
        const fileContent = await fs.readFile(filePath, "utf8");
        const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true, delimiter: ";" });
        const utenteDati = (parsed.data as any[]).find(u => u.EMAIL.toLowerCase() === user.email.toLowerCase());
        if (utenteDati) {
          token.ruolo = utenteDati.RUOLO;
          token.nome = utenteDati.NOME;
          token.cantinaVisibile = utenteDati.CANTINA_VISIBILE; // <-- AGGIUNTO
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.ruolo = token.ruolo;
        session.user.nome = token.nome;
        (session.user as any).cantinaVisibile = token.cantinaVisibile; // <-- AGGIUNTO
      }
      return session;
    }
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
