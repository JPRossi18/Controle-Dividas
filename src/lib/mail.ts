/**
 * Envio de e-mail transacional (recuperação de senha).
 *
 * Provedor por HTTP (Resend), sem dependência npm — só `fetch`. Sem
 * RESEND_API_KEY, nada é enviado: o e-mail vai para o log do servidor e a
 * tela mostra o link, para o fluxo funcionar em desenvolvimento.
 */
export type Mail = { to: string; subject: string; html: string; text?: string };
export type MailResult = { ok: boolean; dev: boolean };

export async function sendMail(mail: Mail): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Controle de dívida <nao-responda@localhost>";

  if (!apiKey) {
    console.info(
      `[divida][mail:dev] (sem provedor) Para: ${mail.to} · Assunto: ${mail.subject}\n${
        mail.text ?? mail.html
      }`
    );
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      console.error("[divida][mail] Falha no envio:", res.status, await res.text());
      return { ok: false, dev: false };
    }
    return { ok: true, dev: false };
  } catch (err) {
    console.error("[divida][mail] Erro no envio:", err);
    return { ok: false, dev: false };
  }
}

/**
 * Base pública da aplicação, para links absolutos nos e-mails. Aceita APP_URL
 * com ou sem protocolo; na Vercel, cai para o domínio do deploy.
 */
export function appUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  const candidate = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    return new URL(candidate).origin;
  } catch {
    return "http://localhost:3000";
  }
}
