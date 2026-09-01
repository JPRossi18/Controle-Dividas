import Link from "next/link";
import { loadDebtState, requireDebtUser } from "@/core/access";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/core/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/core/labels";
import { DCard, DLinkButton, SectionTitle } from "@/components/ui";
import { PrintButton } from "@/components/actions-ui";

export const dynamic = "force-dynamic";

/**
 * Extrato completo: resumo, evolução mês a mês (juros e pagamentos) e a
 * relação de todos os pagamentos. Imprime em PDF pelo navegador e exporta
 * em CSV pelo botão.
 */
export default async function StatementPage() {
  await requireDebtUser();
  const { debt, payments, ledger, totals } = await loadDebtState();

  const rate = (debt.interestRateBps / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  });
  // Linha do tempo do mais recente para o mais antigo.
  const timeline = [...ledger.entries].reverse();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Relatório</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Extrato completo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dívida de {debt.debtorName} com {debt.creditorName} · gerado em{" "}
            {formatDateTimeBR(new Date())}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton label="Imprimir / PDF" />
          <Link href="/extrato/csv" prefetch={false}>
            <DLinkButton variant="ghost">Exportar CSV</DLinkButton>
          </Link>
        </div>
      </header>

      <DCard>
        <SectionTitle>Resumo</SectionTitle>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {[
            ["Contrato assinado em", formatDateBR(debt.contractDate)],
            [
              "Juros",
              debt.interestMode === "NONE"
                ? "Sem juros"
                : `${rate}% ao mês (${
                    debt.interestMode === "COMPOUND" ? "compostos" : "simples"
                  })`,
            ],
            ["Valor original", formatBRL(debt.principalCents)],
            ["Juros acumulados", formatBRL(ledger.interestChargedCents)],
            ["Total devido com juros", formatBRL(ledger.totalDueCents)],
            ["Total pago", formatBRL(ledger.paidCents)],
            [`Confirmado por ${debt.creditorName}`, formatBRL(totals.confirmedCents)],
            ["Saldo devedor atualizado", formatBRL(ledger.balanceCents)],
            [
              "Percentual quitado",
              `${ledger.percentPaid.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`,
            ],
            ["Média dos pagamentos", formatBRL(ledger.averageCents)],
            [
              "Previsão de quitação",
              debt.expectedPayoffDate ? formatDateBR(debt.expectedPayoffDate) : "Não informada",
            ],
            ["Meses decorridos", String(ledger.monthsElapsed)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-1.5">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-sm font-medium tabular-nums text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </DCard>

      <DCard className="overflow-x-auto">
        <SectionTitle description="Todos os pagamentos, do mais recente para o mais antigo.">
          Pagamentos
        </SectionTitle>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum pagamento registrado.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 font-medium">Nº</th>
                <th className="py-2 font-medium">Data</th>
                <th className="py-2 font-medium">Valor</th>
                <th className="py-2 font-medium">Forma</th>
                <th className="py-2 font-medium">Situação</th>
                <th className="py-2 font-medium">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 tabular-nums">{p.number}</td>
                  <td className="py-2 tabular-nums">{formatDateBR(p.paidAt)}</td>
                  <td className="py-2 font-medium tabular-nums">{formatBRL(p.amountCents)}</td>
                  <td className="py-2">{PAYMENT_METHOD_LABELS[p.method]}</td>
                  <td className="py-2">{PAYMENT_STATUS_LABELS[p.status]}</td>
                  <td className="py-2 text-slate-600">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DCard>

      <DCard className="overflow-x-auto">
        <SectionTitle description="Cada incidência mensal de juros e cada pagamento, com o saldo resultante.">
          Evolução do saldo
        </SectionTitle>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">Sem movimentações até agora.</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 font-medium">Data</th>
                <th className="py-2 font-medium">Movimentação</th>
                <th className="py-2 font-medium">Valor</th>
                <th className="py-2 font-medium">Saldo após</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timeline.map((e, i) => (
                <tr key={`${e.kind}-${i}`}>
                  <td className="py-2 tabular-nums">{formatDateBR(e.date)}</td>
                  <td className="py-2">
                    {e.kind === "interest"
                      ? `Juros do mês ${e.monthIndex}`
                      : `Pagamento #${e.number}`}
                  </td>
                  <td
                    className={
                      e.kind === "interest"
                        ? "py-2 tabular-nums text-amber-700"
                        : "py-2 tabular-nums text-emerald-700"
                    }
                  >
                    {e.kind === "interest"
                      ? `+ ${formatBRL(e.interestCents)}`
                      : `− ${formatBRL(e.amountCents)}`}
                  </td>
                  <td className="py-2 font-medium tabular-nums">
                    {formatBRL(e.balanceAfterCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DCard>

      <p className="text-xs leading-relaxed text-slate-500">
        Este documento é um registro de acompanhamento do pagamento e não substitui
        instrumentos jurídicos ou comprovantes bancários.
      </p>
    </div>
  );
}
