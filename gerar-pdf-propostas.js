/* =============================================================
   Gera propostas-delegado-yasser.pdf — a versão ilustrada das propostas.

   POR QUE ESTE ARQUIVO EXISTE
   ---------------------------
   A página propostas.html tem um @media print próprio, em preto sobre
   branco: é a folha que sai quando alguém aperta Ctrl+P, feita para ser
   fotocopiada e para sobreviver a navegador com "imprimir cores de fundo"
   desligado — que é o padrão. Essa versão não pode ser colorida.

   O PDF é outra peça: capa com foto, eixos coloridos e a cola da urna no
   fim. Em vez de manter uma segunda cópia das propostas (que envelheceria
   na primeira edição), este script LÊ propostas.html e index.html e monta
   o documento a partir deles. A fonte da verdade continua sendo a página.

   COMO USAR
   ---------
     python -m http.server 8731 --bind 127.0.0.1   (noutro terminal)
     node gerar-pdf-propostas.js

   Opções:
     --porta=8731        porta do servidor local (padrão 8731)
     --chrome="C:\\..."   caminho do Chrome, se não achar sozinho
     --manter            não apaga o HTML intermediário (para depurar o layout)

   O intermediário é gravado como propostas-pdf.tmp.html na raiz e apagado
   no fim. Ele precisa ficar na raiz porque referencia images/ e fonts/ por
   caminho relativo.
   ============================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = __dirname;
const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith("--" + nome + "="));
  return achado ? achado.slice(nome.length + 3) : padrao;
};
const PORTA = arg("porta", "8731");
const MANTER = process.argv.includes("--manter");
const TMP = "propostas-pdf.tmp.html";
const SAIDA = "propostas-delegado-yasser.pdf";

const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), "utf8");

/* ---------- Paleta: lida do landing.css para não divergir dele ---------- */
const css = ler(path.join("css", "landing.css"));

function token(nome) {
  const m = css.match(new RegExp("--" + nome + ":\\s*([^;]+);"));
  if (!m) throw new Error("token --" + nome + " não encontrado em landing.css");
  return m[1].trim();
}

const COR = {
  brand: token("brand"),
  brandEscuro: token("brand-escuro"),
  tinta: token("tinta"),
  tinta70: token("tinta-70"),
  papel: token("papel"),
  branco: token("branco"),
};

// .eixo--seguranca { --acento: var(--brand-escuro); --acento-tint: #fde6e5; }
const ACENTO = {};
const reAcento = /\.eixo--(\w+)\s*\{\s*--acento:\s*var\(--([\w-]+)\);\s*--acento-tint:\s*(#[0-9a-f]{3,8});/gi;
let m;
while ((m = reAcento.exec(css)) !== null) {
  ACENTO[m[1]] = { acento: token(m[2]), tint: m[3] };
}

/* ---------- Extração das propostas ---------- */
const propostasHtml = ler("propostas.html");

const semTags = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const limpo = (s) => s.replace(/\s+/g, " ").trim();

const eixos = [];
const reEixo =
  /<section class="eixo-bloco eixo--(\w+)" id="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g;
while ((m = reEixo.exec(propostasHtml)) !== null) {
  const [, slug, id, corpo] = m;

  const ico = (corpo.match(/<span class="eixo__ico"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "";
  const titulo = semTags((corpo.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [, ""])[1]);
  const introM = corpo.match(/<p class="eixo-bloco__intro[^"]*">([\s\S]*?)<\/p>/);
  const intro = introM ? limpo(introM[1]) : null;

  const itens = [];
  const reLi = /<li class="proposta([^"]*)">([\s\S]*?)<\/li>/g;
  let li;
  while ((li = reLi.exec(corpo)) !== null) {
    const destaque = li[1].includes("proposta--destaque");
    const bloco = li[2];
    const h3 = limpo((bloco.match(/<h3>([\s\S]*?)<\/h3>/) || [, ""])[1]);
    const paras = [];
    const reP = /<p>([\s\S]*?)<\/p>/g;
    let p;
    while ((p = reP.exec(bloco)) !== null) paras.push(limpo(p[1]));
    itens.push({ titulo: h3, paras, destaque });
  }

  eixos.push({ slug, id, ico: limpo(ico), titulo, intro, itens });
}

if (!eixos.length) throw new Error("nenhum eixo encontrado em propostas.html");

const totalPropostas = eixos.reduce((n, e) => n + e.itens.length, 0);

/* ---------- Extração da cola da urna (index.html) ---------- */
const indexHtml = ler("index.html");
const peca = (indexHtml.match(/<article class="lnu__peca"[\s\S]*?<\/article>/) || [])[0];
if (!peca) throw new Error('bloco .lnu__peca não encontrado em index.html');

const linhas = [];
const reLinha = /<li class="lnu__linha([^"]*)">([\s\S]*?)<\/li>/g;
while ((m = reLinha.exec(peca)) !== null) {
  const modificador = (m[1].match(/lnu__linha--(\w+)/) || [, ""])[1];
  const bloco = m[2];
  const ordem = (bloco.match(/<span class="lnu__ordem"[^>]*>(\d+)<\/span>/) || [, ""])[1];
  const cargoBruto = (bloco.match(/<p class="lnu__cargo">([\s\S]*?)<\/p>/) || [, ""])[1];
  const cargo = semTags(cargoBruto.replace(/<span class="lnu__ordem"[\s\S]*?<\/span>/, ""));
  const casas = [...bloco.matchAll(/<b>(\d)<\/b>/g)].map((c) => c[1]);
  const quemBloco = (bloco.match(/<p class="lnu__quem"[^>]*>([\s\S]*?)<\/p>/) || [, ""])[1];
  const nome = semTags((quemBloco.match(/<strong>([\s\S]*?)<\/strong>/) || [, ""])[1]);
  const detalhe = semTags((quemBloco.match(/<span>([\s\S]*?)<\/span>/) || [, ""])[1]);
  linhas.push({ modificador, ordem, cargo, casas, nome, detalhe, livre: casas.length === 0 });
}

