# Site — Delegado Yasser Yassine · Goiás sem Medo

Site estático do pré-candidato a deputado estadual **Delegado Yasser Yassine
(PT-GO)**. HTML, CSS e JavaScript separados, sem etapa de build — basta abrir
os arquivos ou publicar a pasta.

## Estrutura

```
delegadoyasser/
├── index.html      Página inicial "Em construção" (é o que aparece no domínio)
├── landing.html    Site completo (Goiás sem Medo) — pronto para entrar no ar
├── css/
│   └── styles.css  Estilos da landing (mobile-first, responsivo)
├── js/
│   └── main.js     Menu, header ao rolar, ano do rodapé e envio do formulário
├── images/         Fotos do Yasser (ver abaixo)
├── docs/
│   ├── INTEGRACAO-FORMULARIO.md   Como ligar o formulário ao Google Sheets
│   └── Playbook ... .pdf
└── CNAME           Domínio próprio (delegadoyasser.com.br)
```

## Páginas

- **`index.html`** — página "Em construção". É a que o visitante vê ao acessar
  `delegadoyasser.com.br`. Mantida propositalmente enquanto o site não é lançado.
- **`landing.html`** — o site completo. Já está publicado e acessível em
  `delegadoyasser.com.br/landing.html`. Para colocá-lo na raiz no lançamento,
  renomeie `index.html` (ex.: para `breve.html`) e `landing.html` → `index.html`.

## Formulário de cadastro

Os dados dos voluntários são enviados para uma **planilha do Google** via Apps
Script. O passo a passo está em **[`docs/INTEGRACAO-FORMULARIO.md`](docs/INTEGRACAO-FORMULARIO.md)**.

Enquanto a URL não for configurada em `js/main.js`, o formulário fica em **modo
demonstração** (valida e confirma, sem gravar dados).

## Fotos

A landing usa **placeholders** (blocos com 📷). Para inserir fotos reais:

1. Salve as imagens em `images/` (ex.: `images/yasser-hero.jpg`).
2. Em `landing.html`, troque cada `<figure class="foto ...">...</figure>` por:

   ```html
   <img class="foto foto--alta" src="images/yasser-hero.jpg"
        alt="Delegado Yasser Yassine" loading="lazy">
   ```

Pedem foto: hero, retrato (Quem é), causa, Radar, galeria e cadastro.

## Personalização rápida

- **Cores:** no topo de `css/styles.css`, em `:root` (primária `--vermelho: #c4122f`).
- **Tipografia:** Archivo (títulos) + Libre Franklin (texto), via Google Fonts.
- **Textos, agenda, frases:** edite direto no `landing.html`.
- **WhatsApp:** procure por `https://wa.me/` em `landing.html` e adicione o número
  da campanha (ex.: `https://wa.me/5562900000000`).

## Publicação

Site estático — funciona em GitHub Pages, Netlify, Vercel ou hospedagem comum.
Mantenha o arquivo `CNAME` na raiz para o domínio próprio no GitHub Pages.
