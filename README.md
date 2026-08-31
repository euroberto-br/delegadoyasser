# Site — Delegado Yasser Yassine · Goiás Seguro para Todos

Site estático do candidato a deputado estadual **Delegado Yasser Yassine
(PT-GO), nº 13007**. HTML, CSS e JavaScript separados, sem etapa de build —
basta abrir os arquivos ou publicar a pasta.

Domínio oficial: **https://delegadoyasser.com.br** (apex, sem `www`).

## Estrutura

```
delegadoyasser/
├── index.html                     Página inicial — o site completo
├── propostas.html                 Lista completa das propostas, por eixo
├── goias-seguro-para-todos.html   Mapa participativo de insegurança
├── mapa-do-medo.html              Só redireciona para o arquivo acima (ver "Renomeações")
├── solicitar-reuniao.html         Convite para o Yasser visitar a comunidade
├── voluntario.html                Termo de adesão de voluntário(a)
├── cabo-eleitoral.html            Termo de compromisso de cabo eleitoral
├── acessibilidade.html            Declaração de acessibilidade
├── css/
│   ├── landing.css                Estilos de TODAS as páginas (tokens, base, componentes)
│   ├── goias-seguro-para-todos.css  Só o mapa participativo
│   ├── agenda.css                 Só solicitar-reuniao.html
│   └── termos.css                 Só voluntario.html e cabo-eleitoral.html
├── js/
│   ├── landing.js                 Carregado por todas: menu, carrossel, notícias,
│   │                              agenda, balão de acessibilidade e cadastro
│   ├── goias-seguro-para-todos.js Mapa: relato, moderação e pontos aprovados
│   ├── goias-geo.js               Contorno de Goiás (malha do IBGE) usado pelo mapa
│   ├── agenda.js                  Formulário de solicitar-reuniao.html
│   ├── termos.js                  Formulários dos dois termos (gera o PDF)
│   └── foto-com-yasser.js         Seção "Foto com o Yasser" (montagem no navegador)
├── fonts/                         Fontes .woff2 servidas pelo próprio domínio
├── images/                        Fotos, carrossel (114 fotos em jpg+webp), favicons e selos
├── .github/workflows/             Publicação no GitHub Pages (ver "Publicação")
├── liberar-campanha.js            Ferramenta de manutenção (ver "Liberação da campanha")
├── robots.txt                     Regras para buscadores + link do sitemap
├── sitemap.xml                    Mapa do site para os buscadores
├── site.webmanifest               Manifesto PWA (nome, cores, ícones)
├── favicon.ico / .svg             Ícones do site
└── CNAME                          Domínio próprio (delegadoyasser.com.br)
```

> **Legado:** `css/styles.css` e `js/main.js` são da antiga página "Em construção"
> e não são carregados por nenhuma página atual — confira com
> `grep -rl "styles.css\|main.js" *.html` antes de apagar. É de `js/main.js` que
> vem o seletor de cor de tema que o site **não** usa mais.

> **Removido em ago/2026:** `js/vendor/tfjs/` (TensorFlow.js) e `models/`
> (Selfie Segmentation e BlazeFace, do MediaPipe) serviam ao recorte automático
> da seção "Foto com o Yasser". A arte nova põe a foto numa moldura branca, sem
> recorte, e as pastas foram apagadas. Estão no histórico do git, se fizerem falta.

## Páginas

- **`index.html`** — a página inicial servida na raiz do domínio. Reúne quem é o
  Yasser, o resumo das propostas, as missões do movimento, o mapa, notícias,
  carrossel de fotos, "Foto com o Yasser" e o formulário de cadastro.
- **`propostas.html`** — a lista completa, dividida em **sete eixos**: segurança
  pública, trabalho e direitos, educação, moradia, transporte, saúde e direitos
  humanos e cultura. Cada eixo tem uma âncora própria (`#seguranca`, `#trabalho`,
  `#educacao`, `#moradia`, `#transporte`, `#saude`, `#direitos`).
- **`goias-seguro-para-todos.html`** — mapa participativo (Leaflet +
  OpenStreetMap): a população marca pontos de risco, que passam por moderação
  antes de aparecer.
- **`solicitar-reuniao.html`** — formulário para convidar o Yasser.
- **`voluntario.html`** e **`cabo-eleitoral.html`** — termos preenchidos e
  assinados no navegador (assinatura desenhada na tela); o Apps Script gera o PDF
  no Google Drive da campanha.
- **`acessibilidade.html`** — declaração de acessibilidade, aberta pelo balão de
  acessibilidade e pelo rodapé.

### O resumo de propostas na home espelha `propostas.html`

A seção **"Compromissos de mandato"** (`#propostas` no `index.html`) é o resumo
da página completa e precisa continuar batendo com ela. As regras de sincronia
estão num comentário HTML no próprio bloco: mesma ordem de eixos, **título exato**
de cada proposta, e segurança pública abrindo como destaque nas duas páginas
(o selo "Destaque" em `propostas.html` fica na proposta do SUIP). Se a lista
completa mudar, ajuste o resumo junto.

