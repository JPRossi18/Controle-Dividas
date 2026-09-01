"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseAmountToCents, parseDateInput } from "./money";
import { getDebt, requireDebtUserForAction } from "./access";
import { getDebtSessionUser, revokeDebtSessions } from "./session";
import { debtAudit } from "./audit";
import type { DebtFormState } from "./auth-actions";

function refresh() {
  revalidatePath("/");
  revalidatePath("/configuracoes");
  revalidatePath("/extrato");
  revalidatePath("/pagamentos");
}

const debtSchema = z.object({
  debtorName: z.string().min(1, "Informe o nome do devedor").max(120),
  creditorName: z.string().min(1, "Informe o nome do credor").max(120),
  description: z.string().max(500).optional(),
  interestMode: z.enum(["COMPOUND", "SIMPLE", "NONE"]),
});

/** Atualiza os dados do contrato: partes, valor original, juros e previsão. */
export async function updateDebtAction(
  _prev: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const user = await requireDebtUserForAction("settings.manage");
  const debt = await getDebt();

  const parsed = debtSchema.safeParse({
    debtorName: String(formData.get("debtorName") ?? "").trim(),
    creditorName: String(formData.get("creditorName") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    interestMode: formData.get("interestMode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const principalCents = parseAmountToCents(String(formData.get("principal") ?? ""));
  if (principalCents === null || principalCents <= 0) {
    return { error: "Informe um valor original válido, maior que zero." };
  }

  const contractDate = parseDateInput(String(formData.get("contractDate") ?? ""));
  if (!contractDate) return { error: "Informe a data de assinatura do contrato." };

  // Taxa em % ao mês → pontos-base (1% = 100 bps), sem ponto flutuante no banco.
  const rateRaw = String(formData.get("interestRate") ?? "").replace(",", ".").trim();
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { error: "Informe uma taxa de juros entre 0 e 100% ao mês." };
  }
  const interestRateBps = Math.round(rate * 100);

  const expectedRaw = String(formData.get("expectedPayoffDate") ?? "").trim();
  const expectedPayoffDate = expectedRaw ? parseDateInput(expectedRaw) : null;
  if (expectedRaw && !expectedPayoffDate) return { error: "Data prevista inválida." };

  await prisma.debt.update({
    where: { id: debt.id },
    data: {
      debtorName: parsed.data.debtorName,
      creditorName: parsed.data.creditorName,
      description: parsed.data.description ?? null,
      principalCents,
      contractDate,
      interestRateBps,
      interestMode: parsed.data.interestMode,
      expectedPayoffDate,
    },
  });

  await debtAudit({
    actorId: user.id,
    action: "debt.update",
    entity: "Debt",
    entityId: debt.id,
    metadata: {
      de: {
        valorCentavos: debt.principalCents,
        contrato: debt.contractDate.toISOString(),
        jurosBps: debt.interestRateBps,
        modo: debt.interestMode,
        previsao: debt.expectedPayoffDate?.toISOString() ?? null,
      },
      para: {
        valorCentavos: principalCents,
        contrato: contractDate.toISOString(),
        jurosBps: interestRateBps,
        modo: parsed.data.interestMode,
        previsao: expectedPayoffDate?.toISOString() ?? null,
      },
    },
  });

  refresh();
  return { ok: true };
}

/** Define ou altera só a previsão de quitação (atalho do resumo financeiro). */
export async function setExpectedPayoffAction(formData: FormData) {
  const user = await requireDebtUserForAction("settings.manage");
  const debt = await getDebt();
  const raw = String(formData.get("expectedPayoffDate") ?? "").trim();
  const expectedPayoffDate = raw ? parseDateInput(raw) : null;

  await prisma.debt.update({ where: { id: debt.id }, data: { expectedPayoffDate } });
  await debtAudit({
    actorId: user.id,
    action: "debt.update",
    entity: "Debt",
    entityId: debt.id,
    metadata: { previsao: expectedPayoffDate?.toISOString() ?? null },
  });
  refresh();
  redirect("/?previsao=1");
}

const permissionFields = [
  "canRegisterPayments",
  "canConfirmPayments",
  "canEditPayments",
  "canDeletePayments",
  "canManageSettings",
] as const;

/** Ajusta permissões de um usuário (as regras não são fixas por papel). */
export async function updateUserPermissionsAction(formData: FormData) {
  const actor = await requireDebtUserForAction("settings.manage");
  const id = String(formData.get("id") ?? "");
  const target = await prisma.debtUser.findUnique({ where: { id } });
  if (!target) redirect("/configuracoes?erro=nao-encontrado");

  const data = Object.fromEntries(
    permissionFields.map((f) => [f, formData.get(f) === "on"])
  ) as Record<(typeof permissionFields)[number], boolean>;

  // Trava de segurança: sempre precisa sobrar alguém capaz de administrar.
  if (!data.canManageSettings && target.canManageSettings) {
    const others = await prisma.debtUser.count({
      where: { canManageSettings: true, isActive: true, id: { not: id } },
    });
    if (others === 0) redirect("/configuracoes?erro=ultimo-admin");
  }

  await prisma.debtUser.update({ where: { id }, data });
  await debtAudit({
    actorId: actor.id,
    action: "user.update",
    entity: "DebtUser",
    entityId: id,
    metadata: { permissoes: data },
  });
  refresh();
  redirect("/configuracoes?permissoes=1");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual"),
    next: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "A confirmação não confere" });

/** Troca da própria senha (exige a senha atual e derruba as outras sessões). */
export async function changeOwnPasswordAction(
  _prev: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const session = await getDebtSessionUser();
  if (!session) return { error: "Sessão expirada. Entre novamente." };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const user = await prisma.debtUser.findUnique({ where: { id: session.id } });
  if (!user) return { error: "Usuário não encontrado." };
  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "Senha atual incorreta." };
  }

  await prisma.debtUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 12) },
  });
  await revokeDebtSessions(user.id);
  await debtAudit({
    actorId: user.id,
    action: "user.password",
    entity: "DebtUser",
    entityId: user.id,
    metadata: { via: "troca-manual" },
  });

  redirect("/login?senha-alterada=1");
}
