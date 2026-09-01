/**
 * Acesso e permissões do módulo de dívida.
 *
 * As permissões ficam em colunas do usuário (não em papéis fixos), para que
 * possam ser ajustadas depois na tela de configurações sem mudar código.
 * O papel (devedor/credor) diz apenas quem é quem no documento.
 */
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getDebtSessionUser, type DebtSessionUser } from "./session";
import { computeLedger, statusTotals, type DebtLedger, type LedgerPayment } from "./ledger";

export type DebtPermission =
  | "payment.register"
  | "payment.confirm"
  | "payment.edit"
  | "payment.delete"
  | "settings.manage";

export function can(user: DebtSessionUser, permission: DebtPermission): boolean {
  switch (permission) {
    case "payment.register":
      return user.canRegisterPayments;
    case "payment.confirm":
      return user.canConfirmPayments;
    case "payment.edit":
      return user.canEditPayments;
    case "payment.delete":
      return user.canDeletePayments;
    case "settings.manage":
      return user.canManageSettings;
  }
}

/** Exige sessão válida; sem ela, volta ao login. */
export async function requireDebtUser(): Promise<DebtSessionUser> {
  const user = await getDebtSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Igual à anterior, mas para Server Actions: erro em vez de redirect. */
export async function requireDebtUserForAction(
  permission?: DebtPermission
): Promise<DebtSessionUser> {
  const user = await getDebtSessionUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  if (permission && !can(user, permission)) {
    throw new Error("Seu perfil não tem permissão para esta ação.");
  }
  return user;
}

/**
 * A dívida acompanhada pela plataforma. O modelo suporta várias, mas a
 * instalação atual trabalha com uma só — a primeira criada pelo seed.
 */
export const getDebt = cache(async () => {
  const debt = await prisma.debt.findFirst({ orderBy: { createdAt: "asc" } });
  if (!debt) {
    throw new Error(
      "Nenhuma dívida configurada. Rode `npm run db:seed` para criar o registro inicial."
    );
  }
  return debt;
});

export type PaymentWithPeople = Awaited<ReturnType<typeof loadPayments>>[number];

async function loadPayments(debtId: string) {
  return prisma.debtPayment.findMany({
    where: { debtId },
    orderBy: [{ paidAt: "desc" }, { number: "desc" }],
    include: {
      registeredBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
      receipt: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } },
    },
  });
}

export type DebtState = {
  debt: Awaited<ReturnType<typeof getDebt>>;
  payments: PaymentWithPeople[];
  /** Saldo oficial: considera tudo que não foi cancelado. */
  ledger: DebtLedger;
  /** Segunda visão: só o que o credor confirmou. */
  confirmedLedger: DebtLedger;
  totals: ReturnType<typeof statusTotals>;
};

/**
 * Estado completo da dívida na data de hoje. Recalcula o saldo a cada
 * chamada — é isso que faz o valor "andar sozinho" mês a mês.
 */
export async function loadDebtState(asOf: Date = new Date()): Promise<DebtState> {
  const debt = await getDebt();
  const payments = await loadPayments(debt.id);

  const toLedger = (list: PaymentWithPeople[]): LedgerPayment[] =>
    list.map((p) => ({
      id: p.id,
      number: p.number,
      amountCents: p.amountCents,
      paidAt: p.paidAt,
      status: p.status,
      method: p.method,
    }));

  const base = {
    principalCents: debt.principalCents,
    contractDate: debt.contractDate,
    interestRateBps: debt.interestRateBps,
    interestMode: debt.interestMode,
    asOf,
  };

  return {
    debt,
    payments,
    ledger: computeLedger({ ...base, payments: toLedger(payments) }),
    confirmedLedger: computeLedger({
      ...base,
      payments: toLedger(payments.filter((p) => p.status === "CONFIRMED")),
    }),
    totals: statusTotals(toLedger(payments)),
  };
}