### Seções ocultas

Duas seções do `index.html` estão **ocultas** com o atributo `hidden` (marcadas
por comentário), prontas para reativação:

- **Agenda** (`<section id="agenda">`) — também com os links de menu e rodapé
  comentados.
- **Kit do voluntário / Materiais** (`<section id="materiais">`).

Para reexibir, remova o `hidden` da `<section>` (e descomente os links de
navegação, no caso da agenda).

## Renomeações e redirecionamentos

O mapa participativo chamava-se **"Mapa do Medo"** e virou **"Goiás Seguro para
Todos"** (ago/2026), com o arquivo renomeado de `mapa-do-medo.html` para
`goias-seguro-para-todos.html`.

O GitHub Pages não faz redirecionamento de servidor, então o endereço antigo
continua no repositório como um **stub de desvio** (`mapa-do-medo.html`), com
`canonical`, `<meta http-equiv="refresh">` e `location.replace()` — porque
`/mapa-do-medo.html` já circulou em WhatsApp, material impresso e busca. Pode ser
apagado quando os buscadores tiverem reindexado e nenhum material apontar mais
para lá. **Não** o inclua no `sitemap.xml`: redirecionamento não é conteúdo.

Mesma regra vale para qualquer renomeação futura: renomeie, atualize os `href`,
o `canonical`, o `og:url`, o JSON-LD e o `sitemap.xml`, e deixe um stub no lugar
do endereço antigo.

## Liberação da campanha (o número 13007)

O HTML nasce com `data-campanha="pre"` no `<html>`. Um script inline no `<head>`
troca para `"on"` em **16/08/2026, 08:00 (Brasília)**, e o CSS esconde
`.so-campanha` antes disso e `.pre-campanha` depois. Isso resolve o que aparece
na tela — mas WhatsApp, Facebook e Google **não executam JavaScript**: leem o
HTML cru.

Por isso existe **`liberar-campanha.js`**, que escreve/apaga o número em título,
meta tags, JSON-LD, `sitemap.xml` e `site.webmanifest`:

```
node liberar-campanha.js --ocultar    # estado pré-16/08
node liberar-campanha.js --liberar    # rodar na liberação
```

Ele trabalha com pares de texto exatos: **se algum desses textos for reescrito no
site, o script avisa em vez de trocar pela metade** — nesse caso, ajuste o par
correspondente no arquivo. O workflow `.github/workflows/liberar-campanha.yml`
roda isso sozinho na data e publica. O arquivo é removido da cópia publicada
(ver "Publicação").

## SEO

As quatro páginas que vão para a busca — `index.html`, `propostas.html`,
`goias-seguro-para-todos.html` e `solicitar-reuniao.html` — trazem `canonical`,
`robots`, Open Graph (Facebook/WhatsApp/LinkedIn), Twitter/X Cards e **JSON-LD**
Schema.org (`WebSite` + `Person` + `PoliticalParty` no `index`; `WebPage`/
`ContactPage` + `BreadcrumbList` nas internas). São exatamente as quatro do
`sitemap.xml`.

`voluntario.html`, `cabo-eleitoral.html` e `acessibilidade.html` são
**`noindex, nofollow`** de propósito: são documentos de uso interno, chegam por
link direto e por isso não têm canonical, JSON-LD nem entrada no sitemap. Ao
criar uma página nova, decida em qual dos dois grupos ela entra — e, se for
indexável, acrescente-a ao `sitemap.xml`.

Somam-se `robots.txt` (aponta o sitemap) e `sitemap.xml`.

> Todos os endereços usam o domínio **sem `www`**. Se o domínio principal mudar,
> ajuste o host no `canonical`/OG/JSON-LD de **cada** página, no `robots.txt` e
> no `sitemap.xml`.

## Conteúdo dinâmico e formulários (planilhas Google)

Notícias e agenda são alimentadas por **planilhas publicadas como CSV**; os
formulários gravam via **Apps Script**. Cada URL fica numa constante no topo do
respectivo arquivo:

| O quê | Onde | Constante |
| --- | --- | --- |
| Notícias | `js/landing.js` | `NOTICIAS_CSV_URL` |
| Agenda | `js/landing.js` | `AGENDA_CSV_URL` |
| Cadastro de apoiador | `js/landing.js` | `CADASTRO_ENDPOINT` |
| Convite para reunião | `js/agenda.js` | `AGENDA_ENDPOINT` |
| Termos (voluntário / cabo) | `js/termos.js` | `TERMOS_ENDPOINT` |
| Relatos do mapa | `js/goias-seguro-para-todos.js` | `MAPA_ENDPOINT` |
| Pontos aprovados do mapa | `js/goias-seguro-para-todos.js` | `MAPA_CSV_URL` |
| Fotos dos relatos (Cloudinary) | `js/goias-seguro-para-todos.js` | `CLOUDINARY_*` |

