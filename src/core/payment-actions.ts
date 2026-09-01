"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseAmountToCents, parseDateInput, formatBRL } from "./money";
import { computeLedger } from "./ledger";
import { getDebt, requireDebtUserForAction } from "./access";
import { debtAudit } from "./audit";

export type PaymentFormState = {
  error?: string;
  /** Pedido de confirmação explícita para pagamento acima do saldo. */
  needsExcessConfirmation?: boolean;
  excessMessage?: string;
  ok?: boolean;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

const methodSchema = z.enum(["PIX", "BANK_TRANSFER", "CASH", "OTHER"]);

type ParsedInput = {
  amountCents: number;
  paidAt: Date;
  method: z.infer<typeof methodSchema>;
  note: string | null;
  confirmExcess: boolean;
};

/** Validação de servidor (a do navegador é conveniência, esta é a que vale). */
function parsePaymentForm(formData: FormData): { data?: ParsedInput; error?: string } {
  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amountCents === null) return { error: "Informe um valor válido, como 1.500,00." };
  if (amountCents === 0) return { error: "O valor do pagamento não pode ser zero." };
  if (amountCents < 0) return { error: "O valor do pagamento não pode ser negativo." };

  const paidAt = parseDateInput(String(formData.get("paidAt") ?? ""));
  if (!paidAt) return { error: "Informe a data do pagamento." };

  const method = methodSchema.safeParse(formData.get("method"));
  if (!method.success) return { error: "Selecione a forma de pagamento." };

  const rawNote = String(formData.get("note") ?? "").trim();
  if (rawNote.length > 500) return { error: "A observação deve ter no máximo 500 caracteres." };

  return {
    data: {
      amountCents,
      paidAt,
      method: method.data,
      note: rawNote || null,
      confirmExcess: formData.get("confirmExcess") === "1",
    },
  };
}

/**
 * Saldo devedor de hoje desconsiderando um pagamento (usado na edição, para
 * comparar o novo valor com o saldo "sem ele").
 */
async function balanceExcluding(debtId: string, excludePaymentId?: string) {
  const debt = await getDebt();
  const payments = await prisma.debtPayment.findMany({
    where: { debtId, ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}) },
    select: { number: true, amountCents: true, paidAt: true, status: true },
  });
  return computeLedger({
    principalCents: debt.principalCents,
    contractDate: debt.contractDate,
    interestRateBps: debt.interestRateBps,
    interestMode: debt.interestMode,
    payments,
  }).balanceCents;
}

async function saveReceipt(paymentId: string, file: File | null) {
  if (!file || file.size === 0) return;
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error("O comprovante deve ter no máximo 5 MB.");
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    throw new Error("Comprovante deve ser imagem (JPG, PNG, WEBP) ou PDF.");
  }
  const data = Buffer.from(await file.arrayBuffer());
  await prisma.debtReceipt.upsert({
    where: { paymentId },
    update: { filename: file.name, mimeType: file.type, sizeBytes: file.size, data },
    create: {
      paymentId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      data,
    },
  });
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/pagamentos");
  revalidatePath("/extrato");
}

