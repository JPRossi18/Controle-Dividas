import Link from "next/link";
import { redirect } from "next/navigation";
import { can, loadDebtState, requireDebtUser } from "@/core/access";
import { formatBRL, toDateInputValue } from "@/core/money";
import { DCard, SectionTitle } from "@/components/ui";
import { PaymentForm } from "../payment-form";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  const user = await requireDebtUser();
  if (!can(user, "payment.register")) redirect("/?erro=sem-permissao");

  const { debt, ledger } = await loadDebtState();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link href="/pagamentos" className="text-sm text-blue-700 hover:underline">
          ← Voltar ao histórico
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Registrar pagamento</h1>
        <p className="mt-1 text-sm text-slate-500">
          O valor entra no total pago e abate o saldo devedor. Cada pagamento nasce como
          &ldquo;aguardando confirmação&rdquo; até {debt.creditorName} confirmar.
        </p>
      </header>

      <DCard>
        <SectionTitle description="Todos os campos são conferidos também no servidor.">
          Dados do pagamento
        </SectionTitle>
        <PaymentForm
          mode="create"
          balanceLabel={formatBRL(ledger.balanceCents)}
          todayValue={toDateInputValue(new Date())}
          minDate={toDateInputValue(debt.contractDate)}
        />
      </DCard>
    </div>
  );
}
