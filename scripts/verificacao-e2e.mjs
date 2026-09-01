/**
 * Verificação ponta a ponta da plataforma, com navegador de verdade.
 *
 * Cobre o caminho completo: login, registro de pagamento com comprovante,
 * validações de valor, edição, recibo, extrato, CSV, confirmação pelo
 * credor, celular, quitação total e exclusão com recálculo.
 *
 * Pré-requisitos: a plataforma rodando (npm run build && npm start), banco
 * migrado e populado com `npm run db:seed` usando as senhas de teste:
 *
 *   DEBT_DEBTOR_PASSWORD=... DEBT_CREDITOR_PASSWORD=... npm run db:seed
 *   BASE=http://localhost:3000 JP_SENHA=... BRUNO_SENHA=... \\
 *     node scripts/verificacao-e2e.mjs
 *
 * O Playwright não é dependência do projeto: instale à parte para rodar
 * (npm i -D playwright && npx playwright install chromium).
 */
import { chromium } from "playwright";
import { join } from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
const BASE = process.env.BASE ?? "http://localhost:3000";
const JP = { nome: "JP", email: process.env.JP_EMAIL ?? "jp@divida.local", senha: process.env.JP_SENHA ?? "" };
const BRUNO = { nome: "Bruno", email: process.env.BRUNO_EMAIL ?? "bruno@divida.local", senha: process.env.BRUNO_SENHA ?? "" };
const SP = mkdtempSync(join(tmpdir(), "divida-e2e-"));
// PNG de 1x1 usado como comprovante de teste.
writeFileSync(
  join(SP, "comprovante.png"),
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);
const ok = [];
const fail = [];
function check(name, cond, extra = "") {
  (cond ? ok : fail).push(name + (extra ? ` — ${extra}` : ""));
  console.log(`${cond ? "OK  " : "FALHA"} ${name}${extra ? " — " + extra : ""}`);
}

/**
 * Entra no site como um dos dois perfis. Funciona nos dois modos: se o site
 * exigir login, usa e-mail e senha; no modo aberto, apenas escolhe o perfil
 * no seletor do topo.
 */
