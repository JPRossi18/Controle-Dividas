import Link from "next/link";
import { can, loadDebtState, requireDebtUser } from "@/core/access";
import { formatBRL, formatDateBR, toDateInputValue } from "@/core/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/core/labels";
import { setExpectedPayoffAction } from "@/core/settings-actions";
import {
  Alert,
  DCard,
  DInput,
  DLabel,
  DLinkButton,
  ProgressBar,
  SectionTitle,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";

export const dynamic = "force-dynamic";

export default async function DebtDashboardPage({
  searchParams,
}: {
  searchParams: { previsao?: string };
}) {
  const user = await requireDebtUser();
  const { debt, payments, ledger, confirmedLedger, totals } = await loadDebtState();

  const rate = (debt.interestRateBps / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  });
  const recent = payments.slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Painel</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Dívida de {debt.debtorName} com {debt.creditorName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Contrato assinado em {formatDateBR(debt.contractDate)} ·{" "}
            {debt.interestMode === "NONE"
              ? "sem juros"
              : `juros de ${rate}% ao mês (${
                  debt.interestMode === "COMPOUND" ? "compostos" : "simples"
                })`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ledger.isSettled ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              Quitada
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              Em pagamento
            </span>
          )}
          {can(user, "payment.register") && (
            <Link href="/pagamentos/novo">
              <DLinkButton>Registrar pagamento</DLinkButton>
            </Link>
          )}
        </div>
      </header>

      {searchParams.previsao && <Alert tone="success">Previsão de quitação atualizada.</Alert>}

      {ledger.isSettled && (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
          <p className="text-xl font-semibold text-emerald-800">Pagamento integral concluído.</p>
          <p className="mt-1 text-sm text-emerald-700">
            Saldo devedor zerado em {ledger.lastPaymentAt ? formatDateBR(ledger.lastPaymentAt) : "—"}.
            {!confirmedLedger.isSettled &&
              " Ainda há pagamentos aguardando a confirmação do credor."}
          </p>
        </div>
      )}

      {/* ── Números principais ───────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor original" value={formatBRL(debt.principalCents)} />
        <StatCard
          label="Juros acumulados"
          value={formatBRL(ledger.interestChargedCents)}
          hint={`${ledger.monthsElapsed} ${
            ledger.monthsElapsed === 1 ? "mês" : "meses"
          } desde o contrato`}
          tone="amber"
        />
        <StatCard label="Total já pago" value={formatBRL(ledger.paidCents)} tone="green" />
        <StatCard
          label="Saldo devedor atualizado"
          value={formatBRL(ledger.balanceCents)}
          hint={`Total devido: ${formatBRL(ledger.totalDueCents)}`}
          tone={ledger.isSettled ? "green" : "blue"}
        />
      </div>

      {/* ── Progresso ────────────────────────────────────────── */}
      <DCard>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-700">Progresso da quitação</p>
            <p className="text-sm text-slate-500">
              Percentual calculado sobre o total devido com juros até hoje.
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600">
            {ledger.percentPaid.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
          </p>
        </div>

        <ProgressBar percent={ledger.percentPaid} secondaryPercent={confirmedLedger.percentPaid} />

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Confirmado por {debt.creditorName}: {formatBRL(totals.confirmedCents)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            Informado por {debt.debtorName}: {formatBRL(ledger.paidCents)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            Saldo restante: {formatBRL(ledger.balanceCents)}
          </span>
        </div>
      </DCard>

      {/* ── Informado × confirmado ───────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Total informado por ${debt.debtorName}`}
          value={formatBRL(ledger.paidCents)}
          hint={`${ledger.paymentCount} pagamento(s) registrado(s)`}
        />
        <StatCard
          label={`Total confirmado por ${debt.creditorName}`}
          value={formatBRL(totals.confirmedCents)}
          hint={`${totals.confirmedCount} pagamento(s) confirmado(s)`}
          tone="green"
        />
        <StatCard
          label="Aguardando confirmação"
          value={formatBRL(totals.pendingCents)}
          hint={
            totals.disputedCount > 0
              ? `${formatBRL(totals.disputedCents)} contestado(s)`
              : `${totals.pendingCount} pagamento(s) pendente(s)`
          }
          tone={totals.disputedCount > 0 ? "red" : "amber"}
        />
      </div>

      {/* ── Resumo financeiro ────────────────────────────────── */}
      <DCard>
        <SectionTitle description="Fechamento da dívida na data de hoje.">
          Resumo financeiro
        </SectionTitle>

        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {[
            ["Valor original", formatBRL(debt.principalCents)],
            [
              debt.interestMode === "NONE"
                ? "Juros"
                : `Juros (${rate}% ao mês, ${
                    debt.interestMode === "COMPOUND" ? "compostos" : "simples"
                  })`,
              formatBRL(ledger.interestChargedCents),
            ],
            ["Total devido com juros", formatBRL(ledger.totalDueCents)],
            ["Total pago", formatBRL(ledger.paidCents)],
            ["Saldo atual", formatBRL(ledger.balanceCents)],
            [
              "Percentual quitado",
              `${ledger.percentPaid.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`,
            ],
            [
              "Último pagamento",
              ledger.lastPaymentAt ? formatDateBR(ledger.lastPaymentAt) : "Nenhum ainda",
            ],
            ["Quantidade de pagamentos", String(ledger.paymentCount)],
            ["Média dos pagamentos", formatBRL(ledger.averageCents)],
            [
              "Próxima incidência de juros",
              debt.interestMode === "NONE"
                ? "—"
                : `${formatDateBR(ledger.nextAccrualDate)} · ${formatBRL(ledger.nextAccrualCents)}`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-sm font-medium tabular-nums text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Previsão de quitação: referência combinada entre as partes, não parcela. */}
        <div className="mt-5 rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Previsão de quitação</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Data de referência acordada entre as partes. Não gera parcela nem cobrança
            automática.
          </p>
          {can(user, "settings.manage") ? (
            <form action={setExpectedPayoffAction} className="mt-3 flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-56">
                <DLabel htmlFor="expectedPayoffDate">Data prevista</DLabel>
                <DInput
                  id="expectedPayoffDate"
                  name="expectedPayoffDate"
                  type="date"
                  defaultValue={
                    debt.expectedPayoffDate ? toDateInputValue(debt.expectedPayoffDate) : ""
                  }
                />
              </div>
              <SubmitButton variant="ghost">Salvar previsão</SubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-sm font-medium text-slate-900">
              {debt.expectedPayoffDate ? formatDateBR(debt.expectedPayoffDate) : "Não informada"}
            </p>
          )}
        </div>
      </DCard>

      {/* ── Últimos pagamentos ───────────────────────────────── */}
      <DCard>
        <SectionTitle
          description="Movimentações mais recentes."
          action={
            <Link href="/pagamentos" className="text-sm text-blue-700 hover:underline">
              Ver histórico completo
            </Link>
          }
        >
          Últimos pagamentos
        </SectionTitle>

        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum pagamento registrado até agora.
            {can(user, "payment.register") && (
              <>
                {" "}
                <Link href="/pagamentos/novo" className="text-blue-700 hover:underline">
                  Registrar o primeiro
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/pagamentos/${p.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    #{p.number} · {formatBRL(p.amountCents)}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {formatDateBR(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                  </p>
                </div>
                <StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />
              </li>
            ))}
          </ul>
        )}
      </DCard>
    </div>
  );
}
