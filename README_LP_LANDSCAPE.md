# Landing Page — Landscape (Paddan) × Espontone (v2)

LP premium de alta conversão para o lançamento **Landscape** em Santo André (incorporadora Paddan), atendida pela imobiliária **Espontone**.

## 🎨 Paleta oficial (extraída do logo Espontone)

| Nome | Hex | Uso |
|---|---|---|
| Navy deep | `#061224` | Background muito escuro (rodapé, seções profundas) |
| Navy dark | `#0A1930` | Background principal |
| Navy | `#12294A` | Cards, superfícies elevadas |
| Blue brand | `#3A70A3` | **Cor primária do logo Espontone** |
| Blue light | `#5B95CE` | Hover, gradientes |
| Blue glow | `#7DB4E8` | Acentos, títulos, brilhos |
| Grey | `#8E8E8E` | Secundário |
| White | `#FFFFFF` | Texto |
| Off-white | `#F0F5FA` | Texto suave |

## 🧱 Stack

- **React 19** + **React Router 7** (SPA — 1 rota `/`)
- **Tailwind CSS 3** + shadcn/ui
- **Playfair Display** (títulos) + **Inter** (corpo)
- Lucide React (ícones)

## ✅ Estrutura de Seções (v2)

1. **Hero** — Título + iPhone mock 3D com vídeo do tour (autoplay muted loop)
2. Conceito
3. Galeria de Lazer (5 categorias · 31 espaços)
4. Plantas (5 tipologias)
5. Andamento da Obra (barras + carrossel + link vídeo)
6. Localização (Google Maps + POIs)
7. Por que comprar na planta
8. Quem somos (Espontone)
9. Depoimentos
10. FAQ (com Schema.org)
11. **Formulário Final** (penúltima — WhatsApp)
12. **Galeria Imersiva 3D** (última — scroll/swipe, cover-flow)

## 🎬 Vídeo do iPhone Mock

Arquivo local: `/frontend/public/tour-landscape.mp4` (H.264 854×480, 13MB, ~57s)  
Poster: `/frontend/public/tour-poster.jpg`

**Para substituir**, coloque o novo vídeo em `/frontend/public/tour-landscape.mp4` (mesmo nome). O componente `<HeroSection>` já aponta pra ele.

## 🔌 Como trocar assets quando o cliente enviar

### 1) Logo Espontone
Já implementado usando a URL do artifact enviado.  
Se quiser trocar por uma versão local, coloque `logo.png` em `/frontend/public/` e edite `/frontend/src/components/EspontoneLogo.jsx` → constante `LOGO_URL`.

### 2) Imagens do scroll 3D
URLs em `/frontend/src/data/content.js` → `HERO_IMAGES` e `LEISURE_CATEGORIES`.

### 3) Vídeo do iPhone
Substitua `/frontend/public/tour-landscape.mp4` pelo novo.

### 4) Número de WhatsApp
Adicione no `/frontend/.env`:
```
REACT_APP_WHATSAPP_PHONE=5511999999999
```

### 5) CRECI da imobiliária
Edite `/frontend/src/components/Footer.jsx`.

## 🎯 Galeria Imersiva 3D (última seção)

Comportamento:
- **Desktop**: role o mouse (scroll) → avança slides; ou use setas ←/→; ou botões laterais.
- **Mobile**: **swipe** para o lado.
- **Efeito cover-flow**: cards laterais desfocados e rotacionados em 3D.

Imagens carregadas a partir de `content.js` (fachada + cityscape + 2 imagens de cada categoria de lazer + 1 foto de obra = ~13 slides).

Para ajustar, edite a função `buildSlides()` em `/frontend/src/components/Slider3D.jsx`.

## 🚀 Rodar localmente

```bash
# Frontend
cd frontend
yarn install
yarn start   # http://localhost:3000
```

## 📤 Deploy

```bash
cd frontend && yarn build
# Upload da pasta build/ para Vercel, Netlify, Cloudflare Pages
```
