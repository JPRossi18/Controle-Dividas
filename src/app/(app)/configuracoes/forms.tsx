"use client";

import { useFormState } from "react-dom";
import { updateDebtAction, changeOwnPasswordAction } from "@/core/settings-actions";
import type { DebtFormState } from "@/core/auth-actions";
import { Alert, DInput, DLabel, DSelect, DTextarea } from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";

export function DebtSettingsForm({
  defaults,
}: {
  defaults: {
    debtorName: string;
    creditorName: string;
    description: string;
    principal: string;
    contractDate: string;
    interestRate: string;
    interestMode: string;
    expectedPayoffDate: string;
  };
}) {
  const [state, formAction] = useFormState<DebtFormState, FormData>(updateDebtAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <DLabel htmlFor="debtorName">Devedor</DLabel>
          <DInput id="debtorName" name="debtorName" defaultValue={defaults.debtorName} required />
        </div>
        <div>
          <DLabel htmlFor="creditorName">Credor</DLabel>
          <DInput
            id="creditorName"
            name="creditorName"
            defaultValue={defaults.creditorName}
            required
          />
        </div>
        <div>
          <DLabel htmlFor="principal" hint="em reais">
            Valor original da dívida
          </DLabel>
          <DInput
            id="principal"
            name="principal"
            inputMode="decimal"
            defaultValue={defaults.principal}
            required
          />
        </div>
        <div>
          <DLabel htmlFor="contractDate">Assinatura do contrato</DLabel>
          <DInput
            id="contractDate"
            name="contractDate"
            type="date"
            defaultValue={defaults.contractDate}
            required
          />
        </div>
        <div>
          <DLabel htmlFor="interestRate" hint="% ao mês">
            Taxa de juros
          </DLabel>
          <DInput
            id="interestRate"
            name="interestRate"
            inputMode="decimal"
            defaultValue={defaults.interestRate}
            required
          />
        </div>
        <div>
          <DLabel htmlFor="interestMode">Forma de cálculo dos juros</DLabel>
          <DSelect id="interestMode" name="interestMode" defaultValue={defaults.interestMode}>
            <option value="COMPOUND">Compostos (juros sobre o saldo devedor)</option>
            <option value="SIMPLE">Simples (juros só sobre o principal em aberto)</option>
            <option value="NONE">Sem juros</option>
          </DSelect>
        </div>
        <div>
          <DLabel htmlFor="expectedPayoffDate" hint="opcional">
            Previsão de quitação
          </DLabel>
          <DInput
            id="expectedPayoffDate"
            name="expectedPayoffDate"
            type="date"
            defaultValue={defaults.expectedPayoffDate}
          />
        </div>
      </div>

      <div>
        <DLabel htmlFor="description" hint="opcional">
          Descrição / referência do contrato
        </DLabel>
        <DTextarea id="description" name="description" defaultValue={defaults.description} />
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Dados da dívida atualizados. O saldo foi recalculado.</Alert>}

      <SubmitButton>Salvar dados da dívida</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useFormState<DebtFormState, FormData>(changeOwnPasswordAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <DLabel htmlFor="current">Senha atual</DLabel>
          <DInput id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div>
          <DLabel htmlFor="next" hint="mín. 8">
            Nova senha
          </DLabel>
          <DInput
            id="next"
            name="next"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <DLabel htmlFor="confirm">Repetir nova senha</DLabel>
          <DInput
            id="confirm"
            name="confirm"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <p className="text-xs text-slate-500">
        Ao trocar a senha, todas as sessões abertas são encerradas e será preciso entrar de novo.
      </p>
      <SubmitButton>Alterar senha</SubmitButton>
    </form>
  );
}
