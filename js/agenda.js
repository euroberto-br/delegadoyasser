/* =============================================================
   Delegado Yasser — Solicitar Reunião
   Máscaras (CPF/telefone), validação de CPF e envio da
   solicitação para o Google Sheets via Apps Script.
   Guia completo em docs/SOLICITACAO-AGENDA.md.
   Enquanto AGENDA_ENDPOINT estiver vazio, o formulário funciona
   em modo demonstração (valida e confirma, sem enviar dados).
   ============================================================= */
(function () {
  "use strict";

  var AGENDA_ENDPOINT = "https://script.google.com/macros/s/AKfycbxaOsHpzj3YQItLgLMccBL2iekTVLFnEZpReGYN0OvFDBP7QQkyGprh22_Z2sAxAYeptQ/exec";

  var form = document.getElementById("formAgenda");
  if (!form) return;

  var botao = form.querySelector('button[type="submit"]');
  var textoBotaoOriginal = botao ? botao.textContent : "";
  var status = document.getElementById("formAgendaStatus");

  /* ---------- Máscara e validação de CPF ---------- */
  var campoCpf = document.getElementById("cpf");

  function mascararCpf(valor) {
    var d = valor.replace(/\D/g, "").slice(0, 11);
    if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (d.length > 3) return d.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return d;
  }

  function cpfValido(cpf) {
    var d = cpf.replace(/\D/g, "");
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var i = 0; i < t; i++) soma += Number(d.charAt(i)) * (t + 1 - i);
      var dv = ((soma * 10) % 11) % 10;
      if (dv !== Number(d.charAt(t))) return false;
    }
    return true;
  }

  if (campoCpf) {
    campoCpf.addEventListener("input", function () {
      campoCpf.value = mascararCpf(campoCpf.value);
      // Valida durante a digitação para liberar o campo assim que ficar correto
      campoCpf.setCustomValidity(
        cpfValido(campoCpf.value) ? "" : "Confira o CPF: número inválido."
      );
    });
  }

  /* ---------- Máscara de telefone (fixo e celular) ---------- */
  var campoTelefone = document.getElementById("telefone");

  function mascararTelefone(valor) {
    var d = valor.replace(/\D/g, "").slice(0, 11);
    if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
    if (d.length > 6) return d.replace(/(\d{2})(\d{4})(\d{1,4})/, "($1) $2-$3");
    if (d.length > 2) return d.replace(/(\d{2})(\d{1,5})/, "($1) $2");
    return d;
  }

  if (campoTelefone) {
    campoTelefone.addEventListener("input", function () {
      campoTelefone.value = mascararTelefone(campoTelefone.value);
      var digitos = campoTelefone.value.replace(/\D/g, "");
      campoTelefone.setCustomValidity(
        digitos.length >= 10 ? "" : "Informe o telefone com DDD."
      );
    });
  }

  /* ---------- "Quem participará?" — campo extra quando for "Outro" ---------- */
  var seletorParticipantes = document.getElementById("participantes");
  var campoOutro = document.getElementById("campoParticipantesOutro");
  var inputOutro = document.getElementById("participantesOutro");

  function atualizarCampoOutro() {
    var ehOutro = seletorParticipantes && seletorParticipantes.value === "Outro";
    if (campoOutro) campoOutro.hidden = !ehOutro;
    if (inputOutro) {
      inputOutro.required = ehOutro;
      if (!ehOutro) inputOutro.value = "";
    }
  }

  if (seletorParticipantes) {
    seletorParticipantes.addEventListener("change", atualizarCampoOutro);
  }
  // form.reset() dispara "reset" antes de limpar os valores; espera o ciclo terminar
  form.addEventListener("reset", function () {
    setTimeout(atualizarCampoOutro, 0);
  });

  /* ---------- Data mínima = hoje (fuso local, não UTC) ---------- */
  var campoData = document.getElementById("dataReuniao");
  if (campoData) {
    campoData.min = new Date().toLocaleDateString("en-CA");
  }

  /* ---------- Envio ---------- */
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

    if (!AGENDA_ENDPOINT) {
      mostrarStatus(
        "Solicitação registrada! A equipe analisa a agenda e responde pelo contato informado. ♥ " +
          "(modo demonstração — configure o envio em js/agenda.js)",
        "ok"
      );
      form.reset();
      return;
    }

    var dados = new FormData(form);
    dados.delete("website"); // não envia o honeypot

    // "Outro" + descrição viram um único valor (uma só coluna na planilha)
    var outroDetalhe = String(dados.get("participantes_outro") || "").trim();
    if (dados.get("participantes") === "Outro" && outroDetalhe) {
      dados.set("participantes", "Outro: " + outroDetalhe);
    }
    dados.delete("participantes_outro");

    // Envia como application/x-www-form-urlencoded: o Apps Script (e.parameter)
    // não parseia multipart/form-data de forma confiável (embaralha os campos).
    var corpo = new URLSearchParams();
    dados.forEach(function (valor, chave) { corpo.append(chave, valor); });

    travarBotao(true, "Enviando…");
    mostrarStatus("Enviando sua solicitação…", "info");

    fetch(AGENDA_ENDPOINT, { method: "POST", body: corpo })
      .then(function (resposta) {
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        mostrarStatus(
          "Solicitação enviada! A equipe analisa a agenda e responde pelo contato informado. ♥",
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
})();
