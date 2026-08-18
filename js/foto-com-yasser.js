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

  var VERMELHO = "#f9120c";
  var VERMELHO_ESCURO = "#a10c08";
  var TINTA = "#181114";
  var PAPEL = "#fcf9f5";
  // Cores da bandeirinha diagonal que atravessa o site (.faixa-bandeira).
  var BANDEIRA = ["#2bba29", "#f6d30b", "#293ecf"];

  var TITULO = "DELEGADO YASSER";
  var SUBTITULO = "DEPUTADO ESTADUAL · PT-GO";
  var NUMERO = "13007";
  var SLOGAN = "GOIÁS SEGURO PARA TODOS";
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
      var alturaFade = Math.max(8, Math.round(altura * 0.09));
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

  /* Faixa listrada em diagonal com as cores da bandeirinha, o mesmo detalhe
     que atravessa o site. Como o padrão é diagonal, é mais direto girar o
     contexto e pintar barras verticais dentro de um recorte do que montar um
     pattern. */
  function faixaBandeira(x, y, largura, altura) {
    var passo = Math.max(6, Math.round(largura * 0.017));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, largura, altura);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    var alcance = largura + altura;
    var i = 0;
    for (var d = -alcance; d < alcance; d += passo) {
      ctx.fillStyle = BANDEIRA[i % BANDEIRA.length];
      ctx.fillRect(d, -alcance, passo + 1, alcance * 2);
      i++;
    }
    ctx.restore();
  }

  /* Nome de quem montou, como se assina embaixo de um documento. Volta vazio
     quando os dois campos estão em branco — a faixa inteira some junto. */
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

        var borda = Math.round(W * 0.011);
        // A margem abre espaço para a canaleta da identificação legal, que
        // corre na vertical entre a borda e o conteúdo.
        var margem = W * 0.075;

        /* --- Fundo ----------------------------------------------------------
           Claro, com a mesma queda de luz de um fundo de estúdio — é o fundo
           das fotos do Yasser. A dupla passa a parecer fotografada junta, em
           vez de duas figuras coladas sobre uma chapa de cor. */
        var fundo = ctx.createRadialGradient(W / 2, H * 0.38, W * 0.08,
                                             W / 2, H * 0.52, W * 0.95);
        fundo.addColorStop(0, "#fdfbf9");
        fundo.addColorStop(0.55, "#efe9e3");
        fundo.addColorStop(1, "#d9d1ca");
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, W, H);

        /* --- Faixa de baixo ---------------------------------------------------
           Vermelha da campanha, com o número à esquerda e lema e contatos à
           direita. Medida antes das figuras porque é ela que define até onde
           a dupla desce. */
        var quem = assinatura();
        var tamAssin = Math.round(W * 0.062);
        var tamDados = Math.round(W * 0.0285);
        // Rodapé mais folgado no story: o quadro é o dobro de comprido e a
        // dupla só cresce até onde a largura deixa, então sem isso sobraria
        // fundo vazio entre o cabeçalho e as cabeças.
        var padBarra = W * (ehStory ? 0.05 : 0.038);
        var altBarra = padBarra * 2 + W * 0.034 * 1.35 + tamDados * 1.7;
        if (ehStory) altBarra = Math.max(altBarra, H * 0.155);
        var yBarra = H - altBarra - borda;
        var altBandeira = Math.max(5, Math.round(W * 0.011));

        /* Faixa da assinatura: fica sobre o fundo claro, entre a dupla e o
           rodapé. É de propósito — assinatura no papel, e não dentro de uma
           tarja por cima da foto. Só existe quando alguém se identifica. */
        var altAssinatura = quem
          ? tamAssin * 1.24 + (quem.nome && quem.cidade ? tamDados * 1.45 : 0) +
            W * 0.010
          : 0;
        var yAssinatura = yBarra - altBandeira - altAssinatura;

        /* --- Cabeçalho ------------------------------------------------------
           Alinhado à esquerda, com o número em selo à direita: o bloco de
           identificação de um cartaz, não a pilha centralizada do santinho.

           No story o nome quebra em duas linhas e fica bem maior, e o selo
           sai de cena. É o que resolve o formato: são 1080 px de largura para
           duas pessoas lado a lado num quadro de 1920 px de altura, e a dupla
           só cresce até onde a largura deixa. Antes eu preenchia o resto
           esticando as figuras para fora do quadro, e era isso que decepava
           ombros e braços. Agora quem ocupa a altura é a tipografia, e as
           duas cabem inteiras. */
        var yTopo = borda + H * (ehStory ? 0.05 : 0.038);
        var linhasTitulo = ehStory ? ["DELEGADO", "YASSER"] : [TITULO];
        var comSelo = !ehStory;

        var tamSelo = Math.round(W * 0.062);
        usarFonte("700", tamSelo, "Oswald", Math.round(W * 0.004) + "px");
        var largSelo = ctx.measureText(NUMERO).width + W * 0.055;
        var altSelo = tamSelo * 1.5;

        var larguraNome = W - margem * 2 - (comSelo ? largSelo + W * 0.03 : 0);
        var tamTitulo = W * (ehStory ? 0.23 : 0.098);
        for (var t = 0; t < linhasTitulo.length; t++) {
          tamTitulo = ajustarFonte(linhasTitulo[t], "Oswald", "700", tamTitulo,
                                   larguraNome);
        }
        var alturaLinha = tamTitulo * (linhasTitulo.length > 1 ? 0.86 : 1.0);
        var tamCargo = ajustarFonte(SUBTITULO, "IBM Plex Mono", "500",
                                    W * 0.0235, larguraNome,
                                    Math.round(W * 0.0035) + "px");
        var altCabecalho = Math.max(
          alturaLinha * linhasTitulo.length + tamCargo * 2.1,
          comSelo ? altSelo : 0);

        /* --- Figuras --------------------------------------------------------
           Pessoa e Yasser vêm do mesmo enquadramento, então basta desenhar as
           duas com a mesma altura e a mesma base.

           A aproximação entre elas é proporcional ao tamanho delas, e não à
           largura do quadro: cada recorte carrega sua própria folga lateral, e
           com um valor fixo essas folgas somadas abriam um vão no meio da arte
           justamente quando as figuras cresciam. */
        /* Cada recorte carrega 6% de folga transparente em cada lado, e no meio
           da arte essas duas folgas se somavam num vão que deixava a dupla com
           cara de duas fotos coladas. Este valor as encosta pelos ombros; acima
           de ~0,20 o Yasser começa a cobrir o ombro de quem está do lado. */
        var APROXIMA = 0.18;
        /* Com assinatura, a dupla desce um pouco além do topo dessa faixa: o
           nome fica na margem esquerda e as figuras vivem no centro, então o
           avanço cai em área vazia e as duas ganham altura. */
        var baseFiguras = (quem ? yAssinatura + tamAssin * 0.55
                                : yBarra + altBarra * 0.05);
        var tetoFiguras = yTopo + altCabecalho + H * 0.016;

        var pessoa = estado.pessoa;
        var propYasser = imgYasser.naturalWidth / imgYasser.naturalHeight;
        // A largura da pessoa acompanha o recorte dela, que pode ser mais curto
        // que o padrão quando a foto não mostra o corpo todo.
        var largPorAltura = pessoa
          ? (pessoa.canvas.width / pessoa.canvas.height) * pessoa.fator : 0;

        var altura = baseFiguras - tetoFiguras;
        var larguraPorAltura = propYasser + largPorAltura - APROXIMA;
        // Nunca mais que a largura do quadro: sangrar para fora corta ombros
        // e braços, e é exatamente o que o story não deve fazer.
        var maxLarg = W - borda * 2;
        if (altura * larguraPorAltura > maxLarg) {
          altura = maxLarg / larguraPorAltura;
        }

        var sobreposicao = altura * APROXIMA;
        var largYasser = altura * propYasser;
        var largPessoa = altura * largPorAltura;
        var altPessoa = pessoa ? altura * pessoa.fator : 0;
        var xInicio = (W - (largYasser + largPessoa - sobreposicao)) / 2;
        var yFiguras = baseFiguras - altura;

        /* --- Dupla ------------------------------------------------------------ */
        ctx.save();
        ctx.beginPath();
        ctx.rect(borda, borda, W - borda * 2, baseFiguras - borda);
        ctx.clip();

        // Sombra discreta: sobre fundo claro ela só precisa descolar as figuras,
        // não recortá-las como acontecia sobre o vermelho chapado.
        function comSombra(desenhaFn) {
          ctx.save();
          ctx.shadowColor = "rgba(40,30,26,0.32)";
          ctx.shadowBlur = W * 0.045;
          ctx.shadowOffsetX = W * 0.004;
          ctx.shadowOffsetY = W * 0.012;
          desenhaFn();
          ctx.restore();
        }

        if (pessoa) {
          // Alinhamento pelo topo: os dois recortes começam a mesma distância
          // acima do alto da cabeça, então topos alinhados são rostos alinhados.
          comSombra(function () {
            ctx.drawImage(pessoa.canvas, xInicio, yFiguras, largPessoa, altPessoa);
          });
        }
        comSombra(function () {
          ctx.drawImage(imgYasser, xInicio + largPessoa - sobreposicao, yFiguras,
                        largYasser, altura);
        });
        ctx.restore();

        /* --- Cabeçalho, por cima ---------------------------------------------- */
        usarFonte("700", tamTitulo, "Oswald");
        ctx.fillStyle = TINTA;
        ctx.textAlign = "left";
        for (var n = 0; n < linhasTitulo.length; n++) {
          ctx.fillText(linhasTitulo[n], margem,
                       yTopo + alturaLinha * n + tamTitulo * 0.78);
        }

        var yCargo = yTopo + alturaLinha * linhasTitulo.length + tamCargo * 1.2;
        usarFonte("500", tamCargo, "IBM Plex Mono",
                  Math.round(W * 0.0035) + "px");
        ctx.fillStyle = "rgba(24,17,20,0.72)";
        ctx.fillText(SUBTITULO, margem, yCargo);

        // No story o número já domina o rodapé; repeti-lo num selo aqui em
        // cima só competiria com o nome em duas linhas.
        if (comSelo) {
          ctx.fillStyle = VERMELHO_ESCURO;
          ctx.fillRect(W - margem - largSelo, yTopo, largSelo, altSelo);
          usarFonte("700", tamSelo, "Oswald", Math.round(W * 0.004) + "px");
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText(NUMERO, W - margem - largSelo / 2 + W * 0.002,
                       yTopo + altSelo * 0.76);
        }

        /* --- Assinatura -------------------------------------------------------
           Manuscrita e rubricada, escrita no fundo claro como quem assina
           embaixo de um documento. */
        if (quem) {
          var nomeAssin = quem.nome || quem.cidade;
          var yNome = yAssinatura + W * 0.006;
          usarFonte("400", tamAssin, "Caveat Brush");
          ctx.fillStyle = TINTA;
          ctx.textAlign = "left";
          ctx.fillText(nomeAssin, margem, yNome + tamAssin * 0.78);
          rubrica(margem - W * 0.004, yNome + tamAssin * 0.99,
                  Math.max(ctx.measureText(nomeAssin).width, W * 0.11), VERMELHO);

          if (quem.nome && quem.cidade) {
            ajustarFonte(quem.cidade.toUpperCase() + " · GOIÁS", "IBM Plex Mono",
                         "500", tamDados, (W - margem * 2) * 0.5,
                         Math.round(W * 0.003) + "px");
            ctx.fillStyle = "rgba(24,17,20,0.62)";
            ctx.fillText(quem.cidade.toUpperCase() + " · GOIÁS", margem,
                         yNome + tamAssin * 1.28 + tamDados);
          }
        }

        /* --- Faixa de baixo ---------------------------------------------------- */
        faixaBandeira(borda, yBarra - altBandeira, W - borda * 2, altBandeira);
        ctx.fillStyle = VERMELHO_ESCURO;
        ctx.fillRect(borda, yBarra, W - borda * 2, altBarra);

        var yLinha = yBarra + padBarra;
        var alturaLivre = altBarra - padBarra * 2;

        // O número ocupa a coluna da esquerda por inteiro; no story, onde a
        // faixa é bem mais alta, um teto evita que ele fique desproporcional
        // ao lado do texto.
        ajustarFonte(NUMERO, "Oswald", "700",
                     Math.min(alturaLivre * 1.15, W * 0.16), W * 0.4,
                     Math.round(W * 0.005) + "px");
        var largNumero = ctx.measureText(NUMERO).width;
        var altNumero = parseInt(ctx.font, 10) || alturaLivre;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText(NUMERO, margem,
                     yBarra + altBarra / 2 + altNumero * 0.36);

        var xFilete = margem + largNumero + W * 0.042;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillRect(xFilete, yLinha, Math.max(3, W * 0.004), alturaLivre);

        var xTexto = xFilete + W * 0.038;
        var largTexto = W - margem - xTexto;

        /* Lema e contatos andam juntos, centrados na altura da faixa. Fixar um
           no topo e outro na base abria um buraco no meio quando a faixa
           cresce — que é o caso do story. */
        var tamLema = ajustarFonte(SLOGAN, "Archivo", "800", W * 0.038, largTexto);
        var alturaDireita = tamLema + tamDados * 1.9;
        var yDireita = yBarra + (altBarra - alturaDireita) / 2;
        var yDados = yDireita + tamLema + tamDados * 1.5;

        ctx.fillStyle = "#ffffff";
        ctx.fillText(SLOGAN, xTexto, yDireita + tamLema * 0.86);

        var contatos = SITE + "  ·  " + INSTAGRAM;
        ajustarFonte(contatos, "IBM Plex Mono", "500", tamDados, largTexto,
                     Math.round(W * 0.002) + "px");
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(contatos, xTexto, yDados);
        ctx.textAlign = "center";

        /* --- Identificação legal, na lateral ----------------------------------
           Girada 90°, lida de baixo para cima como lombada de livro, rente à
           borda esquerda e bem apagada. Fica por cima de tudo para acompanhar
           a peça em qualquer compartilhamento, mas com opacidade baixa o
           bastante para não competir com a foto. */
        var alturaLegal = yBarra - borda - W * 0.03;
        var tamLegal = ajustarFonte(LEGAL, "IBM Plex Mono", "500", W * 0.019,
                                    alturaLegal, Math.round(W * 0.0015) + "px");
        ctx.save();
        ctx.translate(borda + W * 0.028, yBarra - W * 0.015);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(24,17,20,0.32)";
        ctx.fillText(LEGAL, 0, 0);
        ctx.restore();
        ctx.textAlign = "center";

        /* --- Borda do cartaz -------------------------------------------------
           Desenhada por último para ficar por cima de tudo, inclusive de
           qualquer figura que sangre pela lateral. */
        ctx.strokeStyle = TINTA;
        ctx.lineWidth = borda * 2;   // metade sai do canvas e some
        ctx.strokeRect(0, 0, W, H);

        atualizarDescricao();
      });
  }

  /* Descrição textual da imagem gerada — o canvas não é lido por leitor de
     tela, então o resultado precisa existir também em texto. */
  function atualizarDescricao() {
    var quem = assinatura();
    var assinado = "";
    if (quem) {
      assinado = " Logo acima do rodapé, assinado à mão por " +
                 (quem.nome || quem.cidade) +
                 (quem.nome && quem.cidade ? ", de " + quem.cidade : "") + ".";
    }
    tela.setAttribute(
      "aria-label",
      "Cartaz no formato " + FORMATOS[estado.formato].rotulo.toLowerCase() +
      ", sobre fundo claro de estúdio: sua foto ao lado do Delegado Yasser " +
      poseAtual().alt + ". No alto, o nome Delegado Yasser, a linha " +
      "Deputado Estadual PT-GO e o número 13007 num selo vermelho." +
      assinado +
      " Na faixa vermelha do rodapé, o número 13007 em destaque, o lema " +
      "Goiás Seguro para Todos e os contatos " + SITE + " e " + INSTAGRAM +
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