const legal = (peca.match(/<p class="lnu__legal">([\s\S]*?)<\/p>/) || [, ""])[1]
  .split(/<br\s*\/?>/)
  .map((l) => limpo(l))
  .filter(Boolean);

const dataUrna = semTags((peca.match(/<p class="lnu__data">([\s\S]*?)<\/p>/) || [, ""])[1]);

/* ---------- Montagem do documento ---------- */
const listaEixos = eixos.map((e) => e.titulo).join(" · ");

const capa = `
  <section class="capa">
    <img class="capa__foto" src="images/yasser/yasser-retrato-camisa-jeans.jpg" alt="">
    <div class="capa__veu"></div>
    <div class="capa__texto">
      <p class="capa__selo">Compromissos de mandato</p>
      <h1 class="capa__titulo">As <em>propostas</em></h1>
      <p class="capa__linha">${totalPropostas} compromissos em ${eixos.length} frentes para Goiás</p>
      <p class="capa__eixos">${listaEixos}</p>
    </div>
    <div class="capa__pe">
      <p class="capa__nome">Delegado Yasser Yassine</p>
      <p class="capa__cargo">Candidato a Deputado Estadual · PT-GO · Goiás Seguro</p>
      <p class="capa__numero">13007</p>
    </div>
  </section>`;

const secoes = eixos
  .map((e) => {
    const cor = ACENTO[e.slug] || { acento: COR.tinta, tint: "#eee" };
    const itens = e.itens
      .map((it, i) => {
        const paras = it.paras.map((p) => `<p>${p}</p>`).join("\n              ");
        if (it.destaque) {
          return `            <li class="proposta proposta--destaque">
              <p class="proposta__selo">Destaque</p>
              <h3><span class="proposta__n">${i + 1}</span>${it.titulo}</h3>
              ${paras}
            </li>`;
        }
        return `            <li class="proposta">
              <h3><span class="proposta__n">${i + 1}</span>${it.titulo}</h3>
              ${paras}
            </li>`;
      })
      .join("\n");

    return `
  <section class="eixo" style="--acento:${cor.acento};--tint:${cor.tint}">
    <header class="eixo__cabeca">
      <span class="eixo__ico">${e.ico}</span>
      <h2>${e.titulo}</h2>
      <span class="eixo__conta">${e.itens.length} ${e.itens.length === 1 ? "proposta" : "propostas"}</span>
    </header>
    ${e.intro ? `<p class="eixo__intro">${e.intro}</p>` : ""}
    <ol class="propostas">
${itens}
    </ol>
  </section>`;
  })
  .join("\n");

