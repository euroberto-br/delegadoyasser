/* =============================================================
   Foto com o Delegado Yasser · 13007
   Monta um cartaz com a foto de quem visita ao lado do candidato.
   =============================================================

   Tudo roda no aparelho de quem acessa. A foto enviada nunca sai do
   navegador: não há upload, não há servidor, não há armazenamento. O
   recorte usa o modelo Selfie Segmentation (MediaPipe, Apache 2.0)
   servido pelo próprio domínio em models/segmentacao/, executado pelo
   TensorFlow.js que está em js/vendor/tfjs/.

   O tamanho do rosto sai do BlazeFace (também Apache 2.0), em
   models/rosto/.

   Peso: os ~1,1 MB do TensorFlow.js e os ~790 KB dos dois modelos só são
   baixados quando alguém escolhe uma foto — quem passa pela seção sem
   usar não paga nada por ela.

   Como pessoa e Yasser acabam do mesmo tamanho
   --------------------------------------------
   O rosto das duas é medido, não deduzido. O detector devolve a caixa do
   rosto, e o recorte é montado em múltiplos dela: 0,70 caixa acima do
   alto do rosto e 3,28 abaixo, o que termina na altura do quadril. Os
   seis recortes do Yasser foram medidos com esse mesmo detector, então
   basta desenhar os dois com a mesma altura para os rostos baterem —
   venha a foto de perto, de longe ou de corpo inteiro.

   A primeira versão adivinhava o rosto pela silhueta, procurando onde o
   contorno estreitava para achar o queixo. Funcionava nas fotos de
   estúdio usadas em teste e errava em quase tudo que chegava de verdade:
   cabelo comprido, boné, mão perto do rosto, corpo inteiro.
   ============================================================= */

