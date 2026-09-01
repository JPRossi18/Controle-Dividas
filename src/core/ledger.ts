/**
 * Motor de cálculo da dívida — juros mensais + amortização.
 *
 * Por que existe: o saldo desta dívida não é "valor original menos pagos".
 * O contrato prevê juros de 1% ao mês (configurável) a partir da data de
 * assinatura, então o valor devido cresce a cada mês completado.
 *
 * Como se atualiza sozinho: não há tarefa agendada. O saldo é recalculado
 * do zero a cada leitura, percorrendo a linha do tempo desde a data do
 * contrato até hoje. Ao virar o dia de aniversário do contrato (ex.: dia 26),
 * um novo mês entra na conta automaticamente — a página abre já atualizada.
 *
 * Regras aplicadas:
 *  - Juros incidem apenas sobre meses INTEIROS completados (nada de
 *    pró-rata diário) — assim o número exibido é sempre verificável.
 *  - Modo COMPOSTO: juros sobre o saldo devedor total (principal + juros
 *    acumulados). Modo SIMPLES: juros só sobre o principal em aberto.
 *  - Cada pagamento abate PRIMEIRO os juros acumulados e só depois o
 *    principal (imputação do art. 354 do Código Civil).
 *  - Se juros e pagamento caem no mesmo dia, os juros do mês entram antes:
 *    o pagamento quita o saldo já atualizado.
 *  - Tudo em centavos inteiros; o arredondamento de cada mês é "meio para
 *    cima" e o resíduo nunca some, fica no saldo.
 */
import type { DebtInterestMode, DebtPaymentMethod, DebtPaymentStatus } from "@prisma/client";

export type LedgerPayment = {
  id?: string;
  number: number;
  amountCents: number;
  paidAt: Date;
  status: DebtPaymentStatus;
  method?: DebtPaymentMethod;
};

export type LedgerInput = {
  principalCents: number;
  contractDate: Date;
  interestRateBps: number;
  interestMode: DebtInterestMode;
  payments: LedgerPayment[];
  /** Momento de referência do cálculo (padrão: agora). */
  asOf?: Date;
};

export type LedgerEntry =
  | {
      kind: "interest";
      date: Date;
      monthIndex: number;
      interestCents: number;
      balanceAfterCents: number;
    }
  | {
      kind: "payment";
      date: Date;
      paymentId?: string;
      number: number;
      amountCents: number;
      toInterestCents: number;
      toPrincipalCents: number;
      /** Sobra quando o pagamento excede o saldo (pagamento a maior). */
      excessCents: number;
      balanceAfterCents: number;
    };

export type DebtLedger = {
  principalCents: number;
  /** Principal ainda em aberto. */
  principalOutstandingCents: number;
  /** Juros lançados desde o contrato (inclui os já pagos). */
  interestChargedCents: number;
  /** Juros lançados e ainda não pagos. */
  interestOutstandingCents: number;
  /** Saldo devedor atualizado = principal em aberto + juros em aberto. */
  balanceCents: number;
  /** Total devido acumulado = valor original + juros lançados. */
  totalDueCents: number;
  paidCents: number;
  paidToInterestCents: number;
  paidToPrincipalCents: number;
  /** Pagamentos que excederam o saldo (crédito a favor do devedor). */
  overpaidCents: number;
  monthsElapsed: number;
  /** Data do próximo aniversário mensal (quando os juros voltam a incidir). */
  nextAccrualDate: Date;
  /** Quanto de juros deve entrar na próxima virada, mantido o saldo de hoje. */
  nextAccrualCents: number;
  percentPaid: number;
  paymentCount: number;
  averageCents: number;
  lastPaymentAt: Date | null;
  isSettled: boolean;
  entries: LedgerEntry[];
};

