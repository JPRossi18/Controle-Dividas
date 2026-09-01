import { NextResponse, type NextRequest } from "next/server";

/** Telas que existem antes do login (quando o login está exigido). */
const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"];

/**
 * Barreira de borda. No modo aberto (padrão) ela não faz nada: o site abre
 * para quem tem o link. Com EXIGIR_LOGIN=1, tudo sem cookie de sessão vai
 * para o login — e a validação real continua no servidor, em core/session.ts.
 */
export function middleware(req: NextRequest) {
  if (process.env.EXIGIR_LOGIN !== "1") return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isPublic && !req.cookies.has("divida_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
