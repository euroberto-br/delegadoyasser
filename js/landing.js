/* =============================================================
   Delegado Yasser — Brasil sem Medo
   Scripts da landing (vanilla JS, sem dependências)
   ============================================================= */

(function () {
  "use strict";

  // Sinaliza que há JS: os efeitos .reveal só escondem conteúdo com esta classe.
  document.documentElement.classList.add("js");

  /* ---------- Menu mobile ---------- */
  var toggle = document.getElementById("menuToggle");
  var links = document.getElementById("navLinks");

  if (toggle && links) {
    function fecharMenu() {
      links.classList.remove("aberto");
      toggle.textContent = "☰";
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var aberto = links.classList.toggle("aberto");
      toggle.textContent = aberto ? "✕" : "☰";
      toggle.setAttribute("aria-expanded", String(aberto));
    });

    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", fecharMenu);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 980) fecharMenu();
    });
  }

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
     Agenda dinâmica ← planilha Google publicada como CSV
     -------------------------------------------------------------
     A equipe edita uma planilha e o site atualiza sozinho.
     Guia passo a passo em docs/AGENDA-DINAMICA.md.

     Colunas esperadas (1ª linha = cabeçalho, em qualquer ordem):
       data (DD/MM/AAAA) · hora · titulo · cidade · local · tipo · link(opcional)

     Enquanto AGENDA_CSV_URL estiver vazia, a seção exibe o aviso
     "em breve" escrito no HTML.
     ============================================================= */
  var AGENDA_CSV_URL = ""; // ex.: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv"

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
    if (ev.link) {
      var a = document.createElement("a");
      a.href = ev.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = ev.titulo;
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

  if (AGENDA_CSV_URL && listaAgenda) {
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
        if (agendaNota) agendaNota.textContent = "Agenda atualizada pela equipe da campanha.";
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
  var NOTICIAS_CSV_URL = ""; // ex.: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv"

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
      nt.fotos.forEach(function (url) {
        var img = document.createElement("img");
        img.src = url;
        img.alt = nt.titulo;
        img.loading = "lazy";
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

    if (nt.link) {
      var fonte = document.createElement("p");
      var a = document.createElement("a");
      a.href = nt.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Ler na íntegra";
      fonte.appendChild(a);
      inner.appendChild(fonte);
    }

    modalNoticia.appendChild(inner);
    modalNoticia.showModal();
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
      mais.addEventListener("click", function () { abrirModalNoticia(nt); });
      corpo.appendChild(mais);
    } else if (nt.link) {
      var a2 = document.createElement("a");
      a2.className = "noticia__mais";
      a2.href = nt.link;
      a2.target = "_blank";
      a2.rel = "noopener";
      a2.textContent = "Ler mais";
      corpo.appendChild(a2);
    }

    art.appendChild(corpo);
    return art;
  }

  if (NOTICIAS_CSV_URL && listaNoticias) {
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
              fotos: col(l, "fotos").split("|").map(function (u) { return u.trim(); }).filter(Boolean),
              link: col(l, "link")
            };
          })
          .filter(function (nt) { return nt && nt.titulo; })
          .sort(function (a, b) { return b.data - a.data; }) // mais recente primeiro
          .slice(0, 9);

        if (!noticias.length) return;

        listaNoticias.innerHTML = "";
        noticias.forEach(function (nt) { listaNoticias.appendChild(montarNoticia(nt)); });
        if (noticiasNota) noticiasNota.textContent = "Últimas notícias publicadas pela equipe da campanha.";
      })
      .catch(function () { /* falhou → mantém o aviso do HTML */ });
  }

  /* =============================================================
     Formulário de cadastro → Google Sheets (Apps Script)
     Guia completo em docs/INTEGRACAO-FORMULARIO.md.
     Enquanto CADASTRO_ENDPOINT estiver vazio, o formulário funciona
     em modo demonstração (valida e confirma, sem enviar dados).
     ============================================================= */
  var CADASTRO_ENDPOINT = ""; // ex.: "https://script.google.com/macros/s/AKfyc.../exec"

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

      travarBotao(true, "Enviando…");
      mostrarStatus("Enviando seu cadastro…", "info");

      fetch(CADASTRO_ENDPOINT, { method: "POST", body: dados })
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
