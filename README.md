# Site — Delegado Yasser Yassine · Brasil Seguro

Site estático do pré-candidato a deputado estadual **Delegado Yasser Yassine
(PT-GO)**. HTML, CSS e JavaScript separados, sem etapa de build — basta abrir
os arquivos ou publicar a pasta.

Domínio oficial: **https://delegadoyasser.com.br** (apex, sem `www`).

## Estrutura

```
delegadoyasser/
├── index.html          Site completo (Brasil Seguro) — é o que aparece no domínio
├── acessibilidade.html Declaração de acessibilidade
├── css/
│   └── landing.css     Estilos do site (mobile-first, responsivo, temas de cor)
├── js/
│   └── landing.js      Menu, carrossel, conteúdo dinâmico, ano do rodapé e formulário
├── images/             Fotos do Yasser, favicons e ícones
├── docs/               Guias da equipe (ver abaixo)
├── erros/              Relatório de auditoria (não é publicado / bloqueado no robots)
├── robots.txt          Regras para buscadores + link do sitemap
├── sitemap.xml         Mapa do site para os buscadores
├── site.webmanifest    Manifesto PWA (nome, cores, ícones)
├── favicon.ico / .svg  Ícones do site
└── CNAME               Domínio próprio (delegadoyasser.com.br)
```

> **Legado:** `css/styles.css` e `js/main.js` eram da antiga página "Em construção"
> e não são mais usados por nenhuma página. Podem ser removidos com segurança.

## Páginas

- **`index.html`** — o site completo. É a página inicial servida na raiz do
  domínio (`delegadoyasser.com.br`). Foi renomeada a partir do antigo
  `landing.html`; a antiga página "Em construção" foi removida.
- **`acessibilidade.html`** — declaração de acessibilidade, acessível pelo balão
  de acessibilidade e pelo rodapé.

### Seções ocultas

Duas seções estão **ocultas** com o atributo `hidden` (marcadas por comentário no
`index.html`), prontas para serem reativadas quando a equipe quiser:

- **Agenda** (`<section id="agenda">`) — também com os links de menu e rodapé
  comentados.
- **Kit do voluntário / Materiais** (`<section id="materiais">`).

Para reexibir qualquer uma, remova o atributo `hidden` da `<section>` (e
descomente os links de navegação, no caso da agenda).

## SEO

O `index.html` já vem com SEO completo:

- `robots` liberando indexação, **canonical**, `hreflang` e meta tags (autor,
  keywords, geo).
- **Open Graph** (Facebook / WhatsApp / LinkedIn) e **Twitter/X Cards**, com
  imagem, dimensões e `alt`.
- **Dados estruturados** (JSON-LD Schema.org: `WebSite` + `Person`).
- **`robots.txt`** (bloqueia `/erros/`, aponta o sitemap) e **`sitemap.xml`**.
- **`site.webmanifest`** para instalação como app (PWA).

> Todos os endereços usam o domínio **sem `www`**. Se o domínio principal mudar,
> ajuste o host em `index.html` (canonical/OG/JSON-LD), `robots.txt` e `sitemap.xml`.

## Conteúdo dinâmico (planilhas Google)

Carrossel, notícias e agenda podem ser alimentados por **planilhas Google
publicadas como CSV**, configuradas em `js/landing.js`. Guias:

- **[`docs/CARROSSEL-DINAMICO.md`](docs/CARROSSEL-DINAMICO.md)**
- **[`docs/NOTICIAS-DINAMICAS.md`](docs/NOTICIAS-DINAMICAS.md)**
- **[`docs/AGENDA-DINAMICA.md`](docs/AGENDA-DINAMICA.md)**

Enquanto as URLs não são configuradas, cada seção mostra um aviso padrão.

## Formulário de cadastro

Os dados dos voluntários são enviados para uma **planilha do Google** via Apps
Script. O passo a passo está em
**[`docs/INTEGRACAO-FORMULARIO.md`](docs/INTEGRACAO-FORMULARIO.md)**.

Enquanto a URL não for configurada em `js/landing.js`, o formulário fica em
**modo demonstração** (valida e confirma, sem gravar dados).

## Personalização rápida

- **Cores:** no topo de `css/landing.css`, em `:root` (marca `--brand: #c8102e`).
  O site também oferece um seletor de cor (vermelho, roxo, azul, verde, laranja).
- **Tipografia:** Anton (display), Archivo (texto) e IBM Plex Mono (rótulos),
  via Google Fonts.
- **Textos e frases:** edite direto no `index.html`.
- **WhatsApp:** procure por `https://wa.me/` em `index.html` e ajuste o número
  da campanha.

## Acessibilidade

- Balão flutuante com ajuste de fonte, alto contraste, destaque de links e pausa
  de animações (preferências salvas no navegador).
- Widget **VLibras** (tradução para Libras).
- Página de declaração em `acessibilidade.html`.

## Publicação

Site estático — funciona em GitHub Pages, Netlify, Vercel ou hospedagem comum.
Mantenha o arquivo `CNAME` na raiz para o domínio próprio no GitHub Pages.
