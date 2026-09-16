# Controle de dívida

Plataforma web para acompanhar o pagamento de uma dívida de **JP** com
**Bruno**. JP lança os pagamentos; o site mostra o saldo restante, o
progresso da quitação e o histórico de todas as alterações.

Site próprio, independente de qualquer outro sistema: banco de dados e
domínio exclusivos.

> **Atenção — o site é aberto por decisão do dono.** Não há senha: quem tiver
> o link vê e altera os valores. Para exigir e-mail e senha, defina
> `EXIGIR_LOGIN=1` na hospedagem (ver [Acesso](#acesso)).

## O que faz

- **Painel** — valor original, juros acumulados, total pago, saldo devedor
  atualizado, percentual quitado, data do último pagamento, quantidade de
  pagamentos, barra de progresso e situação (Em pagamento / Quitada). Ao
  zerar o saldo, aparece em destaque **"Pagamento integral concluído."**
- **Registrar pagamento** — valor, data, forma (PIX, transferência bancária,
  dinheiro, outro), observação e comprovante opcional (JPG, PNG, WEBP ou PDF
  até 5 MB). Valor zero ou negativo é recusado; valor acima do saldo só entra
  com confirmação explícita.
- **Histórico** — do mais recente para o mais antigo, com número, data,
  valor, forma, observação, comprovante, data e hora do registro e ações de
  ver, editar e excluir (as duas últimas pedem confirmação e recalculam tudo).
- **Recibo e extrato** — recibo por pagamento e extrato completo, ambos
  imprimíveis em PDF pelo navegador; extrato também exportável em CSV.
- **Configurações** — dados do contrato, permissões por usuário, troca de
  senha e histórico de alterações.

## Juros

**Hoje a dívida está sem juros** (16/09/2026): a taxa real ainda será
acertada entre as partes, então o saldo é simplesmente o valor da dívida
menos os pagamentos. Nada de juros aparece nas telas enquanto estiver assim.

O cálculo com juros continua pronto. Para ligar, basta ir em
**Configurações → Dados da dívida**, escolher a forma de cálculo (compostos
ou simples) e informar a taxa ao mês. A partir daí o saldo passa a ser
recalculado do zero a cada leitura, percorrendo a linha do tempo desde a
assinatura do contrato (26/08/2022) até hoje (`src/core/ledger.ts`) — é isso
que faz o valor **andar sozinho mês a mês**, sem tarefa agendada: ao virar o
dia 26, o mês novo já entra na conta na próxima vez que a página abre.

Regras que valem quando os juros estão ligados:

| Regra | Comportamento |
| --- | --- |
| Período de incidência | Apenas meses **inteiros** completados (sem pró-rata diário) |
| Formas disponíveis | **Compostos** (sobre principal + juros acumulados) ou **simples** (só sobre o principal em aberto) |
| Imputação do pagamento | Abate **primeiro os juros**, depois o principal (art. 354 do Código Civil) |
| Empate de datas | Os juros do mês entram antes do pagamento feito no mesmo dia |
| Arredondamento | Centavos inteiros, meio para cima; o resíduo permanece no saldo |

Todo valor é gravado em **centavos** (`Int`) e todo cálculo roda no servidor.

## Permissões

Quem opera o site é **JP**, o devedor: registra, edita e exclui pagamentos e
altera os dados da dívida. **Bruno é o credor no documento, não usuário da
plataforma** — não precisa entrar, confirmar nem validar nada; o nome dele
aparece no painel, no extrato e nos recibos.

As permissões ficam em colunas do usuário, não em papéis fixos, e podem ser
ajustadas na tela de Configurações caso um dia isso mude. Sempre precisa
sobrar ao menos uma conta com permissão de administrar.

## Acesso

O site tem dois modos, escolhidos por variável de ambiente:

**Aberto (padrão).** Sem senha: quem abre o link entra direto e já pode
lançar pagamentos. Consequência a ter em mente: **qualquer pessoa com o
endereço vê e altera tudo**, inclusive excluir pagamentos. O site pede aos
buscadores que não o indexem, mas isso não protege nada — só reduz a chance
de alguém tropeçar nele.

**Com login (`EXIGIR_LOGIN=1`).** Volta a exigir e-mail e senha, com sessão
em banco (cookie httpOnly de 7 dias, revogável), senhas em bcrypt (custo
12), recuperação por e-mail com token de uso único de 30 minutos que derruba
as sessões abertas, e mensagem de erro idêntica exista ou não a conta. Nada
disso foi removido do código: a conta de JP já existe com senha desde a
configuração inicial, basta ligar a variável e publicar de novo.

Em ambos os modos, os comprovantes são servidos pela rota
`/comprovantes/[id]` a partir do banco, nunca por link público de arquivo.

## Rodando localmente

```bash
cp .env.example .env          # ajuste DATABASE_URL se precisar
docker compose up -d          # PostgreSQL local
npm install
npm run db:migrate            # cria as tabelas
npm run db:seed               # cria a dívida e as duas contas
npm run dev                   # http://localhost:3000
```

O seed cria **apenas** a dívida (R$ 100.000,00, contrato 26/08/2022, sem
juros) e a conta de JP. Nenhum pagamento fictício é criado — o
histórico começa vazio. Se `DEBT_DEBTOR_PASSWORD` / `DEBT_CREDITOR_PASSWORD`
não estiverem definidas, ele gera senhas fortes e as imprime **uma única
vez**. Rodar de novo é seguro: não sobrescreve senha existente nem duplica a
dívida.

## Publicando

Feito para Vercel (ou qualquer host com Node 20+):

1. Crie um PostgreSQL gerenciado (Neon, Supabase, Railway…) e copie a string
   de conexão.
2. Na Vercel, importe o repositório e configure `DATABASE_URL` com essa
   string. Opcionais: `APP_URL`, `EXIGIR_LOGIN` (vazio = site aberto, `1` =
   exige senha) e, para recuperação de senha por e-mail, `RESEND_API_KEY` e
   `MAIL_FROM`.
3. Clique em **Deploy**. Não há passo 4: o próprio build aplica as migrações
   e cria a dívida e os perfis (`scripts/preparar-banco.mjs`). As duas
   etapas são idempotentes — publicações seguintes não duplicam nada.

Se o provedor usar *pooler* e recusar migrações por ele (caso do Neon e do
Supabase), configure também `DIRECT_DATABASE_URL` com a conexão direta (a
mesma string, sem o `-pooler` no endereço): ela é usada só na preparação do
banco. Para compilar sem tocar no banco, use `npm run build:sem-banco`.

## Testes

```bash
npm run typecheck
npm test                      # 21 casos do motor financeiro
```

Verificação ponta a ponta com navegador (registro, saldo, edição, exclusão,
confirmação, comprovante, recibo, extrato, CSV, celular e quitação):

```bash
npm i -D playwright && npx playwright install chromium
# no modo aberto, as senhas nem são necessárias:
BASE=http://localhost:3000 node scripts/verificacao-e2e.mjs
```

## Estrutura

```
src/core/        cálculo dos juros, sessão, permissões e ações de servidor
src/app/         telas (login, painel, pagamentos, extrato, configurações)
src/components/  componentes visuais
prisma/          schema, migrações e configuração inicial
docs/            decisões de arquitetura
```

Decisões de projeto: `docs/ADR-0001-calculo-e-arquitetura.md`.
