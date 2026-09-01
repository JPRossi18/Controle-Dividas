"use client";

import { useFormState } from "react-dom";
import { debtLoginAction, type DebtFormState } from "@/core/auth-actions";
import { DInput, DLabel, Alert } from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";

export function LoginForm() {
  const [state, formAction] = useFormState<DebtFormState, FormData>(debtLoginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <DLabel htmlFor="email">E-mail</DLabel>
        <DInput id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <DLabel htmlFor="password">Senha</DLabel>
        <DInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <SubmitButton className="w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
