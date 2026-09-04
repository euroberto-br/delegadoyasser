/* =============================================================
   Leve na urna · 13007
   Transforma a folha da seção #leve-na-urna em imagem para salvar
   e compartilhar, e manda a versão de papel para a impressora.
   =============================================================

   O que existe aqui, e por quê
   ----------------------------
   A folha impressa é HTML puro (ver .lnu__peca em index.html e o bloco
   @media print de css/landing.css). Este arquivo não desenha nada na
   tela: ele existe para as duas coisas que o HTML não faz sozinho —

     1. redesenhar a mesma folha num <canvas> fora da página, nos
        formatos quadrado e story, para virar arquivo de imagem que
        entra na galeria do celular e no status do WhatsApp;
     2. guardar o número de deputado federal que a pessoa anotou, para
        ele voltar na próxima visita e aparecer na imagem e no papel.

   Nada é enviado para lugar nenhum: o canvas é montado no aparelho de
   quem acessa e o número anotado fica só no localStorage do navegador.

   Se os números mudarem, mude em DOIS lugares: a lista CARGOS abaixo e
   as linhas .lnu__linha do HTML. São a mesma informação em duas mídias,
   e o site não tem etapa de build para gerar uma a partir da outra.
   ============================================================= */

(function () {
  "use strict";

  var raiz = document.getElementById("leveNaUrna");
  if (!raiz) return;

  var ENDERECO = "https://delegadoyasser.com.br/#leve-na-urna";
  var CHAVE_FEDERAL = "leve-na-urna-federal";

  /* A ordem é a da urna, não a da importância. */
  var CARGOS = [
    { ordem: "1", cargo: ["Deputado", "Federal"],  casas: 4, numero: null,
      quem: "Voto livre", nota: "anote o seu candidato" },
    { ordem: "2", cargo: ["Deputado", "Estadual"], casas: 5, numero: "13007",
      quem: "Delegado Yasser", nota: "PT · Goiás Seguro para Todos", destaque: true },
    { ordem: "3", cargo: ["Senador", "1º voto"],   casas: 3, numero: "500",
      quem: "Cíntia Dias", nota: "Supl.: Fernando Isaac e Paulo Rochitld" },
    { ordem: "4", cargo: ["Senador", "2º voto"],   casas: 3, numero: "400",
      quem: "Isaura Lemos", nota: "" },
    { ordem: "5", cargo: ["Governador"],           casas: 2, numero: "13",
      quem: "Luís Cesar Bueno", nota: "Vice: Carlos Mundim" },
    { ordem: "6", cargo: ["Presidente"],           casas: 2, numero: "13",
      quem: "Lula", nota: "Vice: Geraldo Alckmin" }
  ];

  /* O mesmo texto do rodapé do site, quebrado à mão: o canvas não quebra
     linha sozinho e estas quatro linhas cabem na largura do rodapé. */
  var LEGAL = [
    "ELEIÇÃO 2026 · YASSER MARTINS YASSINE · DEPUTADO ESTADUAL",
    "COLIGAÇÃO GOIÁS PODE MAIS",
    "FEDERAÇÃO BRASIL DA ESPERANÇA (PT / PCdoB / PV) · FEDERAÇÃO PSOL-REDE (PSOL / REDE)",
    "PSB · PDT · CNPJ 68.454.985/0001-69"
  ];

  var COR = {
    papel:   "#ffffff",
    papel2:  "#f4ece4",
    tinta:   "#181114",
    tinta70: "#4a3f43",
    brand:   "#f9120c",
    brandEscuro: "#a10c08",
    brandSuave:  "#fde6e5",
    amarelo: "#f6d30b",
    verde:   "#2bba29",
    azul:    "#293ecf",
    creme:   "#cbbfba",
    rosaClaro: "#f7d9d7"
  };

  /* A largura é 1080 nos dois formatos, então a composição horizontal é a
     mesma: só a altura das faixas muda. `escala` dá ao story um corpo maior
     para o conteúdo, aproveitando a sobra de altura sem estourar a largura. */
  var FORMATOS = {
    quadrado: { largura: 1080, altura: 1080, escala: 1.00,
                faixa: 14, cabeca: 152, grito: 176, rodape: 186 },
    story:    { largura: 1080, altura: 1920, escala: 1.18,
                faixa: 18, cabeca: 300, grito: 340, rodape: 250 }
  };

  /* Medidas horizontais, em pixels de um canvas de 1080 de largura. */
  var ARTE = {
    margem: 52,
    badge: 42,
    cargoCol: 200,   // largura total do bloco "nº da ordem + nome do cargo"
    casa: 56,
    casaDestaque: 66,
    gapCasa: 9,
    gapCol: 20
  };

  var estado = { formato: "quadrado", federal: "" };

  /* =============================================================
     Peças da página
     ============================================================= */

  var campoFederal = document.getElementById("lnuFederal");
  var caixaFormatos = document.getElementById("lnuFormatos");
  var btnBaixar = document.getElementById("lnuBaixar");
  var btnImprimir = document.getElementById("lnuImprimir");
  var btnCompartilhar = document.getElementById("lnuCompartilhar");
  var btnZap = document.getElementById("lnuZap");
  var painelEstado = document.getElementById("lnuEstado");

  function avisar(texto) {
    if (painelEstado) painelEstado.textContent = texto || "";
  }

  /* =============================================================
     O número do deputado federal
     =============================================================
     É o único campo em branco da peça oficial. Quem já escolheu anota
     aqui e leva junto; quem não escolheu imprime as casas vazias e
     escreve à caneta. Fica no localStorage porque a pessoa costuma
     voltar ao site mais de uma vez antes do dia da votação. */

  function lerFederalSalvo() {
    try { return (localStorage.getItem(CHAVE_FEDERAL) || "").replace(/\D/g, "").slice(0, 4); }
    catch (e) { return ""; }
  }

  function guardarFederal(valor) {
    try {
      if (valor) localStorage.setItem(CHAVE_FEDERAL, valor);
      else localStorage.removeItem(CHAVE_FEDERAL);
    } catch (e) { /* navegação anônima, cota cheia: só não guarda */ }
  }

  if (campoFederal) {
    estado.federal = lerFederalSalvo();
    campoFederal.value = estado.federal;

    campoFederal.addEventListener("input", function () {
      var limpo = campoFederal.value.replace(/\D/g, "").slice(0, 4);
      if (limpo !== campoFederal.value) campoFederal.value = limpo;
      estado.federal = limpo;
      guardarFederal(limpo);
    });
  }

  /* =============================================================
     Desenho no canvas
     ============================================================= */

  var tela = document.createElement("canvas");
  var ctx = tela.getContext("2d");

  /* letterSpacing no canvas é recente (Chrome 99, Safari 17.4, Firefox 122).
     Onde não existe, o texto sai sem o espaçamento — muda o acabamento, não
     a legibilidade. */
  var TEM_ESPACAMENTO = typeof ctx.letterSpacing === "string";

  function usarFonte(peso, tamanho, familia, espacamento) {
    ctx.font = peso + " " + Math.round(tamanho) + 'px "' + familia + '", sans-serif';
    if (TEM_ESPACAMENTO) ctx.letterSpacing = espacamento || "0px";
  }

  /* Largura de um texto num corpo qualquer, sem deixar a fonte escolhida
     valendo para o desenho seguinte. */
  function medir(texto, peso, tamanho, familia, espacamento) {
    usarFonte(peso, tamanho, familia, espacamento);
    return ctx.measureText(texto).width;
  }

  /* Diminui o corpo até o texto caber na largura pedida. */
  function ajustarFonte(texto, familia, peso, tamanhoInicial, larguraMax, espacamento) {
    var tamanho = Math.round(tamanhoInicial);
    usarFonte(peso, tamanho, familia, espacamento);
    while (ctx.measureText(texto).width > larguraMax && tamanho > 7) {
      tamanho -= 1;
      usarFonte(peso, tamanho, familia, espacamento);
    }
    return tamanho;
  }

  /* roundRect só chegou aos navegadores em 2022/2023; onde não existe, a
     tecla sai de canto vivo. */
  function tecla(x, y, larg, alt, raio, preenchimento, traco, espessura, tracejado) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, larg, alt, raio);
    else ctx.rect(x, y, larg, alt);
    if (preenchimento) { ctx.fillStyle = preenchimento; ctx.fill(); }
    if (traco) {
      ctx.save();
      ctx.lineWidth = espessura || 3;
      ctx.strokeStyle = traco;
      if (tracejado && ctx.setLineDash) ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* As fontes do site precisam estar carregadas antes do primeiro desenho: o
     canvas não espera pelo @font-face e cairia na fonte do sistema. */
  function fontesProntas() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 120px "Oswald"'),
      document.fonts.load('500 40px "Oswald"'),
      document.fonts.load('600 24px "IBM Plex Mono"'),
      document.fonts.load('800 34px "Archivo"')
    ]).catch(function () { /* sem as fontes o desenho segue com as reservas */ });
  }

  var qrPronto = null;
  function qrProntoPromise() {
    if (qrPronto) return qrPronto;
    qrPronto = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };   // sem QR a peça sai igual
      img.src = "images/qr-leve-na-urna.png";
    });
    return qrPronto;
  }

  function faixaDeCores(W, alt) {
    var cores = [COR.azul, COR.verde, COR.amarelo, COR.brand, COR.azul, COR.verde];
    var larg = W / cores.length;
    for (var i = 0; i < cores.length; i++) {
      ctx.fillStyle = cores[i];
      ctx.fillRect(Math.floor(i * larg), 0, Math.ceil(larg) + 1, alt);
    }
  }

  function cabecalho(W, y, alt) {
    var meio = W / 2;
    ctx.textAlign = "center";

    ctx.fillStyle = COR.tinta70;
    ajustarFonte("ELEIÇÕES 2026 · GOIÁS · 4 DE OUTUBRO", "IBM Plex Mono", "600",
                 alt * 0.135, W * 0.8, Math.round(alt * 0.02) + "px");
    ctx.textBaseline = "top";
    ctx.fillText("ELEIÇÕES 2026 · GOIÁS · 4 DE OUTUBRO", meio, y + alt * 0.13);

    ctx.fillStyle = COR.tinta;
    ajustarFonte("MEU VOTO", "Oswald", "700", alt * 0.56, W * 0.82);
    ctx.textBaseline = "alphabetic";
    ctx.fillText("MEU VOTO", meio, y + alt * 0.78);

    ctx.fillStyle = COR.tinta70;
    ajustarFonte("NA ORDEM EM QUE A URNA PERGUNTA", "IBM Plex Mono", "600",
                 alt * 0.115, W * 0.8, Math.round(alt * 0.018) + "px");
    ctx.textBaseline = "top";
    ctx.fillText("NA ORDEM EM QUE A URNA PERGUNTA", meio, y + alt * 0.84);

    if (TEM_ESPACAMENTO) ctx.letterSpacing = "0px";
  }

  function linhaCargo(dados, W, y, alt, esc) {
    var M = ARTE.margem;
    var destaque = !!dados.destaque;
    var casaL = (destaque ? ARTE.casaDestaque : ARTE.casa) * esc;
    var casaA = casaL * 1.2;
    var badge = ARTE.badge * esc;
    var cargoCol = ARTE.cargoCol * esc;
    var gapCasa = ARTE.gapCasa * esc;
    var meioY = y + alt / 2;

    var corTexto = destaque ? COR.papel : COR.tinta;
    var corApoio = destaque ? COR.rosaClaro : COR.tinta70;

    if (destaque) {
      ctx.fillStyle = COR.brandEscuro;
      ctx.fillRect(0, y, W, alt);
    }

    /* Tarja de cor à esquerda (na linha do 13007 ela é amarela). Larga o
       bastante para sobrar depois da moldura de 6 px que fecha a folha —
       com 8 px ela virava um fiapo de cor na borda. */
    ctx.fillStyle = destaque ? COR.amarelo : corDaLinha(dados);
    ctx.fillRect(0, y, 20, alt);

    // separador entre as linhas
    ctx.fillStyle = destaque ? COR.brandEscuro : "rgba(24,17,20,0.18)";
    ctx.fillRect(0, y + alt - 1, W, 1);

    // ---- número da ordem
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    tecla(M, meioY - badge / 2, badge, badge, 2,
          destaque ? COR.amarelo : COR.tinta, COR.tinta, 3);
    ctx.fillStyle = destaque ? COR.tinta : COR.papel;
    usarFonte("600", badge * 0.5, "IBM Plex Mono");
    ctx.fillText(dados.ordem, M + badge / 2, meioY + 1);

    // ---- nome do cargo (uma ou duas linhas)
    var xCargo = M + badge + 12 * esc;
    var largCargo = cargoCol - badge - 12 * esc;
    ctx.textAlign = "left";
    ctx.fillStyle = corTexto;
    var linhas = dados.cargo;
    var corpoCargo = Math.round(28 * esc);
    for (var i = 0; i < linhas.length; i++) {
      var texto = linhas[i].toUpperCase();
      // a segunda linha de "Senador" é o rótulo do voto, e vai menor
      var ehRotulo = linhas.length === 2 && i === 1 && /VOTO/.test(texto);
      if (ehRotulo) {
        ctx.fillStyle = corApoio;
        ajustarFonte(texto, "IBM Plex Mono", "600", corpoCargo * 0.6, largCargo);
      } else {
        ctx.fillStyle = corTexto;
        ajustarFonte(texto, "Oswald", "500", corpoCargo, largCargo);
      }
      var deslocamento = linhas.length === 1
        ? 0
        : (i === 0 ? -corpoCargo * 0.58 : corpoCargo * 0.58);
      ctx.fillText(texto, xCargo, meioY + deslocamento);
    }

    // ---- as casas de dígito
    var xCasas = M + cargoCol + ARTE.gapCol * esc;
    var digitos = dados.numero ? dados.numero.split("") : null;
    var yCasa = meioY - casaA / 2;

    for (var c = 0; c < dados.casas; c++) {
      var xc = xCasas + c * (casaL + gapCasa);
      if (digitos) {
        tecla(xc, yCasa, casaL, casaA, 10,
              destaque ? COR.amarelo : COR.brandSuave, COR.tinta, 3);
        ctx.fillStyle = COR.tinta;
        usarFonte("700", casaA * 0.66, "Oswald");
        ctx.textAlign = "center";
        ctx.fillText(digitos[c], xc + casaL / 2, meioY + casaA * 0.03);
      } else {
        // deputado federal: casa em branco, tracejada, com o que a pessoa anotou
        tecla(xc, yCasa, casaL, casaA, 10, COR.papel, COR.tinta, 3, true);
        if (estado.federal.charAt(c)) {
          ctx.fillStyle = COR.tinta;
          usarFonte("700", casaA * 0.6, "Oswald");
          ctx.textAlign = "center";
          ctx.fillText(estado.federal.charAt(c), xc + casaL / 2, meioY + casaA * 0.03);
        }
      }
    }

    // ---- nome de quem recebe o voto
    var xQuem = xCasas + dados.casas * casaL + (dados.casas - 1) * gapCasa + ARTE.gapCol * esc;
    var largQuem = W - ARTE.margem - xQuem;
    ctx.textAlign = "left";
    var temNota = !!dados.nota;

    ctx.fillStyle = corTexto;
    ajustarFonte(dados.quem, "Archivo", "800",
                 (destaque ? 34 : 29) * esc, largQuem);
    ctx.fillText(dados.quem, xQuem, meioY + (temNota ? -9 * esc : 0));

    if (temNota) {
      ctx.fillStyle = corApoio;
      ajustarFonte(dados.nota, "Archivo", "400", 17 * esc, largQuem);
      ctx.fillText(dados.nota, xQuem, meioY + 20 * esc);
    }
  }

  function corDaLinha(dados) {
    switch (dados.ordem) {
      case "1": return COR.tinta70;
      case "3": return COR.azul;
      case "4": return COR.verde;
      case "5": return COR.amarelo;
      default:  return COR.brand;
    }
  }

  /* A tarja preta com o 13007 do tamanho que a folha aguenta. */
  function grito(W, y, alt) {
    ctx.fillStyle = COR.tinta;
    ctx.fillRect(0, y, W, alt);

    var NUM = "13007";
    var meioY = y + alt / 2;
    var corpoNum = alt * 0.74;
    var corpoNome = alt * 0.21;
    var corpoCargo = alt * 0.095;
    var espacoNome = Math.round(alt * 0.008) + "px";
    var espacoCargo = Math.round(alt * 0.02) + "px";

    var largNum = medir(NUM, "700", corpoNum, "Oswald");
    var largNome = Math.max(
      medir("DELEGADO YASSER", "500", corpoNome, "Oswald", espacoNome),
      medir("DEPUTADO ESTADUAL", "600", corpoCargo, "IBM Plex Mono", espacoCargo)
    );

    /* No story a tarja tem quase o dobro da altura, e o 13007 no corpo cheio
       passa da margem — foi o que aconteceu na primeira versão, com o nome
       saindo cortado na borda direita. Encolhe os dois blocos juntos até
       caberem. É um laço, e não uma conta só, porque o espaçamento entre
       letras é fixo em pixels e não diminui junto com o corpo da fonte. */
    var vao = alt * 0.16;
    var limite = W - ARTE.margem * 2;
    var total = largNum + vao + largNome;
    var voltas = 0;
    while (total > limite && voltas < 12) {
      var k = Math.min(0.97, limite / total);
      corpoNum *= k;
      corpoNome *= k;
      corpoCargo *= k;
      largNum = medir(NUM, "700", corpoNum, "Oswald");
      largNome = Math.max(
        medir("DELEGADO YASSER", "500", corpoNome, "Oswald", espacoNome),
        medir("DEPUTADO ESTADUAL", "600", corpoCargo, "IBM Plex Mono", espacoCargo)
      );
      total = largNum + vao + largNome;
      voltas++;
    }
    var x = Math.max(ARTE.margem, (W - total) / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillStyle = COR.amarelo;
    usarFonte("700", corpoNum, "Oswald");
    ctx.fillText(NUM, x, meioY + alt * 0.02);

    var xNome = x + largNum + vao;
    ctx.fillStyle = COR.papel;
    usarFonte("500", corpoNome, "Oswald", espacoNome);
    ctx.fillText("DELEGADO YASSER", xNome, meioY - alt * 0.09);
    ctx.fillStyle = COR.creme;
    usarFonte("600", corpoCargo, "IBM Plex Mono", espacoCargo);
    ctx.fillText("DEPUTADO ESTADUAL", xNome, meioY + alt * 0.13);

    if (TEM_ESPACAMENTO) ctx.letterSpacing = "0px";
  }

  function rodape(W, y, alt, qr) {
    ctx.fillStyle = COR.papel2;
    ctx.fillRect(0, y, W, alt);
    ctx.fillStyle = "rgba(24,17,20,0.2)";
    ctx.fillRect(0, y, W, 2);

    var pad = alt * 0.13;
    var lado = alt - pad * 2;
    var x = ARTE.margem;

    if (qr) {
      ctx.fillStyle = COR.papel;
      ctx.fillRect(x, y + pad, lado, lado);
      ctx.drawImage(qr, x, y + pad, lado, lado);
      ctx.lineWidth = 3;
      ctx.strokeStyle = COR.tinta;
      ctx.strokeRect(x + 1.5, y + pad + 1.5, lado - 3, lado - 3);
      x += lado + alt * 0.14;
    }

    var largTexto = W - ARTE.margem - x;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = COR.tinta;
    var corpoSite = ajustarFonte("DELEGADOYASSER.COM.BR", "Oswald", "500",
                                 alt * 0.17, largTexto, "1px");
    ctx.fillText("DELEGADOYASSER.COM.BR", x, y + pad);

    /* Um corpo só para as quatro linhas: o que couber na mais longa vale
       para todas. Ajustar linha a linha deixava a terceira visivelmente
       menor que as outras — parecia erro, e não hierarquia. */
    ctx.fillStyle = COR.tinta70;
    var corpoLegal = alt * 0.082;
    for (var i = 0; i < LEGAL.length; i++) {
      corpoLegal = Math.min(corpoLegal,
        ajustarFonte(LEGAL[i], "IBM Plex Mono", "400", corpoLegal, largTexto));
    }
    usarFonte("400", corpoLegal, "IBM Plex Mono");
    var passo = corpoLegal * 1.55;
    var yLegal = y + pad + corpoSite * 1.35;
    for (var j = 0; j < LEGAL.length; j++) {
      ctx.fillText(LEGAL[j], x, yLegal + j * passo);
    }

    if (TEM_ESPACAMENTO) ctx.letterSpacing = "0px";
  }

  function desenhar(qr) {
    var f = FORMATOS[estado.formato];
    var W = f.largura;
    var H = f.altura;

    tela.width = W;
    tela.height = H;

    ctx.fillStyle = COR.papel;
    ctx.fillRect(0, 0, W, H);

    faixaDeCores(W, f.faixa);

    var y = f.faixa;
    cabecalho(W, y, f.cabeca);
    y += f.cabeca;

    var alturaLista = H - f.faixa - f.cabeca - f.grito - f.rodape;
    var alturaLinha = alturaLista / CARGOS.length;

    ctx.fillStyle = COR.tinta;
    ctx.fillRect(0, y, W, 3);

    for (var i = 0; i < CARGOS.length; i++) {
      linhaCargo(CARGOS[i], W, y + i * alturaLinha, alturaLinha, f.escala);
    }
    y += alturaLista;

    grito(W, y, f.grito);
    y += f.grito;

    rodape(W, y, f.rodape, qr);

    // moldura da folha inteira
    ctx.lineWidth = 6;
    ctx.strokeStyle = COR.tinta;
    ctx.strokeRect(3, 3, W - 6, H - 6);
  }

  /* =============================================================
     Saída: baixar, compartilhar, WhatsApp, imprimir
     ============================================================= */

  var montando = false;

  function nomeArquivo() {
    return "leve-na-urna-13007-" + estado.formato + ".png";
  }

  /* PNG, e não JPEG: a folha é tipografia e traço fino sobre fundo chapado,
     onde o JPEG suja as bordas dos dígitos. */
  function gerarBlob() {
    if (montando) return Promise.resolve(null);
    montando = true;
    avisar("Montando a imagem…");
    return Promise.all([fontesProntas(), qrProntoPromise()])
      .then(function (partes) {
        desenhar(partes[1]);
        return new Promise(function (resolve) {
          tela.toBlob(function (blob) { resolve(blob); }, "image/png");
        });
      })
      .then(function (blob) { montando = false; return blob; })
      .catch(function (e) {
        montando = false;
        avisar("Não deu para montar a imagem aqui. Tente imprimir a folha.");
        throw e;
      });
  }

  function baixar() {
    return gerarBlob().then(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      avisar("Imagem salva no seu aparelho. Agora é só mandar para a galera.");
    }).catch(function () { /* o aviso já foi dado */ });
  }

  function compartilhar() {
    gerarBlob().then(function (blob) {
      if (!blob) return;
      var arquivo = new File([blob], nomeArquivo(), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        avisar("");
        navigator.share({
          files: [arquivo],
          text: "Anota aí para o dia 4: Deputado Estadual 13007, Delegado Yasser."
        }).catch(function () { /* cancelar não é erro */ });
      } else {
        baixar();
      }
    }).catch(function () { /* o aviso já foi dado */ });
  }

  /* =============================================================
     Ligações com a página
     ============================================================= */

  if (caixaFormatos) {
    caixaFormatos.addEventListener("click", function (ev) {
      var botao = ev.target.closest ? ev.target.closest(".lnu__formato") : null;
      if (!botao) return;
      estado.formato = botao.getAttribute("data-formato");
      var todos = caixaFormatos.querySelectorAll(".lnu__formato");
      for (var i = 0; i < todos.length; i++) {
        todos[i].setAttribute("aria-pressed", todos[i] === botao ? "true" : "false");
      }
      avisar("");
    });
  }

  if (btnBaixar) btnBaixar.addEventListener("click", baixar);

  if (btnImprimir) {
    btnImprimir.addEventListener("click", function () {
      avisar("Abrindo a impressão. Sai só a folha, em preto e branco.");
      window.print();
    });
  }

  if (btnZap) {
    btnZap.addEventListener("click", function () {
      var msg = "Anota aí para o dia 4 de outubro: Deputado Estadual 13007, " +
                "Delegado Yasser. Presidente 13, Governador 13, Senadores 500 e 400. " +
                "A lista completa para imprimir está em " + ENDERECO;
      window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
    });
  }

  /* O botão de compartilhar só existe onde o navegador sabe enviar arquivos.
     Onde não sabe, ele sairia da tela sem fazer nada de diferente do "baixar". */
  var suportaEnviarArquivo = false;
  try {
    suportaEnviarArquivo = !!(navigator.canShare && navigator.canShare({
      files: [new File([new Blob([""], { type: "image/png" })], "t.png",
                       { type: "image/png" })]
    }));
  } catch (e) { /* navegadores sem File/canShare ficam só com o download */ }

  if (btnCompartilhar) {
    if (suportaEnviarArquivo) btnCompartilhar.addEventListener("click", compartilhar);
    else btnCompartilhar.hidden = true;
  }
})();
