import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("kyria_demo_session");
  const isLoginPage = request.nextUrl.pathname === "/login";

  // Reindirizza al login se non ha il cookie di sessione fittizio e cerca di accedere alle rotte protette
  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Reindirizza alla Home se ha già effettuato il login e si reca sulla pagina /login
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protegge tutte le pagine tranne api, asset statici e favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};