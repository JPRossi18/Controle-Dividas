/**
 * Componentes visuais do módulo de dívida.
 *
 * Paleta própria (azul, verde e cinza sobre fundo claro), independente dos
 * tokens do VTC: este módulo é uma aplicação à parte dentro do mesmo projeto.
 */
import { forwardRef } from "react";

export function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "ghost" | "danger" | "success";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700",
  ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export const DButton = forwardRef<HTMLButtonElement, ButtonProps>(function DButton(
  { className, variant = "primary", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
});

export function DLinkButton({
  className,
  variant = "primary",
  children,
}: {
  className?: string;
  variant?: ButtonVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
        buttonVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

const fieldBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";

export const DInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function DInput({ className, ...props }, ref) {
    return <input ref={ref} className={cx(fieldBase, "h-11", className)} {...props} />;
  }
);

export const DSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function DSelect({ className, ...props }, ref) {
    return <select ref={ref} className={cx(fieldBase, "h-11", className)} {...props} />;
  }
);

export const DTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function DTextarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(fieldBase, "min-h-[88px] py-2", className)} {...props} />;
});

export function DLabel({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {hint && <span className="ml-2 font-normal text-slate-400">{hint}</span>}
    </label>
  );
}

export function DCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cx(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-slate-300 print:shadow-none",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    neutral: "text-slate-900",
    blue: "text-blue-700",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  } as const;

  return (
    <DCard>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx("mt-2 text-2xl font-semibold tabular-nums sm:text-[1.7rem]", tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </DCard>
  );
}

export function ProgressBar({
  percent,
  secondaryPercent,
  className,
}: {
  percent: number;
  secondaryPercent?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(percent, 100));
  const secondary =
    secondaryPercent === undefined ? undefined : Math.max(0, Math.min(secondaryPercent, 100));

  return (
    <div
      className={cx("relative h-4 w-full overflow-hidden rounded-full bg-slate-200", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso da quitação"
    >
      {/* Faixa clara: tudo que o devedor informou. Faixa forte: o que o credor confirmou. */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-emerald-300 transition-[width]"
        style={{ width: `${clamped}%` }}
      />
      {secondary !== undefined && (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-600 transition-[width]"
          style={{ width: `${secondary}%` }}
        />
      )}
    </div>
  );
}

const statusStyles = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISPUTED: "bg-red-50 text-red-700 border-red-200",
  CANCELED: "bg-slate-100 text-slate-500 border-slate-200",
} as const;

export function StatusBadge({ status, label }: { status: keyof typeof statusStyles; label: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status]
      )}
    >
      {label}
    </span>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  } as const;

  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone], className)} role="status">
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  description,
  action,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
