"use server";

import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendMail, appUrl } from "@/lib/mail";
import { createDebtSession, destroyDebtSession } from "./session";
import { debtAudit } from "./audit";

export type DebtFormState = { error?: string; ok?: boolean; devHint?: string };

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});

export async function debtLoginAction(
  _prev: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const user = await prisma.debtUser.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  // Mensagem única: não revela se o e-mail existe.
  const generic = { error: "E-mail ou senha incorretos." };
  if (!user || !user.isActive) return generic;
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return generic;

  await createDebtSession(user.id);
  await debtAudit({ actorId: user.id, action: "auth.login", entity: "DebtUser", entityId: user.id });
  redirect("/");
}

export async function debtLogoutAction() {
  await destroyDebtSession();
  redirect("/login");
}

export async function requestDebtPasswordResetAction(
  _prev: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido" };

  const user = await prisma.debtUser.findUnique({ where: { email: email.data.toLowerCase() } });

  let devHint: string | undefined;
  if (user?.isActive) {
    const token = randomBytes(32).toString("hex");
    await prisma.debtPasswordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    const link = `${appUrl()}/redefinir-senha?token=${token}`;
    const result = await sendMail({
      to: user.email,
      subject: "Redefinição de senha — Controle de dívida",
      text: `Olá, ${user.name}.\n\nPara criar uma nova senha, acesse:\n${link}\n\nO link vale por 30 minutos. Se não foi você que pediu, ignore este e-mail.`,
      html: `<p>Olá, ${user.name}.</p><p>Para criar uma nova senha, acesse:</p><p><a href="${link}">${link}</a></p><p>O link vale por 30 minutos. Se não foi você que pediu, ignore este e-mail.</p>`,
    });
    // Sem provedor de e-mail (ambiente local): mostra o link para não travar o teste.
    if (result.dev && process.env.NODE_ENV !== "production") {
      devHint = `/redefinir-senha?token=${token}`;
    }
  }

  // Resposta idêntica exista ou não a conta.
  return { ok: true, devHint };
}

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres"),
});

export async function resetDebtPasswordAction(
  _prev: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const record = await prisma.debtPasswordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Link inválido ou expirado. Solicite uma nova redefinição." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.debtUser.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.debtPasswordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Nova senha derruba as sessões antigas.
    prisma.debtSession.deleteMany({ where: { userId: record.userId } }),
  ]);

  await debtAudit({
    actorId: record.userId,
    action: "user.password",
    entity: "DebtUser",
    entityId: record.userId,
    metadata: { via: "recuperacao" },
  });

  redirect("/login?redefinida=1");
}
