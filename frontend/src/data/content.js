// Central data source for all LP sections. Swap URLs / texts easily.

export const BRAND = {
  agency: "ESPONTONE",
  developer: "CONSTRUTORA",
  project: "LANÇAMENTO",
  tagline: "Especialistas no ABC",
  creci: "CRECI-J XX.XXX (a ajustar)",
};

export const HERO_IMAGES = {
  facade: "https://landscapepaddan.com.br/imgs/Home/fachada_2025.webp",
  slide1: "https://landscapepaddan.com.br/imgs/Home/slide_superior/slide_1_landscape.webp",
  slide2: "https://landscapepaddan.com.br/imgs/Home/slide_superior/slide_2_landscape.webp",
  cityscape: "https://landscapepaddan.com.br/imgs/Home/landscape_cidade.webp",
};

// Full leisure gallery — 5 categories, 30 spaces
export const LEISURE_CATEGORIES = [
  {
    id: "water",
    icon: "💧",
    title: "Piscinas & Relax",
    accent: "from-sky-400/20 to-cyan-500/10",
    items: [
      { name: "Piscina Adulto e Infantil", url: "https://landscapepaddan.com.br/imgs/espacos/PISCINA_01.jpg" },
      { name: "Piscina Coberta", url: "https://landscapepaddan.com.br/imgs/espacos/PISCINA_COBERTA.jpg" },
      { name: "Bar da Piscina", url: "https://landscapepaddan.com.br/imgs/espacos/BAR_PISCINA.jpg" },
      { name: "Hidromassagem", url: "https://landscapepaddan.com.br/imgs/espacos/HIDROMASSAGEM.jpg" },
      { name: "Sauna", url: "https://landscapepaddan.com.br/imgs/espacos/SAUNA.jpg" },
      { name: "Spa / Massagem", url: "https://landscapepaddan.com.br/imgs/espacos/MASSAGEM.jpg" },
    ],
  },
  {
    id: "fitness",
    icon: "🏋️",
    title: "Fitness & Esporte",
    accent: "from-emerald-400/20 to-lime-500/10",
    items: [
      { name: "Academia", url: "https://landscapepaddan.com.br/imgs/espacos/ACADEMIA.jpg" },
      { name: "Crossfit", url: "https://landscapepaddan.com.br/imgs/espacos/CROSS_FIT.jpg" },
      { name: "Pilates", url: "https://landscapepaddan.com.br/imgs/espacos/PILATES.jpg" },
      { name: "Quadra Poliesportiva", url: "https://landscapepaddan.com.br/imgs/espacos/QUADRA.jpg" },
      { name: "Beach Tennis", url: "https://landscapepaddan.com.br/imgs/espacos/BEACH_TENNIS.jpg" },
    ],
  },
  {
    id: "gastro",
    icon: "🍽️",
    title: "Gastronomia & Convivência",
    accent: "from-amber-400/20 to-orange-500/10",
    items: [
      { name: "Salão de Festas", url: "https://landscapepaddan.com.br/imgs/espacos/SALAO%20DE%20FESTAS%201.jpg" },
      { name: "Gourmet", url: "https://landscapepaddan.com.br/imgs/espacos/GOUMERT.jpg" },
      { name: "Churrasqueiras", url: "https://landscapepaddan.com.br/imgs/espacos/CHURRASQUEIRA.jpg" },
      { name: "PUB", url: "https://landscapepaddan.com.br/imgs/espacos/PUB.jpg" },
      { name: "Casa Verão", url: "https://landscapepaddan.com.br/imgs/espacos/CASA_VERAO_01.jpg" },
      { name: "Casa Inverno", url: "https://landscapepaddan.com.br/imgs/espacos/CASA_INVERNO.jpg" },
      { name: "Praça do Fogo", url: "https://landscapepaddan.com.br/imgs/espacos/PRACA_FOGO.jpg" },
    ],
  },
  {
    id: "family",
    icon: "👨‍👩‍👧",
    title: "Família & Kids",
    accent: "from-pink-400/20 to-rose-500/10",
    items: [
      { name: "Playground", url: "https://landscapepaddan.com.br/imgs/espacos/PLAYGROUND.jpg" },
      { name: "Pet Place", url: "https://landscapepaddan.com.br/imgs/espacos/ESPACO_PET.jpg" },
      { name: "Brinquedoteca", url: "https://landscapepaddan.com.br/imgs/espacos/BRINQUEDOTECA.jpg" },
      { name: "Praça Adolescente", url: "https://landscapepaddan.com.br/imgs/espacos/PRACA_ADOLESCENTE.jpg" },
      { name: "Praça Zen", url: "https://landscapepaddan.com.br/imgs/espacos/PRACA_ZEN.jpg" },
      { name: "Redário", url: "https://landscapepaddan.com.br/imgs/espacos/REDARIO.jpg" },
    ],
  },
  {
    id: "indoor",
    icon: "💼",
    title: "Lazer Indoor & Trabalho",
    accent: "from-indigo-400/20 to-violet-500/10",
    items: [
      { name: "Coworking", url: "https://landscapepaddan.com.br/imgs/espacos/COWORKING.jpg" },
      { name: "Cinema", url: "https://landscapepaddan.com.br/imgs/espacos/CINEMA.jpg" },
      { name: "Sala Gamer", url: "https://landscapepaddan.com.br/imgs/espacos/SALA_GAMER.jpg" },
      { name: "Salão de Jogos", url: "https://landscapepaddan.com.br/imgs/espacos/JOGOS_E_CINEMA_02.jpg" },
      { name: "Espaço Mulher", url: "https://landscapepaddan.com.br/imgs/espacos/SALAO_BELEZA_MULHER.jpg" },
      { name: "Espaço Homem", url: "https://landscapepaddan.com.br/imgs/espacos/ESPACO_HOMEM.jpg" },
      { name: "Espaço Melhor Idade", url: "https://landscapepaddan.com.br/imgs/espacos/ESPACO_MELHOR_IDADE.jpg" },
      { name: "Lavanderia", url: "https://landscapepaddan.com.br/imgs/espacos/LAVANDERIA.jpg" },
    ],
  },
];

