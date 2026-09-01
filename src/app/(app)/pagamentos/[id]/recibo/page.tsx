import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDebtState, requireDebtUser } from "@/core/access";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/core/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/core/labels";
import { PrintButton } from "@/components/actions-ui";

export const dynamic = "force-dynamic";

/**
 * Recibo de um pagamento. Feito para caber numa folha: a impressão do
 * navegador (Ctrl+P) gera o PDF, sem depender de biblioteca externa.
 */
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  await requireDebtUser();
  const { debt, payments, ledger } = await loadDebtState();

  const payment = payments.find((p) => p.id === params.id);
  if (!payment) notFound();

  const entry = ledger.entries.find(
    (e) => e.kind === "payment" && e.number === payment.number
  );
  const balanceAfter = entry && entry.kind === "payment" ? entry.balanceAfterCents : null;
  const toInterest = entry && entry.kind === "payment" ? entry.toInterestCents : null;
  const toPrincipal = entry && entry.kind === "payment" ? entry.toPrincipalCents : null;

  const rows: Array<[string, string]> = [
    ["Número identificador do pagamento", `#${String(payment.number).padStart(4, "0")}`],
    ["Credor (recebedor)", debt.creditorName],
    ["Pagador", debt.debtorName],
    ["Valor recebido", formatBRL(payment.amountCents)],
    ["Data do pagamento", formatDateBR(payment.paidAt)],
    ["Forma de pagamento", PAYMENT_METHOD_LABELS[payment.method]],
    ["Observação", payment.note || "—"],
    ["Situação", PAYMENT_STATUS_LABELS[payment.status]],
    ...(toInterest !== null && toPrincipal !== null && debt.interestMode !== "NONE"
      ? ([
          ["Abatido de juros", formatBRL(toInterest)],
          ["Abatido do principal", formatBRL(toPrincipal)],
        ] as Array<[string, string]>)
      : []),
    ["Saldo restante após o pagamento", balanceAfter === null ? "—" : formatBRL(balanceAfter)],
    ["Registrado na plataforma em", formatDateTimeBR(payment.createdAt)],
    ...(payment.confirmedAt
      ? ([["Confirmado pelo credor em", formatDateTimeBR(payment.confirmedAt)]] as Array<
          [string, string]
        >)
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/pagamentos/${payment.id}`} className="text-sm text-blue-700 hover:underline">
          ← Voltar ao pagamento
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-xl font-semibold text-slate-900">Recibo de pagamento</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dívida de {debt.debtorName} com {debt.creditorName} · emitido em{" "}
            {formatDateTimeBR(new Date())}
          </p>
        </header>

        <dl className="space-y-2.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-6 border-b border-slate-100 pb-2">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-lg font-semibold text-slate-900">
          Valor recebido: {formatBRL(payment.amountCents)}
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div className="border-t border-slate-400 pt-2 text-center text-sm text-slate-600">
            {debt.debtorName} · pagador
          </div>
          <div className="border-t border-slate-400 pt-2 text-center text-sm text-slate-600">
            {debt.creditorName} · credor
          </div>
        </div>

        <p className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
          Este documento é um registro de acompanhamento do pagamento e não substitui
          instrumentos jurídicos ou comprovantes bancários.
        </p>
      </article>
    </div>
  );
}
