# WhatsApp direto nos botões "Falar com corretor" — design curto

Aprovado pelo dono em 19/11/2026 ("Sim, faça").

## Por quê
De 17 a 19/11, 9 sessões clicaram nos botões que parecem WhatsApp ("Falar com corretor" flutuante,
topo, menu do celular e o telefone do rodapé) e nenhuma virou lead. Esses botões abrem um formulário
(nome + WhatsApp) em vez da conversa. Nos registros, a pessoa toca em "Seguir para o atendimento" sem
preencher e vai embora. Quem pede para falar com o corretor quer a conversa, e o corretor recebe o
telefone de qualquer jeito quando a pessoa chama.

## O que muda
- **Vão direto para o WhatsApp** (nova aba, mensagem pronta): o botão flutuante, "Fale com corretor"
  no topo (computador e menu do celular), "Falar com corretor" no início da página e o telefone do
  rodapé.
- **Continuam com o formulário**: "Quero condições exclusivas", "Agendar visita", "Agendar visita ao
  decorado", "Quero esta planta", "Ver plantas disponíveis", "Quero morar aqui" e o formulário do fim
  da página. Eles prometem enviar algo ou agendar; aí o formulário faz sentido.
- A mensagem leva um **código do site** de 6 caracteres (início do id da sessão do Radar). Com ele, o
  corretor (ou o painel, numa próxima etapa) acha de qual anúncio e palavra-chave a pessoa veio.
- O Radar registra `whatsapp_click` com `{ source, code }` (nome `direct`). O Funil já conta isso em
  "Foram ao WhatsApp". O sinal `whatsapp_click` do GTM continua (pode virar conversão no Google Ads).

## Abordagens consideradas
1. **WhatsApp direto com código (escolhida)**: menos atrito; perde nome/telefone no Radar, mas o
   corretor recebe o contato na conversa.
2. Formulário só com telefone: ainda é um formulário no caminho de quem quer conversar.
3. Deixar como está: 0 de 9 até agora.

## Fora do escopo
- Tela no painel para buscar uma sessão pelo código (próxima etapa, se o corretor usar o código).
- Texto "lançamento em SBC" nas mensagens (decisão de posicionamento do dono).
