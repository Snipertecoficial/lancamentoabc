# Página v1 — ajustes rápidos para os anúncios (19/11/2026)

**Por quê:** de 447 visitas de anúncio (17–19/11, 99% celular), 1 virou lead (0,2%). O Google dá
"experiência na página de destino abaixo da média" em todas as palavras-chave, o que encarece o clique.
7 de 9 desistências no pop-up foram no campo "nome" (quem clica quer WhatsApp). Aprovado pelo dono
("Pode começar") a partir do plano `docs/marketing/2026-11-19-plano-campanha-google-ads.md`.

**Escopo (só o que a página realmente mostra: topo, formulário, FAQ, galeria 3D, rodapé):**

1. **Topo fala o que a pessoa buscou:** selo "Lançamento · Divisa Santo André / São Bernardo"; título
   "Apartamentos na planta a 2 minutos do Shopping Metrópole"; subtítulo com 2 ou 3 dorms com suíte,
   varanda gourmet, 60 a 75 m², Av. Pereira Barreto, divisa de Santo André com São Bernardo.
2. **"Quero condições exclusivas" → "Receber condições no WhatsApp"**, abrindo o WhatsApp direto com o
   código do site (mesmo caminho dos botões de corretor). "Agendar visita" e o formulário continuam.
3. **Localização coerente:** FAQ e metadados (título, descrição, dados estruturados, geo) dizem "divisa
   de Santo André com São Bernardo"; o texto "Casas de campo" dos dados estruturados some; canonical e
   og:url passam a ser `https://lancamento.espontone.com.br/`.
4. **Sem texto escondido:** sai o bloco `LLMContext` (texto invisível com lista de buscas — risco de
   política do Google).
5. **Topo leve no celular:** o vídeo (42 MB) é recomprimido para 720 px; não baixa mais ao abrir a
   página: começa quando chega perto da tela (IntersectionObserver), com o pôster até lá.

**Fora do escopo:** reescrever a página inteira (vem depois), mudar "Agendar visita" ou os
formulários, novas promessas de preço (as parcelas desde R$ 3.900 aguardam confirmação da construtora).

**Abordagens consideradas para o vídeo:** (a) só comprimir — ainda baixa vários MB para quem não rola;
(b) só carregar perto da tela — quem rola ainda baixa 42 MB; (c) as duas — escolhida.

**Efeito colateral aceito:** "viu o vídeo" no Funil do Radar cai para quem não rola (antes o vídeo
tocava sozinho), então essa métrica não é comparável com antes de 19/11.

**Publicação:** só com OK do dono.
