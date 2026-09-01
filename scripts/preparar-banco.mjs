/**
 * Prepara o banco antes de compilar o site.
 *
 * Roda no deploy (faz parte do `npm run build`), onde há acesso ao banco:
 *  1. aplica as migrações que ainda faltam;
 *  2. cria a dívida e os dois perfis, se ainda não existirem.
 *
 * As duas etapas são idempotentes: em publicações seguintes elas não
 * refazem nada nem duplicam dados. Assim, publicar o site é o único passo
 * necessário — não é preciso rodar comando nenhum à mão.
 *
 * Bancos com pooler (Neon, Supabase) podem recusar migrações pela porta do
 * pooler; por isso, se DIRECT_DATABASE_URL existir, ela é usada aqui — o
 * site em si continua usando DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n[banco] DATABASE_URL não está configurada.\n" +
      "        Configure a string de conexão do PostgreSQL na hospedagem\n" +
      "        (na Vercel: Settings → Environment Variables) e publique de novo.\n"
  );
  process.exit(1);
}

const bin = (nome) => {
  const caminho = join(process.cwd(), "node_modules", ".bin", nome);
  return existsSync(caminho) ? caminho : nome;
};

function executar(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  if (resultado.status !== 0) {
    console.error(`\n[banco] Falhou: ${comando} ${argumentos.join(" ")}\n`);
    process.exit(resultado.status ?? 1);
  }
}

console.info("[banco] Aplicando migrações…");
executar(bin("prisma"), ["migrate", "deploy"]);

console.info("[banco] Conferindo a dívida e os perfis…");
executar(bin("tsx"), ["prisma/seed.ts"]);
