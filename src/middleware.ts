import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/api/auth/signin",
  },
});

export const config = {
  matcher: [
    /*
     * Protegge tutte le pagine tranne:
     * 1. api/auth (necessario per il login)
     * 2. _next/static e _next/image (file di sistema)
     * 3. favicon.ico
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};