async function entrar(page, pessoa) {
  await page.goto(`${BASE}/`);
  const caminho = new URL(page.url()).pathname;

  if (caminho === "/login") {
    await page.fill("#email", pessoa.email);
    await page.fill("#password", pessoa.senha);
    await Promise.all([
      page.waitForURL((u) => new URL(u).pathname === "/"),
      page.getByRole("button", { name: "Entrar" }).click(),
    ]);
    return;
  }

  const seletor = page.locator("#userId");
  const valor = await seletor
    .locator("option", { hasText: pessoa.nome })
    .first()
    .getAttribute("value");
  const atual = await seletor.inputValue();
  if (valor && valor !== atual) {
    await Promise.all([page.waitForLoadState("networkidle"), seletor.selectOption(valor)]);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 1. login JP
  await entrar(page, JP);
  let body = await page.textContent("body");
  check("painel abre com valor original", body.includes("100.000,00"));
  check("painel mostra juros acumulados", /Juros acumulados/.test(body));
  check("status inicial em pagamento", body.includes("Em pagamento"));
  const saldoAntes = (await page.textContent("body")).match(/Saldo devedor atualizado[\s\S]{0,80}?R\$\s([\d.,]+)/);
  console.log("   saldo atual:", saldoAntes && saldoAntes[1]);
  await page.screenshot({ path: `${SP}/01-painel.png`, fullPage: true });

  // 2. registrar pagamento com comprovante
  await page.goto(`${BASE}/pagamentos/novo`);
  await page.fill("#amount", "10.000,00");
  await page.fill("#paidAt", "2026-08-20");
  await page.selectOption("#method", "PIX");
  await page.fill("#note", "Teste automatizado de registro");
  await page.setInputFiles("#receipt", `${SP}/comprovante.png`);
  await Promise.all([
    page.waitForURL(/pagamentos\/[^/]+\?registrado=1/),
    page.getByRole("button", { name: "Confirmar pagamento" }).click(),
  ]);
  body = await page.textContent("body");
  check("pagamento registrado", body.includes("Pagamento registrado"));
  check("detalhe mostra valor", body.includes("10.000,00"));
  check("detalhe mostra comprovante", body.includes("comprovante.png"));
  check("situacao inicial aguardando", body.includes("Aguardando confirmação"));
  const paymentUrl = page.url().split("?")[0];
  await page.screenshot({ path: `${SP}/02-pagamento.png`, fullPage: true });

  // comprovante servido
  const rec = await page.request.get(paymentUrl.replace("/pagamentos/", "/comprovantes/"));
  check("comprovante acessível com sessão", rec.status() === 200, `HTTP ${rec.status()} ${rec.headers()["content-type"]}`);

  // 3. saldo do painel caiu
  await page.goto(`${BASE}/`);
  body = await page.textContent("body");
  check("total pago atualizado no painel", body.includes("10.000,00"));
  check("informado x confirmado separados", body.includes("Total informado por JP") && body.includes("Total confirmado por Bruno"));

  // 4. validações do formulário (servidor)
  await page.goto(`${BASE}/pagamentos/novo`);
  await page.fill("#amount", "0");
  await page.fill("#paidAt", "2026-08-21");
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await page.waitForSelector("text=não pode ser zero", { timeout: 5000 }).catch(() => {});
  check("valor zero recusado", (await page.textContent("body")).includes("não pode ser zero"));

  await page.fill("#amount", "-50");
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await page.waitForTimeout(800);
  check("valor negativo recusado", (await page.textContent("body")).includes("não pode ser negativo"));

  await page.fill("#amount", "500.000,00");
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await page.waitForSelector("text=maior que o saldo devedor", { timeout: 5000 }).catch(() => {});
  check("valor acima do saldo pede confirmação", (await page.textContent("body")).includes("Confirmo o registro deste valor"));
  await page.screenshot({ path: `${SP}/03-confirmacao-excedente.png`, fullPage: true });

  // 5. editar pagamento
  await page.goto(`${paymentUrl}/editar`);
  await page.fill("#amount", "12.500,00");
  await Promise.all([
    page.waitForURL(/atualizado=1/),
    page.getByRole("button", { name: "Salvar alterações" }).click(),
  ]);
  body = await page.textContent("body");
  check("edição salva", body.includes("12.500,00"));
  check("histórico registra a edição", body.includes("Pagamento editado"));

  // 6. recibo
  await page.goto(`${paymentUrl}/recibo`);
  body = await page.textContent("body");
  check("recibo traz credor e pagador", body.includes("Bruno") && body.includes("JP"));
  check("recibo traz saldo após o pagamento", body.includes("Saldo restante após o pagamento"));
  check("recibo traz a ressalva jurídica", body.includes("não substitui instrumentos jurídicos"));
  await page.screenshot({ path: `${SP}/04-recibo.png`, fullPage: true });

  // 7. extrato + CSV
  await page.goto(`${BASE}/extrato`);
  body = await page.textContent("body");
  check("extrato mostra evolução do saldo", body.includes("Evolução do saldo") && body.includes("Juros do mês"));
  const csv = await page.request.get(`${BASE}/extrato/csv`);
  const csvText = await csv.text();
  check("CSV exportado", csv.status() === 200 && csvText.includes("Extrato da dívida") && csvText.includes("12.500,00"));
  await page.screenshot({ path: `${SP}/05-extrato.png`, fullPage: true });

  // 8. JP não pode confirmar
  await page.goto(paymentUrl);
  check("JP não confirma o próprio pagamento", (await page.textContent("body")).includes("Somente Bruno pode confirmar"));

  // 9. Bruno confirma
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const bruno = await ctx2.newPage();
  await entrar(bruno, BRUNO);
  await bruno.goto(paymentUrl);
  check(
    "Bruno não vê botão de registrar",
    !(await bruno.textContent("body")).includes("Registrar pagamento")
  );
  await Promise.all([bruno.waitForURL(/situacao=1/), bruno.click("text=Confirmar recebimento")]);
  body = await bruno.textContent("body");
  check("pagamento confirmado por Bruno", body.includes("Confirmado") && body.includes("Bruno"));
  check("data e hora da confirmação registradas", /em \d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}/.test(body));
  await bruno.goto(`${BASE}/`);
  check("painel separa total confirmado", (await bruno.textContent("body")).includes("Total confirmado por Bruno"));
  await bruno.screenshot({ path: `${SP}/06-painel-bruno.png`, fullPage: true });

  // 10. quitação total
  await page.goto(`${BASE}/`);
  const saldoTxt = (await page.textContent("body")).match(/Saldo devedor atualizado[\s\S]{0,60}?R\$\s([\d.,]+)/);
  const saldo = saldoTxt[1];
  await page.goto(`${BASE}/pagamentos/novo`);
  await page.fill("#amount", saldo);
  await page.fill("#paidAt", "2026-08-30");
  await Promise.all([
    page.waitForURL(/registrado=1/),
    page.getByRole("button", { name: "Confirmar pagamento" }).click(),
  ]);
  const quitacaoUrl = page.url().split("?")[0];
  await page.goto(`${BASE}/`);
  body = await page.textContent("body");
  check("quitação exibe mensagem de destaque", body.includes("Pagamento integral concluído."), `saldo quitado: ${saldo}`);
  check("status muda para Quitada", body.includes("Quitada"));
  await page.screenshot({ path: `${SP}/07-quitada.png`, fullPage: true });

  // 11. celular
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mob.newPage();
  await entrar(mp, JP);
  await mp.screenshot({ path: `${SP}/08-celular-painel.png`, fullPage: true });
  await mp.goto(`${BASE}/pagamentos`);
  await mp.screenshot({ path: `${SP}/09-celular-pagamentos.png`, fullPage: true });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check("sem rolagem horizontal no celular", overflow);

  // 12. excluir o pagamento de quitação e ver os totais voltarem
  page.on("dialog", (d) => d.accept());
  await page.goto(quitacaoUrl);
  await Promise.all([page.waitForURL(/excluido=1/), page.click("text=Excluir pagamento")]);
  await page.goto(`${BASE}/`);
  body = await page.textContent("body");
  check("exclusão recalcula totais", !body.includes("Pagamento integral concluído.") && body.includes("Em pagamento"));
  await page.goto(`${BASE}/configuracoes`);
  check("exclusão fica no histórico de alterações", (await page.textContent("body")).includes("Pagamento excluído"));

  console.log(`\n${ok.length} verificações OK, ${fail.length} falhas · capturas em ${SP}`);
  if (fail.length) console.log("Falhas:\n" + fail.join("\n"));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
