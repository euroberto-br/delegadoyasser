/* =============================================================
   Delegado Yasser — Brasil sem Medo
   Scripts da landing (vanilla JS, sem dependências)
   ============================================================= */

(function () {
  "use strict";

  // Sinaliza que há JS: os efeitos .reveal só escondem conteúdo com esta classe.
  document.documentElement.classList.add("js");

  // As planilhas do Google só liberam CORS para origens http(s). Ao abrir o HTML
  // direto do disco (file://, origem "null"), o navegador bloqueia o fetch com
  // erro 307/CORS no console. Nesse caso pulamos a busca e mantemos os avisos
  // "em breve" do HTML. Em produção (domínio real / GitHub Pages) funciona normal.
  // Para testar localmente, sirva a pasta por http (ex.: python -m http.server).
  var SERVIDO_VIA_HTTP =
    location.protocol === "http:" || location.protocol === "https:";

  /* ---------- Menu mobile ---------- */
  var toggle = document.getElementById("menuToggle");
  var links = document.getElementById("navLinks");

  if (toggle && links) {
    function fecharMenu() {
      links.classList.remove("aberto");
      toggle.textContent = "☰";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menu");
    }

    toggle.addEventListener("click", function () {
      var aberto = links.classList.toggle("aberto");
      toggle.textContent = aberto ? "✕" : "☰";
      toggle.setAttribute("aria-expanded", String(aberto));
      toggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });

    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", fecharMenu);
    });

    // Esc fecha o menu e devolve o foco ao botão (navegação por teclado)
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("aberto")) {
        fecharMenu();
        toggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 980) fecharMenu();
    });
  }

  /* ---------- Links externos: avisa leitores de tela sobre a nova aba ---------- */
  document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
    /* Com aria-label, o aviso entra no próprio label — um span de texto ficaria
       fora do nome acessível e violaria o critério WCAG 2.5.3 (label in name) */
    if (a.hasAttribute("aria-label")) {
      var label = a.getAttribute("aria-label");
      if (label.indexOf("abre em nova aba") === -1) {
        a.setAttribute("aria-label", label + " (abre em nova aba)");
      }
      return;
    }
    if (a.querySelector(".sr-only")) return;
    var aviso = document.createElement("span");
    aviso.className = "sr-only";
    aviso.textContent = " (abre em nova aba)";
    a.appendChild(aviso);
  });

  /* ---------- Sombra no header ao rolar ---------- */
  var header = document.getElementById("cabecalho");
  if (header) {
    window.addEventListener(
      "scroll",
      function () {
        header.classList.toggle("rolou", window.scrollY > 8);
      },
      { passive: true }
    );
  }

  /* ---------- Ano atual no rodapé ---------- */
  var ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();

  /* ---------- Reveal ao rolar (respeita reduced motion) ---------- */
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = document.querySelectorAll(".reveal");

  if (reveals.length && "IntersectionObserver" in window && !reduzMovimento) {
    var io = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visivel");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("visivel"); });
  }

  /* ---------- Seletor de cor (pré-visualização) ---------- */
  var TEMAS = ["vermelho", "roxo", "azul", "verde", "laranja"];
  var raiz = document.documentElement;
  var dots = document.querySelectorAll(".tema-dot");

  function aplicarTema(tema) {
    if (TEMAS.indexOf(tema) === -1) tema = "vermelho";
    if (tema === "vermelho") raiz.removeAttribute("data-theme");
    else raiz.setAttribute("data-theme", tema);
    dots.forEach(function (d) {
      d.setAttribute("aria-pressed", String(d.dataset.tema === tema));
    });
    try { localStorage.setItem("tema-cor", tema); } catch (e) {}
  }

  if (dots.length) {
    dots.forEach(function (d) {
      d.addEventListener("click", function () { aplicarTema(d.dataset.tema); });
    });
    var salvo;
    try { salvo = localStorage.getItem("tema-cor"); } catch (e) {}
    if (salvo) aplicarTema(salvo);
  }

  /* =============================================================
     Balão de acessibilidade: fonte, contraste, links e animações
     (padrão eMAG; preferências persistem via localStorage e são
     reaplicadas antes da pintura pelo script inline do <head>)
     ============================================================= */
  var ESCALAS = [90, 100, 110, 120, 130]; // % do tamanho de fonte
  var escalaEl = document.getElementById("fonteEscala");

  function escalaAtual() {
    var p = 100;
    try { p = parseInt(localStorage.getItem("fonte-escala"), 10) || 100; } catch (e) {}
    return ESCALAS.indexOf(p) === -1 ? 100 : p;
  }

  function aplicarEscala(p) {
    if (ESCALAS.indexOf(p) === -1) p = 100;
    raiz.style.fontSize = p === 100 ? "" : p + "%";
    if (escalaEl) escalaEl.textContent = p + "%";
    try { localStorage.setItem("fonte-escala", String(p)); } catch (e) {}
  }

  function mudarEscala(direcao) {
    var i = ESCALAS.indexOf(escalaAtual()) + direcao;
    aplicarEscala(ESCALAS[Math.max(0, Math.min(ESCALAS.length - 1, i))]);
  }

  var btnMenor = document.getElementById("fonteMenor");
  var btnMaior = document.getElementById("fonteMaior");
  if (btnMenor) btnMenor.addEventListener("click", function () { mudarEscala(-1); });
  if (btnMaior) btnMaior.addEventListener("click", function () { mudarEscala(1); });
  if (escalaEl) escalaEl.textContent = escalaAtual() + "%";

  /* Modos ligados/desligados por classe no <html> */
  var MODOS = [
    { id: "destacarLinks", classe: "a11y-links", chave: "destacar-links" },
    { id: "pausarAnimacoes", classe: "a11y-parado", chave: "pausar-animacoes" }
  ];

  MODOS.forEach(function (modo) {
    var btn = document.getElementById(modo.id);
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(raiz.classList.contains(modo.classe)));
    btn.addEventListener("click", function () {
      var ligado = raiz.classList.toggle(modo.classe);
      btn.setAttribute("aria-pressed", String(ligado));
      try { localStorage.setItem(modo.chave, ligado ? "1" : "0"); } catch (e) {}
    });
  });

  var btnRestaurar = document.getElementById("restaurarPadrao");
  if (btnRestaurar) {
    btnRestaurar.addEventListener("click", function () {
      aplicarEscala(100);
      raiz.removeAttribute("data-contraste");
      MODOS.forEach(function (modo) {
        raiz.classList.remove(modo.classe);
        var btn = document.getElementById(modo.id);
        if (btn) btn.setAttribute("aria-pressed", "false");
        try { localStorage.setItem(modo.chave, "0"); } catch (e) {}
      });
      var btnC = document.getElementById("contrasteAlto");
      if (btnC) btnC.setAttribute("aria-pressed", "false");
      try { localStorage.setItem("contraste", "normal"); } catch (e) {}
    });
  }

  /* Balão flutuante: abre/fecha o painel de opções */
  var acessToggle = document.getElementById("acessToggle");
  var acessPainel = document.getElementById("acessPainel");
  if (acessToggle && acessPainel) {
    function fecharPainelAcess() {
      acessPainel.hidden = true;
      acessToggle.setAttribute("aria-expanded", "false");
    }

    acessToggle.addEventListener("click", function () {
      var abrir = acessPainel.hidden;
      acessPainel.hidden = !abrir;
      acessToggle.setAttribute("aria-expanded", String(abrir));
    });

    // Esc fecha o painel e devolve o foco ao balão
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !acessPainel.hidden) {
        fecharPainelAcess();
        acessToggle.focus();
      }
    });

    // Clique fora fecha o painel
    document.addEventListener("click", function (e) {
      if (!acessPainel.hidden && !e.target.closest(".acess-flutuante")) fecharPainelAcess();
    });
  }

  var btnContraste = document.getElementById("contrasteAlto");
  if (btnContraste) {
    // Sincroniza o estado do botão com a preferência aplicada no <head>
    btnContraste.setAttribute("aria-pressed", String(raiz.getAttribute("data-contraste") === "alto"));

    btnContraste.addEventListener("click", function () {
      var ligado = raiz.getAttribute("data-contraste") !== "alto";
      if (ligado) raiz.setAttribute("data-contraste", "alto");
      else raiz.removeAttribute("data-contraste");
      btnContraste.setAttribute("aria-pressed", String(ligado));
      try { localStorage.setItem("contraste", ligado ? "alto" : "normal"); } catch (e) {}
    });
  }

  /* =============================================================
     Agenda dinâmica ← planilha Google publicada como CSV
     -------------------------------------------------------------
     A equipe edita uma planilha e o site atualiza sozinho.
     Guia passo a passo em docs/AGENDA-DINAMICA.md.

     Colunas esperadas (1ª linha = cabeçalho, em qualquer ordem):
       data (DD/MM/AAAA) · hora · titulo · cidade · local · tipo · link(opcional)

     Enquanto AGENDA_CSV_URL estiver vazia, a seção exibe o aviso
     "em breve" escrito no HTML.
     ============================================================= */
  var AGENDA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzk7ubRRinRl77vVBIPgBFZO_38RRf3Eaqj4F4vS_E4ozyBU0nKl1sZDlal0nf_qInC9ftL8KDFOCa/pub?output=csv";

  var listaAgenda = document.getElementById("listaAgenda");
  var agendaNota = document.getElementById("agendaNota");
  var MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Parser de CSV simples com suporte a aspas (títulos podem ter vírgulas).
  function parseCSV(texto) {
    var linhas = [];
    var linha = [];
    var campo = "";
    var dentroAspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (dentroAspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') dentroAspas = false;
        else campo += c;
      } else if (c === '"') {
        dentroAspas = true;
      } else if (c === ",") {
        linha.push(campo); campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); campo = "";
        linhas.push(linha); linha = [];
      } else {
        campo += c;
      }
    }
    if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  function montarEvento(ev) {
    var art = document.createElement("article");
    art.className = "evento";

    var data = document.createElement("div");
    data.className = "evento__data";
    var dia = document.createElement("span");
    dia.className = "dia";
    dia.textContent = ("0" + ev.data.getDate()).slice(-2);
    var mes = document.createElement("span");
    mes.className = "mes";
    mes.textContent = MESES[ev.data.getMonth()];
    data.appendChild(dia);
    data.appendChild(mes);

    var info = document.createElement("div");
    info.className = "evento__info";
    var h3 = document.createElement("h3");
    var linkEv = linkSeguro(ev.link);
    if (linkEv) {
      var a = document.createElement("a");
      a.href = linkEv;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = ev.titulo;
      var aviso = document.createElement("span");
      aviso.className = "sr-only";
      aviso.textContent = " (abre em nova aba)";
      a.appendChild(aviso);
      h3.appendChild(a);
    } else {
      h3.textContent = ev.titulo;
    }
    var p = document.createElement("p");
    p.textContent = [ev.cidade, ev.local, ev.hora].filter(Boolean).join(" · ");
    info.appendChild(h3);
    info.appendChild(p);

    art.appendChild(data);
    art.appendChild(info);

    if (ev.tipo) {
      var tipo = document.createElement("span");
      tipo.className = "evento__tipo";
      tipo.textContent = ev.tipo;
      art.appendChild(tipo);
    }
    return art;
  }

  if (AGENDA_CSV_URL && listaAgenda && SERVIDO_VIA_HTTP) {
    fetch(AGENDA_CSV_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (csv) {
        var linhas = parseCSV(csv).filter(function (l) { return l.join("").trim() !== ""; });
        if (linhas.length < 2) return; // só cabeçalho → mantém o aviso

        var cab = linhas[0].map(function (c) { return c.trim().toLowerCase(); });
        var col = function (linha, nome) {
          var idx = cab.indexOf(nome);
          return idx === -1 ? "" : (linha[idx] || "").trim();
        };

        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        var eventos = linhas.slice(1)
          .map(function (l) {
            var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(col(l, "data"));
            if (!m) return null;
            return {
              data: new Date(+m[3], +m[2] - 1, +m[1]),
              hora: col(l, "hora"),
              titulo: col(l, "titulo"),
              cidade: col(l, "cidade"),
              local: col(l, "local"),
              tipo: col(l, "tipo"),
              link: col(l, "link")
            };
          })
          .filter(function (ev) { return ev && ev.titulo && ev.data >= hoje; })
          .sort(function (a, b) { return a.data - b.data; })
          .slice(0, 8);

        if (!eventos.length) return; // nada futuro → mantém o aviso

        listaAgenda.innerHTML = "";
        eventos.forEach(function (ev) { listaAgenda.appendChild(montarEvento(ev)); });
        if (agendaNota) agendaNota.textContent = "Agenda atualizada pela equipe do movimento.";
      })
      .catch(function () { /* falhou → mantém o aviso do HTML */ });
  }

  /* =============================================================
     Notícias dinâmicas ← planilha Google publicada como CSV
     -------------------------------------------------------------
     Mesmo esquema da agenda. Guia em docs/NOTICIAS-DINAMICAS.md.

     Colunas esperadas (1ª linha = cabeçalho, em qualquer ordem):
       data (DD/MM/AAAA) · titulo · resumo · conteudo · fotos · link
     "fotos": uma ou mais URLs de imagem separadas por | (barra vertical).
     "conteudo": texto completo; cada quebra de linha vira um parágrafo.
     "link" (opcional): fonte externa exibida no fim da notícia.

     Enquanto NOTICIAS_CSV_URL estiver vazia, a seção exibe o aviso
     "em breve" escrito no HTML.
     ============================================================= */
  var NOTICIAS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQG9CWJYF9Svf-4d1sA_jnaX5hDwjE71FuO76XOQA9Pxkf0JECt3EgmZBBGePXOFE0Sx5zelFiSUmAc/pub?output=csv";

  var listaNoticias = document.getElementById("listaNoticias");
  var noticiasNota = document.getElementById("noticiasNota");
  var modalNoticia = null;

  function formatarData(d) {
    return ("0" + d.getDate()).slice(-2) + " " + MESES[d.getMonth()] + " " + d.getFullYear();
  }

  function abrirModalNoticia(nt) {
    if (!modalNoticia) {
      modalNoticia = document.createElement("dialog");
      modalNoticia.className = "modal-noticia";
      modalNoticia.addEventListener("click", function (e) {
        if (e.target === modalNoticia) modalNoticia.close(); // clique no backdrop
      });
      document.body.appendChild(modalNoticia);
    }

    modalNoticia.innerHTML = "";
    modalNoticia.setAttribute("aria-label", nt.titulo);

    var inner = document.createElement("div");
    inner.className = "modal-noticia__inner";

    var fechar = document.createElement("button");
    fechar.type = "button";
    fechar.className = "modal-noticia__fechar";
    fechar.setAttribute("aria-label", "Fechar notícia");
    fechar.textContent = "✕";
    fechar.addEventListener("click", function () { modalNoticia.close(); });

    var dataEl = document.createElement("span");
    dataEl.className = "noticia__data";
    dataEl.textContent = formatarData(nt.data);

    var h3 = document.createElement("h3");
    h3.textContent = nt.titulo;

    inner.appendChild(fechar);
    inner.appendChild(dataEl);
    inner.appendChild(h3);

    if (nt.fotos.length) {
      var fotos = document.createElement("div");
      fotos.className = "modal-noticia__fotos";
      nt.fotos.forEach(function (url, idx) {
        var img = document.createElement("img");
        img.src = url;
        // Com várias fotos, diferencia o alt para o leitor de tela não
        // repetir o mesmo título imagem após imagem.
        img.alt = nt.fotos.length > 1
          ? nt.titulo + " — imagem " + (idx + 1) + " de " + nt.fotos.length
          : nt.titulo;
        img.loading = "lazy";
        // Some a imagem se falhar (ex.: 429 do Drive ou link quebrado)
        img.addEventListener("error", function () {
          if (img.parentNode) img.parentNode.removeChild(img);
        });
        fotos.appendChild(img);
      });
      inner.appendChild(fotos);
    }

    var texto = document.createElement("div");
    texto.className = "modal-noticia__texto";
    (nt.conteudo || nt.resumo || "").split(/\n+/).forEach(function (par) {
      if (!par.trim()) return;
      var p = document.createElement("p");
      p.textContent = par.trim();
      texto.appendChild(p);
    });
    inner.appendChild(texto);

    var linkFonte = linkSeguro(nt.link);
    if (linkFonte) {
      var fonte = document.createElement("p");
      var a = document.createElement("a");
      a.href = linkFonte;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Ler na íntegra";
      var avisoFonte = document.createElement("span");
      avisoFonte.className = "sr-only";
      avisoFonte.textContent = " (abre em nova aba)";
      a.appendChild(avisoFonte);
      fonte.appendChild(a);
      inner.appendChild(fonte);
    }

    modalNoticia.appendChild(inner);
    modalNoticia.showModal();
  }

  // Converte um link do Google Drive numa URL que funciona em <img>.
  // Aceita o link normal de "Copiar link" (…/file/d/ID/view), o …?id=ID,
  // o formato thumbnail já pronto, ou só o ID colado. Qualquer outra URL
  // (ex.: uma foto hospedada em outro lugar) é usada como está.
  function urlImagem(u) {
    u = (u || "").trim();
    if (!u) return "";
    var m = u.match(/\/d\/([A-Za-z0-9_-]{20,})/)   // …/file/d/ID/view
         || u.match(/[?&]id=([A-Za-z0-9_-]{20,})/); // …?id=ID  ou  uc?id=ID
    var id = m ? m[1]
      : (/^[A-Za-z0-9_-]{20,}$/.test(u) ? u : ""); // colou só o ID
    if (id) return "https://drive.google.com/thumbnail?id=" + id + "&sz=w1600";
    return u; // já é uma URL de imagem comum (não é do Drive)
  }

  // Sanitiza URLs vindas de fontes externas (planilhas Google). Só libera
  // http(s) e mailto — bloqueia esquemas perigosos como javascript: e data:,
  // que num href poderiam executar script caso a planilha fosse adulterada.
  function linkSeguro(u) {
    u = (u || "").trim();
    return /^(https?:|mailto:)/i.test(u) ? u : "";
  }

  function montarNoticia(nt) {
    var art = document.createElement("article");
    art.className = "noticia";

    if (nt.fotos.length) {
      var img = document.createElement("img");
      img.src = nt.fotos[0];
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      // Se a imagem falhar (ex.: Google Drive respondendo 429, ou link
      // quebrado), remove o <img> para não deixar o quadro de imagem
      // quebrada — o card fica só com o texto.
      img.addEventListener("error", function () {
        if (img.parentNode) img.parentNode.removeChild(img);
      });
      // Foto clicável: abre a notícia completa (com a imagem ampliada)
      img.classList.add("noticia__foto--zoom");
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
      img.setAttribute("aria-label", "Ampliar foto: " + nt.titulo);
      img.addEventListener("click", function () { abrirModalNoticia(nt); });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          abrirModalNoticia(nt);
        }
      });
      art.appendChild(img);
    }

    var corpo = document.createElement("div");
    corpo.className = "noticia__corpo";

    var dataEl = document.createElement("span");
    dataEl.className = "noticia__data";
    dataEl.textContent = formatarData(nt.data);

    var h3 = document.createElement("h3");
    h3.textContent = nt.titulo;

    corpo.appendChild(dataEl);
    corpo.appendChild(h3);

    if (nt.resumo) {
      var p = document.createElement("p");
      p.textContent = nt.resumo;
      corpo.appendChild(p);
    }

    if (nt.conteudo || nt.fotos.length > 1) {
      var mais = document.createElement("button");
      mais.type = "button";
      mais.className = "noticia__mais";
      mais.textContent = "Ler mais";
      mais.setAttribute("aria-label", "Ler mais: " + nt.titulo);
      mais.addEventListener("click", function () { abrirModalNoticia(nt); });
      corpo.appendChild(mais);
    } else if (linkSeguro(nt.link)) {
      var a2 = document.createElement("a");
      a2.className = "noticia__mais";
      a2.href = linkSeguro(nt.link);
      a2.target = "_blank";
      a2.rel = "noopener";
      a2.textContent = "Ler mais";
      a2.setAttribute("aria-label", "Ler mais: " + nt.titulo + " (abre em nova aba)");
      corpo.appendChild(a2);
    }

    art.appendChild(corpo);
    return art;
  }

  if (NOTICIAS_CSV_URL && listaNoticias && SERVIDO_VIA_HTTP) {
    fetch(NOTICIAS_CSV_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (csv) {
        var linhas = parseCSV(csv).filter(function (l) { return l.join("").trim() !== ""; });
        if (linhas.length < 2) return; // só cabeçalho → mantém o aviso

        var cab = linhas[0].map(function (c) { return c.trim().toLowerCase(); });
        var col = function (linha, nome) {
          var idx = cab.indexOf(nome);
          return idx === -1 ? "" : (linha[idx] || "").trim();
        };

        var noticias = linhas.slice(1)
          .map(function (l) {
            var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(col(l, "data"));
            if (!m) return null;
            return {
              data: new Date(+m[3], +m[2] - 1, +m[1]),
              titulo: col(l, "titulo"),
              resumo: col(l, "resumo"),
              conteudo: col(l, "conteudo"),
              fotos: col(l, "fotos").split("|").map(urlImagem).filter(Boolean),
              link: col(l, "link")
            };
          })
          .filter(function (nt) { return nt && nt.titulo; })
          .sort(function (a, b) { return b.data - a.data; }) // mais recente primeiro
          .slice(0, 9);

        if (!noticias.length) return;

        listaNoticias.innerHTML = "";
        noticias.forEach(function (nt) { listaNoticias.appendChild(montarNoticia(nt)); });
        if (noticiasNota) noticiasNota.textContent = "Últimas notícias publicadas pela equipe do movimento.";
      })
      .catch(function () { /* falhou → mantém o aviso do HTML */ });
  }

  /* =============================================================
     Carrossel de fotos (Momentos)
     -------------------------------------------------------------
     Slides gerados a partir de images/carrousel/carrousel-NN.jpg
     (quantidade em data-total, caminho-base em data-prefixo no HTML).
     Lazy-load (só carrega o slide atual e os vizinhos), autoplay
     que pausa no hover/foco, navegação por setas, teclado e toque.
     ============================================================= */
  var carrossel = document.getElementById("carrossel");
  var trilho = document.getElementById("carrosselTrilho");
  if (carrossel && trilho) {
    var total = parseInt(carrossel.getAttribute("data-total"), 10) || 0;
    var prefixo = carrossel.getAttribute("data-prefixo") || "";
    var atualEl = document.getElementById("carrosselAtual");
    var reduzido = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var slidesImg = [];
    var frag = document.createDocumentFragment();
    for (var i = 1; i <= total; i++) {
      var li = document.createElement("li");
      li.className = "carrossel__slide";
      li.setAttribute("role", "group");
      li.setAttribute("aria-roledescription", "slide");
      li.setAttribute("aria-label", i + " de " + total);

      var img = document.createElement("img");
      img.className = "carrossel__img";
      img.setAttribute("data-src", prefixo + ("0" + i).slice(-2) + ".jpg");
      // O número da foto já é anunciado pelo aria-label do slide ("N de total"),
      // então o alt traz só a descrição, sem repetir o número.
      img.alt = "Delegado Yasser durante as ações do movimento Brasil sem Medo";
      img.decoding = "async";
      // Se a foto falhar (link quebrado), esconde a imagem — o slide fica
      // como painel escuro, sem o ícone de imagem quebrada.
      img.addEventListener("error", function () { this.style.display = "none"; });

      li.appendChild(img);
      frag.appendChild(li);
      slidesImg.push(img);
    }
    trilho.appendChild(frag);

    function carregar(idx) {
      if (idx < 0 || idx >= total) return;
      var im = slidesImg[idx];
      if (im && !im.src && im.getAttribute("data-src")) {
        im.src = im.getAttribute("data-src");
      }
    }

    var indice = 0;
    function irPara(novo) {
      indice = (novo % total + total) % total; // circular
      trilho.style.transform = "translateX(" + (-indice * 100) + "%)";
      if (atualEl) atualEl.textContent = indice + 1;
      carregar(indice);
      carregar(indice - 1);
      carregar(indice + 1);
    }

    document.getElementById("carrosselPrev")
      .addEventListener("click", function () { irPara(indice - 1); reiniciar(); });
    document.getElementById("carrosselNext")
      .addEventListener("click", function () { irPara(indice + 1); reiniciar(); });

    // Teclado: setas esquerda/direita quando o carrossel está em foco.
    carrossel.setAttribute("tabindex", "0");
    carrossel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); irPara(indice - 1); reiniciar(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); irPara(indice + 1); reiniciar(); }
    });

    // Toque: arrastar para o lado troca de foto.
    var x0 = null;
    carrossel.addEventListener("touchstart", function (e) {
      x0 = e.touches[0].clientX;
    }, { passive: true });
    carrossel.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { irPara(indice + (dx < 0 ? 1 : -1)); reiniciar(); }
      x0 = null;
    });

    // Autoplay (pausa no hover, no foco e com a aba oculta).
    var intervalo = parseInt(carrossel.getAttribute("data-autoplay"), 10) || 0;
    var timer = null;
    function tocando() {
      return intervalo > 0 && !reduzido &&
        !carrossel.matches(":hover") && !carrossel.contains(document.activeElement) &&
        !document.hidden;
    }
    function iniciar() {
      if (timer || !tocando()) return;
      timer = setInterval(function () {
        if (tocando()) irPara(indice + 1); else parar();
      }, intervalo);
    }
    function parar() { if (timer) { clearInterval(timer); timer = null; } }
    function reiniciar() { parar(); iniciar(); }

    ["mouseenter", "focusin"].forEach(function (ev) {
      carrossel.addEventListener(ev, parar);
    });
    ["mouseleave", "focusout"].forEach(function (ev) {
      carrossel.addEventListener(ev, iniciar);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) parar(); else iniciar();
    });

    irPara(0);
    iniciar();
  }

  /* =============================================================
     Formulário de cadastro → Google Sheets (Apps Script)
     Guia completo em docs/INTEGRACAO-FORMULARIO.md.
     Enquanto CADASTRO_ENDPOINT estiver vazio, o formulário funciona
     em modo demonstração (valida e confirma, sem enviar dados).
     ============================================================= */
  var CADASTRO_ENDPOINT = "https://script.google.com/macros/s/AKfycbyhj3B2E1Knj_J2QcEpQptJtbvKOkzcct8wUTQu153SB81UYnbf5tTaIB19kccKk0FY/exec";

  var form = document.getElementById("formCadastro");
  if (form) {
    var botao = form.querySelector('button[type="submit"]');
    var textoBotaoOriginal = botao ? botao.textContent : "";
    var status = document.getElementById("formStatus");

    function mostrarStatus(mensagem, tipo) {
      if (!status) {
        if (tipo === "erro") alert(mensagem);
        return;
      }
      status.textContent = mensagem;
      status.className = "form-status form-status--" + tipo;
      status.hidden = false;
    }

    function travarBotao(travado, texto) {
      if (!botao) return;
      botao.disabled = travado;
      botao.textContent = travado ? texto : textoBotaoOriginal;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Anti-spam: se o honeypot estiver preenchido, é um bot. Ignora em silêncio.
      var honeypot = form.querySelector('[name="website"]');
      if (honeypot && honeypot.value.trim() !== "") return;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (!CADASTRO_ENDPOINT) {
        mostrarStatus(
          "Cadastro recebido! Em breve a equipe entra em contato. ♥ " +
            "(modo demonstração — configure o envio em js/landing.js)",
          "ok"
        );
        form.reset();
        return;
      }

      var dados = new FormData(form);
      dados.delete("website"); // não envia o honeypot

      // Envia como application/x-www-form-urlencoded: o Apps Script (e.parameter)
      // não parseia multipart/form-data de forma confiável (embaralha os campos).
      var corpo = new URLSearchParams();
      dados.forEach(function (valor, chave) { corpo.append(chave, valor); });

      travarBotao(true, "Enviando…");
      mostrarStatus("Enviando seu cadastro…", "info");

      fetch(CADASTRO_ENDPOINT, { method: "POST", body: corpo })
        .then(function (resposta) {
          if (!resposta.ok) throw new Error("HTTP " + resposta.status);
          mostrarStatus(
            "Cadastro enviado com sucesso! Em breve a equipe entra em contato. ♥",
            "ok"
          );
          form.reset();
        })
        .catch(function () {
          mostrarStatus(
            "Não foi possível enviar agora. Confira sua conexão e tente novamente em instantes.",
            "erro"
          );
        })
        .finally(function () {
          travarBotao(false);
        });
    });
  }
})();