export async function createPaymentAction(
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const user = await requireDebtUserForAction("payment.register");
  const debt = await getDebt();

  const parsed = parsePaymentForm(formData);
  if (!parsed.data) return { error: parsed.error };
  const { amountCents, paidAt, method, note, confirmExcess } = parsed.data;

  if (paidAt < debt.contractDate) {
    return { error: "A data do pagamento não pode ser anterior à assinatura do contrato." };
  }
  if (paidAt.getTime() > Date.now() + 86400_000) {
    return { error: "Não é possível registrar um pagamento com data futura." };
  }

  const balance = await balanceExcluding(debt.id);
  if (amountCents > balance && !confirmExcess) {
    return {
      needsExcessConfirmation: true,
      excessMessage: `O valor informado (${formatBRL(amountCents)}) é maior que o saldo devedor atualizado (${formatBRL(
        balance
      )}). Confirme se deseja registrar assim mesmo.`,
    };
  }

  let paymentId: string;
  try {
    const payment = await prisma.$transaction(async (tx) => {
      const last = await tx.debtPayment.findFirst({
        where: { debtId: debt.id },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      return tx.debtPayment.create({
        data: {
          debtId: debt.id,
          number: (last?.number ?? 0) + 1,
          amountCents,
          paidAt,
          method,
          note,
          registeredById: user.id,
          status: "PENDING",
        },
      });
    });
    paymentId = payment.id;

    const file = formData.get("receipt");
    if (file instanceof File) await saveReceipt(payment.id, file);

    await debtAudit({
      actorId: user.id,
      action: "payment.create",
      entity: "DebtPayment",
      entityId: payment.id,
      metadata: {
        numero: payment.number,
        valorCentavos: amountCents,
        data: paidAt.toISOString(),
        forma: method,
        acimaDoSaldo: amountCents > balance,
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível registrar o pagamento." };
  }

  refresh();
  redirect(`/pagamentos/${paymentId}?registrado=1`);
}

export async function updatePaymentAction(
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const user = await requireDebtUserForAction("payment.edit");
  const debt = await getDebt();
  const id = String(formData.get("id") ?? "");

  const current = await prisma.debtPayment.findFirst({ where: { id, debtId: debt.id } });
  if (!current) return { error: "Pagamento não encontrado." };

  const parsed = parsePaymentForm(formData);
  if (!parsed.data) return { error: parsed.error };
  const { amountCents, paidAt, method, note, confirmExcess } = parsed.data;

  if (paidAt < debt.contractDate) {
    return { error: "A data do pagamento não pode ser anterior à assinatura do contrato." };
  }

  const balance = await balanceExcluding(debt.id, id);
  if (amountCents > balance && !confirmExcess) {
    return {
      needsExcessConfirmation: true,
      excessMessage: `O novo valor (${formatBRL(amountCents)}) é maior que o saldo devedor sem este pagamento (${formatBRL(
        balance
      )}). Confirme se deseja salvar assim mesmo.`,
    };
  }

  const financialChange =
    current.amountCents !== amountCents || current.paidAt.getTime() !== paidAt.getTime();
  // Alterar valor ou data de um pagamento já confirmado invalida a confirmação:
  // o credor precisa confirmar de novo o que passou a valer.
  const resetConfirmation = financialChange && current.status === "CONFIRMED";

  try {
    await prisma.debtPayment.update({
      where: { id },
      data: {
        amountCents,
        paidAt,
        method,
        note,
        ...(resetConfirmation
          ? { status: "PENDING", confirmedAt: null, confirmedById: null }
          : {}),
      },
    });

    const file = formData.get("receipt");
    if (file instanceof File) await saveReceipt(id, file);

    await debtAudit({
      actorId: user.id,
      action: "payment.update",
      entity: "DebtPayment",
      entityId: id,
      metadata: {
        numero: current.number,
        de: {
          valorCentavos: current.amountCents,
          data: current.paidAt.toISOString(),
          forma: current.method,
          observacao: current.note,
        },
        para: {
          valorCentavos: amountCents,
          data: paidAt.toISOString(),
          forma: method,
          observacao: note,
        },
        confirmacaoRevogada: resetConfirmation,
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar as alterações." };
  }

  refresh();
  redirect(`/pagamentos/${id}?atualizado=1`);
}

export async function deletePaymentAction(formData: FormData) {
  const user = await requireDebtUserForAction("payment.delete");
  const debt = await getDebt();
  const id = String(formData.get("id") ?? "");

  const payment = await prisma.debtPayment.findFirst({
    where: { id, debtId: debt.id },
    include: { receipt: { select: { filename: true } } },
  });
  if (!payment) redirect("/pagamentos?erro=nao-encontrado");

  await prisma.debtPayment.delete({ where: { id } });
  await debtAudit({
    actorId: user.id,
    action: "payment.delete",
    entity: "DebtPayment",
    entityId: id,
    metadata: {
      numero: payment.number,
      valorCentavos: payment.amountCents,
      data: payment.paidAt.toISOString(),
      forma: payment.method,
      situacao: payment.status,
      observacao: payment.note,
      comprovante: payment.receipt?.filename ?? null,
    },
  });

  refresh();
  redirect("/pagamentos?excluido=1");
}

const statusActionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["CONFIRMED", "DISPUTED", "CANCELED", "PENDING"]),
  statusNote: z.string().max(500).optional(),
});

/** Confirmar, contestar, cancelar ou reabrir um pagamento (ação do credor). */
export async function setPaymentStatusAction(formData: FormData) {
  const user = await requireDebtUserForAction("payment.confirm");
  const debt = await getDebt();

  const parsed = statusActionSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    statusNote: String(formData.get("statusNote") ?? "").trim() || undefined,
  });
  if (!parsed.success) redirect("/pagamentos?erro=dados-invalidos");

  const payment = await prisma.debtPayment.findFirst({
    where: { id: parsed.data.id, debtId: debt.id },
  });
  if (!payment) redirect("/pagamentos?erro=nao-encontrado");

  const { status, statusNote } = parsed.data;
  const confirming = status === "CONFIRMED";

  await prisma.debtPayment.update({
    where: { id: payment.id },
    data: {
      status,
      statusNote: status === "PENDING" ? null : statusNote ?? null,
      confirmedAt: confirming ? new Date() : null,
      confirmedById: confirming ? user.id : null,
    },
  });

  const actionByStatus = {
    CONFIRMED: "payment.confirm",
    DISPUTED: "payment.dispute",
    CANCELED: "payment.cancel",
    PENDING: "payment.reopen",
  } as const;

  await debtAudit({
    actorId: user.id,
    action: actionByStatus[status],
    entity: "DebtPayment",
    entityId: payment.id,
    metadata: {
      numero: payment.number,
      de: payment.status,
      para: status,
      justificativa: statusNote ?? null,
    },
  });

  refresh();
  redirect(`/pagamentos/${payment.id}?situacao=1`);
}

export async function deleteReceiptAction(formData: FormData) {
  const user = await requireDebtUserForAction("payment.edit");
  const id = String(formData.get("id") ?? "");
  const receipt = await prisma.debtReceipt.findUnique({ where: { paymentId: id } });
  if (receipt) {
    await prisma.debtReceipt.delete({ where: { paymentId: id } });
    await debtAudit({
      actorId: user.id,
      action: "receipt.delete",
      entity: "DebtPayment",
      entityId: id,
      metadata: { arquivo: receipt.filename },
    });
  }
  refresh();
  redirect(`/pagamentos/${id}?comprovante=removido`);
}
