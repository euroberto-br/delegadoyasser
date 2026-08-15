/* =============================================================
   Delegado Yasser — Goiás Seguro para Todos
   Troca o número 13007 nas partes que o JavaScript NÃO alcança.
   =============================================================

   Por que este script existe
   --------------------------
   O que aparece na tela (banner inicial, pills, rodapé) é controlado em tempo
   de execução: o HTML nasce com data-campanha="pre" e o script inline do <head>
   libera sozinho em 16/08/2026 às 08:00. Isso resolve o navegador.

   Só que WhatsApp, Facebook, Twitter/X e Google NÃO executam JavaScript: eles
   leem o HTML cru. Título, meta tags, JSON-LD, sitemap e webmanifest, portanto,
   só ficam sem o número se o número não estiver no arquivo. É o que este script
   faz — e desfaz.

   Como usar
   ---------
     node liberar-campanha.js --ocultar    (estado atual, pré-16/08)
     node liberar-campanha.js --liberar    (rodar em 16/08/2026 às 08:00)

   Depois de rodar --liberar, faça commit e push: o deploy do GitHub Pages é
   disparado por push na main (.github/workflows/static.yml).

   Se algum texto do site for reescrito, os pares abaixo param de casar e o
   script avisa em vez de trocar pela metade. Nesse caso, ajuste o par.
   ============================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = __dirname;

// [arquivo, trecho COM o número, trecho SEM o número]
const PARES = [
  // ---- index.html: título da aba -------------------------------------------
  [
    "index.html",
    "<title>Delegado Yasser 13007 — Goiás Seguro para Todos | Candidato a Deputado Estadual PT-GO</title>",
    "<title>Delegado Yasser — Goiás Seguro para Todos | Candidato a Deputado Estadual PT-GO</title>",
  ],
  // ---- index.html: meta description e keywords -----------------------------
  [
    "index.html",
    "candidato a deputado estadual pelo PT-GO, número 13007. Goiás seguro para todos:",
    "candidato a deputado estadual pelo PT-GO. Goiás seguro para todos:",
  ],
  [
    "index.html",
    'content="Delegado Yasser, Yasser Yassine, 13007, deputado estadual Goiás,',
    'content="Delegado Yasser, Yasser Yassine, deputado estadual Goiás,',
  ],
  // ---- index.html: Open Graph + Twitter ------------------------------------
  // O fecho `">` no fim evita casar com outros textos que começam igual.
  [
    "index.html",
    'Delegado Yasser 13007 — Goiás Seguro para Todos">',
    'Delegado Yasser — Goiás Seguro para Todos">',
  ],
  [
    "index.html",
    "candidato a deputado estadual pelo PT-GO, número 13007. Segurança pública",
    "candidato a deputado estadual pelo PT-GO. Segurança pública",
  ],
  [
    "index.html",
    'content="Candidato a deputado estadual pelo PT-GO, número 13007. Segurança pública',
    'content="Candidato a deputado estadual pelo PT-GO. Segurança pública',
  ],
  [
    "index.html",
    'content="Delegado Yasser Yassine, candidato a deputado estadual, número 13007">',
    'content="Delegado Yasser Yassine, candidato a deputado estadual">',
  ],
  // ---- index.html: dados estruturados (JSON-LD) ----------------------------
  [
    "index.html",
    "candidato a deputado estadual pelo PT-GO, número 13007, com bandeira",
    "candidato a deputado estadual pelo PT-GO, com bandeira",
  ],
  // ---- sitemap.xml ---------------------------------------------------------
  [
    "sitemap.xml",
    "<image:title>Delegado Yasser Yassine — 13007</image:title>",
    "<image:title>Delegado Yasser Yassine</image:title>",
  ],
  // ---- site.webmanifest ----------------------------------------------------
  [
    "site.webmanifest",
    '"name": "Delegado Yasser Yassine 13007 — Goiás Seguro para Todos",',
    '"name": "Delegado Yasser Yassine — Goiás Seguro para Todos",',
  ],
  [
    "site.webmanifest",
    "candidato a deputado estadual pelo PT-GO, número 13007.",
    "candidato a deputado estadual pelo PT-GO.",
  ],
];

const modo = process.argv[2];
if (modo !== "--ocultar" && modo !== "--liberar") {
  console.error("Uso: node liberar-campanha.js --ocultar | --liberar");
  process.exit(1);
}
const liberando = modo === "--liberar";

// Lê cada arquivo uma vez só, aplica todos os pares dele e grava no fim.
const conteudo = new Map();
const ler = (arq) => {
  if (!conteudo.has(arq)) {
    conteudo.set(arq, fs.readFileSync(path.join(RAIZ, arq), "utf8"));
  }
  return conteudo.get(arq);
};

let trocas = 0;
let jaEstava = 0;
const problemas = [];

for (const [arq, com, sem] of PARES) {
  const de = liberando ? sem : com;
  const para = liberando ? com : sem;
  const txt = ler(arq);

  const achados = txt.split(de).length - 1;

  if (achados === 0) {
    // Já está no estado desejado? Então não é erro, é reexecução.
    if (txt.includes(para)) {
      jaEstava++;
      continue;
    }
    problemas.push(`${arq}: trecho não encontrado → ${de.slice(0, 60)}…`);
    continue;
  }

  conteudo.set(arq, txt.split(de).join(para));
  trocas += achados;
}

if (problemas.length) {
  console.error("\nNada foi gravado. Pares que não casaram:\n");
  problemas.forEach((p) => console.error("  - " + p));
  console.error("\nO texto do site provavelmente mudou; ajuste os pares em PARES.\n");
  process.exit(1);
}

for (const [arq, txt] of conteudo) {
  fs.writeFileSync(path.join(RAIZ, arq), txt, "utf8");
}

console.log(
  `\n${liberando ? "LIBERADO" : "OCULTO"}: ${trocas} troca(s) em ` +
    `${conteudo.size} arquivo(s)` +
    (jaEstava ? `, ${jaEstava} já estava(m) no estado certo` : "") +
    "."
);
if (liberando) {
  console.log("Agora faça commit e push na main para publicar.\n");
}
