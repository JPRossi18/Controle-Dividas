import { formatAmount, formatDateBR, formatDateTimeBR } from "./money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "./labels";
import type { DebtLedger } from "./ledger";
import type { DebtState } from "./access";

/** Escapa um campo para CSV com separador ";" (padrão que o Excel pt-BR abre direto). */
function cell(value: string | number): string {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(values: Array<string | number>): string {
  return values.map(cell).join(";");
}

/**
 * Extrato completo em CSV: cabeçalho com o resumo da dívida e, em seguida,
 * a lista de pagamentos. Números em formato brasileiro (vírgula decimal).
 */
export function buildStatementCsv(state: DebtState, ledger: DebtLedger): string {
  const { debt, payments, totals } = state;
  const rate = (debt.interestRateBps / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  });

  const lines: string[] = [
    row(["Extrato da dívida"]),
    row(["Devedor", debt.debtorName]),
    row(["Credor", debt.creditorName]),
    row(["Contrato assinado em", formatDateBR(debt.contractDate)]),
    row([
      "Juros",
      debt.interestMode === "NONE"
        ? "sem juros"
        : `${rate}% ao mês (${debt.interestMode === "COMPOUND" ? "compostos" : "simples"})`,
    ]),
    row(["Valor original (R$)", formatAmount(debt.principalCents)]),
    row(["Juros acumulados (R$)", formatAmount(ledger.interestChargedCents)]),
    row(["Total devido com juros (R$)", formatAmount(ledger.totalDueCents)]),
    row(["Total pago (R$)", formatAmount(ledger.paidCents)]),
    row(["Total confirmado pelo credor (R$)", formatAmount(totals.confirmedCents)]),
    row(["Saldo devedor atualizado (R$)", formatAmount(ledger.balanceCents)]),
    row(["Percentual quitado (%)", ledger.percentPaid.toLocaleString("pt-BR")]),
    row(["Quantidade de pagamentos", ledger.paymentCount]),
    row(["Média dos pagamentos (R$)", formatAmount(ledger.averageCents)]),
    row(["Extrato gerado em", formatDateTimeBR(new Date())]),
    "",
    row([
      "Número",
      "Data do pagamento",
      "Valor (R$)",
      "Forma de pagamento",
      "Situação",
      "Observação",
      "Comprovante",
      "Registrado em",
      "Registrado por",
      "Confirmado em",
      "Confirmado por",
    ]),
  ];

  // Do mais recente para o mais antigo, igual à tela de histórico.
  for (const p of payments) {
    lines.push(
      row([
        p.number,
        formatDateBR(p.paidAt),
        formatAmount(p.amountCents),
        PAYMENT_METHOD_LABELS[p.method],
        PAYMENT_STATUS_LABELS[p.status],
        p.note ?? "",
        p.receipt ? p.receipt.filename : "",
        formatDateTimeBR(p.createdAt),
        p.registeredBy?.name ?? "",
        p.confirmedAt ? formatDateTimeBR(p.confirmedAt) : "",
        p.confirmedBy?.name ?? "",
      ])
    );
  }

  return lines.join("\r\n");
}
