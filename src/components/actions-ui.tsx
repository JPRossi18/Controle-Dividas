"use client";

import { useFormStatus } from "react-dom";
import { DButton, cx } from "./ui";

/** Botão de envio com estado de carregamento (evita duplo clique). */
export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger" | "success";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <DButton type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </DButton>
  );
}

/** Botão que pede confirmação antes de enviar (excluir, cancelar, contestar). */
export function ConfirmSubmit({
  message,
  children,
  variant = "danger",
  pendingLabel = "Processando…",
  className,
}: {
  message: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger" | "success";
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <DButton
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </DButton>
  );
}

export function PrintButton({ label = "Imprimir / salvar em PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cx(
        "inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 print:hidden"
      )}
    >
      {label}
    </button>
  );
}
