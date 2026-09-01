"use client";

import { useFormState } from "react-dom";
import { resetDebtPasswordAction, type DebtFormState } from "@/core/auth-actions";
import { Alert, DInput, DLabel } from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<DebtFormState, FormData>(resetDebtPasswordAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <DLabel htmlFor="password" hint="mínimo de 8 caracteres">
          Nova senha
        </DLabel>
        <DInput
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <SubmitButton className="w-full">Salvar nova senha</SubmitButton>
    </form>
  );
}
