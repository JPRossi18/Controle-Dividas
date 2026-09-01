"use client";

import { useFormState } from "react-dom";
import {
  createPaymentAction,
  updatePaymentAction,
  type PaymentFormState,
} from "@/core/payment-actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/core/labels";
import { Alert, DInput, DLabel, DSelect, DTextarea } from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";

export type PaymentFormDefaults = {
  id?: string;
  amount?: string;
  paidAt?: string;
  method?: string;
  note?: string;
  receiptName?: string | null;
};

/**
 * Formulário de pagamento (registro e edição).
 *
 * A validação daqui é conveniência: o servidor revalida tudo. O caso do
 * valor acima do saldo não é bloqueado — o servidor devolve um pedido de
 * confirmação explícita, que aparece como caixa de marcação.
 */
export function PaymentForm({
  mode,
  defaults = {},
  balanceLabel,
  todayValue,
  minDate,
}: {
  mode: "create" | "edit";
  defaults?: PaymentFormDefaults;
  balanceLabel: string;
  todayValue: string;
  minDate: string;
}) {
  const action = mode === "create" ? createPaymentAction : updatePaymentAction;
  const [state, formAction] = useFormState<PaymentFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5" encType="multipart/form-data">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <DLabel htmlFor="amount" hint="em reais">
            Valor pago
          </DLabel>
          <DInput
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={defaults.amount}
            required
            aria-describedby="amount-help"
          />
          <p id="amount-help" className="mt-1 text-xs text-slate-500">
            Saldo devedor atualizado: {balanceLabel}
          </p>
        </div>

        <div>
          <DLabel htmlFor="paidAt">Data do pagamento</DLabel>
          <DInput
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={defaults.paidAt ?? todayValue}
            min={minDate}
            max={todayValue}
            required
          />
        </div>

        <div>
          <DLabel htmlFor="method">Forma de pagamento</DLabel>
          <DSelect id="method" name="method" defaultValue={defaults.method ?? "PIX"} required>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </DSelect>
        </div>

        <div>
          <DLabel htmlFor="receipt" hint="opcional · JPG, PNG, WEBP ou PDF até 5 MB">
            Comprovante
          </DLabel>
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
          />
          {defaults.receiptName && (
            <p className="mt-1 text-xs text-slate-500">
              Anexo atual: {defaults.receiptName}. Enviar outro arquivo substitui este.
            </p>
          )}
        </div>
      </div>

      <div>
        <DLabel htmlFor="note" hint="opcional">
          Observação
        </DLabel>
        <DTextarea
          id="note"
          name="note"
          maxLength={500}
          defaultValue={defaults.note}
          placeholder="Ex.: transferência referente ao mês de setembro."
        />
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      {state.needsExcessConfirmation && (
        <Alert tone="warning">
          <p>{state.excessMessage}</p>
          <label className="mt-2 flex items-start gap-2 font-medium">
            <input type="checkbox" name="confirmExcess" value="1" className="mt-1" />
            <span>
              Confirmo o registro deste valor mesmo sendo maior que o saldo devedor.
            </span>
          </label>
        </Alert>
      )}

      <div className="flex gap-3">
        <SubmitButton pendingLabel="Salvando…">
          {mode === "create" ? "Confirmar pagamento" : "Salvar alterações"}
        </SubmitButton>
      </div>
    </form>
  );
}
