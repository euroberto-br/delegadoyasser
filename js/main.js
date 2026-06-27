/* =============================================================
   Delegado Yasser Yassine — Goiás sem Medo
   Scripts da página (vanilla JS, sem dependências)
   ============================================================= */

(function () {
  "use strict";

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

    // Fecha o menu ao clicar em qualquer link
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", fecharMenu);
    });

    // Fecha ao redimensionar para desktop
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

  /* ---------- Seletor de cor (pré-visualização) ----------
     Troca o tema da marca aplicando data-theme em <html>.
     A escolha é lembrada via localStorage. */
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
    // Sincroniza o estado ativo com o tema já salvo (aplicado no <head>).
    var salvo;
    try { salvo = localStorage.getItem("tema-cor"); } catch (e) {}
    if (salvo) aplicarTema(salvo);
  }

  /* =============================================================
     Formulário de cadastro → Google Sheets (Apps Script)
     -------------------------------------------------------------
     Os dados são enviados para uma planilha do Google por meio de
     um Web App do Google Apps Script.

     COMO ATIVAR (passo a passo completo em docs/INTEGRACAO-FORMULARIO.md):
       1. Crie uma planilha no Google Sheets.
       2. Extensões ▸ Apps Script e cole o código do guia.
       3. Implantar ▸ Nova implantação ▸ App da Web
          (Executar como: você · Acesso: qualquer pessoa).
       4. Copie a URL terminada em "/exec" e cole abaixo.

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

      // Validação nativa do navegador (campos required, e-mail, etc.)
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Sem endpoint configurado → modo demonstração.
      if (!CADASTRO_ENDPOINT) {
        mostrarStatus(
          "Cadastro recebido! Em breve a equipe entra em contato. 💜 " +
            "(modo demonstração — configure o envio em js/main.js)",
          "ok"
        );
        form.reset();
        return;
      }

      var dados = new FormData(form);
      dados.delete("website"); // não envia o honeypot

      travarBotao(true, "Enviando…");
      mostrarStatus("Enviando seu cadastro…", "info");

      // FormData dispara uma "requisição simples" (sem preflight CORS),
      // que é o formato aceito pelos Web Apps do Apps Script.
      fetch(CADASTRO_ENDPOINT, { method: "POST", body: dados })
        .then(function (resposta) {
          if (!resposta.ok) throw new Error("HTTP " + resposta.status);
          mostrarStatus(
            "Cadastro enviado com sucesso! Em breve a equipe entra em contato. 💜",
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
