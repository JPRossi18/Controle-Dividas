"use client";

/**
 * Seletor de quem está usando o site (modo aberto, sem senha).
 *
 * Existe para o site continuar sabendo quem registrou e quem confirmou cada
 * pagamento — é o que sustenta o "informado por JP × confirmado por Bruno"
 * e o histórico de alterações. Trocar de perfil aqui não é autenticação:
 * qualquer pessoa com o link pode escolher qualquer um dos dois.
 */
export function ProfileSwitch({
  current,
  profiles,
  action,
}: {
  current: string;
  profiles: Array<{ id: string; label: string }>;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="flex items-center gap-2">
      <label htmlFor="userId" className="hidden text-slate-500 sm:inline">
        Usando como
      </label>
      <select
        id="userId"
        name="userId"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {/* Sem JavaScript, o botão faz o mesmo que o onChange acima. */}
      <noscript>
        <button
          type="submit"
          className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-700"
        >
          Trocar
        </button>
      </noscript>
    </form>
  );
}