Com a URL em branco, cada seção mostra um aviso padrão e cada formulário fica em
**modo demonstração** (valida e confirma, sem gravar). O mapa exibe pontos de
exemplo. Nada disso funciona abrindo o arquivo direto do disco (`file://`) — as
requisições exigem servidor; use `python -m http.server` para testar.

> O preset e a pasta do Cloudinary (`mapa-medo-yasser`, `mapa-medo`) mantêm o
> nome antigo de propósito: são configurações **da conta Cloudinary**, e mudar só
> no código quebraria o envio de fotos. Para renomear, crie o preset novo lá
> primeiro.

O **carrossel** não usa planilha: as fotos saem de `images/carrousel/` (hoje 114,
cada uma em `.jpg` e `.webp`), e a quantidade e as dimensões estão em atributos
`data-` no próprio `<div id="carrossel">` do `index.html`. Ao acrescentar fotos,
atualize `data-total` e `data-dims` — as dimensões, na ordem das imagens, evitam
que o layout pule enquanto elas carregam.

## Personalização rápida

- **Cores:** no `:root` de `css/landing.css` (`--brand: #f9120c`). Cada token
  tem uma variante `-escuro` usada em texto, para manter contraste ≥ 4,5:1.
  Os sete eixos de proposta usam `--acento`/`--acento-tint` (`.eixo--seguranca`
  e afins), no mesmo arquivo.
- **Tipografia:** Oswald (display), Archivo (texto), IBM Plex Mono (rótulos) e
  Caveat Brush (assinatura à mão) — todas em `fonts/`, servidas pelo próprio
  domínio via `@font-face`, sem chamada ao Google Fonts. Caveat Brush é a
  substituta livre da "Brosign Brush" do manual, que é comercial.
- **Textos:** direto no HTML da página.
- **WhatsApp:** procure `https://wa.me/`. Atenção: nos links de compartilhamento
  a URL do site vai **codificada** dentro do parâmetro `?text=`
  (`https%3A%2F%2Fdelegadoyasser.com.br%2F...`); ela também precisa ser atualizada
  quando um arquivo é renomeado.

## Acessibilidade

Padrão exigido: **eMAG / WCAG 2.2 AA**.

- Balão flutuante com ajuste de fonte, alto contraste, destaque de links e pausa
  de animações — as preferências ficam salvas no navegador e são aplicadas antes
  da primeira pintura (script inline no `<head>`, para não piscar).
- Widget **VLibras** (gov.br) em todas as páginas de conteúdo.
- Declaração em `acessibilidade.html`.
- Ao mexer no HTML, mantenha: alvos de toque ≥ 44px, foco visível (a regra global
  `:focus-visible` de `landing.css` cobre o site), texto de link que faça sentido
  fora de contexto (use `.sr-only` quando o rótulo visível se repetir) e
  hierarquia de títulos sem pular nível.

## Dependências externas

O site não tem build nem framework, mas carrega de terceiros:

- **Leaflet 1.9.4** (unpkg, com verificação de integridade SRI) e blocos do
  **OpenStreetMap** — só no mapa participativo.
- **VLibras** (gov.br) — nas páginas de conteúdo.
- **Google Analytics** (`G-BKFLZQW72Y`) e **Microsoft Clarity** (`xltc65hll6`)
  — nas sete páginas de conteúdo. Ao criar uma página nova, copie os dois blocos
  do fim do `<head>` do `index.html`; o stub de redirecionamento fica de fora de
  propósito (ele desvia em milissegundos, e o script não chegaria a rodar).
- **Player do Spotify** (álbum de jingles) — só no `index.html`.

> Nos dois termos, o `<form id="formTermo">` leva `data-clarity-mask="True"`: o
> Clarity grava replay da sessão e ali a pessoa digita CPF, RG e endereço e
> desenha a assinatura. O atributo mascara a subárvore inteira, sem depender do
> modo de máscara configurado no painel. **Qualquer formulário novo com dado
> pessoal precisa do mesmo atributo.**

## Publicação

Site estático — funciona em GitHub Pages, Netlify, Vercel ou hospedagem comum.
Mantenha o `CNAME` na raiz para o domínio próprio no GitHub Pages.

O deploy é automático: **`.github/workflows/static.yml`** publica a cada push na
`main`. Antes de subir, ele **remove `liberar-campanha.js`** da cópia do runner —
esse arquivo guarda os textos com o número 13007 e ficaria legível em
`/liberar-campanha.js`, que é justamente o que não pode circular antes da
liberação. O repositório não muda.

> O workflow publica a pasta **inteira** (`path: '.'`), então qualquer arquivo
> solto na raiz vai para o ar. Antes de commitar, confira se não sobrou nada que
> não seja do site. O `.gitignore` já barra os suspeitos de sempre (`*.log`,
> `*.stackdump`, originais de câmera, `Thumbs.db`/`.DS_Store`).