export const FLOOR_PLANS = [
  {
    id: "7482-1",
    area: "74,82m²",
    label: "Opção 1",
    dorms: "2 dorms (1 suíte) + Lavabo",
    highlight: "Cozinha integrada à área gourmet",
    tag: "MAIS PROCURADA",
  },
  {
    id: "7482-2",
    area: "74,82m²",
    label: "Opção 2",
    dorms: "3 dorms (1 suíte) + Lavabo",
    highlight: "Cozinha integrada à área gourmet",
    tag: null,
  },
  {
    id: "68-1",
    area: "68m²",
    label: "Opção 1",
    dorms: "3 dorms (1 suíte)*",
    highlight: "Cozinha integrada à varanda (opção 2 dorms c/ sala ampliada)",
    tag: null,
  },
  {
    id: "68-2",
    area: "68m²",
    label: "Opção 2",
    dorms: "3 dorms (1 suíte)*",
    highlight: "Varanda (opção 2 dorms c/ sala ampliada)",
    tag: null,
  },
  {
    id: "60",
    area: "60m²",
    label: "Compacto Premium",
    dorms: "2 dorms (1 suíte)",
    highlight: "Varanda gourmet · Ideal para investir",
    tag: "INVESTIDOR",
  },
];

export const CONSTRUCTION_PHOTOS = Array.from({ length: 10 }).map((_, i) => ({
  id: i + 1,
  url: `https://landscapepaddan.com.br/obras/jul_2026/lg/${i + 1}.jpg`,
}));

export const CONSTRUCTION_PROGRESS = [
  { label: "Projetos Iniciais", percent: 100 },
  { label: "Canteiro de obras", percent: 90 },
  { label: "Terraplenagem", percent: 75 },
  { label: "Fundação", percent: 25 },
  { label: "Estrutura", percent: 0 },
  { label: "Vedações", percent: 0 },
  { label: "Acabamentos", percent: 0 },
];

export const LOCATION = {
  address: "Centro — São Bernardo do Campo / SP",
  mapEmbed:
    "https://maps.google.com/maps?q=-23.6932,-46.5540&z=15&output=embed",
  poi: [
    { title: "Vias", items: ["Rodovia Anchieta", "Av. Pereira Barreto", "Av. Kennedy", "Rua Marechal Deodoro"] },
    { title: "Compras", items: ["Shopping Metrópole", "Golden Square Shopping", "Sonda Supermercados"] },
    { title: "Transporte", items: ["Futuro BRT-ABC", "Terminal Metropolitano", "Trólebus"] },
    { title: "Lazer & Serviços", items: ["Parque da Juventude", "Poupatempo", "Paço Municipal"] },
  ],
};

export const TESTIMONIALS = [
  {
    name: "Marina S.",
    text: "Atendimento consultivo do início ao fim. A equipe da Espontone me ajudou a comparar opções e escolher o melhor apto para minha família em Santo André.",
    rating: 5,
  },
  {
    name: "Rafael T.",
    text: "Como investidor, procurava valorização no ABC. A Espontone me apresentou o Landscape com números claros e transparência total. Fechei negócio.",
    rating: 5,
  },
  {
    name: "Camila e Bruno",
    text: "Compramos na planta com tranquilidade. Explicaram cada etapa da obra, financiamento e acabamentos. Recomendo demais.",
    rating: 5,
  },
];

export const FAQ_ITEMS = [
  {
    q: "Quando será a entrega do Landscape?",
    a: "A obra está em andamento (fase de fundação em Julho/2026). A previsão de entrega é divulgada em detalhe na tabela de vendas — fale com um corretor Espontone para receber a data oficial atualizada.",
  },
  {
    q: "Quais são as metragens disponíveis?",
    a: "São 5 tipologias entre 60m² e 74,82m², todas com varanda: 2 ou 3 dormitórios (com 1 suíte), 1 ou 2 vagas na garagem.",
  },
  {
    q: "Posso personalizar acabamentos comprando na planta?",
    a: "Sim. Uma das grandes vantagens de comprar na planta é escolher acabamentos dentro do padrão do empreendimento, valorizando ainda mais o apartamento antes da entrega.",
  },
  {
    q: "O empreendimento fica em uma boa região para investir?",
    a: "Sim. A Av. Pereira Barreto é uma das localizações mais valorizadas de Santo André. A cidade lidera valorização no ABC em 2026, impulsionada pela extensão da Linha 20-Rosa do Metrô e a chegada do BRT-ABC.",
  },
  {
    q: "Como funciona o parcelamento durante a obra?",
    a: "O parcelamento é feito durante a construção com condições diferenciadas de lançamento. Um corretor Espontone monta uma simulação sob medida para o seu perfil no WhatsApp.",
  },
  {
    q: "Vocês têm outros lançamentos no ABC?",
    a: "Sim. A Espontone é especialista no ABC Paulista e possui um portfólio exclusivo de lançamentos. Fale com nosso time e conhecemos opções que combinam com o seu momento.",
  },
];
