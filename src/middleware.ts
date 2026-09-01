import { NextResponse, type NextRequest } from "next/server";

/** Telas que existem antes do login. */
const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"];

/**
 * Barreira de borda: sem cookie de sessão, tudo vai para o login. A
 * validação real (expiração, usuário ativo) acontece no servidor, em
 * core/session.ts — o middleware é o primeiro filtro, nunca o único.
 */
export function middleware(req: NextRequest) {
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
  // Ignora estáticos do /public e internos do Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
