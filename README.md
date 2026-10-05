# Site — Delegado Yasser Yassine · Goiás Seguro para Todos

Site estático do **Delegado Yasser Yassine** e do movimento **Goiás Seguro para
Todos**. HTML, CSS e JavaScript separados, sem etapa de build — basta abrir os
arquivos ou publicar a pasta.

Domínio oficial: **https://delegadoyasser.com.br** (apex, sem `www`).

> **Fim da campanha (out/2026):** todo o conteúdo da campanha eleitoral de 2026
> saiu do site — número de urna, propostas de mandato (`propostas.html` e o PDF),
> "Leve na urna", "Foto com o Yasser", termos de voluntário e de cabo eleitoral,
> álbum de jingles, texto legal da coligação e a liberação agendada
> (`liberar-campanha.js`). Está tudo no histórico do git, se fizer falta.

## Estrutura

```
delegadoyasser/
├── index.html                     Página inicial — o site completo
├── goias-seguro-para-todos.html   Mapa participativo de insegurança
├── mapa-do-medo.html              Só redireciona para o arquivo acima (ver "Renomeações")
├── solicitar-reuniao.html         Convite para o Yasser visitar a comunidade
├── acessibilidade.html            Declaração de acessibilidade
├── css/
│   ├── landing.css                Estilos de TODAS as páginas (tokens, base, componentes)
│   ├── goias-seguro-para-todos.css  Só o mapa participativo
│   └── agenda.css                 Só solicitar-reuniao.html
├── js/
│   ├── landing.js                 Carregado por todas: menu, carrossel, notícias,
│   │                              agenda, balão de acessibilidade e cadastro
│   ├── goias-seguro-para-todos.js Mapa: relato, moderação e pontos aprovados
│   ├── goias-geo.js               Contorno de Goiás (malha do IBGE) usado pelo mapa
│   └── agenda.js                  Formulário de solicitar-reuniao.html
├── fonts/                         Fontes .woff2 servidas pelo próprio domínio
├── images/                        Fotos, carrossel (114 fotos em jpg+webp), favicons e selos
├── .github/workflows/             Publicação no GitHub Pages (ver "Publicação")
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

## Páginas

- **`index.html`** — a página inicial servida na raiz do domínio. Reúne quem é o
  Yasser, pilares e bandeiras, frases, redes, as missões do movimento, o radar,
  notícias, carrossel de fotos e o formulário de cadastro.
- **`goias-seguro-para-todos.html`** — mapa participativo (Leaflet +
  OpenStreetMap): a população marca pontos de risco, que passam por moderação
  antes de aparecer.
- **`solicitar-reuniao.html`** — formulário para convidar o Yasser.
- **`acessibilidade.html`** — declaração de acessibilidade, aberta pelo balão de
  acessibilidade e pelo rodapé.

### O menu do topo cabe em uma linha

O container do site tem 1.120 px e o logo come 262. Sobram **842 px** para o
menu. Com a saída dos itens da campanha sobrou folga, mas a regra continua:
**cada item novo no topo pode tirar o menu da linha única**, e o `overflow-x:
hidden` do `body` esconde o estouro em vez de deixar rolar.

Duas defesas no CSS, para o problema não voltar calado:

- o menu na horizontal só vale a partir de **1160 px** (`@media (min-width: 1160px)`,
  em `css/landing.css`); abaixo disso vale o menu-gaveta. Se mexer nesse
  valor, mexa junto no `window.innerWidth >= 1160` de `js/landing.js`;
- `.nav__links` tem `flex-wrap: wrap`, então o pior caso é o cabeçalho ganhar
  uma segunda linha — nunca um item para fora da tela.

Para conferir depois de mexer no menu, sirva o site com
`python -m http.server` e meça a altura do `#cabecalho`: **69 px é uma linha**,
~112 px são duas.

### Seções ocultas

Duas seções do `index.html` estão **ocultas** com o atributo `hidden` (marcadas
por comentário), prontas para reativação:

- **Agenda** (`<section id="agenda">`) — também com o link do rodapé comentado.
- **Kit do voluntário / Materiais** (`<section id="materiais">`).

Para reexibir, remova o `hidden` da `<section>` (e descomente o link do rodapé,
no caso da agenda).

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

## SEO

As três páginas que vão para a busca — `index.html`,
`goias-seguro-para-todos.html` e `solicitar-reuniao.html` — trazem `canonical`,
`robots`, Open Graph (Facebook/WhatsApp/LinkedIn), Twitter/X Cards e **JSON-LD**
Schema.org (`WebSite` + `Person` no `index`; `WebPage`/`ContactPage` +
`BreadcrumbList` nas internas). São exatamente as três do `sitemap.xml`.

`acessibilidade.html` é **`noindex, nofollow`** de propósito: chega por link
direto e por isso não tem canonical, JSON-LD nem entrada no sitemap. Ao criar
uma página nova, decida em qual dos dois grupos ela entra — e, se for
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
- **Tipografia:** Oswald (display), Archivo (texto), IBM Plex Mono (rótulos) e
  Caveat Brush (assinatura à mão) — todas em `fonts/`, servidas pelo próprio
  domínio via `@font-face`, sem chamada ao Google Fonts. Caveat Brush é a
  substituta livre da "Brosign Brush" do manual, que é comercial.
- **Textos:** direto no HTML da página.
- **WhatsApp:** procure `https://wa.me/` e `chat.whatsapp.com`.

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
  — nas quatro páginas de conteúdo. Ao criar uma página nova, copie os dois
  blocos do fim do `<head>` do `index.html`; o stub de redirecionamento fica de
  fora de propósito (ele desvia em milissegundos, e o script não chegaria a rodar).

> O Clarity grava replay da sessão. **Qualquer formulário novo com dado pessoal
> sensível (CPF, RG, endereço, assinatura) precisa de `data-clarity-mask="True"`**
> no `<form>`, que mascara a subárvore inteira sem depender do modo de máscara
> configurado no painel.

## Publicação

Site estático — funciona em GitHub Pages, Netlify, Vercel ou hospedagem comum.
Mantenha o `CNAME` na raiz para o domínio próprio no GitHub Pages.

O deploy é automático: **`.github/workflows/static.yml`** publica a cada push na
`main`.

> O workflow publica a pasta **inteira** (`path: '.'`), então qualquer arquivo
> solto na raiz vai para o ar. Antes de commitar, confira se não sobrou nada que
> não seja do site. O `.gitignore` já barra os suspeitos de sempre (`*.log`,
> `*.stackdump`, originais de câmera, `Thumbs.db`/`.DS_Store`).
