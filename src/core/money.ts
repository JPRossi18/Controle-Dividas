/**
 * Dinheiro no módulo de dívida.
 *
 * Regra: valores trafegam e são gravados em CENTAVOS (inteiro). Nada de
 * ponto flutuante em cálculo financeiro — float acumula erro de
 * arredondamento e, num controle de dívida, isso vira divergência de saldo.
 */

/** Formata centavos como moeda brasileira: 1000000 → "R$ 10.000,00". */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Formata centavos sem o símbolo: 1000000 → "10.000,00" (usado em CSV/inputs). */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Converte texto digitado pelo usuário em centavos.
 *
 * Aceita as formas usadas no Brasil: "1.234,56", "1234,56", "1234.56",
 * "R$ 1.234,56" e "1234". Retorna null quando não é um número válido.
 */
export function parseAmountToCents(input: string): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  let cleaned = raw.replace(/[R$\s ]/gi, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // "1.234,56" (pt-BR) ou "1,234.56" (en) — o último separador manda
    cleaned =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    cleaned = cleaned.replace(",", ".");
  } else if (hasDot) {
    // "1.234" costuma ser milhar em pt-BR; "1.5" ou "1.50" é decimal.
    const decimals = cleaned.length - cleaned.lastIndexOf(".") - 1;
    const dots = (cleaned.match(/\./g) ?? []).length;
    if (dots > 1 || decimals === 3) cleaned = cleaned.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const cents = Math.round(Number(cleaned) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/** Data no formato brasileiro: 01/09/2026. */
export function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/** Data e hora no formato brasileiro: 01/09/2026 14:32. */
export function formatDateTimeBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/**
 * Converte "AAAA-MM-DD" (input type=date) em Date ao meio-dia UTC.
 *
 * O meio-dia evita o clássico "pagamento do dia 05 aparece como 04":
 * qualquer fuso entre -11 e +12 continua caindo no mesmo dia civil.
 */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "AAAA-MM-DD" para preencher input type=date. */
export function toDateInputValue(date: Date): string {
  return new Date(date.getTime()).toISOString().slice(0, 10);
}