const cola = `
  <section class="cola">
    <header class="cola__cabeca">
      <p class="cola__data">${dataUrna}</p>
      <h2>Leve na urna</h2>
      <p class="cola__sub">Os números na ordem em que a urna pergunta</p>
    </header>
    <ol class="cola__lista">
${linhas
  .map(
    (l) => `      <li class="cola__linha cola__linha--${l.modificador || "normal"}">
        <p class="cola__cargo"><span class="cola__ordem">${l.ordem}</span>${l.cargo}</p>
        <p class="cola__num">${
          l.livre
            ? "<b></b>".repeat(4)
            : l.casas.map((d) => `<b>${d}</b>`).join("")
        }</p>
        <p class="cola__quem"><strong>${l.nome}</strong>${
      l.detalhe ? `<span>${l.detalhe}</span>` : ""
    }</p>
      </li>`
  )
  .join("\n")}
    </ol>
    <p class="cola__grito"><span class="cola__grito__num">13007</span><span class="cola__grito__nome">Delegado Yasser<small>Deputado Estadual</small></span></p>
    <footer class="cola__pe">
      <img class="cola__qr" src="images/qr-leve-na-urna.png" alt="">
      <div>
        <p class="cola__site">delegadoyasser.com.br</p>
        <p class="cola__legal">${legal.join("<br>")}</p>
      </div>
    </footer>
  </section>`;

