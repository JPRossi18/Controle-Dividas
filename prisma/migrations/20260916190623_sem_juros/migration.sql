-- AlterTable
ALTER TABLE "Debt" ALTER COLUMN "interestRateBps" SET DEFAULT 0,
ALTER COLUMN "interestMode" SET DEFAULT 'NONE';

-- Desliga os juros da dívida já cadastrada (16/09/2026): a taxa real ainda
-- será acertada entre as partes, então o saldo passa a ser simplesmente o
-- valor da dívida menos os pagamentos. Roda uma única vez; depois disso a
-- configuração volta a ser editável na tela de Configurações, sem que uma
-- nova publicação desfaça a escolha.
UPDATE "Debt" SET "interestMode" = 'NONE', "interestRateBps" = 0;
