/**
 * Modo de acesso do site.
 *
 * Padrão: **aberto** — quem tem o link entra direto, sem senha, e apenas
 * escolhe no topo se está usando como devedor ou como credor. Foi a decisão
 * do dono do site; a consequência está escrita na tela de configurações.
 *
 * Ligar o login de volta é uma variável de ambiente: EXIGIR_LOGIN=1. Aí
 * voltam a valer e-mail, senha, sessão em banco e recuperação de senha —
 * nada disso foi removido do código.
 */
export const requireLogin = process.env.EXIGIR_LOGIN === "1";

/** Cookie que guarda o perfil escolhido no modo aberto (id do DebtUser). */
export const PROFILE_COOKIE = "divida_perfil";
