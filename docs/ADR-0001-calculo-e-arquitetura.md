# ADR 0001 — Cálculo da dívida e arquitetura da plataforma

**Data:** 01/09/2026 · **Situação:** aceita

## Contexto

Acompanhar o pagamento de uma dívida de R$ 100.000,00 entre JP (devedor) e
Bruno (credor), com contrato assinado em 26/08/2022 e juros de 1% ao mês,
atualizando o valor mês a mês. As informações não podem ser públicas e as
duas partes precisam de acesso próprio, com papéis diferentes.

## Decisões

1. **Site próprio, banco próprio.** Aplicação independente (Next.js 14 App
   Router, PostgreSQL, Prisma), sem compartilhar código, dados ou domínio com
   qualquer outro sistema.

2. **Saldo recalculado a cada leitura, não gravado.** Não há job mensal nem
   coluna de saldo. `computeLedger` percorre os aniversários do contrato e os
   pagamentos e devolve a posição de hoje. Consequência: o valor "anda
   sozinho" ao virar o dia 26, e qualquer correção retroativa (data ou valor
   de um pagamento) refaz a história inteira, sem migração de dados.

3. **Juros compostos como padrão, configurável.** "1% ao mês atualizando mês
   a mês" foi implementado como capitalização mensal. Como a escolha entre
   compostos e simples tem efeito jurídico e financeiro relevante, os três
   modos (compostos, simples, sem juros) ficam disponíveis em Configurações e
   a tela sempre diz qual está valendo. Só meses inteiros contam — nada de
   pró-rata diário — para o número ser conferível na mão.

4. **Pagamento abate juros antes do principal** (art. 354 do Código Civil), e
   o recibo mostra a divisão.

5. **Dinheiro em centavos inteiros, cálculo só no servidor.** O navegador
   nunca soma valores; a validação do formulário é conveniência, a que vale é
   a do servidor.

6. **Confirmação do credor separada do saldo.** O saldo principal considera o
   que JP informou (menos cancelados); o confirmado por Bruno aparece em
   paralelo, inclusive como segunda faixa da barra de progresso. Assim
   nenhuma das partes precisa aceitar a leitura da outra para acompanhar.

7. **Comprovantes no banco (`Bytes`), não em bucket.** O volume esperado é
   pequeno e a plataforma passa a funcionar em qualquer hospedagem sem
   configurar S3. O acesso exige sessão.

8. **Permissões em colunas, não em papéis fixos** — editáveis na tela, porque
   o combinado previa ajuste posterior das regras.

9. **Recibo e extrato em PDF pela impressão do navegador.** Evita dependência
   de biblioteca de PDF; o CSV é gerado no servidor com separador `;` e BOM,
   que o Excel em português abre direto.

10. **Sessão em banco, não JWT.** Permite revogar acesso na hora (troca de
    senha derruba as sessões abertas).

11. **Site aberto por padrão, login opcional (01/09/2026).** O dono do site
    decidiu, depois de avisado do risco, que não quer senha: quem tem o link
    entra direto. Para não perder o que o próprio combinado exigia — saber
    quem registrou e quem confirmou cada pagamento, e o histórico de
    alterações —, o modo aberto mantém os dois perfis e os expõe num seletor
    no topo ("Usando como"), sem senha. As permissões continuam valendo por
    perfil: o devedor registra, o credor confirma. Nada do login foi
    removido: `EXIGIR_LOGIN=1` reativa e-mail, senha, sessão e recuperação.
    Consequência aceita: qualquer pessoa com o endereço vê, altera e exclui
    pagamentos, e pode se passar por qualquer um dos dois perfis.

## Consequências

- Alterar a data do contrato ou a taxa em Configurações reescreve todo o
  histórico de juros; a ação fica registrada no histórico de alterações.
- Excluir um pagamento não renumera os demais: o número é identificador do
  recibo e precisa ser estável.
- Comprovantes no banco tornam o backup do PostgreSQL suficiente para
  restaurar tudo, mas exigem atenção ao tamanho do banco a longo prazo.