const ESTILO = `
/* Fontes do próprio site, servidas por caminho relativo. */
@font-face{font-family:"Oswald";font-weight:200 700;font-display:block;src:url(fonts/oswald-var-latin.woff2) format("woff2")}
@font-face{font-family:"Oswald";font-weight:200 700;font-display:block;src:url(fonts/oswald-var-latin-ext.woff2) format("woff2");unicode-range:U+0100-024F}
@font-face{font-family:"Archivo";font-weight:100 900;font-display:block;src:url(fonts/archivo-var-latin.woff2) format("woff2")}
@font-face{font-family:"Archivo";font-weight:100 900;font-display:block;src:url(fonts/archivo-var-latin-ext.woff2) format("woff2");unicode-range:U+0100-024F}
@font-face{font-family:"IBM Plex Mono";font-weight:600;font-display:block;src:url(fonts/plexmono-600-latin.woff2) format("woff2")}

:root{
  --brand:${COR.brand};
  --brand-escuro:${COR.brandEscuro};
  --tinta:${COR.tinta};
  --tinta-70:${COR.tinta70};
  --papel:${COR.papel};
  --branco:${COR.branco};
}

/* Sem isto o Chrome descarta todo fundo colorido na impressão. */
*{ -webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box }

@page{ size:A4; margin:14mm 15mm }
@page capa{ margin:0 }

html,body{ margin:0; padding:0 }
body{
  font-family:"Archivo",system-ui,sans-serif;
  color:var(--tinta);
  background:var(--branco);
  font-size:9.6pt;
  line-height:1.5;
}

/* ---------------------------------------------------------- CAPA */
.capa{
  page:capa;
  position:relative;
  width:210mm; height:297mm;
  overflow:hidden;
  background:var(--tinta);
  color:var(--papel);
  break-after:page;
}
.capa__foto{
  position:absolute; inset:0;
  width:100%; height:100%;
  object-fit:cover; object-position:50% 22%;
}
/* O véu escurece a foto para o texto passar de 4,5:1 em cima dela. */
.capa__veu{
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    rgba(24,17,20,.42) 0%,
    rgba(24,17,20,.72) 46%,
    rgba(24,17,20,.96) 74%,
    var(--tinta) 100%);
}
.capa__texto{ position:absolute; left:18mm; right:18mm; bottom:64mm }
.capa__selo{
  display:inline-block; margin:0 0 6mm;
  font-family:"IBM Plex Mono",monospace; font-weight:600;
  font-size:7.6pt; letter-spacing:.18em; text-transform:uppercase;
  color:var(--branco); background:var(--brand);
  padding:1.6mm 3.4mm;
}
.capa__titulo{
  margin:0; font-family:"Oswald",sans-serif; font-weight:500;
  font-size:58pt; line-height:.94; text-transform:uppercase;
  letter-spacing:-.01em;
}
.capa__titulo em{ font-style:normal; color:var(--brand) }
.capa__linha{ margin:5mm 0 1.5mm; font-size:12pt; font-weight:700 }
.capa__eixos{ margin:0; font-size:8.6pt; color:#c8bcc0; max-width:150mm }
.capa__pe{
  position:absolute; left:18mm; right:18mm; bottom:16mm;
  border-top:2px solid rgba(252,249,245,.28); padding-top:5mm;
}
.capa__nome{
  margin:0; font-family:"Oswald",sans-serif; font-weight:500;
  font-size:17pt; text-transform:uppercase; line-height:1;
}
.capa__cargo{
  margin:1.6mm 0 0; font-family:"IBM Plex Mono",monospace; font-weight:600;
  font-size:7.2pt; letter-spacing:.12em; text-transform:uppercase; color:#c8bcc0;
}
.capa__numero{
  position:absolute; right:0; bottom:0; margin:0;
  font-family:"Oswald",sans-serif; font-weight:600; font-size:40pt;
  line-height:.86; color:var(--brand);
}

/* ---------------------------------------------------------- EIXOS */
.eixo{ margin:0 0 8mm }
.eixo__cabeca{
  display:flex; align-items:center; gap:3mm;
  background:var(--acento); color:var(--branco);
  padding:2.6mm 4mm; margin-bottom:3.5mm;
  break-after:avoid; break-inside:avoid;
}
.eixo__ico{ display:flex; width:5.4mm; height:5.4mm; flex:none }
.eixo__ico svg{ width:100%; height:100% }
.eixo__cabeca h2{
  margin:0; flex:1;
  font-family:"Oswald",sans-serif; font-weight:500; font-size:15pt;
  text-transform:uppercase; letter-spacing:.01em; line-height:1.1;
}
.eixo__conta{
  font-family:"IBM Plex Mono",monospace; font-weight:600;
  font-size:6.8pt; letter-spacing:.1em; text-transform:uppercase;
  opacity:.85; white-space:nowrap;
}
.eixo__intro{
  margin:0 0 3.5mm; padding:2.6mm 3.4mm;
  background:var(--tint); font-size:8.8pt;
  break-inside:avoid;
}
.propostas{ list-style:none; margin:0; padding:0 }

.proposta{
  border-left:1.2mm solid var(--acento);
  padding:0 0 0 3.4mm;
  margin:0 0 3.6mm;
  break-inside:avoid;
}
.proposta h3{
  margin:0 0 1mm;
  font-size:10.2pt; font-weight:800; line-height:1.25;
}
.proposta__n{
  display:inline-block; min-width:5.2mm;
  color:var(--acento); font-family:"IBM Plex Mono",monospace;
  font-weight:600; font-size:8.6pt;
}
.proposta p{ margin:0 0 1.2mm; color:#2b2226 }
.proposta p:last-child{ margin-bottom:0 }
.proposta a{ color:inherit; text-decoration:underline }

.proposta--destaque{
  background:var(--tinta); color:var(--papel);
  border-left:0; padding:4mm 4.4mm;
  margin-bottom:4.4mm;
}
.proposta--destaque h3{
  font-family:"Oswald",sans-serif; font-weight:500;
  font-size:15pt; text-transform:uppercase; line-height:1.05;
  margin:1.6mm 0 1.6mm;
}
.proposta--destaque .proposta__n{ color:var(--brand); font-size:11pt }
.proposta--destaque p{ color:#ded3cd }
.proposta--destaque a{ color:var(--papel) }
.proposta__selo{
  display:inline-block; margin:0;
  background:var(--brand); color:var(--branco);
  font-family:"IBM Plex Mono",monospace; font-weight:600;
  font-size:6.4pt; letter-spacing:.16em; text-transform:uppercase;
  padding:1mm 2.4mm;
}

/* ---------------------------------------------------------- COLA DA URNA */
.cola{
  break-before:page;
  border:1mm solid var(--tinta);
  padding:6mm;
}
.cola__cabeca{ text-align:center; border-bottom:.6mm solid var(--tinta); padding-bottom:4mm }
.cola__data{
  margin:0; font-family:"IBM Plex Mono",monospace; font-weight:600;
  font-size:7pt; letter-spacing:.14em; text-transform:uppercase; color:var(--brand-escuro);
}
.cola__cabeca h2{
  margin:1.5mm 0 0; font-family:"Oswald",sans-serif; font-weight:500;
  font-size:26pt; text-transform:uppercase; line-height:1;
}
.cola__sub{ margin:1mm 0 0; font-size:8.6pt; color:var(--tinta-70) }

.cola__lista{ list-style:none; margin:5mm 0 0; padding:0 }
.cola__linha{
  display:grid;
  grid-template-columns:52mm 34mm 1fr;
  align-items:center; gap:4mm;
  padding:2.6mm 2mm;
  border-bottom:.3mm solid rgba(24,17,20,.25);
  break-inside:avoid;
}
.cola__cargo{
  display:flex; align-items:center; gap:2.4mm; margin:0;
  font-family:"Oswald",sans-serif; font-weight:500;
  font-size:11.5pt; text-transform:uppercase; line-height:1.05;
}
.cola__ordem{
  display:flex; align-items:center; justify-content:center;
  width:5.6mm; height:5.6mm; flex:none;
  border:.4mm solid var(--tinta); border-radius:50%;
  font-family:"IBM Plex Mono",monospace; font-size:7pt; font-weight:600;
}
.cola__num{ display:flex; gap:1.4mm; margin:0 }
.cola__num b{
  display:flex; align-items:center; justify-content:center;
  width:7.4mm; height:9.4mm;
  border:.5mm solid var(--tinta); background:var(--branco);
  font-family:"Oswald",sans-serif; font-weight:600; font-size:15pt;
}
.cola__quem{ margin:0; font-size:9pt; line-height:1.3 }
.cola__quem strong{ display:block; font-size:10.4pt }
.cola__quem span{ color:var(--tinta-70); font-size:8.2pt }

/* A linha do 13007 é a única colorida: é ela que a peça existe para gritar. */
.cola__linha--destaque{
  background:var(--brand); color:var(--branco);
  border-bottom:0; padding:3.4mm 2mm;
}
.cola__linha--destaque .cola__ordem{ border-color:var(--branco) }
.cola__linha--destaque .cola__num b{ border-color:var(--branco); background:var(--branco); color:var(--brand-escuro) }
.cola__linha--destaque .cola__quem span{ color:rgba(255,255,255,.9) }

.cola__grito{
  display:flex; align-items:center; justify-content:center; gap:5mm;
  margin:5mm 0 0; padding:4mm 0 0; border-top:.8mm solid var(--tinta);
}
.cola__grito__num{
  font-family:"Oswald",sans-serif; font-weight:600; font-size:42pt;
  line-height:.9; color:var(--brand);
}
.cola__grito__nome{
  font-family:"Oswald",sans-serif; font-weight:500; font-size:16pt;
  text-transform:uppercase; line-height:1;
}
.cola__grito__nome small{
  display:block; font-family:"IBM Plex Mono",monospace; font-weight:600;
  font-size:6.8pt; letter-spacing:.12em; color:var(--tinta-70); margin-top:1mm;
}
.cola__pe{
  display:flex; align-items:center; gap:4mm;
  margin-top:5mm; padding-top:3.5mm; border-top:.3mm solid rgba(24,17,20,.3);
}
.cola__qr{ width:20mm; height:20mm; flex:none }
.cola__site{
  margin:0 0 1mm; font-family:"Oswald",sans-serif; font-weight:500;
  font-size:12pt; text-transform:uppercase;
}
.cola__legal{
  margin:0; font-family:"IBM Plex Mono",monospace;
  font-size:5.8pt; line-height:1.5; letter-spacing:.04em;
  text-transform:uppercase; color:var(--tinta-70);
}
`;

