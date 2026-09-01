/**
 * Sessão do módulo de dívida.
 *
 * Independente da sessão do VTC: cookie próprio (`divida_session`), tabela
 * própria e token guardado só como hash — o valor em claro existe apenas no
 * cookie httpOnly do navegador. Sessão em banco para poder ser revogada.
 */
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { cache } from "react";
import type { DebtUser } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PROFILE_COOKIE, requireLogin } from "./mode";

const COOKIE = "divida_session";
const TTL_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDebtSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const h = headers();
  await prisma.debtSession.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + TTL_DAYS * 86400_000),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent") ?? null,
    },
  });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 86400,
  });
}

export type DebtSessionUser = Pick<
  DebtUser,
  | "id"
  | "name"
  | "email"
  | "role"
  | "canRegisterPayments"
  | "canConfirmPayments"
  | "canEditPayments"
  | "canDeletePayments"
  | "canManageSettings"
>;

function toSessionUser(user: DebtUser): DebtSessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    canRegisterPayments: user.canRegisterPayments,
    canConfirmPayments: user.canConfirmPayments,
    canEditPayments: user.canEditPayments,
    canDeletePayments: user.canDeletePayments,
    canManageSettings: user.canManageSettings,
  };
}

/**
 * Perfil em uso no modo aberto: o que estiver escolhido no cookie ou, na
 * falta dele, o devedor (quem registra os pagamentos).
 */
async function openModeUser(): Promise<DebtSessionUser | null> {
  const chosen = cookies().get(PROFILE_COOKIE)?.value;
  if (chosen) {
    const user = await prisma.debtUser.findFirst({ where: { id: chosen, isActive: true } });
    if (user) return toSessionUser(user);
  }
  // Sem escolha ainda: assume o devedor, que é quem registra pagamentos.
  const user =
    (await prisma.debtUser.findFirst({
      where: { isActive: true, role: "DEBTOR" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.debtUser.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  return user ? toSessionUser(user) : null;
}

/**
 * Quem está usando o site agora. Com login exigido, vem da sessão em banco;
 * no modo aberto (padrão), vem do perfil escolhido no topo da página.
 * Cacheado por request.
 */
export const getDebtSessionUser = cache(async (): Promise<DebtSessionUser | null> => {
  const token = cookies().get(COOKIE)?.value;

  if (token) {
    const session = await prisma.debtSession.findUnique({
      where: { id: hashToken(token) },
      include: { user: true },
    });
    if (session && session.expiresAt >= new Date() && session.user.isActive) {
      return toSessionUser(session.user);
    }
  }

  return requireLogin ? null : openModeUser();
});

/** Perfis disponíveis para escolher no modo aberto. */
export async function listProfiles() {
  return prisma.debtUser.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, role: true },
  });
}

/** Troca o perfil em uso (modo aberto). Sem senha, por decisão do dono. */
export async function setProfileCookie(userId: string) {
  cookies().set(PROFILE_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 86400,
  });
}

export async function destroyDebtSession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await prisma.debtSession.deleteMany({ where: { id: hashToken(token) } });
  cookies().delete(COOKIE);
}

/** Derruba todas as sessões de um usuário (troca de senha, desativação). */
export async function revokeDebtSessions(userId: string) {
  await prisma.debtSession.deleteMany({ where: { userId } });
}
