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

3. **Juros configuráveis; desligados por ora (revisto em 16/09/2026).** A
   primeira versão nasceu com 1% ao mês composto desde 26/08/2022. O dono
   pediu para desligar: a taxa real ainda não está acertada, e é melhor
   mostrar um número que ninguém contesta (valor menos pagamentos) do que um
   número calculado sobre uma premissa incerta. Uma migração zerou a taxa da
   dívida já cadastrada e os três modos (compostos, simples, sem juros)
   seguem disponíveis em Configurações — a tela sempre diz qual está
   valendo, e some qualquer menção a juros enquanto estiverem desligados.
   Quando ligados, só meses inteiros contam — nada de pró-rata diário —
   para o número ser conferível na mão.

4. **Pagamento abate juros antes do principal** (art. 354 do Código Civil), e
   o recibo mostra a divisão.

5. **Dinheiro em centavos inteiros, cálculo só no servidor.** O navegador
   nunca soma valores; a validação do formulário é conveniência, a que vale é
   a do servidor.

6. **Sem confirmação do credor (revisto em 16/09/2026).** A primeira versão
   tinha situação por pagamento (aguardando/confirmado/contestado/cancelado)
   e separava "informado por JP" de "confirmado por Bruno". O dono pediu algo
   mais simples: ele lança, e pronto. Toda essa etapa saiu do app — um
   pagamento registrado já vale. Bruno continua sendo o credor do documento
   (painel, extrato e recibos), mas não é usuário da plataforma. As colunas
   de situação seguem no banco por precaução com dados já gravados: o cálculo
   ainda ignora um pagamento marcado como cancelado em versões anteriores.

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
    entra direto. Nada do login foi removido: `EXIGIR_LOGIN=1` reativa
    e-mail, senha, sessão e recuperação. Consequência aceita: qualquer pessoa
    com o endereço vê, altera e exclui pagamentos. Com a simplificação de
    16/09/2026 (decisão 6), o site passou a ter um operador só — o seletor de
    perfil do topo deixou de existir.

## Consequências

- Alterar a data do contrato ou a taxa em Configurações reescreve todo o
  histórico de juros; a ação fica registrada no histórico de alterações.
- Excluir um pagamento não renumera os demais: o número é identificador do
  recibo e precisa ser estável.
- Comprovantes no banco tornam o backup do PostgreSQL suficiente para
  restaurar tudo, mas exigem atenção ao tamanho do banco a longo prazo.