(function () {
  "use strict";

  var raiz = document.getElementById("fotoComYasser");
  if (!raiz) return;

  var POSES = [
    { id: "bone-pt",       rotulo: "De boné do PT",
      alt: "de terno preto e boné vermelho com a estrela do PT" },
    { id: "camiseta-lula", rotulo: "Camiseta do Lula",
      alt: "de camiseta vermelha do Lula" },
    { id: "camisa-branca", rotulo: "De camisa branca",
      alt: "de camisa branca com as mangas dobradas" },
    { id: "terno",         rotulo: "De terno",
      alt: "de terno preto e camisa branca" },
    { id: "selecao",       rotulo: "Camisa do Brasil",
      alt: "de camisa da seleção brasileira" },
    { id: "kufiya",        rotulo: "Com o kufiya",
      alt: "de terno preto com o kufiya palestino na cabeça" }
  ];

  var FORMATOS = {
    quadrado: { largura: 1080, altura: 1080, rotulo: "Quadrado" },
    story:    { largura: 1080, altura: 1920, rotulo: "Story" },
    retrato:  { largura: 1080, altura: 1350, rotulo: "Retrato" }
  };

  /* Enquadramento padrão, em múltiplos da caixa do rosto devolvida pelo
     detector. Os dois primeiros valores saíram de medir os seis recortes do
     Yasser com o mesmo detector: nele, o rosto começa a 0,175 da altura do
     arquivo e a caixa mede 0,251 — ou seja, 0,70 caixa acima do alto do rosto
     e 3,28 abaixo. Reexportar os recortes com outro enquadramento exige
     remedi-los e atualizar estes números. */
  var ROSTO_ACIMA = 0.70;
  var ROSTO_ABAIXO = 3.28;
  var FOLGA_LADO = 0.06;

  /* Corte da máscara de segmentação. Antes a rampa começava em 0,40, e num
     fundo cheio isso deixava passar retalhos de céu e de parede em volta da
     pessoa; subir o piso resolve a maior parte, e o resto cai no filtro que
     mantém só o corpo ligado ao rosto. */
  var LIMIAR_MASCARA = 0.5;
  var RAMPA_INI = 0.5;
  var RAMPA_FIM = 0.78;

  /* Cores tiradas por amostragem do material oficial da campanha
     (Yasser/Recorte/Base.jpeg) — batem com os tokens do landing.css. */
  var VERMELHO = "#f7130a";
  var AZUL = "#293dd0";
  var VERDE = "#2fba29";
  var AMARELO = "#f5d302";
  var TINTA = "#181114";
  var PAPEL = "#fcf9f5";

  var CARGO = "DEPUTADO ESTADUAL";
  var NOME_TOPO = "DELEGADO";
  var NOME_BASE = "YASSER";
  var NUMERO = "13007";
  var SLOGAN = "Goiás seguro para todos";
  var SITE = "delegadoyasser.com.br";
  var INSTAGRAM = "@delegadoyasser";
  /* Identificação obrigatória da propaganda eleitoral. Vai na lateral da arte,
     em vertical e quase transparente: precisa acompanhar a peça onde quer que
     ela seja compartilhada, sem disputar espaço com a foto. */
  var LEGAL = "ELEIÇÃO 2026 · YASSER MARTINS YASSINE · DEPUTADO ESTADUAL · " +
              "FEDERAÇÃO BRASIL DA ESPERANÇA (PT, PCdoB, PV) · " +
              "CNPJ 68.454.985/0001-69";

  var CAMINHO_POSES = "images/foto-com-yasser/";
  var CAMINHO_TFJS = "js/vendor/tfjs/";
  var CAMINHO_MODELO = "models/segmentacao/model.json";
  var CAMINHO_ROSTO = "models/rosto/model.json";

  /* ---------- Elementos ---------- */
  var entradaFoto = document.getElementById("fcyArquivo");
  var listaPoses = document.getElementById("fcyPoses");
  var listaFormatos = document.getElementById("fcyFormatos");
  var campoNome = document.getElementById("fcyNome");
  var campoCidade = document.getElementById("fcyCidade");
  var tela = document.getElementById("fcyTela");
  var estadoTexto = document.getElementById("fcyEstado");
  var painelAcoes = document.getElementById("fcyAcoes");
  var btnBaixar = document.getElementById("fcyBaixar");
  var btnCompartilhar = document.getElementById("fcyCompartilhar");
  var btnZap = document.getElementById("fcyZap");
  var btnTrocar = document.getElementById("fcyTrocar");
  var vazio = document.getElementById("fcyVazio");

  var ctx = tela.getContext("2d");

  var estado = {
    pose: POSES[0].id,
    formato: "quadrado",
    pessoa: null,     // canvas já enquadrado no padrão
    ocupado: false
  };

  var imagensPose = {};
  var modelo = null;
  var detectorRosto = null;
  var tfPronto = null;

  /* =============================================================
     Utilidades
     ============================================================= */

  function avisar(texto) {
    estadoTexto.textContent = texto;
  }

  function carregarScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    });
  }

  function carregarImagem(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Falha ao carregar " + src)); };
      img.src = src;
    });
  }

  function imagemDaPose(id) {
    if (!imagensPose[id]) {
      imagensPose[id] = carregarImagem(CAMINHO_POSES + "yasser-" + id + ".webp");
    }
    return imagensPose[id];
  }

  function poseAtual() {
    for (var i = 0; i < POSES.length; i++) {
      if (POSES[i].id === estado.pose) return POSES[i];
    }
    return POSES[0];
  }

  /* As fontes do site precisam estar carregadas antes do primeiro desenho: o
     canvas não espera pelo @font-face e cairia na fonte do sistema. */
  function fontesProntas() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 100px "Oswald"'),
      document.fonts.load('400 60px "Caveat Brush"'),
      document.fonts.load('500 30px "IBM Plex Mono"'),
      document.fonts.load('800 40px "Archivo"')
    ]).catch(function () { /* sem as fontes o desenho segue com as reservas */ });
  }

  /* =============================================================
     Recorte da pessoa
     ============================================================= */

  function prepararModelos() {
    if (tfPronto) return tfPronto;
    tfPronto = carregarScript(CAMINHO_TFJS + "tf-core.min.js")
      .then(function () {
        return Promise.all([
          carregarScript(CAMINHO_TFJS + "tf-converter.min.js"),
          carregarScript(CAMINHO_TFJS + "tf-backend-webgl.min.js")
        ]);
      })
      .then(function () {
        return carregarScript(CAMINHO_TFJS + "blazeface.min.umd.js");
      })
      .then(function () {
        return window.tf.setBackend("webgl").catch(function () { return false; });
      })
      .then(function (ok) {
        // Aparelho sem WebGL utilizável: o backend de CPU resolve, mais devagar.
        if (ok === false || window.tf.getBackend() !== "webgl") {
          return carregarScript(CAMINHO_TFJS + "tf-backend-cpu.min.js")
            .then(function () { return window.tf.setBackend("cpu"); });
        }
      })
      .then(function () { return window.tf.ready(); })
      .then(function () {
        return Promise.all([
          window.tf.loadGraphModel(CAMINHO_MODELO),
          window.blazeface.load({ modelUrl: CAMINHO_ROSTO, maxFaces: 5 })
        ]);
      })
      .then(function (m) { modelo = m[0]; detectorRosto = m[1]; });
    return tfPronto;
  }

  /* O modelo recebe 256x256 em [0,1] e devolve 256x256x2; o canal 1 é a
     probabilidade de o pixel ser pessoa (é assim que o grafo original do
     MediaPipe lê a saída).

     Tudo em API funcional (tf.cast, tf.div…) e não encadeada: os pacotes
     avulsos do TensorFlow.js não registram os métodos de tensor — quem faz
     isso é o pacote guarda-chuva @tensorflow/tfjs, que traria junto o
     tfjs-layers, grande e sem uso aqui. */
  function calcularMascara(imagem) {
    var tf = window.tf;
    return tf.tidy(function () {
      var pixels = tf.expandDims(
        tf.div(tf.cast(tf.browser.fromPixels(imagem), "float32"), 255), 0);
      var entrada = tf.image.resizeBilinear(pixels, [256, 256]);
      var saida = modelo.predict(entrada);
      var pessoa = tf.slice(saida, [0, 0, 0, 1], [1, 256, 256, 1]);
      return tf.squeeze(
        tf.image.resizeBilinear(pessoa, [imagem.height, imagem.width]));
    });
  }

  /* Caixa do maior rosto da foto, ou null.

     Medir o rosto de verdade substituiu a leitura da silhueta que havia aqui
     antes — aquela procurava onde o contorno "estreitava" para adivinhar o
     queixo, e errava em tudo que fugisse de um retrato de estúdio: cabelo
     comprido, boné, mão perto do rosto, foto de corpo inteiro. O tamanho do
     rosto é o que precisa bater entre as duas pessoas da montagem, então
     agora ele é medido, e não deduzido.

     Pega o maior rosto de propósito: em foto com mais gente, quem enviou
     costuma ser quem está mais perto da câmera — e numa camiseta estampada
     com um rosto, o estampado é sempre menor que o de quem a veste. */
  function acharRosto(imagem) {
    return detectorRosto.estimateFaces(imagem, false).then(function (caras) {
      if (!caras || !caras.length) return null;
      var melhor = null, maior = 0;
      for (var i = 0; i < caras.length; i++) {
        var alt = caras[i].bottomRight[1] - caras[i].topLeft[1];
        if (alt > maior) { maior = alt; melhor = caras[i]; }
      }
      if (!melhor || maior < 12) return null;
      return {
        topo: melhor.topLeft[1],
        altura: maior,
        centroX: (melhor.topLeft[0] + melhor.bottomRight[0]) / 2
      };
    });
  }

  /* Apaga tudo que não faz parte do corpo de quem está na foto.

     O modelo de segmentação é leve e, em fundo cheio — rua, interior de
     carro —, deixa manchas soltas com probabilidade alta. Sem esta limpeza
     elas chegavam à arte como retalhos de céu e de parede em volta da
     pessoa. Aqui só sobrevive o pedaço ligado ao rosto detectado. */
  function manterCorpoDoRosto(dados, largura, altura, xRosto, yRosto) {
    var dentro = new Uint8Array(dados.length);
    var i;
    for (i = 0; i < dados.length; i++) {
      if (dados[i] > LIMIAR_MASCARA) dentro[i] = 1;
    }

    var partida = Math.round(yRosto) * largura + Math.round(xRosto);
    if (!dentro[partida]) {
      // O centro do rosto pode cair num furo da máscara (óculos, boné): procura
      // o pixel de corpo mais próximo numa espiral curta.
      var achou = -1;
      for (var r = 4; r < Math.max(largura, altura) && achou < 0; r += 4) {
        for (var a = 0; a < 16 && achou < 0; a++) {
          var ang = a * Math.PI / 8;
          var px = Math.round(xRosto + Math.cos(ang) * r);
          var py = Math.round(yRosto + Math.sin(ang) * r);
          if (px >= 0 && px < largura && py >= 0 && py < altura &&
              dentro[py * largura + px]) {
            achou = py * largura + px;
          }
        }
      }
      if (achou < 0) return null;
      partida = achou;
    }

    // Preenchimento em largura a partir do rosto; fila em Int32Array porque
    // um array comum com milhões de posições engasga em celular.
    var fila = new Int32Array(dados.length);
    var ini = 0, fim = 0;
    var corpo = new Uint8Array(dados.length);
    fila[fim++] = partida;
    corpo[partida] = 1;
    while (ini < fim) {
      var p = fila[ini++];
      var x = p % largura, y = (p - x) / largura;
      if (x > 0 && dentro[p - 1] && !corpo[p - 1]) { corpo[p - 1] = 1; fila[fim++] = p - 1; }
      if (x < largura - 1 && dentro[p + 1] && !corpo[p + 1]) { corpo[p + 1] = 1; fila[fim++] = p + 1; }
      if (y > 0 && dentro[p - largura] && !corpo[p - largura]) { corpo[p - largura] = 1; fila[fim++] = p - largura; }
      if (y < altura - 1 && dentro[p + largura] && !corpo[p + largura]) { corpo[p + largura] = 1; fila[fim++] = p + largura; }
    }
    return corpo;
  }

  /* Aplica a máscara sobre a foto e devolve um canvas RGBA.
     A transição usa uma rampa em vez de um corte seco: borda dura entrega
     serrilhado, e o recorte de um modelo leve nunca é bom o bastante para
     aguentar corte seco. */
  function aplicarMascara(imagem, dados, corpo) {
    var lona = document.createElement("canvas");
    lona.width = imagem.width;
    lona.height = imagem.height;
    var c = lona.getContext("2d");
    c.drawImage(imagem, 0, 0);

    var quadro = c.getImageData(0, 0, lona.width, lona.height);
    var px = quadro.data;
    for (var i = 0; i < dados.length; i++) {
      var a = corpo[i] ? (dados[i] - RAMPA_INI) / (RAMPA_FIM - RAMPA_INI) : 0;
      px[i * 4 + 3] = Math.round((a < 0 ? 0 : (a > 1 ? 1 : a)) * 255);
    }
    c.putImageData(quadro, 0, 0);
    return lona;
  }

  /* Recorta a pessoa no mesmo enquadramento dos recortes do Yasser, contado
     em múltiplos da caixa do rosto: ROSTO_ACIMA para cima do alto da caixa e
     ROSTO_ABAIXO para baixo. Os dois valores vieram de medir os seis recortes
     do Yasser com este mesmo detector, então desenhar os dois com a mesma
     altura basta para os rostos saírem do mesmo tamanho.

     Quando a foto não tem corpo até onde o enquadramento pede, o recorte
     termina onde a pessoa termina e `fator` registra que fração da altura
     padrão foi possível. */
  function enquadrarPorRosto(lona, rosto) {
    var alturaPadrao = (ROSTO_ACIMA + ROSTO_ABAIXO) * rosto.altura;
    var topo = Math.round(rosto.topo - ROSTO_ACIMA * rosto.altura);
    var baseIdeal = Math.round(rosto.topo + ROSTO_ABAIXO * rosto.altura);

    var yIni = Math.max(0, topo);
    var yFim = Math.min(lona.height, baseIdeal);
    if (yFim - yIni < 8) return null;

    var quadro = lona.getContext("2d")
      .getImageData(0, yIni, lona.width, yFim - yIni);
    var px = quadro.data;
    var esquerda = lona.width, direita = 0, ultima = yIni;
    for (var l = 0; l < yFim - yIni; l++) {
      var temLinha = false;
      for (var x = 0; x < lona.width; x++) {
        if (px[(l * lona.width + x) * 4 + 3] > 128) {
          if (x < esquerda) esquerda = x;
          if (x > direita) direita = x;
          temLinha = true;
        }
      }
      if (temLinha) ultima = yIni + l;
    }
    if (direita <= esquerda) return null;

    var base = Math.min(baseIdeal, ultima + 2);
    var altura = base - topo;
    if (altura < 8) return null;

    var folga = Math.round((direita - esquerda) * FOLGA_LADO);
    var x0 = esquerda - folga;

    var saida = document.createElement("canvas");
    saida.width = Math.max(1, (direita + folga) - x0);
    saida.height = altura;
    var s = saida.getContext("2d");
    // Fora dos limites da foto o canvas fica transparente, e é o que se quer:
    // uma selfie de busto não inventa um tronco que não foi fotografado.
    s.drawImage(lona, -x0, -topo);

    /* Corpo interrompido antes da hora terminaria num corte reto no meio do
       cartaz. Um esmaecimento longo transforma o corte em acabamento. */
    var fator = altura / alturaPadrao;
    if (fator < 0.98) {
      var alturaFade = Math.max(8, Math.round(altura * 0.20));
      var fade = s.createLinearGradient(0, altura - alturaFade, 0, altura);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,1)");
      s.globalCompositeOperation = "destination-out";
      s.fillStyle = fade;
      s.fillRect(0, altura - alturaFade, saida.width, alturaFade);
      s.globalCompositeOperation = "source-over";
    }

    return { canvas: saida, fator: fator };
  }

  function processarFoto(arquivo) {
    if (estado.ocupado) return;
    estado.ocupado = true;
    vazio.hidden = true;
    raiz.classList.add("fcy--carregando");
    avisar("Preparando o recorte. Isso leva alguns segundos na primeira vez.");

    var url = URL.createObjectURL(arquivo);
    carregarImagem(url)
      .then(function (original) {
        // 1024 px no maior lado: o modelo trabalha em 256 px de qualquer forma,
        // e segurar um JPEG de 12 MP na memória derruba celular modesto.
        var escala = Math.min(1, 1024 / Math.max(original.width, original.height));
        var lona = document.createElement("canvas");
        lona.width = Math.round(original.width * escala);
        lona.height = Math.round(original.height * escala);
        lona.getContext("2d").drawImage(original, 0, 0, lona.width, lona.height);
        URL.revokeObjectURL(url);

        avisar("Procurando seu rosto na foto…");
        return prepararModelos().then(function () { return lona; });
      })
      .then(function (lona) {
        return acharRosto(lona).then(function (rosto) {
          if (!rosto) throw new Error("sem-rosto");
          avisar("Recortando você da foto…");
          var mascara = calcularMascara(lona);
          return mascara.data().then(function (dados) {
            mascara.dispose();
            var corpo = manterCorpoDoRosto(dados, lona.width, lona.height,
                                           rosto.centroX,
                                           rosto.topo + rosto.altura * 0.6);
            if (!corpo) throw new Error("sem-pessoa");
            var enquadrada = enquadrarPorRosto(
              aplicarMascara(lona, dados, corpo), rosto);
            if (!enquadrada) throw new Error("sem-pessoa");
            estado.pessoa = enquadrada;
            if (window.FCY_DEBUG && window.console) {
              console.log("[fcy] rosto", JSON.stringify(rosto), "fator",
                          enquadrada.fator.toFixed(3), "recorte",
                          enquadrada.canvas.width + "x" + enquadrada.canvas.height,
                          "foto", lona.width + "x" + lona.height);
            }
          });
        });
      })
      .then(function () { return desenhar(); })
      .then(function () {
        painelAcoes.hidden = false;
        // No celular os quatro passos empurram a montagem para baixo da
        // dobra: sem isto, quem escolhe a foto não vê o resultado aparecer.
        if (tela.scrollIntoView) {
          var suave = !(window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
          tela.scrollIntoView({ block: "center",
                                behavior: suave ? "smooth" : "auto" });
        }
        if (estado.pessoa.fator < 0.5) {
          avisar("Pronto! A sua foto está bem fechada no rosto — se quiser, " +
                 "tente outra que mostre os ombros: a montagem fica mais " +
                 "parecida com uma foto dos dois juntos.");
        } else {
          avisar("Pronto! Sua montagem com o Delegado Yasser está abaixo.");
        }
      })
      .catch(function (erro) {
        if (window.console && console.warn) console.warn("[fcy]", erro);
        vazio.hidden = false;
        if (erro && erro.message === "sem-rosto") {
          avisar("Não encontrei um rosto nessa foto. Tente uma em que o rosto " +
                 "apareça de frente, com boa luz e sem óculos escuros.");
        } else if (erro && erro.message === "sem-pessoa") {
          avisar("Não consegui recortar você dessa foto. Tente outra, de " +
                 "preferência com o fundo mais limpo.");
        } else {
          avisar("Não foi possível montar a foto. Verifique sua conexão e tente " +
                 "de novo.");
        }
      })
      .then(function () {
        estado.ocupado = false;
        raiz.classList.remove("fcy--carregando");
      });
  }

  /* =============================================================
     Desenho do cartaz
     ============================================================= */

  /* letterSpacing no canvas é recente (Chrome 99, Safari 17.4, Firefox 122).
     Onde não existe, o texto sai sem o espaçamento — muda o acabamento, não
     a legibilidade. */
  var TEM_ESPACAMENTO = typeof ctx.letterSpacing === "string";

  function usarFonte(peso, tamanho, familia, espacamento) {
    ctx.font = peso + " " + tamanho + 'px "' + familia + '", sans-serif';
    if (TEM_ESPACAMENTO) ctx.letterSpacing = espacamento || "0px";
  }

  /* Diminui o corpo da fonte até o texto caber na largura pedida. */
  function ajustarFonte(texto, familia, peso, tamanhoInicial, larguraMax, espacamento) {
    var tamanho = Math.round(tamanhoInicial);
    usarFonte(peso, tamanho, familia, espacamento);
    while (ctx.measureText(texto).width > larguraMax && tamanho > 8) {
      tamanho -= 1;
      usarFonte(peso, tamanho, familia, espacamento);
    }
    return tamanho;
  }

  /* As três camadas de cor que ficam atrás da figura na arte da campanha:
     azul por fora, verde no meio, amarelo por dentro.

     Cada camada tem seu próprio quadrilátero, com os quatro cantos fora de
     esquadro e nenhum lado paralelo ao vizinho — é o que dá o aspecto de
     papel recortado e colado do material oficial. Retângulos concêntricos,
     que foi a primeira tentativa, saíam com cara de moldura de apresentação.
     Os vértices são fixos, e não sorteados: a mesma montagem tem de sair
     igual toda vez que for gerada. */
  var CAMADAS = [
    { cor: "azul",    pts: [[0.02, 0.05], [0.97, 0.00], [1.00, 0.94], [0.00, 1.00]] },
    { cor: "verde",   pts: [[0.10, 0.13], [0.90, 0.09], [0.94, 0.99], [0.06, 0.95]] },
    { cor: "amarelo", pts: [[0.19, 0.24], [0.79, 0.19], [0.85, 1.00], [0.15, 0.92]] }
  ];

  function camadasAtras(cx, base, larg, alt) {
    var cores = { azul: AZUL, verde: VERDE, amarelo: AMARELO };
    var x0 = cx - larg / 2;
    var y0 = base - alt;
    for (var i = 0; i < CAMADAS.length; i++) {
      var c = CAMADAS[i];
      ctx.fillStyle = cores[c.cor];
      ctx.beginPath();
      for (var p = 0; p < c.pts.length; p++) {
        var px = x0 + larg * c.pts[p][0];
        var py = y0 + alt * c.pts[p][1];
        ctx[p ? "lineTo" : "moveTo"](px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  /* Estrela de cinco pontas, o símbolo que acompanha o cargo na arte. */
  function estrela(cx, cy, raio, cor) {
    ctx.save();
    ctx.fillStyle = cor;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? raio * 0.42 : raio;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function assinatura() {
    var nome = (campoNome.value || "").trim();
    var cidade = (campoCidade.value || "").trim();
    if (!nome && !cidade) return null;
    return { nome: nome, cidade: cidade };
  }

  /* Rubrica: o traço que se dá embaixo do nome. Duas curvas em vez de uma
     linha reta — reta parece sublinhado de editor de texto, não caneta. */
  function rubrica(x, y, largura, cor) {
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(2, largura * 0.012);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + largura * 0.28, y + largura * 0.055,
                      x + largura * 0.62, y - largura * 0.045,
                      x + largura * 0.88, y + largura * 0.012);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + largura * 0.74, y + largura * 0.05);
    ctx.quadraticCurveTo(x + largura * 0.92, y + largura * 0.03,
                         x + largura * 1.0, y - largura * 0.03);
    ctx.stroke();
    ctx.restore();
  }

  function desenhar() {
    var formato = FORMATOS[estado.formato];
    var W = formato.largura;
    var H = formato.altura;
    var ehStory = estado.formato === "story";
    tela.width = W;
    tela.height = H;

    var pose = poseAtual();

    return Promise.all([fontesProntas(), imagemDaPose(pose.id)])
      .then(function (r) {
        var imgYasser = r[1];

        ctx.clearRect(0, 0, W, H);
        ctx.textBaseline = "alphabetic";
        if (TEM_ESPACAMENTO) ctx.letterSpacing = "0px";

        var margem = W * 0.062;

        /* --- Fundo ---------------------------------------------------------- */
        ctx.fillStyle = VERMELHO;
        ctx.fillRect(0, 0, W, H);

        /* --- Bloco de identificação: medidas ---------------------------------
           As proporções vêm de medição direta da arte oficial de dobradinha
           (Yasser/Recorte/Base2.jpeg, 896x1280), em múltiplos da largura:
           tarja azul 0,042 de altura, bloco verde 0,203, bloco amarelo 0,220,
           lema 0,050, e a pilha inteira com 0,50 de largura.

           A escala varia por formato porque a peça original é 0,70 de
           proporção. No quadrado, manter a pilha no tamanho original comeria
           metade do cartaz e o topo dela bateria no queixo das duas pessoas. */
        var escalaBloco = ehStory ? 1.12 : (H > W ? 0.90 : 0.76);
        var largBloco = W * (ehStory ? 0.62 : 0.50) * (ehStory ? 1 : escalaBloco / 0.9);
        var altCargo = W * 0.042 * escalaBloco;
        var altVerde = W * 0.203 * escalaBloco;
        var altAmarelo = W * 0.220 * escalaBloco;
        var altLema = W * 0.050 * escalaBloco;
        var altBloco = altCargo + altVerde + altAmarelo + altLema;

        var xBloco = W * (ehStory ? 0.13 : 0.24);
        var yBloco = H - altBloco - H * 0.012;

        /* --- Figuras ---------------------------------------------------------
           Yasser à esquerda e a pessoa à direita, no lugar que na arte de
           dobradinha é do Lula. Os dois sobem até quase o topo e descem
           sangrando pela base — é assim na peça original, e é o que mantém os
           rostos bem acima do bloco.

           No story a dupla se apoia dentro do bloco em vez de sangrar: num
           quadro tão alto ela não cresce o bastante para chegar à base, e o
           pé dos recortes terminaria à vista no meio da arte. */
        var pessoa = estado.pessoa;
        var ATRAS = 0.94;          // o Yasser fica meio passo atrás

        /* O cartaz é dividido em duas faixas fixas: o Yasser mora na esquerda
           e quem enviou a foto, na direita. Antes as duas dividiam um espaço
           calculado a partir das proporções dos recortes, e o layout mudava a
           cada foto — uma selfie larga empurrava o Yasser para fora, uma foto
           estreita deixava um vão no meio. Com faixa fixa, a arte sai igual
           independentemente do que chega. */
        var centroYasser = W * 0.28;
        var centroPessoa = W * 0.72;
        var LARG_FAIXA = W * 0.60;   // passa um pouco da metade: as duas se tocam

        var propYasser = imgYasser.naturalWidth / imgYasser.naturalHeight;
        var largPorAltura = pessoa
          ? (pessoa.canvas.width / pessoa.canvas.height) * pessoa.fator : 0;

        var topoFiguras, altura;
        if (ehStory) {
          topoFiguras = H * 0.12;
          altura = (yBloco + altCargo + altVerde * 0.5) - topoFiguras;
        } else {
          topoFiguras = H * (estado.formato === "retrato" ? 0.10 : 0.045);
          altura = H * (estado.formato === "retrato" ? 0.86 : 0.95) - topoFiguras;
        }
        // Nenhuma das duas passa da própria faixa.
        altura = Math.min(altura, LARG_FAIXA / (propYasser * ATRAS));
        if (largPorAltura > 0) {
          altura = Math.min(altura, LARG_FAIXA / largPorAltura);
        }

        var altYasser = altura * ATRAS;
        var largYasser = altYasser * propYasser;
        var altPessoa = pessoa ? altura * pessoa.fator : 0;
        var largPessoa = altura * largPorAltura;

        /* Alinhadas pelo topo, e não pela base: como os dois recortes têm o
           mesmo enquadramento em relação ao rosto, topos iguais são rostos
           iguais. Alinhar pela base deixava o rosto de quem mandou foto de
           busto mais baixo que o do Yasser. */
        var xYasser = centroYasser - largYasser / 2;
        var xPessoa = centroPessoa - largPessoa / 2;
        var yYasser = topoFiguras + (altura - altYasser);
        var yPessoa = topoFiguras;

        /* Foto sem corpo até o quadril termina antes do rodapé, e o
           esmaecimento ficava à vista no meio do cartaz. Desce a pessoa o
           necessário para o pé sumir atrás do bloco — no máximo um pouco,
           porque o que não pode é o rosto dela descolar do rosto do Yasser. */
        if (pessoa && pessoa.fator < 0.98) {
          var faltaCobrir = yBloco - (yPessoa + altPessoa);
          if (faltaCobrir > 0) {
            yPessoa += Math.min(faltaCobrir, altura * 0.24);
          }
        }

        /* --- Camadas de cor atrás da dupla ------------------------------------ */
        /* As camadas param na altura do peito. Descendo mais, o esmaecimento
           da base de quem mandou foto sem corpo caía em cima do verde e do
           amarelo e virava um borrão colorido; terminando aqui, ele dissolve
           no vermelho liso do fundo. */
        camadasAtras(W * 0.5, topoFiguras + altura * 0.50, W * 0.54, altura * 0.48);

        /* --- Dupla ------------------------------------------------------------ */
        function comSombra(desenhaFn) {
          ctx.save();
          ctx.shadowColor = "rgba(20,10,8,0.35)";
          ctx.shadowBlur = W * 0.035;
          ctx.shadowOffsetX = W * 0.004;
          ctx.shadowOffsetY = W * 0.010;
          desenhaFn();
          ctx.restore();
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.clip();
        comSombra(function () {
          ctx.drawImage(imgYasser, xYasser, yYasser, largYasser, altYasser);
        });
        if (pessoa) {
          comSombra(function () {
            ctx.drawImage(pessoa.canvas, xPessoa, yPessoa, largPessoa, altPessoa);
          });
        }
        ctx.restore();

        /* --- Bloco de identificação ------------------------------------------- */
        var padBloco = W * 0.020 * escalaBloco;
        var y = yBloco;

        // Tarja azul do cargo, mais estreita que o bloco, com a estrela na ponta.
        var tamCargo = Math.round(altCargo * 0.62);
        var largCargo = largBloco * 0.52;
        ctx.fillStyle = AZUL;
        ctx.fillRect(xBloco - padBloco * 0.8, y, largCargo, altCargo);
        usarFonte("800", tamCargo, "Archivo", Math.round(W * 0.001) + "px");
        var tamCargoFinal = ajustarFonte(CARGO, "Archivo", "800", tamCargo,
                                         largCargo - padBloco * 2.2);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText(CARGO, xBloco, y + altCargo * 0.72);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(xBloco - padBloco * 0.8 + largCargo, y + altCargo * 0.5,
                altCargo * 0.6, 0, Math.PI * 2);
        ctx.fill();
        estrela(xBloco - padBloco * 0.8 + largCargo, y + altCargo * 0.5,
                altCargo * 0.4, VERMELHO);
        y += altCargo;

        // Bloco verde: DELEGADO pequeno em cima, YASSER gigante embaixo.
        ctx.fillStyle = VERDE;
        ctx.fillRect(xBloco, y, largBloco, altVerde);
        var tamDelegado = Math.round(altVerde * 0.22);
        usarFonte("500", tamDelegado, "Oswald", Math.round(W * 0.003) + "px");
        ctx.fillStyle = "#ffffff";
        ctx.fillText(NOME_TOPO, xBloco + padBloco, y + altVerde * 0.26);
        var tamNome = ajustarFonte(NOME_BASE, "Oswald", "700", altVerde * 0.86,
                                   largBloco - padBloco * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(NOME_BASE, xBloco + padBloco, y + altVerde * 0.95);
        y += altVerde;

        // Bloco amarelo com o número em vermelho.
        ctx.fillStyle = AMARELO;
        ctx.fillRect(xBloco, y, largBloco, altAmarelo + altLema);
        var tamNumero = ajustarFonte(NUMERO, "Oswald", "700", altAmarelo * 0.92,
                                     largBloco - padBloco * 2);
        ctx.fillStyle = VERMELHO;
        ctx.fillText(NUMERO, xBloco + padBloco, y + altAmarelo * 0.86);
        y += altAmarelo;

        // Lema manuscrito, em branco sobre o fim do bloco amarelo.
        var tamLema = ajustarFonte(SLOGAN, "Caveat Brush", "400", altLema * 1.25,
                                   largBloco - padBloco * 1.4);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(SLOGAN, xBloco + padBloco, y + altLema * 0.82);

        /* --- Assinatura de quem montou -----------------------------------------
           Numa etiqueta clara, e não solta sobre o vermelho: escrita à mão em
           branco sobre o fundo da campanha o contraste ficava em ~4:1, baixo
           demais para um texto miúdo e cursivo. Sobre o papel passa de 14:1, e
           a etiqueta ainda reforça a ideia de assinar num pedaço de papel. */
        var quem = assinatura();
        if (quem) {
          var nomeAssin = quem.nome || quem.cidade;
          var temCidade = !!(quem.nome && quem.cidade);
          var textoCidade = temCidade
            ? quem.cidade.toUpperCase() + " · GOIÁS" : "";

          var tamAssin = Math.round(W * 0.048);
          var tamCidade = Math.round(W * 0.022);
          ajustarFonte(nomeAssin, "Caveat Brush", "400", tamAssin, W * 0.34);
          var largTexto = ctx.measureText(nomeAssin).width;
          if (temCidade) {
            ajustarFonte(textoCidade, "IBM Plex Mono", "500", tamCidade,
                         W * 0.34, Math.round(W * 0.003) + "px");
            largTexto = Math.max(largTexto, ctx.measureText(textoCidade).width);
          }

          var padEtiq = W * 0.024;
          var largEtiq = largTexto + padEtiq * 2;
          var altEtiq = padEtiq * 1.4 + tamAssin * 1.05 +
                        (temCidade ? tamCidade * 1.7 : 0);
          var yAssin = H * 0.028;

          ctx.fillStyle = PAPEL;
          ctx.fillRect(W - margem - largEtiq, yAssin, largEtiq, altEtiq);

          usarFonte("400", tamAssin, "Caveat Brush");
          ctx.fillStyle = TINTA;
          ctx.textAlign = "left";
          ctx.fillText(nomeAssin, W - margem - largEtiq + padEtiq,
                       yAssin + padEtiq * 0.65 + tamAssin * 0.78);
          rubrica(W - margem - largEtiq + padEtiq * 0.7,
                  yAssin + padEtiq * 0.65 + tamAssin * 0.99,
                  Math.max(ctx.measureText(nomeAssin).width, W * 0.09), VERMELHO);

          if (temCidade) {
            usarFonte("500", tamCidade, "IBM Plex Mono",
                      Math.round(W * 0.003) + "px");
            ctx.fillStyle = "rgba(24,17,20,0.72)";
            ctx.fillText(textoCidade, W - margem - largEtiq + padEtiq,
                         yAssin + altEtiq - padEtiq * 0.65);
          }
        }

        /* --- Contatos ----------------------------------------------------------
           Em duas linhas, à direita do bloco: numa linha só eles passavam por
           cima do lema manuscrito, que ocupa a base do bloco amarelo. */
        var larguraLivre = W - (xBloco + largBloco) - margem * 0.6;
        var tamContato = ajustarFonte(SITE, "IBM Plex Mono", "500", W * 0.021,
                                      larguraLivre, Math.round(W * 0.001) + "px");
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.textAlign = "right";
        ctx.fillText(SITE, W - margem * 0.6, H - H * 0.016 - tamContato * 1.45);
        ctx.fillText(INSTAGRAM, W - margem * 0.6, H - H * 0.016);
        ctx.textAlign = "center";

        /* --- Identificação legal, na lateral ----------------------------------
           Girada 90°, lida de baixo para cima como lombada de livro, rente à
           borda esquerda e bem apagada. */
        ajustarFonte(LEGAL, "IBM Plex Mono", "500", W * 0.018, H * 0.70,
                     Math.round(W * 0.0015) + "px");
        ctx.save();
        ctx.translate(W * 0.020, H * 0.88);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText(LEGAL, 0, 0);
        ctx.restore();
        ctx.textAlign = "center";

        atualizarDescricao();
      });
  }

  /* Descrição textual da imagem gerada — o canvas não é lido por leitor de
     tela, então o resultado precisa existir também em texto. */
  function atualizarDescricao() {
    var quem = assinatura();
    var assinado = "";
    if (quem) {
      assinado = " No alto, à esquerda, assinado à mão por " +
                 (quem.nome || quem.cidade) +
                 (quem.nome && quem.cidade ? ", de " + quem.cidade : "") + ".";
    }
    tela.setAttribute(
      "aria-label",
      "Cartaz de campanha no formato " +
      FORMATOS[estado.formato].rotulo.toLowerCase() +
      ", sobre fundo vermelho com recortes em azul, verde e amarelo: sua foto " +
      "em destaque e, ao lado e um pouco atrás, o Delegado Yasser " +
      poseAtual().alt + "." + assinado +
      " Embaixo, à esquerda, a tarja azul Deputado Estadual com a estrela, o " +
      "bloco verde Delegado Yasser, o bloco amarelo com o número 13007 em " +
      "vermelho e o lema Goiás seguro para todos. No canto, os contatos " +
      SITE + " e " + INSTAGRAM +
      ". Na lateral esquerda, em letras pequenas na vertical: " + LEGAL + "."
    );
  }

  /* =============================================================
     Saída: baixar, compartilhar, WhatsApp
     ============================================================= */

  function nomeArquivo() {
    return "delegado-yasser-13007-" + estado.formato + ".jpg";
  }

  function gerarBlob() {
    return new Promise(function (resolve) {
      tela.toBlob(function (blob) { resolve(blob); }, "image/jpeg", 0.92);
    });
  }

  function baixar() {
    return gerarBlob().then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      avisar("Imagem salva no seu aparelho.");
    });
  }

  function compartilhar() {
    gerarBlob().then(function (blob) {
      var arquivo = new File([blob], nomeArquivo(), { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        navigator.share({
          files: [arquivo],
          text: "Minha foto com o Delegado Yasser. Deputado Estadual 13007!"
        }).catch(function () { /* cancelar não é erro */ });
      } else {
        baixar();
      }
    });
  }

  /* =============================================================
     Interface
     ============================================================= */

  function montarPoses() {
    POSES.forEach(function (pose, indice) {
      var item = document.createElement("li");
      var botao = document.createElement("button");
      botao.type = "button";
      botao.className = "fcy-pose";
      botao.setAttribute("aria-pressed", indice === 0 ? "true" : "false");
      botao.setAttribute("data-pose", pose.id);

      var img = document.createElement("img");
      img.src = CAMINHO_POSES + "yasser-" + pose.id + "-mini.webp";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      var rotulo = document.createElement("span");
      rotulo.textContent = pose.rotulo;

      botao.appendChild(img);
      botao.appendChild(rotulo);
      botao.addEventListener("click", function () {
        estado.pose = pose.id;
        var todos = listaPoses.querySelectorAll(".fcy-pose");
        for (var i = 0; i < todos.length; i++) {
          todos[i].setAttribute("aria-pressed",
            todos[i].getAttribute("data-pose") === pose.id ? "true" : "false");
        }
        if (estado.pessoa) desenhar();
      });

      item.appendChild(botao);
      listaPoses.appendChild(item);
    });
  }

  function ligarFormatos() {
    var botoes = listaFormatos.querySelectorAll("[data-formato]");
    for (var i = 0; i < botoes.length; i++) {
      (function (botao) {
        botao.addEventListener("click", function () {
          estado.formato = botao.getAttribute("data-formato");
          for (var j = 0; j < botoes.length; j++) {
            botoes[j].setAttribute("aria-pressed",
              botoes[j].getAttribute("data-formato") === estado.formato
                ? "true" : "false");
          }
          if (estado.pessoa) desenhar();
        });
      })(botoes[i]);
    }
  }

  var esperaTexto = null;
  function aoDigitar() {
    if (!estado.pessoa) return;
    clearTimeout(esperaTexto);
    esperaTexto = setTimeout(desenhar, 220);
  }

  entradaFoto.addEventListener("change", function () {
    var arquivo = entradaFoto.files && entradaFoto.files[0];
    if (!arquivo) return;
    if (!/^image\//.test(arquivo.type)) {
      avisar("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
      return;
    }
    if (arquivo.size > 25 * 1024 * 1024) {
      avisar("Essa imagem tem mais de 25 MB. Escolha uma menor.");
      return;
    }
    processarFoto(arquivo);
  });

  campoNome.addEventListener("input", aoDigitar);
  campoCidade.addEventListener("input", aoDigitar);
  btnBaixar.addEventListener("click", baixar);
  btnZap.addEventListener("click", function () {
    var msg = "Olha minha foto com o Delegado Yasser! Deputado Estadual 13007. " +
              "Faça a sua em https://delegadoyasser.com.br/#foto-com-yasser";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
  });
  btnTrocar.addEventListener("click", function () {
    entradaFoto.value = "";
    entradaFoto.click();
  });

  // O botão de compartilhar só existe onde o navegador sabe enviar arquivos.
  var suportaEnviarArquivo = false;
  try {
    suportaEnviarArquivo = !!(navigator.canShare && navigator.canShare({
      files: [new File([new Blob([""], { type: "image/jpeg" })], "t.jpg",
                       { type: "image/jpeg" })]
    }));
  } catch (e) { /* navegadores sem File/canShare caem no download */ }

  if (suportaEnviarArquivo) {
    btnCompartilhar.addEventListener("click", compartilhar);
  } else {
    btnCompartilhar.hidden = true;
  }

  montarPoses();
  ligarFormatos();
})();
