/* =============================================================
   Foto com o Delegado Yasser · 13007
   Monta um cartaz com a foto de quem visita ao lado do candidato.
   =============================================================

   Tudo roda no aparelho de quem acessa. A foto enviada nunca sai do
   navegador: não há upload, não há servidor, não há armazenamento. O
   recorte usa o modelo Selfie Segmentation (MediaPipe, Apache 2.0)
   servido pelo próprio domínio em models/segmentacao/, executado pelo
   TensorFlow.js que está em js/vendor/tfjs/.

   Peso: os ~1,1 MB do TensorFlow.js e os ~330 KB do modelo só são
   baixados quando alguém escolhe uma foto — quem passa pela seção sem
   usar não paga nada por ela.

   Como pessoa e Yasser acabam do mesmo tamanho
   --------------------------------------------
   Os recortes do Yasser foram exportados num enquadramento fixo: do alto
   da cabeça, 0,11 rosto de folga para cima e 2,75 rostos para baixo, o
   que termina na altura do quadril. A foto de quem acessa passa pelo
   mesmo enquadramento aqui no navegador, medido do mesmo jeito. Com os
   dois recortes na mesma proporção, a montagem só precisa desenhá-los
   com a mesma altura — não há escala a calcular na hora, e portanto não
   há escala para errar quando a foto vem de muito perto ou de corpo
   inteiro.
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

  /* Enquadramento padrão, em múltiplos da altura do rosto. Mudar estes
     números exige reexportar os recortes do Yasser com os mesmos valores. */
  var FOLGA_TOPO = 0.11;
  var CORPO = 2.75;
  var FOLGA_LADO = 0.06;

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

  function prepararTensorFlow() {
    if (tfPronto) return tfPronto;
    tfPronto = carregarScript(CAMINHO_TFJS + "tf-core.min.js")
      .then(function () {
        return Promise.all([
          carregarScript(CAMINHO_TFJS + "tf-converter.min.js"),
          carregarScript(CAMINHO_TFJS + "tf-backend-webgl.min.js")
        ]);
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
      .then(function () { return window.tf.loadGraphModel(CAMINHO_MODELO); })
      .then(function (m) { modelo = m; });
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

  /* Aplica a máscara sobre a foto e devolve um canvas RGBA.
     A transição usa uma rampa em vez de um corte seco: borda dura entrega
     serrilhado, e o recorte de um modelo leve nunca é bom o bastante para
     aguentar corte seco. */
  function aplicarMascara(imagem, dados) {
    var lona = document.createElement("canvas");
    lona.width = imagem.width;
    lona.height = imagem.height;
    var c = lona.getContext("2d");
    c.drawImage(imagem, 0, 0);

    var quadro = c.getImageData(0, 0, lona.width, lona.height);
    var px = quadro.data;
    for (var i = 0; i < dados.length; i++) {
      var a = (dados[i] - 0.40) / 0.25;   // rampa entre 0,40 e 0,65
      px[i * 4 + 3] = Math.round((a < 0 ? 0 : (a > 1 ? 1 : a)) * 255);
    }
    c.putImageData(quadro, 0, 0);
    return lona;
  }

  /* Trecho contínuo de uma linha da máscara que contém (ou está mais perto
     de) um x. Seguir um único trecho, em vez de somar a linha inteira, é o
     que impede uma mão levantada ao lado do rosto de entrar na conta. */
  function trechoEm(dados, largura, linha, alvo) {
    var base = linha * largura;
    var achouIni = -1, achouFim = -1, menorDist = Infinity, ini = -1;
    for (var i = 0; i <= largura; i++) {
      var dentro = i < largura && dados[base + i] > 0.5;
      if (dentro && ini < 0) {
        ini = i;
      } else if (!dentro && ini >= 0) {
        var dist = (alvo >= ini && alvo < i) ? 0 : Math.abs((ini + i) / 2 - alvo);
        if (dist < menorDist) { menorDist = dist; achouIni = ini; achouFim = i; }
        ini = -1;
      }
    }
    return achouIni < 0 ? null : { ini: achouIni, fim: achouFim };
  }

  /* Encontra o alto da cabeça e o queixo pela forma da silhueta.

     Nada de "a cabeça está nos primeiros 30% da imagem": isso vale para um
     retrato de meio corpo, mas numa foto de corpo inteiro 30% já é o tórax.
     Aqui a busca desce da cabeça até o ponto mais estreito e confirma o
     pescoço quando a largura volta a subir nos ombros — a proporção da curva
     é a mesma numa selfie e num retrato de corpo inteiro. */
  function medirSilhueta(dados, largura, altura) {
    var y, x;

    var y0 = -1, y1 = -1;
    for (y = 0; y < altura; y++) {
      for (x = 0; x < largura; x++) {
        if (dados[y * largura + x] > 0.5) {
          if (y0 < 0) y0 = y;
          y1 = y;
          break;
        }
      }
    }
    if (y0 < 0) return null;

    var alt = y1 - y0;
    if (alt < altura * 0.08) return null;   // recorte pequeno demais para confiar

    var primeiro = trechoEm(dados, largura, y0, largura / 2);
    var centro = primeiro ? (primeiro.ini + primeiro.fim) / 2 : largura / 2;

    var perfil = new Float32Array(altura);
    for (y = y0; y <= y1; y++) {
      var t = trechoEm(dados, largura, y, centro);
      if (!t) continue;
      perfil[y] = t.fim - t.ini;
      // O centro acompanha o corpo devagar: seguir um salto brusco costuma
      // significar que a trilha pulou para um braço.
      centro += ((t.ini + t.fim) / 2 - centro) * 0.25;
    }

    var janela = Math.max(3, Math.round(alt * 0.012));
    var suave = new Float32Array(altura);
    var soma = 0;
    for (y = 0; y < altura; y++) {
      soma += perfil[y];
      if (y >= janela) soma -= perfil[y - janela];
      suave[y] = soma / Math.min(y + 1, janela);
    }
    var atraso = Math.floor(janela / 2);   // a média móvel acima adianta o sinal
    function larguraEm(linha) {
      var i = linha + atraso;
      return suave[i < altura ? i : altura - 1];
    }

    var QUEDA = 0.82, SUBIDA = 1.22;
    var maiorLargura = larguraEm(y0);
    var vale = -1, menorLargura = 0, descendo = false;

    for (y = y0 + 1; y <= y1; y++) {
      var w = larguraEm(y);
      if (w <= 0) continue;
      if (!descendo) {
        if (w > maiorLargura) {
          maiorLargura = w;
        } else if (w < maiorLargura * QUEDA) {
          descendo = true; vale = y; menorLargura = w;
        }
      } else if (w < menorLargura) {
        vale = y; menorLargura = w;
      } else if (w > menorLargura * SUBIDA) {
        break;                 // os ombros começaram: o vale é o pescoço
      }
    }

    /* Duas situações em que a leitura não é confiável, ambas típicas de quem
       está cortado pela borda do quadro:

       - a silhueta nunca estreitou, então não há queixo nenhum a apontar;
       - o "queixo" encontrado deixaria o rosto com mais da metade da figura
         e ainda sobra corpo abaixo dele. Rosto assim só existe num retrato
         fechado, e num retrato fechado não sobra corpo — o que foi medido,
         portanto, é o tronco.

       Nos dois casos vale mais assumir um enquadramento comum de meio corpo
       do que aceitar a medida. */
    var duvidoso = vale > 0 && (vale - y0) > alt * 0.55 && (y1 - vale) > alt * 0.15;
    if (vale < 0 || duvidoso) vale = y0 + Math.round(alt * 0.32);

    return { topo: y0, base: y1, rosto: vale - y0 };
  }

  /* Recorta a pessoa no mesmo enquadramento dos recortes do Yasser.

     Quando a foto não tem corpo até onde o enquadramento pede — um retrato
     fechado no rosto, por exemplo —, o recorte termina onde a pessoa termina
     e `fator` registra que fração da altura padrão foi possível. A montagem
     usa esse fator para desenhar a figura mais curta em vez de mais estreita:
     o rosto sai do tamanho certo de qualquer jeito, e é o rosto que precisa
     bater com o do Yasser. */
  function enquadrar(lona, medida) {
    var rosto = medida.rosto;
    var alturaPadrao = (FOLGA_TOPO + CORPO) * rosto;
    var topo = Math.round(medida.topo - FOLGA_TOPO * rosto);
    var base = Math.round(Math.min(medida.topo + CORPO * rosto, medida.base));
    var altura = base - topo;
    if (altura < 8) return null;

    // Extremos horizontais dentro da faixa que vai ficar.
    var yIni = Math.max(0, topo);
    var yFim = Math.min(lona.height, base);
    var quadro = lona.getContext("2d")
      .getImageData(0, yIni, lona.width, Math.max(1, yFim - yIni));
    var px = quadro.data;
    var esquerda = lona.width, direita = 0;
    for (var l = 0; l < yFim - yIni; l++) {
      for (var x = 0; x < lona.width; x++) {
        if (px[(l * lona.width + x) * 4 + 3] > 128) {
          if (x < esquerda) esquerda = x;
          if (x > direita) direita = x;
        }
      }
    }
    if (direita <= esquerda) return null;

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
       cartaz. Um esmaecimento curto transforma o corte em acabamento. */
    var fator = altura / alturaPadrao;
    if (fator < 0.98) {
      // Esmaecimento longo: sobre o fundo vermelho da arte, uma transição
      // curta lê como borrão de roupa; alongada, dissolve na cor.
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

        avisar("Recortando você da foto…");
        return prepararTensorFlow().then(function () { return lona; });
      })
      .then(function (lona) {
        var mascara = calcularMascara(lona);
        return mascara.data().then(function (dados) {
          mascara.dispose();
          var medida = medirSilhueta(dados, lona.width, lona.height);
          if (!medida) throw new Error("sem-pessoa");
          var enquadrada = enquadrar(aplicarMascara(lona, dados), medida);
          if (!enquadrada) throw new Error("sem-pessoa");
          estado.pessoa = enquadrada;
          if (window.FCY_DEBUG && window.console) {
            console.log("[fcy]", JSON.stringify(medida), "fator",
                        enquadrada.fator.toFixed(3), "foto",
                        lona.width + "x" + lona.height);
          }
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
        if (estado.pessoa.fator < 0.55) {
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
        if (erro && erro.message === "sem-pessoa") {
          avisar("Não consegui encontrar uma pessoa nessa foto. Tente uma foto " +
                 "mais próxima, com boa luz e o rosto visível.");
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
        var APROXIMA = 0.36;

        /* O Yasser é ancorado com folga na margem esquerda e nunca é cortado:
           é o candidato, e cortá-lo era o efeito colateral de centralizar um
           conjunto mais largo que o quadro. Quem pode sangrar pela direita é a
           pessoa — que é justamente como o Lula aparece na peça original. */
        var xInicioYasser = W * 0.02;
        var sangraDireita = W * 1.28 - xInicioYasser;

        var propYasser = imgYasser.naturalWidth / imgYasser.naturalHeight;
        var largPorAltura = pessoa
          ? (pessoa.canvas.width / pessoa.canvas.height) * pessoa.fator : 0;
        var conjuntoPorAltura = propYasser * ATRAS + largPorAltura - APROXIMA;

        var baseFiguras, altura;
        if (ehStory) {
          baseFiguras = yBloco + altCargo + altVerde * 0.5;
          altura = Math.min(baseFiguras - H * 0.09,
                            sangraDireita / conjuntoPorAltura);
        } else {
          /* Encostada na borda de baixo, e não passando dela: sobe a dupla
             inteira no quadro sem deixar o pé dos recortes à vista. O retrato
             sobe mais um pouco — é o formato com mais altura sobrando acima
             das cabeças, e o esmaecimento longo da base disfarça o pé que
             passa a ficar dentro do quadro. */
          baseFiguras = H * (estado.formato === "retrato" ? 0.955 : 0.99);
          altura = Math.min(H * 0.97, sangraDireita / conjuntoPorAltura);
        }

        var altYasser = altura * ATRAS;
        var largYasser = altYasser * propYasser;
        var altPessoa = pessoa ? altura * pessoa.fator : 0;
        var largPessoa = altura * largPorAltura;
        var conjunto = largYasser + largPessoa - altura * APROXIMA;

        // Ancorado à esquerda pelo Yasser, e não centrado: centralizar um
        // conjunto mais largo que o quadro jogava metade dele para fora.
        var xYasser = xInicioYasser;
        var xPessoa = xYasser + largYasser - altura * APROXIMA;
        var yYasser = baseFiguras - altYasser;
        var yPessoa = baseFiguras - altPessoa;

        /* --- Camadas de cor atrás da dupla ------------------------------------ */
        camadasAtras(W * 0.47, yYasser + altura * 0.60, W * 0.52, altura * 0.62);

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
