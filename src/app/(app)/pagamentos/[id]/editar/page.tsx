import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, loadDebtState, requireDebtUser } from "@/core/access";
import { formatAmount, formatBRL, toDateInputValue } from "@/core/money";
import { Alert, DCard, SectionTitle } from "@/components/ui";
import { PaymentForm } from "../../payment-form";

export const dynamic = "force-dynamic";

export default async function EditPaymentPage({ params }: { params: { id: string } }) {
  const user = await requireDebtUser();
  if (!can(user, "payment.edit")) redirect(`/pagamentos/${params.id}`);

  const { debt, payments, ledger } = await loadDebtState();
  const payment = payments.find((p) => p.id === params.id);
  if (!payment) notFound();

  // Saldo "sem este pagamento": referência correta ao trocar o valor.
  const balanceWithout = ledger.balanceCents + payment.amountCents;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link href={`/pagamentos/${payment.id}`} className="text-sm text-blue-700 hover:underline">
          ← Voltar ao pagamento
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Editar pagamento #{payment.number}
        </h1>
      </header>

      {payment.status === "CONFIRMED" && (
        <Alert tone="warning">
          Este pagamento já foi confirmado por {debt.creditorName}. Alterar o valor ou a data
          revoga a confirmação e ele volta para &ldquo;aguardando confirmação&rdquo;.
        </Alert>
      )}

      <DCard>
        <SectionTitle description="Os totais são recalculados assim que você salvar.">
          Dados do pagamento
        </SectionTitle>
        <PaymentForm
          mode="edit"
          defaults={{
            id: payment.id,
            amount: formatAmount(payment.amountCents),
            paidAt: toDateInputValue(payment.paidAt),
            method: payment.method,
            note: payment.note ?? "",
            receiptName: payment.receipt?.filename ?? null,
          }}
          balanceLabel={`${formatBRL(balanceWithout)} (sem este pagamento)`}
          todayValue={toDateInputValue(new Date())}
          minDate={toDateInputValue(debt.contractDate)}
        />
      </DCard>
    </div>
  );
}
