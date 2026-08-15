/* =============================================================
   Delegado Yasser — Termos (Cabo Eleitoral e Voluntário)
   Máscaras (CPF/telefone/CEP), validação de CPF e idade,
   assinatura (desenhada no canvas ou digitada) e envio do termo
   para o Google Apps Script, que gera o PDF no Google Drive.
   Guia completo em docs-privados/docs/TERMOS-CABO-VOLUNTARIO.md.
   Enquanto TERMOS_ENDPOINT estiver vazio, o formulário funciona
   em modo demonstração (valida e confirma, sem enviar dados).
   ============================================================= */
(function () {
  "use strict";

  var TERMOS_ENDPOINT = "https://script.google.com/macros/s/AKfycbx2XNM62e9GMDCOwYBN1z7QSo7XCbgU8XCrAzutit46h2UJ7IzioZCZcmXfhqTikn1q/exec";

  var form = document.getElementById("formTermo");
  if (!form) return;

  var TIPO = form.getAttribute("data-tipo") || "voluntario"; // "cabo" | "voluntario"
  var IDADE_MINIMA = parseInt(form.getAttribute("data-idade-minima"), 10) || 16;

  var botao = form.querySelector('button[type="submit"]');
  var textoBotaoOriginal = botao ? botao.textContent : "";
  var status = document.getElementById("formTermoStatus");

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

  /* ---------- Máscara de CEP ---------- */
  var campoCep = document.getElementById("cep");
  if (campoCep) {
    campoCep.addEventListener("input", function () {
      var d = campoCep.value.replace(/\D/g, "").slice(0, 8);
      campoCep.value = d.length > 5 ? d.replace(/(\d{5})(\d{1,3})/, "$1-$2") : d;
      campoCep.setCustomValidity(d.length === 8 ? "" : "Informe o CEP completo (8 dígitos).");
    });
  }

  /* ---------- Data de nascimento: idade mínima ---------- */
  var campoNascimento = document.getElementById("dataNascimento");

  function calcularIdade(iso) {
    var partes = iso.split("-");
    if (partes.length !== 3) return 0;
    var hoje = new Date();
    var idade = hoje.getFullYear() - Number(partes[0]);
    var mes = Number(partes[1]) - 1;
    var dia = Number(partes[2]);
    if (hoje.getMonth() < mes || (hoje.getMonth() === mes && hoje.getDate() < dia)) idade--;
    return idade;
  }

  if (campoNascimento) {
    // Limita o seletor de datas ao intervalo plausível
    var hoje = new Date();
    var max = new Date(hoje.getFullYear() - IDADE_MINIMA, hoje.getMonth(), hoje.getDate());
    campoNascimento.max = max.toLocaleDateString("en-CA");
    campoNascimento.min = "1920-01-01";
    campoNascimento.addEventListener("change", function () {
      var idade = campoNascimento.value ? calcularIdade(campoNascimento.value) : 0;
      campoNascimento.setCustomValidity(
        idade >= IDADE_MINIMA
          ? ""
          : "É preciso ter pelo menos " + IDADE_MINIMA + " anos."
      );
    });
  }

  /* =============================================================
     Assinatura — dois modos:
     · "desenho": traço livre no canvas (mouse, caneta ou dedo);
     · "digitada": nome digitado, renderizado em itálico no canvas
       (alternativa acessível para quem navega só pelo teclado).
     Nos dois casos o PNG do canvas vai no envio (assinatura_png).
     ============================================================= */
  var canvas = document.getElementById("assinaturaCanvas");
  var padWrap = document.getElementById("assinaturaPad");
  var dicaPad = document.getElementById("assinaturaDica");
  var botaoLimpar = document.getElementById("assinaturaLimpar");
  var campoDigitada = document.getElementById("campoAssinaturaDigitada");
  var inputDigitada = document.getElementById("assinaturaDigitada");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var assinaturaTemTraco = false;

  function modoAssinatura() {
    var marcado = form.querySelector('input[name="assinatura_modo"]:checked');
    return marcado ? marcado.value : "desenho";
  }

  function prepararCanvas() {
    if (!canvas || !ctx) return;
    // Ajusta a resolução interna ao tamanho exibido (nitidez em telas retina)
    var escala = window.devicePixelRatio || 1;
    var largura = canvas.clientWidth || 600;
    var altura = canvas.clientHeight || 180;
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1b1418";
    assinaturaTemTraco = false;
  }

  function limparCanvas() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    assinaturaTemTraco = false;
    if (dicaPad) dicaPad.hidden = false;
  }

  function desenharAssinaturaDigitada(texto) {
    if (!canvas || !ctx) return;
    limparCanvas();
    if (!texto) return;
    var largura = canvas.clientWidth || 600;
    var altura = canvas.clientHeight || 180;
    var tamanho = 34;
    ctx.font = "italic " + tamanho + 'px Georgia, "Times New Roman", serif';
    while (tamanho > 16 && ctx.measureText(texto).width > largura - 40) {
      tamanho -= 2;
      ctx.font = "italic " + tamanho + 'px Georgia, "Times New Roman", serif';
    }
    ctx.fillStyle = "#1b1418";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, largura / 2, altura / 2);
    assinaturaTemTraco = true;
    if (dicaPad) dicaPad.hidden = true;
  }

  /* --- Traço livre com Pointer Events (mouse, toque e caneta) --- */
  var desenhando = false;

  function posicaoNoCanvas(evento) {
    var r = canvas.getBoundingClientRect();
    return { x: evento.clientX - r.left, y: evento.clientY - r.top };
  }

  if (canvas && ctx) {
    prepararCanvas();

    canvas.addEventListener("pointerdown", function (e) {
      if (modoAssinatura() !== "desenho") return;
      desenhando = true;
      canvas.setPointerCapture(e.pointerId);
      var p = posicaoNoCanvas(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // Um toque simples também deixa marca (ponto)
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      assinaturaTemTraco = true;
      if (dicaPad) dicaPad.hidden = true;
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!desenhando) return;
      var p = posicaoNoCanvas(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach(function (nome) {
      canvas.addEventListener(nome, function () { desenhando = false; });
    });

    // Redesenha na resolução certa se a janela mudar de tamanho.
    // O conteúdo é perdido; a assinatura digitada é redesenhada.
    var timerRedimensionar = null;
    window.addEventListener("resize", function () {
      clearTimeout(timerRedimensionar);
      timerRedimensionar = setTimeout(function () {
        prepararCanvas();
        if (modoAssinatura() === "digitada" && inputDigitada) {
          desenharAssinaturaDigitada(inputDigitada.value.trim());
        } else {
          limparCanvas();
        }
      }, 200);
    });
  }

  if (botaoLimpar) {
    botaoLimpar.addEventListener("click", function () {
      limparCanvas();
      if (inputDigitada && modoAssinatura() === "digitada") {
        inputDigitada.value = "";
        inputDigitada.focus();
      }
    });
  }

  /* --- Alternância entre os modos --- */
  function aplicarModoAssinatura() {
    var digitada = modoAssinatura() === "digitada";
    if (campoDigitada) campoDigitada.hidden = !digitada;
    if (inputDigitada) inputDigitada.required = digitada;
    if (padWrap) padWrap.classList.toggle("assinatura-pad--digitada", digitada);
    limparCanvas();
    if (digitada && inputDigitada) {
      desenharAssinaturaDigitada(inputDigitada.value.trim());
    }
  }

  form.querySelectorAll('input[name="assinatura_modo"]').forEach(function (radio) {
    radio.addEventListener("change", aplicarModoAssinatura);
  });
  aplicarModoAssinatura();

  if (inputDigitada) {
    inputDigitada.addEventListener("input", function () {
      desenharAssinaturaDigitada(inputDigitada.value.trim());
    });
  }

  form.addEventListener("reset", function () {
    setTimeout(function () {
      aplicarModoAssinatura();
      limparCanvas();
    }, 0);
  });

  /* ---------- Status e botão ---------- */
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

  /* ---------- Envio ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Anti-spam: se o honeypot estiver preenchido, é um bot. Ignora em silêncio.
    var honeypot = form.querySelector('[name="website"]');
    if (honeypot && honeypot.value.trim() !== "") return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!assinaturaTemTraco) {
      mostrarStatus(
        modoAssinatura() === "digitada"
          ? "Digite seu nome no campo de assinatura para assinar o termo."
          : "Assine no quadro acima (com o dedo, caneta ou mouse) antes de enviar.",
        "erro"
      );
      if (canvas) canvas.focus();
      return;
    }

    if (!TERMOS_ENDPOINT) {
      mostrarStatus(
        "Termo validado! (modo demonstração — configure o envio em js/termos.js " +
          "seguindo o guia TERMOS-CABO-VOLUNTARIO.md)",
        "ok"
      );
      return;
    }

    var dados = new FormData(form);
    dados.delete("website"); // não envia o honeypot
    dados.set("tipo", TIPO);
    dados.set("assinatura_png", canvas ? canvas.toDataURL("image/png") : "");
    // Dimensões exibidas do canvas: o Apps Script usa a proporção para
    // inserir a assinatura no PDF sem distorcer
    dados.set("assinatura_largura", canvas ? String(canvas.clientWidth || 600) : "600");
    dados.set("assinatura_altura", canvas ? String(canvas.clientHeight || 180) : "180");

    // Envia como application/x-www-form-urlencoded: o Apps Script (e.parameter)
    // não parseia multipart/form-data de forma confiável (embaralha os campos).
    var corpo = new URLSearchParams();
    dados.forEach(function (valor, chave) { corpo.append(chave, valor); });

    travarBotao(true, "Enviando…");
    mostrarStatus("Enviando o termo assinado…", "info");

    fetch(TERMOS_ENDPOINT, { method: "POST", body: corpo })
      .then(function (resposta) {
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        return resposta.json().catch(function () { return { ok: true }; });
      })
      .then(function (retorno) {
        if (retorno && retorno.ok === false) {
          throw new Error(retorno.erro || "erro no servidor");
        }
        mostrarStatus(
          "Termo enviado com sucesso! Agora ele passa pela aprovação da coordenação " +
            "da campanha, que confere os dados e encaminha o documento final para " +
            "você pelo WhatsApp ou e-mail informado. ♥",
          "ok"
        );
        form.reset();
        limparCanvas();
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