/** Aniversário mensal do contrato: mesma data, `months` meses depois. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Meses curtos (contrato no dia 31 → 28/29/30) caem no último dia do mês.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Arredondamento "meio para cima" em centavos (evita viés do Math.round com negativos). */
function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function computeLedger(input: LedgerInput): DebtLedger {
  const asOf = input.asOf ?? new Date();
  const rate = input.interestMode === "NONE" ? 0 : input.interestRateBps / 10_000;

  const payments = input.payments
    .filter((p) => p.status !== "CANCELED")
    .slice()
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.number - b.number);

  let principalOutstanding = input.principalCents;
  let interestOutstanding = 0;
  let interestCharged = 0;
  let paidToInterest = 0;
  let paidToPrincipal = 0;
  let overpaid = 0;
  const entries: LedgerEntry[] = [];

  // Aniversários mensais do contrato até hoje (só meses inteiros completados).
  const accruals: Array<{ date: Date; monthIndex: number }> = [];
  for (let i = 1; i <= 1200; i++) {
    const date = addMonths(input.contractDate, i);
    if (date.getTime() > asOf.getTime()) break;
    accruals.push({ date, monthIndex: i });
  }
  const monthsElapsed = accruals.length;

  let pi = 0;
  const applyPaymentsUntil = (limit: number) => {
    while (pi < payments.length && payments[pi].paidAt.getTime() <= limit) {
      const p = payments[pi++];
      let remaining = p.amountCents;

      const toInterest = Math.min(remaining, interestOutstanding);
      interestOutstanding -= toInterest;
      remaining -= toInterest;

      const toPrincipal = Math.min(remaining, principalOutstanding);
      principalOutstanding -= toPrincipal;
      remaining -= toPrincipal;

      paidToInterest += toInterest;
      paidToPrincipal += toPrincipal;
      overpaid += remaining;

      entries.push({
        kind: "payment",
        date: p.paidAt,
        paymentId: p.id,
        number: p.number,
        amountCents: p.amountCents,
        toInterestCents: toInterest,
        toPrincipalCents: toPrincipal,
        excessCents: remaining,
        balanceAfterCents: principalOutstanding + interestOutstanding,
      });
    }
  };

  for (const accrual of accruals) {
    // Pagamentos ANTERIORES ao aniversário reduzem a base de juros; os do
    // próprio dia entram depois, sobre o saldo já reajustado (o mês fechou).
    applyPaymentsUntil(accrual.date.getTime() - 1);

    const base =
      input.interestMode === "SIMPLE"
        ? principalOutstanding
        : principalOutstanding + interestOutstanding;
    const interest = base > 0 ? roundCents(base * rate) : 0;

    if (interest !== 0) {
      interestOutstanding += interest;
      interestCharged += interest;
    }
    entries.push({
      kind: "interest",
      date: accrual.date,
      monthIndex: accrual.monthIndex,
      interestCents: interest,
      balanceAfterCents: principalOutstanding + interestOutstanding,
    });

    applyPaymentsUntil(accrual.date.getTime());
  }
  applyPaymentsUntil(asOf.getTime());
  // Pagamentos com data futura (adiantamento) também abatem o saldo.
  applyPaymentsUntil(Number.MAX_SAFE_INTEGER);

  const balance = principalOutstanding + interestOutstanding;
  const paid = paidToInterest + paidToPrincipal + overpaid;
  const totalDue = input.principalCents + interestCharged;
  const nextBase =
    input.interestMode === "SIMPLE" ? principalOutstanding : balance;

  const lastPaymentAt = payments.reduce<Date | null>(
    (acc, p) => (acc === null || p.paidAt > acc ? p.paidAt : acc),
    null
  );

  return {
    principalCents: input.principalCents,
    principalOutstandingCents: principalOutstanding,
    interestChargedCents: interestCharged,
    interestOutstandingCents: interestOutstanding,
    balanceCents: balance,
    totalDueCents: totalDue,
    paidCents: paid,
    paidToInterestCents: paidToInterest,
    paidToPrincipalCents: paidToPrincipal,
    overpaidCents: overpaid,
    monthsElapsed,
    nextAccrualDate: addMonths(input.contractDate, monthsElapsed + 1),
    nextAccrualCents: nextBase > 0 ? roundCents(nextBase * rate) : 0,
    percentPaid: percentOf(paid, paid + balance),
    paymentCount: payments.length,
    averageCents: payments.length ? Math.round(paid / payments.length) : 0,
    lastPaymentAt,
    isSettled: balance <= 0,
    entries,
  };
}

function percentOf(part: number, total: number): number {
  if (total <= 0) return part > 0 ? 100 : 0;
  return Math.round(Math.min((part / total) * 100, 100) * 10) / 10;
}

/**
 * Saldo devedor logo depois de um pagamento específico — o número que vai
 * no recibo (situação daquele momento, não a de hoje).
 */
export function balanceAfterPayment(ledger: DebtLedger, paymentNumber: number): number | null {
  for (const entry of ledger.entries) {
    if (entry.kind === "payment" && entry.number === paymentNumber) {
      return entry.balanceAfterCents;
    }
  }
  return null;
}

/** Totais por situação, para o painel separar informado × confirmado. */
export function statusTotals(payments: LedgerPayment[]) {
  const sum = (s: DebtPaymentStatus) =>
    payments.filter((p) => p.status === s).reduce((a, p) => a + p.amountCents, 0);
  const count = (s: DebtPaymentStatus) => payments.filter((p) => p.status === s).length;
  return {
    confirmedCents: sum("CONFIRMED"),
    confirmedCount: count("CONFIRMED"),
    pendingCents: sum("PENDING"),
    pendingCount: count("PENDING"),
    disputedCents: sum("DISPUTED"),
    disputedCount: count("DISPUTED"),
    canceledCents: sum("CANCELED"),
    canceledCount: count("CANCELED"),
  };
}
