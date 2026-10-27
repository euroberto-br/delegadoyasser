/* =============================================================
   Consentimento de cookies (LGPD — Lei nº 13.709/2018, art. 7º, I e art. 8º)
   =============================================================
   Google Analytics e Microsoft Clarity só são carregados DEPOIS que a pessoa
   clica em "Aceitar". Sem escolha, com "Recusar" ou com o localStorage
   bloqueado, nenhum script de estatística sai do navegador (fail-closed).

   - A escolha fica no localStorage ("consentimento-cookies"), com versão e
     data, como registro do consentimento (art. 8º, § 2º).
   - Qualquer elemento com [data-preferencias-cookies] reabre o aviso. O
     rodapé de todas as páginas tem um, porque revogar precisa ser tão fácil
     quanto aceitar (art. 8º, § 5º).
   - Quem revoga tem os cookies _ga, _clck e _clsk apagados e a página é
     recarregada, já que um script carregado não tem como ser descarregado.
     Com a escolha "recusar", cada página varre de novo o que tiver sobrado.
   - O aviso é montado aqui mesmo, para não repetir o HTML em cada página.
     Estilos em css/landing.css ("Aviso de cookies").

   Suba VERSAO quando mudar o que é coletado: todo mundo é perguntado de novo.
   ============================================================= */
(function () {
  "use strict";

  var CHAVE = "consentimento-cookies";
  var VERSAO = 1;
  var GA_ID = "G-BKFLZQW72Y";
  var CLARITY_ID = "xltc65hll6";
  var COOKIES_ESTATISTICA = /^(_ga|_gid|_gat|_clck|_clsk)/;

  // Vale para a página atual quando o navegador bloqueia o localStorage.
  var escolhaEmMemoria = null;
  var estatisticasCarregadas = false;

  function lerEscolha() {
    try {
      var e = JSON.parse(localStorage.getItem(CHAVE));
      if (e && e.versao === VERSAO && typeof e.estatisticas === "boolean") return e;
    } catch (err) {}
    return escolhaEmMemoria;
  }

  function salvarEscolha(estatisticas) {
    escolhaEmMemoria = { versao: VERSAO, estatisticas: estatisticas, data: new Date().toISOString() };
    try { localStorage.setItem(CHAVE, JSON.stringify(escolhaEmMemoria)); } catch (err) {}
  }

  function injetarScript(src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function carregarEstatisticas() {
    if (estatisticasCarregadas) return;
    estatisticasCarregadas = true;

    // Google Analytics 4 em Consent Mode v2: só medição; publicidade sempre negada.
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    injetarScript("https://www.googletagmanager.com/gtag/js?id=" + GA_ID);

    // Microsoft Clarity — a fila guarda as chamadas até o script chegar.
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    injetarScript("https://www.clarity.ms/tag/" + CLARITY_ID);
  }

  // Os cookies do GA ficam no domínio raiz (.delegadoyasser.com.br); tenta
  // apagar em cada nível do host, que é o único jeito de acertar o domínio.
  function apagarCookiesEstatisticas() {
    var partes = location.hostname.split(".");
    var dominios = [""];
    for (var i = 0; i < partes.length - 1; i++) {
      var d = partes.slice(i).join(".");
      dominios.push("; domain=" + d, "; domain=." + d);
    }
    document.cookie.split(";").forEach(function (par) {
      var nome = par.split("=")[0].trim();
      if (!COOKIES_ESTATISTICA.test(nome)) return;
      dominios.forEach(function (dom) {
        document.cookie = nome + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + dom;
      });
    });
  }

  /* ---------- Aviso ---------- */
  var aviso = null;
  var origemFoco = null;

  function fecharAviso() {
    if (aviso) { aviso.remove(); aviso = null; }
    if (origemFoco) { origemFoco.focus(); origemFoco = null; }
  }

  function escolher(aceitou) {
    var antes = lerEscolha();
    salvarEscolha(aceitou);
    fecharAviso();
    if (aceitou) {
      carregarEstatisticas();
    } else if (estatisticasCarregadas || (antes && antes.estatisticas)) {
      // Sem isso o GA regrava o _ga_<id> no pagehide, logo depois da limpeza.
      if (window.gtag) window.gtag("consent", "update", { analytics_storage: "denied" });
      if (window.clarity) window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
      apagarCookiesEstatisticas();
      location.reload();
    }
  }

  function abrirAviso(gatilho) {
    if (aviso) { aviso.querySelector("h2").focus(); return; }

    var atual = lerEscolha();
    var situacao = atual
      ? '<p class="cookies__atual">Sua escolha atual: estatísticas <strong>' +
        (atual.estatisticas ? "aceitas" : "recusadas") + "</strong>.</p>"
      : "";

    aviso = document.createElement("section");
    aviso.className = "cookies";
    aviso.setAttribute("aria-labelledby", "cookiesTitulo");
    aviso.innerHTML =
      '<h2 class="cookies__titulo" id="cookiesTitulo" tabindex="-1">Cookies e privacidade</h2>' +
      "<p>Usamos cookies de estatística (Google Analytics e Microsoft Clarity) para entender " +
      "como o site é usado e melhorá-lo. Eles só são ativados se você aceitar. " +
      '<a href="politica-de-privacidade.html#cookies">Política de Privacidade</a>.</p>' +
      situacao +
      '<div class="cookies__acoes">' +
      '<button type="button" class="btn" data-cookies="recusar">Recusar</button>' +
      '<button type="button" class="btn" data-cookies="aceitar">Aceitar</button>' +
      "</div>";

    aviso.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-cookies]");
      if (b) escolher(b.getAttribute("data-cookies") === "aceitar");
    });
    // Esc só fecha quem já escolheu antes: sem escolha, o aviso precisa de resposta.
    if (atual) {
      aviso.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") fecharAviso();
      });
    }

    // Logo depois do "Pular para o conteúdo", para ser alcançado cedo pelo teclado.
    var pular = document.querySelector(".skip-link");
    document.body.insertBefore(aviso, pular ? pular.nextSibling : document.body.firstChild);

    // Aberto pelo rodapé: leva o foco ao aviso e devolve ao fechar. Na primeira
    // visita o aviso não rouba o foco — ele não bloqueia o resto da página.
    if (gatilho) {
      origemFoco = gatilho;
      aviso.querySelector("h2").focus();
    }
  }

  document.addEventListener("click", function (ev) {
    var gatilho = ev.target.closest("[data-preferencias-cookies]");
    if (gatilho) { ev.preventDefault(); abrirAviso(gatilho); }
  });

  var escolha = lerEscolha();
  if (escolha && escolha.estatisticas) {
    carregarEstatisticas();
  } else if (escolha) {
    // Recusou: varre a cada página o que tiver sobrado de um aceite antigo.
    apagarCookiesEstatisticas();
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { abrirAviso(null); });
    } else {
      abrirAviso(null);
    }
  }
})();
