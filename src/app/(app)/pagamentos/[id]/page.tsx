import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, loadDebtState, requireDebtUser } from "@/core/access";
import { balanceAfterPayment } from "@/core/ledger";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/core/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  auditLabel,
} from "@/core/labels";
import {
  deletePaymentAction,
  deleteReceiptAction,
  setPaymentStatusAction,
} from "@/core/payment-actions";
import {
  Alert,
  DCard,
  DInput,
  DLinkButton,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/actions-ui";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { registrado?: string; atualizado?: string; situacao?: string; comprovante?: string };
}) {
  const user = await requireDebtUser();
  const { debt, payments, ledger } = await loadDebtState();

  const payment = payments.find((p) => p.id === params.id);
  if (!payment) notFound();

  const balanceAfter = balanceAfterPayment(ledger, payment.number);
  const history = await prisma.debtAuditLog.findMany({
    where: { entity: "DebtPayment", entityId: payment.id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/pagamentos" className="text-sm text-blue-700 hover:underline">
            ← Voltar ao histórico
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Pagamento #{payment.number}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatBRL(payment.amountCents)} · {formatDateBR(payment.paidAt)} ·{" "}
            {PAYMENT_METHOD_LABELS[payment.method]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/pagamentos/${payment.id}/recibo`}>
            <DLinkButton variant="ghost">Recibo</DLinkButton>
          </Link>
          {can(user, "payment.edit") && (
            <Link href={`/pagamentos/${payment.id}/editar`}>
              <DLinkButton variant="ghost">Editar</DLinkButton>
            </Link>
          )}
        </div>
      </header>

      {searchParams.registrado && (
        <Alert tone="success">Pagamento registrado. Saldo e progresso atualizados.</Alert>
      )}
      {searchParams.atualizado && (
        <Alert tone="success">Pagamento atualizado e totais recalculados.</Alert>
      )}
      {searchParams.situacao && <Alert tone="success">Situação do pagamento atualizada.</Alert>}
      {searchParams.comprovante === "removido" && <Alert tone="success">Comprovante removido.</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr,1fr]">
        <DCard>
          <SectionTitle>Detalhes</SectionTitle>
          <dl className="space-y-3">
            {[
              ["Número do pagamento", `#${payment.number}`],
              ["Valor pago", formatBRL(payment.amountCents)],
              ["Data do pagamento", formatDateBR(payment.paidAt)],
              ["Forma de pagamento", PAYMENT_METHOD_LABELS[payment.method]],
              ["Observação", payment.note || "—"],
              [
                "Saldo restante após este pagamento",
                balanceAfter === null ? "—" : formatBRL(balanceAfter),
              ],
              [
                "Registrado em",
                `${formatDateTimeBR(payment.createdAt)}${
                  payment.registeredBy ? ` por ${payment.registeredBy.name}` : ""
                }`,
              ],
              [
                "Última alteração",
                payment.updatedAt.getTime() === payment.createdAt.getTime()
                  ? "—"
                  : formatDateTimeBR(payment.updatedAt),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2"
              >
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="text-sm font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-slate-700">Comprovante</p>
            {payment.receipt ? (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/comprovantes/${payment.id}`}
                  target="_blank"
                  className="text-sm text-blue-700 hover:underline"
                >
                  {payment.receipt.filename} ({Math.ceil(payment.receipt.sizeBytes / 1024)} KB)
                </Link>
                {can(user, "payment.edit") && (
                  <form action={deleteReceiptAction}>
                    <input type="hidden" name="id" value={payment.id} />
                    <ConfirmSubmit
                      message="Remover o comprovante deste pagamento?"
                      variant="ghost"
                      className="h-8 border-0 px-0 text-sm text-red-700 hover:bg-transparent hover:underline"
                    >
                      Remover
                    </ConfirmSubmit>
                  </form>
                )}
                {payment.receipt.mimeType.startsWith("image/") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/comprovantes/${payment.id}`}
                    alt={`Comprovante do pagamento #${payment.number}`}
                    className="mt-2 w-full max-w-sm rounded-lg border border-slate-200"
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhum comprovante anexado.</p>
            )}
          </div>
        </DCard>

        <div className="space-y-5">
          <DCard>
            <SectionTitle description={`Confirmação de ${debt.creditorName}.`}>
              Situação
            </SectionTitle>

            <div className="flex items-center gap-3">
              <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
              {payment.confirmedAt && (
                <span className="text-sm text-slate-500">
                  em {formatDateTimeBR(payment.confirmedAt)}
                  {payment.confirmedBy ? ` por ${payment.confirmedBy.name}` : ""}
                </span>
              )}
            </div>
            {payment.statusNote && (
              <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {payment.statusNote}
              </p>
            )}

            {can(user, "payment.confirm") ? (
              <form action={setPaymentStatusAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={payment.id} />
                <div>
                  <label htmlFor="statusNote" className="mb-1.5 block text-sm text-slate-600">
                    Justificativa (para contestar ou cancelar)
                  </label>
                  <DInput
                    id="statusNote"
                    name="statusNote"
                    maxLength={500}
                    placeholder="Opcional"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {payment.status !== "CONFIRMED" && (
                    <button
                      type="submit"
                      name="status"
                      value="CONFIRMED"
                      className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Confirmar recebimento
                    </button>
                  )}
                  {payment.status !== "DISPUTED" && (
                    <button
                      type="submit"
                      name="status"
                      value="DISPUTED"
                      className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Contestar
                    </button>
                  )}
                  {payment.status !== "CANCELED" && (
                    <button
                      type="submit"
                      name="status"
                      value="CANCELED"
                      className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  )}
                  {payment.status !== "PENDING" && (
                    <button
                      type="submit"
                      name="status"
                      value="PENDING"
                      className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Cancelado não entra em nenhum total. Contestado continua somando, porém
                  sinalizado.
                </p>
              </form>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Somente {debt.creditorName} pode confirmar ou contestar este pagamento.
              </p>
            )}
          </DCard>

          {can(user, "payment.delete") && (
            <DCard>
              <SectionTitle description="A exclusão fica registrada no histórico de alterações.">
                Excluir
              </SectionTitle>
              <form action={deletePaymentAction}>
                <input type="hidden" name="id" value={payment.id} />
                <ConfirmSubmit
                  message={`Excluir o pagamento #${payment.number} de ${formatBRL(
                    payment.amountCents
                  )}? Os totais serão recalculados.`}
                >
                  Excluir pagamento
                </ConfirmSubmit>
              </form>
            </DCard>
          )}
        </div>
      </div>

      <DCard>
        <SectionTitle description="Tudo o que aconteceu com este pagamento.">
          Histórico de alterações
        </SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Sem registros.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="py-2.5 text-sm">
                <span className="font-medium text-slate-800">{auditLabel(h.action)}</span>
                <span className="text-slate-500">
                  {" "}
                  · {formatDateTimeBR(h.createdAt)}
                  {h.actor ? ` · ${h.actor.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DCard>
    </div>
  );
}