const documento = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Propostas — Delegado Yasser Yassine</title>
<style>${ESTILO}</style>
</head>
<body>
${capa}
<main>
${secoes}
${cola}
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(RAIZ, TMP), documento, "utf8");
console.log(
  "montado: " + eixos.length + " eixos, " + totalPropostas + " propostas, " +
  linhas.length + " linhas na cola"
);

/* ---------- Impressão ---------- */
const CANDIDATOS = [
  arg("chrome", null),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chrome = CANDIDATOS.find((c) => fs.existsSync(c));
if (!chrome) {
  console.error("Chrome não encontrado. Passe --chrome=\"caminho\\para\\chrome.exe\".");
  process.exit(1);
}

try {
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=20000",
      "--print-to-pdf=" + path.join(RAIZ, SAIDA),
      "http://127.0.0.1:" + PORTA + "/" + TMP,
    ],
    { stdio: "inherit", timeout: 120000 }
  );
} catch (e) {
  // O Chrome headless às vezes demora a encerrar depois de escrever o arquivo;
  // o que importa é o PDF ter sido gravado.
  if (!fs.existsSync(path.join(RAIZ, SAIDA))) {
    console.error("Falhou ao gerar o PDF. O servidor local está no ar na porta " + PORTA + "?");
    process.exit(1);
  }
}

if (!MANTER) fs.unlinkSync(path.join(RAIZ, TMP));

const kb = Math.round(fs.statSync(path.join(RAIZ, SAIDA)).size / 1024);
console.log("gerado: " + SAIDA + " (" + kb + " KB)");
