import Link from "next/link";
import { can, loadDebtState, requireDebtUser } from "@/core/access";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/core/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/core/labels";
import { deletePaymentAction } from "@/core/payment-actions";
import {
  Alert,
  DCard,
  DLinkButton,
  StatusBadge,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/actions-ui";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { excluido?: string; erro?: string };
}) {
  const user = await requireDebtUser();
  const { debt, payments, ledger } = await loadDebtState();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Histórico</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Pagamentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ledger.paymentCount} pagamento(s) · {formatBRL(ledger.paidCents)} pagos ·{" "}
            {formatBRL(ledger.balanceCents)} em aberto
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/extrato">
            <DLinkButton variant="ghost">Extrato</DLinkButton>
          </Link>
          {can(user, "payment.register") && (
            <Link href="/pagamentos/novo">
              <DLinkButton>Registrar pagamento</DLinkButton>
            </Link>
          )}
        </div>
      </header>

      {searchParams.excluido && <Alert tone="success">Pagamento excluído e totais recalculados.</Alert>}
      {searchParams.erro === "nao-encontrado" && (
        <Alert tone="danger">Pagamento não encontrado.</Alert>
      )}

      {payments.length === 0 ? (
        <DCard>
          <p className="text-sm text-slate-500">
            Nenhum pagamento registrado. Os valores pagos aparecem aqui, do mais recente para o
            mais antigo.
          </p>
        </DCard>
      ) : (
        <>
          {/* Tabela (telas médias e grandes) */}
          <DCard className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nº</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Forma</th>
                  <th className="px-4 py-3 font-medium">Observação</th>
                  <th className="px-4 py-3 font-medium">Comprovante</th>
                  <th className="px-4 py-3 font-medium">Registrado em</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                      {p.number}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatDateBR(p.paidAt)}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                      {formatBRL(p.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-600">
                      {p.note ? <span className="line-clamp-2">{p.note}</span> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.receipt ? (
                        <Link
                          href={`/comprovantes/${p.id}`}
                          className="text-blue-700 hover:underline"
                          target="_blank"
                        >
                          Ver
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-500">
                      {formatDateTimeBR(p.createdAt)}
                      {p.registeredBy && <div>por {p.registeredBy.name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <Link
                          href={`/pagamentos/${p.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          Ver
                        </Link>
                        {can(user, "payment.edit") && (
                          <Link
                            href={`/pagamentos/${p.id}/editar`}
                            className="text-slate-600 hover:underline"
                          >
                            Editar
                          </Link>
                        )}
                        {can(user, "payment.delete") && (
                          <form action={deletePaymentAction} className="inline">
                            <input type="hidden" name="id" value={p.id} />
                            <ConfirmSubmit
                              message={`Excluir o pagamento #${p.number} de ${formatBRL(
                                p.amountCents
                              )}? Os totais serão recalculados. Esta ação fica registrada no histórico de alterações.`}
                              variant="ghost"
                              className="h-auto border-0 px-0 text-sm text-red-700 hover:bg-transparent hover:underline"
                            >
                              Excluir
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DCard>

          {/* Cartões (celular) */}
          <div className="space-y-3 md:hidden">
            {payments.map((p) => (
              <DCard key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-slate-900">
                      {formatBRL(p.amountCents)}
                    </p>
                    <p className="text-sm text-slate-500">
                      #{p.number} · {formatDateBR(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                    </p>
                  </div>
                  <StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />
                </div>
                {p.note && <p className="mt-2 text-sm text-slate-600">{p.note}</p>}
                <p className="mt-2 text-xs text-slate-400">
                  Registrado em {formatDateTimeBR(p.createdAt)}
                  {p.registeredBy ? ` por ${p.registeredBy.name}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link href={`/pagamentos/${p.id}`} className="text-blue-700 hover:underline">
                    Ver detalhes
                  </Link>
                  {p.receipt && (
                    <Link
                      href={`/comprovantes/${p.id}`}
                      target="_blank"
                      className="text-blue-700 hover:underline"
                    >
                      Comprovante
                    </Link>
                  )}
                  {can(user, "payment.edit") && (
                    <Link
                      href={`/pagamentos/${p.id}/editar`}
                      className="text-slate-600 hover:underline"
                    >
                      Editar
                    </Link>
                  )}
                </div>
              </DCard>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-400">
        Dívida de {debt.debtorName} com {debt.creditorName}. Valores em reais.
      </p>
    </div>
  );
}
