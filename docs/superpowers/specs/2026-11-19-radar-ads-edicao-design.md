# Radar — editar campanhas do Google Ads pelo painel (fila de comandos)

Aprovado pelo dono em 2026-11-19 ("se der tempo real blz, se não 1 em 1 hora por enquanto").

## Por quê
O dono quer ver e editar campanhas no painel, e quer que o Claude consiga analisar e melhorar os anúncios
com dados do Google Ads (termos de pesquisa, rede onde o anúncio rodou) sem abrir o Google Ads.

## Abordagens
- **Fila de comandos via script do Google Ads (escolhida).** Sem credencial nova; o script já roda na conta
  do dono. Limite do Google: o script roda no máximo de hora em hora e cada execução pode durar até 30 min.
- **API do Google Ads direto do servidor.** Tempo real, mas exige token de desenvolvedor aprovado pelo
  Google (dias), conta MCC e OAuth. Fica para depois, se a fila não bastar.

## Como funciona
1. Painel grava um pedido em `ads_commands` (status `pending`). Só admin (RLS).
2. Script, a cada execução: (a) busca pedidos (`pull`), aplica com `AdsApp.mutate`, devolve o resultado
   (`results`); (b) envia custos/cliques como hoje + **estado** atual (campanhas com situação e orçamento;
   palavras-chave com situação) + **insights** dos últimos 30 dias (termos de pesquisa; custo por rede);
   (c) fica **vigiando a fila** a cada 60 s até ~25 min de execução. Resultado: pedido aplicado em ~1 min
   durante metade de cada hora e em até ~35 min no pior caso.
3. Em modo "Visualizar" (preview) o script não puxa pedidos (nada seria aplicado).
4. Pedido não aplicado em 24 h expira. Pedido `sent` sem resposta há 10 min volta para a fila
   (todas as edições são idempotentes ou falham sem efeito).

## Edições suportadas
- Pausar / ativar campanha (`campaignOperation.update status`).
- Orçamento diário da campanha (`campaignBudgetOperation.update amountMicros`), R$ 1 a R$ 10.000/dia;
  aviso quando o orçamento é compartilhado.
- Pausar / ativar palavra-chave (`adGroupCriterionOperation.update status`).
- Palavra-chave negativa na campanha (`campaignCriterionOperation.create negative`), exata/frase/ampla.

## Painel (tela Anúncios)
Novo cartão "Gerenciar campanhas": situação, tipo e orçamento de cada campanha, botões Pausar/Ativar e
Orçamento, palavras-chave da campanha com Pausar/Ativar, campo de negativa, e lista "Alterações" (aguardando /
aplicada / falhou com o motivo / expirou / cancelada; cancelar enquanto aguarda). Confirmação antes de enviar.

## Fora do escopo agora
Criar campanhas/anúncios, lances, exclusão de posicionamentos (YouTube), API em tempo real.
