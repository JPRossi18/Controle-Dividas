"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import {
  requestDebtPasswordResetAction,
  type DebtFormState,
} from "@/core/auth-actions";
import { Alert, DInput, DLabel } from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";

export function RecoverForm() {
  const [state, formAction] = useFormState<DebtFormState, FormData>(
    requestDebtPasswordResetAction,
    {}
  );

  if (state.ok) {
    return (
      <div className="space-y-3">
        <Alert tone="success">
          Se este e-mail estiver cadastrado, o link de redefinição foi enviado. O link
          vale por 30 minutos.
        </Alert>
        {/* Sem provedor de e-mail configurado (ambiente local), o link aparece aqui
            para que o fluxo possa ser testado. Em produção isto não aparece. */}
        {state.devHint && (
          <Alert tone="warning">
            Ambiente sem envio de e-mail configurado. Link para teste:{" "}
            <Link href={state.devHint} className="underline">
              redefinir senha
            </Link>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <DLabel htmlFor="email">E-mail</DLabel>
        <DInput id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <SubmitButton className="w-full" pendingLabel="Enviando…">
        Enviar link
      </SubmitButton>
    </form>
  );
}
