/**
 * Modo de acesso do site.
 *
 * Padrão: **aberto** — quem tem o link entra direto, sem senha. Foi a
 * decisão do dono do site; a consequência está escrita na tela de
 * configurações.
 *
 * Ligar o login de volta é uma variável de ambiente: EXIGIR_LOGIN=1. Aí
 * voltam a valer e-mail, senha, sessão em banco e recuperação de senha —
 * nada disso foi removido do código.
 */
export const requireLogin = process.env.EXIGIR_LOGIN === "1";
