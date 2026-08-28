/* =============================================================
   Foto com o Delegado Yasser · 13007
   Monta o cartaz da campanha com a foto de quem visita.
   =============================================================

   Tudo roda no aparelho de quem acessa. A foto escolhida nunca sai do
   navegador: não há upload, não há servidor, não há armazenamento.

   A arte segue a peça oficial (Yasser/Recorte/Base.jpeg): fundo amarelo
   em degradê na diagonal, o Delegado recortado à esquerda subindo da
   faixa do rodapé, a foto de quem monta dentro de uma moldura branca à
   direita, o adesivo do 13007 colado torto sobre o peito do Delegado e,
   embaixo, a faixa azul-marinho com o site e o Instagram.

   Por que a foto entra numa moldura, e não recortada
   --------------------------------------------------
   A primeira versão recortava a pessoa do fundo com dois modelos de
   visão computacional (Selfie Segmentation e BlazeFace) rodando em
   TensorFlow.js. Funcionava, mas custava 1,9 MB de download, alguns
   segundos de espera e um recorte que errava sempre que a foto tinha
   cabelo comprido, boné, mão perto do rosto ou fundo carregado — e
   quando erra, erra na cara da pessoa.

   A peça oficial já reserva um quadro branco para a foto. Dentro dele a
   foto entra inteira, sem recorte: nada para baixar, nada para esperar,
   nada para dar errado. O enquadramento fica na mão de quem monta —
   arrastando, com a roda do mouse, pelo teclado ou pelo controle de
   aproximação embaixo da montagem.
   ============================================================= */

(function () {
  "use strict";

  var raiz = document.getElementById("fotoComYasser");
  if (!raiz) return;

  /* As poses são recortes prontos, todos com 1200 px de altura e o mesmo
     enquadramento em relação ao rosto — desenhá-las com a mesma altura já
     deixa o Delegado do mesmo tamanho em qualquer uma.

     `cabeca` é onde fica o centro da cabeça, em fração da largura do
     arquivo. Medido percorrendo o alfa na faixa do rosto de cada recorte.
     É por ela que a figura é alinhada: fixar a borda esquerda faria a
     cabeça andar de lado a cada troca de pose, porque uns recortes têm o
     braço aberto de um lado e outros não. */
  var POSES = [
    { id: "bone-pt",       rotulo: "De boné do PT",     cabeca: 0.518,
      alt: "de terno preto e boné vermelho com a estrela do PT" },
    { id: "camiseta-lula", rotulo: "Camiseta do Lula",  cabeca: 0.465,
      alt: "de camiseta vermelha do Lula" },
    { id: "camisa-branca", rotulo: "De camisa branca",  cabeca: 0.559,
      alt: "de camisa branca com as mangas dobradas" },
    { id: "terno",         rotulo: "De terno",          cabeca: 0.506,
      alt: "de terno preto e camisa branca" },
    { id: "selecao",       rotulo: "Camisa do Brasil",  cabeca: 0.485,
      alt: "de camisa da seleção brasileira" },
    { id: "kufiya",        rotulo: "Com o kufiya",      cabeca: 0.446,
      alt: "de terno preto com o kufiya palestino na cabeça" }
  ];

  var FORMATOS = {
    quadrado: { largura: 1080, altura: 1080, rotulo: "Quadrado" },
    story:    { largura: 1080, altura: 1920, rotulo: "Story" },
    retrato:  { largura: 1080, altura: 1350, rotulo: "Retrato" }
  };

  /* Onde cada peça da arte fica, por formato. Distâncias horizontais e
     tamanhos em fração da largura; alturas de posicionamento em fração da
     altura. Os números do quadrado saíram de medir a arte oficial em
     2048x2048; os outros dois formatos reaproveitam a mesma composição com
     o espaço que sobra indo para a foto (no story) ou para o Delegado (no
     retrato).

       diagonal  altura da virada do amarelo para o creme, na borda esquerda
       foto      moldura branca: lado e canto superior esquerdo
       yasser    altura da figura e onde o centro da cabeça se apoia
       adesivo   largura total do bloco colado e onde fica sua base
       assin     canto de onde a assinatura à mão cresce para a esquerda */
  var ARRANJO = {
    quadrado: {
      diagonal: 0.483,
      foto:    { lado: 0.460, x: 0.500, y: 0.075 },
      yasser:  { altura: 0.72, cabeca: 0.300 },
      adesivo: { largura: 0.420, cx: 0.280, base: 0.895 },
      assin:   { x: 0.930, y: 0.680 }
    },
    retrato: {
      diagonal: 0.445,
      foto:    { lado: 0.460, x: 0.500, y: 0.065 },
      yasser:  { altura: 0.88, cabeca: 0.320 },
      adesivo: { largura: 0.440, cx: 0.290, base: 0.905 },
      assin:   { x: 0.930, y: 0.600 }
    },
    story: {
      diagonal: 0.412,
      foto:    { lado: 0.700, x: 0.150, y: 0.045 },
      yasser:  { altura: 0.83, cabeca: 0.280 },
      adesivo: { largura: 0.460, cx: 0.660, base: 0.905 },
      assin:   { x: 0.930, y: 0.520 }
    }
  };

  /* Cores amostradas pixel a pixel na arte oficial. As do site (landing.css)
     são próximas, mas não iguais: aqui manda o arquivo da campanha, para a
     montagem sair do mesmo tom das peças impressas. */
  var AMARELO_TOPO = "#f8d111";   // topo do fundo
  var AMARELO_BAIXO = "#fdc006";  // logo antes da virada da diagonal
  var CREME_ALTO = "#fced90";     // logo depois da virada
  var CREME_MEIO = "#fef1ad";
  var CREME_BAIXO = "#fefadf";
  var PAPEL = "#fffffb";          // pé do degradê, onde encosta no rodapé
  var VERMELHO = "#eb1811";
  var AZUL = "#3642a6";           // tarja do cargo
  var VERDE = "#3aa835";
  var AMARELO = "#f4c80d";        // bloco do número
  var NAVY = "#101d3f";           // faixa do rodapé e textos sobre o creme
  var BRANCO = "#ffffff";

  var CARGO = "DEPUTADO ESTADUAL";
  var NOME_TOPO = "DELEGADO";
  var NOME_BASE = "YASSER";
  var NUMERO = "13007";
  var SLOGAN = "Goiás seguro para todos";
  var SITE = "delegadoyasser.com.br";
  var INSTAGRAM = "@delegadoyasser";
  /* Identificação obrigatória da propaganda eleitoral. Vai na lateral
     direita, em vertical: precisa acompanhar a peça onde quer que ela seja
     compartilhada, sem disputar espaço com a foto.

     Em DUAS linhas, e não numa só: o nome da coligação traz quatro legendas
     e deixa a identificação com ~200 caracteres. Numa linha única a
     ajustarFonte() teria de encolher até o piso de 8 px e ainda assim
     estouraria a altura no formato quadrado, que é o mais apertado. Partida
     em duas, a linha mais longa fica menor que a de antes — ou seja, o corpo
     da letra não diminui em nenhum formato. */
  var LEGAL_CARGO = "ELEIÇÃO 2026 · YASSER MARTINS YASSINE · DEPUTADO ESTADUAL · " +
                    "CNPJ 68.454.985/0001-69";
  var LEGAL_COLIGACAO = "COLIGAÇÃO BRASIL PRONTO PRA MAIS · PSB / PDT / " +
                        "FEDERAÇÃO FÉ BRASIL (PT / PCdoB / PV) / " +
                        "FEDERAÇÃO PSOL-REDE (PSOL / REDE)";
  // Versão corrida, para a descrição textual da imagem (leitor de tela).
  var LEGAL = LEGAL_CARGO + " · " + LEGAL_COLIGACAO;

  var CAMINHO_POSES = "images/foto-com-yasser/";
  var ARQUIVO_RODAPE = CAMINHO_POSES + "rodape.webp";

  /* A faixa do rodapé é um recorte da própria arte oficial: leva o skyline,
     os ícones e as duas linhas de contato exatamente como foram desenhados.
     Tem 1080 px de largura — a mesma dos três formatos —, então entra sem
     escala e sem perder nitidez. */
  var RODAPE_LARG = 1080;
  var RODAPE_ALT = 165;

  /* ---------- Elementos ---------- */
  var entradaFoto = document.getElementById("fcyArquivo");
  var listaPoses = document.getElementById("fcyPoses");
  var listaFormatos = document.getElementById("fcyFormatos");
  var campoNome = document.getElementById("fcyNome");
  var campoCidade = document.getElementById("fcyCidade");
  var tela = document.getElementById("fcyTela");
  var estadoTexto = document.getElementById("fcyEstado");
  var painelAcoes = document.getElementById("fcyAcoes");
  var painelAjuste = document.getElementById("fcyAjuste");
  var controleZoom = document.getElementById("fcyZoom");
  var btnCentralizar = document.getElementById("fcyCentralizar");
  var btnBaixar = document.getElementById("fcyBaixar");
  var btnCompartilhar = document.getElementById("fcyCompartilhar");
  var btnZap = document.getElementById("fcyZap");
  var btnTrocar = document.getElementById("fcyTrocar");
  var vazio = document.getElementById("fcyVazio");

  var ctx = tela.getContext("2d");

  var estado = {
    pose: POSES[0].id,
    formato: "quadrado",
    foto: null,      // { imagem, zoom, dx, dy } — dx/dy em fração do lado da moldura
    ocupado: false,
    desenhou: false
  };

  var imagensPose = {};
  var imagemRodape = null;
  var adesivoPronto = null;   // { lona, lb } — cache do adesivo já montado

  /* =============================================================
     Utilidades
     ============================================================= */

  function avisar(texto) {
    estadoTexto.textContent = texto;
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

  function imagemDoRodape() {
    if (!imagemRodape) imagemRodape = carregarImagem(ARQUIVO_RODAPE);
    return imagemRodape;
  }

  function poseAtual() {
    for (var i = 0; i < POSES.length; i++) {
      if (POSES[i].id === estado.pose) return POSES[i];
    }
    return POSES[0];
  }

  function arranjo() {
    return ARRANJO[estado.formato];
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

  /* letterSpacing no canvas é recente (Chrome 99, Safari 17.4, Firefox 122).
     Onde não existe, o texto sai sem o espaçamento — muda o acabamento, não
     a legibilidade. */
  var TEM_ESPACAMENTO = typeof ctx.letterSpacing === "string";

  function usarFonte(c, peso, tamanho, familia, espacamento) {
    c.font = peso + " " + tamanho + 'px "' + familia + '", sans-serif';
    if (TEM_ESPACAMENTO) c.letterSpacing = espacamento || "0px";
  }

  /* Diminui o corpo da fonte até o texto caber na largura pedida. */
  function ajustarFonte(c, texto, familia, peso, tamanhoInicial, larguraMax,
                        espacamento) {
    var tamanho = Math.round(tamanhoInicial);
    usarFonte(c, peso, tamanho, familia, espacamento);
    while (c.measureText(texto).width > larguraMax && tamanho > 8) {
      tamanho -= 1;
      usarFonte(c, peso, tamanho, familia, espacamento);
    }
    return tamanho;
  }

  /* roundRect só chegou aos navegadores em 2022/2023; onde não existe, o
     bloco sai de canto vivo. */
  function bloco(c, x, y, larg, alt, raio) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, larg, alt, raio);
    else c.rect(x, y, larg, alt);
    c.fill();
  }

  function estrela(c, cx, cy, raio, cor, giro) {
    c.save();
    c.translate(cx, cy);
    c.rotate(giro || 0);
    c.fillStyle = cor;
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? raio * 0.44 : raio;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      c[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  /* =============================================================
     Fundo: o degradê na diagonal da arte oficial
     =============================================================

     A virada do amarelo forte para o creme não é horizontal: ela desce da
     direita para a esquerda numa reta de inclinação 0,16 (medida na arte
     oficial, onde a borda esquerda vira a 0,483 da altura e a direita a
     0,323). Um degradê linear ao longo da normal dessa reta reproduz a
     virada e a descida até o branco de uma vez só. */
  function fundo(W, H, alturaArte) {
    var INCLINACAO = 0.1603;
    var sVirada = arranjo().diagonal * H;     // valor da normal na borda esquerda
    var sFim = alturaArte;                    // onde o creme encosta no rodapé
    var k = sFim / (1 + INCLINACAO * INCLINACAO);

    var g = ctx.createLinearGradient(0, 0, INCLINACAO * k, k);
    var t = function (s) { return Math.max(0, Math.min(1, s / sFim)); };
    g.addColorStop(0, AMARELO_TOPO);
    g.addColorStop(t(sVirada * 0.975), AMARELO_BAIXO);
    g.addColorStop(t(sVirada * 1.04), CREME_ALTO);
    g.addColorStop(t(sVirada + (sFim - sVirada) * 0.31), CREME_MEIO);
    g.addColorStop(t(sVirada + (sFim - sVirada) * 0.73), CREME_BAIXO);
    g.addColorStop(1, PAPEL);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* =============================================================
     Adesivo do 13007
     =============================================================

     Montado num canvas à parte e depois colado torto na arte. Ir por fora
     resolve dois problemas de uma vez: a sombra sai do contorno do conjunto
     todo (desenhado direto, cada bloco projetaria a sua por cima do vizinho)
     e a borda branca fica contínua, porque as bordas brancas são desenhadas
     antes de qualquer bloco colorido.

     As medidas estão em fração da largura do bloco verde (`lb`), tiradas da
     arte oficial: a tarja do cargo tem 0,566 dessa largura, o verde 0,365 de
     altura, o amarelo 0,435 e a faixa do lema 0,166, com as peças se
     sobrepondo alguns pontos como num recorte colado à mão. */
  function montarAdesivo(lb) {
    if (adesivoPronto && adesivoPronto.lb === lb) return adesivoPronto.lona;

    var borda = lb * 0.028;
    var raio = lb * 0.022;
    /* A folga em volta existe porque o contorno branco e a estrela do PT
       passam da caixa das peças: sem ela, a lona corta a borda esquerda da
       tarja e a ponta de cima da estrela. */
    var folga = Math.ceil(borda * 1.6);

    var lona = document.createElement("canvas");
    lona.width = Math.round(lb * 1.16) + folga * 2;
    lona.height = Math.round(lb * 1.07) + folga * 2;
    var c = lona.getContext("2d");
    c.translate(folga, folga);
    var u = function (v) { return v * lb; };   // fração da largura → pixel

    var pecas = [
      { x: 0.000, y: 0.048, l: 0.566, a: 0.090, cor: AZUL },   // tarja do cargo
      { x: 0.048, y: 0.138, l: 1.000, a: 0.365, cor: VERDE },  // nome
      { x: 0.076, y: 0.503, l: 1.000, a: 0.435, cor: AMARELO },// número
      { x: 0.097, y: 0.862, l: 1.014, a: 0.166, cor: VERMELHO }// lema
    ];

    // 1. contorno branco: cada peça com uma folga por fora, tudo antes das cores
    c.fillStyle = BRANCO;
    for (var i = 0; i < pecas.length; i++) {
      var p = pecas[i];
      bloco(c, u(p.x) - borda, u(p.y) - borda,
            u(p.l) + borda * 2, u(p.a) + borda * 2, raio + borda);
    }
    // a estrela do PT também é adesivo, com o mesmo contorno
    estrela(c, u(1.021), u(0.100), u(0.100) + borda, BRANCO, 0.26);

    // 2. as peças coloridas por cima
    for (var j = 0; j < pecas.length; j++) {
      var q = pecas[j];
      c.fillStyle = q.cor;
      bloco(c, u(q.x), u(q.y), u(q.l), u(q.a), raio);
    }

    // 3. textos
    c.textBaseline = "alphabetic";
    c.textAlign = "left";

    // Cargo, na tarja azul, com a lapela branca e a estrelinha na ponta.
    var altTarja = u(0.090);
    ajustarFonte(c, CARGO, "Archivo", "800", altTarja * 0.60,
                 u(0.566) - u(0.10) - u(0.055), "0.5px");
    c.fillStyle = BRANCO;
    c.fillText(CARGO, u(0.030), u(0.048) + altTarja * 0.72);
    c.fillStyle = BRANCO;
    bloco(c, u(0.494), u(0.036), u(0.115), u(0.115), raio);
    estrela(c, u(0.551), u(0.093), u(0.040), VERMELHO, 0);

    // Bloco verde: DELEGADO miúdo em cima, YASSER tomando o resto.
    usarFonte(c, "500", Math.round(u(0.078)), "Oswald", (lb * 0.004) + "px");
    c.fillStyle = BRANCO;
    c.fillText(NOME_TOPO, u(0.115), u(0.212));
    ajustarFonte(c, NOME_BASE, "Oswald", "700", u(0.300), u(0.885));
    c.fillStyle = BRANCO;
    c.fillText(NOME_BASE, u(0.112), u(0.452));

    // Bloco amarelo: o número, que é o que precisa ser lembrado na urna.
    ajustarFonte(c, NUMERO, "Oswald", "700", u(0.420), u(0.880));
    c.fillStyle = VERMELHO;
    c.fillText(NUMERO, u(0.140), u(0.855));

    // Faixa vermelha: o lema, à mão.
    ajustarFonte(c, SLOGAN, "Caveat Brush", "400", u(0.150), u(0.930));
    c.fillStyle = BRANCO;
    c.fillText(SLOGAN, u(0.140), u(0.995));

    // Estrela do PT, girada como um selo carimbado no canto.
    estrela(c, u(1.021), u(0.100), u(0.100), VERMELHO, 0.26);
    usarFonte(c, "800", Math.round(u(0.055)), "Archivo", "0.5px");
    c.fillStyle = BRANCO;
    c.textAlign = "center";
    c.fillText("PT", u(1.021), u(0.122));

    adesivoPronto = { lona: lona, lb: lb };
    return lona;
  }

  /* =============================================================
     Moldura da foto
     =============================================================

     A foto entra cobrindo o quadro inteiro (o menor lado é que manda), com
     a aproximação e o deslocamento que a pessoa escolheu. O deslocamento é
     guardado em fração do lado do quadro, e não em pixel: assim o
     enquadramento sobrevive à troca de formato, em que o quadro muda de
     tamanho. */
  function limiteDeslocamento(lado) {
    var f = estado.foto;
    if (!f) return { x: 0, y: 0 };
    var escala = Math.max(lado / f.imagem.naturalWidth,
                          lado / f.imagem.naturalHeight) * f.zoom;
    return {
      x: Math.max(0, (f.imagem.naturalWidth * escala - lado) / 2),
      y: Math.max(0, (f.imagem.naturalHeight * escala - lado) / 2)
    };
  }

  function prenderDeslocamento(lado) {
    var f = estado.foto;
    if (!f) return;
    var lim = limiteDeslocamento(lado);
    f.dx = Math.max(-lim.x / lado, Math.min(lim.x / lado, f.dx));
    f.dy = Math.max(-lim.y / lado, Math.min(lim.y / lado, f.dy));
  }

  function molduraDaFoto(W, H) {
    var a = arranjo();
    var lado = a.foto.lado * W;
    var x = a.foto.x * W;
    var y = a.foto.y * H;
    var margem = lado * 0.038;      // a borda branca da moldura, tipo foto revelada

    ctx.save();
    ctx.shadowColor = "rgba(30,22,10,0.22)";
    ctx.shadowBlur = W * 0.022;
    ctx.shadowOffsetY = W * 0.008;
    ctx.fillStyle = BRANCO;
    ctx.fillRect(x, y, lado, lado);
    ctx.restore();

    var ix = x + margem;
    var iy = y + margem;
    var il = lado - margem * 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, il, il);
    ctx.clip();

    var f = estado.foto;
    if (f) {
      prenderDeslocamento(il);
      var escala = Math.max(il / f.imagem.naturalWidth,
                            il / f.imagem.naturalHeight) * f.zoom;
      var lf = f.imagem.naturalWidth * escala;
      var af = f.imagem.naturalHeight * escala;
      ctx.drawImage(f.imagem,
                    ix + (il - lf) / 2 + f.dx * il,
                    iy + (il - af) / 2 + f.dy * il, lf, af);
    } else {
      // Sem foto ainda: o mesmo espaço reservado da arte oficial.
      ctx.fillStyle = "#eef0f6";
      ctx.fillRect(ix, iy, il, il);
      var cx = ix + il / 2;
      var cy = iy + il * 0.42;
      var ic = il * 0.20;
      ctx.fillStyle = AZUL;
      bloco(ctx, cx - ic, cy - ic * 0.78, ic * 2, ic * 1.56, ic * 0.22);
      ctx.fillStyle = "#eef0f6";
      ctx.beginPath();
      ctx.arc(cx - ic * 0.42, cy - ic * 0.26, ic * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - ic * 0.80, cy + ic * 0.62);
      ctx.lineTo(cx - ic * 0.05, cy - ic * 0.20);
      ctx.lineTo(cx + ic * 0.80, cy + ic * 0.62);
      ctx.closePath();
      ctx.fill();
      var tam = ajustarFonte(ctx, "SUA FOTO AQUI", "Oswald", "700", il * 0.15,
                             il * 0.80, (il * 0.004) + "px");
      ctx.fillStyle = AZUL;
      ctx.textAlign = "center";
      ctx.fillText("SUA FOTO AQUI", cx, iy + il * 0.80 + tam * 0.35);
    }
    ctx.restore();

    return { x: x, y: y, lado: lado, interno: il };
  }

  /* =============================================================
     Desenho do cartaz
     ============================================================= */

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

  function desenharAssinatura(W, H) {
    var quem = assinatura();
    if (!quem) return;
    var a = arranjo();
    var xDir = a.assin.x * W;
    var y = a.assin.y * H;
    var nome = quem.nome || quem.cidade;
    var temCidade = !!(quem.nome && quem.cidade);

    var tamNome = ajustarFonte(ctx, nome, "Caveat Brush", "400", W * 0.062,
                               W * 0.40);
    var largNome = ctx.measureText(nome).width;
    ctx.fillStyle = NAVY;
    ctx.textAlign = "right";
    ctx.fillText(nome, xDir, y);
    rubrica(xDir - Math.max(largNome, W * 0.10), y + tamNome * 0.22,
            Math.max(largNome, W * 0.10), VERMELHO);

    if (temCidade) {
      var tamCidade = ajustarFonte(ctx, quem.cidade.toUpperCase() + " · GOIÁS",
                                   "IBM Plex Mono", "500", W * 0.024, W * 0.40,
                                   (W * 0.003) + "px");
      ctx.fillStyle = "rgba(16,29,63,0.78)";
      ctx.fillText(quem.cidade.toUpperCase() + " · GOIÁS", xDir,
                   y + tamNome * 0.62 + tamCidade * 1.1);
    }
    ctx.textAlign = "left";
  }

  function desenhar() {
    var formato = FORMATOS[estado.formato];
    var W = formato.largura;
    var H = formato.altura;
    tela.width = W;
    tela.height = H;

    var pose = poseAtual();

    return Promise.all([fontesProntas(), imagemDaPose(pose.id), imagemDoRodape()])
      .then(function (r) {
        var imgYasser = r[1];
        var imgRodape = r[2];
        var a = arranjo();
        var altRodape = RODAPE_ALT * (W / RODAPE_LARG);
        var topoRodape = H - altRodape;
        // A arte útil termina onde a faixa começa: é até aí que o creme desce
        // e é aí que o Delegado se apoia.
        var alturaArte = topoRodape;

        ctx.clearRect(0, 0, W, H);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        if (TEM_ESPACAMENTO) ctx.letterSpacing = "0px";

        /* --- Fundo ---------------------------------------------------------- */
        fundo(W, H, alturaArte);

        /* --- O Delegado ------------------------------------------------------
           Sobe da faixa do rodapé, alinhado pelo centro da cabeça. Poses de
           braço aberto passam por baixo da moldura da foto — o que fica por
           trás dela é ombro e braço, e a moldura é desenhada depois, então a
           sobreposição some sozinha. */
        var altYasser = a.yasser.altura * W;
        var largYasser = altYasser *
                         (imgYasser.naturalWidth / imgYasser.naturalHeight);
        var xYasser = a.yasser.cabeca * W - largYasser * pose.cabeca;
        var yYasser = alturaArte - altYasser + W * 0.004;  // encosta na faixa

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, topoRodape);
        ctx.clip();
        ctx.shadowColor = "rgba(40,28,6,0.30)";
        ctx.shadowBlur = W * 0.030;
        ctx.shadowOffsetX = W * 0.004;
        ctx.shadowOffsetY = W * 0.008;
        ctx.drawImage(imgYasser, xYasser, yYasser, largYasser, altYasser);
        ctx.restore();

        /* --- Moldura com a foto de quem monta -------------------------------- */
        molduraDaFoto(W, H);

        /* --- Assinatura de quem montou --------------------------------------- */
        desenharAssinatura(W, H);

        /* --- Faixa do rodapé -------------------------------------------------- */
        ctx.drawImage(imgRodape, 0, topoRodape, W, altRodape);

        /* --- Adesivo do 13007 -------------------------------------------------
           Depois da faixa, e não antes: na arte oficial o adesivo é a última
           coisa colada, e a ponta de baixo dele passa por cima da faixa
           azul-marinho. Desenhado antes, a faixa cortaria o lema. */
        var lb = a.adesivo.largura * W / 1.16;   // a lona tem 1,16 da largura do verde
        var adesivo = montarAdesivo(Math.round(lb));
        // A lona já sai no tamanho final, então vai para a arte pixel a pixel.
        var largAdes = adesivo.width;
        var altAdes = adesivo.height;
        ctx.save();
        ctx.translate(a.adesivo.cx * W, a.adesivo.base * H - altAdes / 2);
        ctx.rotate(-2 * Math.PI / 180);
        ctx.shadowColor = "rgba(40,28,6,0.32)";
        ctx.shadowBlur = W * 0.028;
        ctx.shadowOffsetY = W * 0.010;
        ctx.drawImage(adesivo, -largAdes / 2, -altAdes / 2, largAdes, altAdes);
        ctx.restore();

        /* --- Identificação legal, na lateral -----------------------------------
           Girada 90°, lida de baixo para cima como lombada de livro, rente à
           borda direita — a esquerda é do Delegado e do adesivo.

           As duas linhas são medidas pela mais longa, para saírem no mesmo
           corpo. Depois do rotate(-90°) o eixo y local aponta para a direita
           da tela, então o deslocamento negativo joga a segunda linha para
           dentro da arte, encostando na primeira. */
        var corpoLegal = ajustarFonte(ctx, LEGAL_COLIGACAO, "IBM Plex Mono", "500",
                                      W * 0.017, alturaArte * 0.72,
                                      (W * 0.0015) + "px");
        ctx.save();
        ctx.translate(W * 0.982, alturaArte * 0.965);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(16,29,63,0.55)";
        ctx.fillText(LEGAL_CARGO, 0, 0);
        ctx.fillText(LEGAL_COLIGACAO, 0, -corpoLegal * 1.35);
        ctx.restore();
        ctx.textAlign = "left";

        estado.desenhou = true;
        vazio.hidden = true;
        atualizarDescricao();
      });
  }

  /* Redesenho pedido de fora: no arrasto chegam dezenas por segundo, e cada
     um refaz o cartaz inteiro. Um quadro por vez basta. */
  var pedido = null;
  function redesenhar() {
    if (pedido) return;
    pedido = requestAnimationFrame(function () {
      pedido = null;
      desenhar();
    });
  }

  /* Descrição textual da imagem gerada — o canvas não é lido por leitor de
     tela, então o resultado precisa existir também em texto. */
  function atualizarDescricao() {
    var quem = assinatura();
    var assinado = "";
    if (quem) {
      assinado = " Ao lado, assinado à mão por " + (quem.nome || quem.cidade) +
                 (quem.nome && quem.cidade ? ", de " + quem.cidade : "") + ".";
    }
    tela.setAttribute(
      "aria-label",
      "Cartaz de campanha no formato " +
      FORMATOS[estado.formato].rotulo.toLowerCase() +
      ", sobre fundo amarelo em degradê: à esquerda o Delegado Yasser " +
      poseAtual().alt + " e, à direita, " +
      (estado.foto ? "sua foto dentro de uma moldura branca"
                   : "uma moldura branca vazia com o aviso Sua foto aqui") +
      "." + assinado +
      " Colado sobre o peito do Delegado, o adesivo da campanha: tarja azul " +
      "Deputado Estadual com a estrela, bloco verde Delegado Yasser, bloco " +
      "amarelo com o número 13007 em vermelho, faixa vermelha com o lema " +
      "Goiás seguro para todos e a estrela do PT. No rodapé, faixa " +
      "azul-marinho com " + SITE + " e " + INSTAGRAM +
      ". Na lateral direita, em letras pequenas na vertical: " + LEGAL + "."
    );
  }

  /* =============================================================
     Entrada da foto
     ============================================================= */

  function usarFoto(arquivo) {
    if (estado.ocupado) return;
    estado.ocupado = true;
    raiz.classList.add("fcy--carregando");
    avisar("Abrindo sua foto…");

    var url = URL.createObjectURL(arquivo);
    carregarImagem(url)
      .then(function (original) {
        /* 1600 px no maior lado: a moldura nunca passa de 780 px de lado
           mesmo no story, e segurar um JPEG de 12 MP na memória derruba
           celular modesto. O redesenho no arrasto também fica mais leve. */
        var escala = Math.min(1, 1600 / Math.max(original.width, original.height));
        var img = original;
        if (escala < 1) {
          var lona = document.createElement("canvas");
          lona.width = Math.round(original.width * escala);
          lona.height = Math.round(original.height * escala);
          lona.getContext("2d").drawImage(original, 0, 0, lona.width, lona.height);
          img = lona;
          // canvas não tem naturalWidth; o resto do código pede por esse nome
          img.naturalWidth = lona.width;
          img.naturalHeight = lona.height;
        }
        URL.revokeObjectURL(url);
        estado.foto = { imagem: img, zoom: 1, dx: 0, dy: 0 };
        controleZoom.value = "1";
        return desenhar();
      })
      .then(function () {
        painelAcoes.hidden = false;
        painelAjuste.hidden = false;
        raiz.classList.add("fcy--comfoto");
        // No celular os passos empurram a montagem para baixo da dobra: sem
        // isto, quem escolhe a foto não vê o resultado aparecer.
        if (tela.scrollIntoView) {
          var suave = !(window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
          tela.scrollIntoView({ block: "center",
                                behavior: suave ? "smooth" : "auto" });
        }
        avisar("Pronto! Arraste a foto dentro da moldura para enquadrar do " +
               "jeito que você quiser.");
      })
      .catch(function (erro) {
        if (window.console && console.warn) console.warn("[fcy]", erro);
        avisar("Não consegui abrir essa imagem. Tente outra, em JPG, PNG ou WebP.");
      })
      .then(function () {
        estado.ocupado = false;
        raiz.classList.remove("fcy--carregando");
      });
  }

  /* =============================================================
     Enquadramento: arrasto, roda, teclado e o controle de aproximar
     ============================================================= */

  function ladoInterno() {
    var a = arranjo();
    var lado = a.foto.lado * FORMATOS[estado.formato].largura;
    return lado - lado * 0.038 * 2;
  }

  function mover(dxPx, dyPx) {
    if (!estado.foto) return;
    var il = ladoInterno();
    estado.foto.dx += dxPx / il;
    estado.foto.dy += dyPx / il;
    prenderDeslocamento(il);
    redesenhar();
  }

  function aproximar(passo) {
    if (!estado.foto) return;
    var novo = Math.max(1, Math.min(3, estado.foto.zoom + passo));
    if (novo === estado.foto.zoom) return;
    estado.foto.zoom = novo;
    controleZoom.value = String(novo);
    prenderDeslocamento(ladoInterno());
    redesenhar();
  }

  // Um pixel na tela do navegador vale mais de um pixel no canvas: o canvas
  // tem 1080 de largura e aparece com a largura que couber no layout.
  function fatorTela() {
    var caixa = tela.getBoundingClientRect();
    return caixa.width ? tela.width / caixa.width : 1;
  }

  /* Um dedo arrasta, dois dedos aproximam. Os ponteiros ativos ficam numa
     lista porque no celular chegam dois ao mesmo tempo e o gesto de pinça
     precisa da distância entre eles — sem isso, no aparelho onde a maioria
     vai montar o cartaz só daria para enquadrar pelo controle deslizante. */
  var ponteiros = [];
  var pincaInicial = null;

  function acharPonteiro(id) {
    for (var i = 0; i < ponteiros.length; i++) {
      if (ponteiros[i].id === id) return i;
    }
    return -1;
  }

  function distanciaPinca() {
    var dx = ponteiros[0].x - ponteiros[1].x;
    var dy = ponteiros[0].y - ponteiros[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  tela.addEventListener("pointerdown", function (ev) {
    if (!estado.foto) return;
    if (acharPonteiro(ev.pointerId) === -1) {
      ponteiros.push({ id: ev.pointerId, x: ev.clientX, y: ev.clientY });
    }
    if (ponteiros.length === 2) {
      pincaInicial = { distancia: distanciaPinca(), zoom: estado.foto.zoom };
    }
    if (tela.setPointerCapture) {
      try { tela.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura */ }
    }
  });

  tela.addEventListener("pointermove", function (ev) {
    if (!estado.foto) return;
    var i = acharPonteiro(ev.pointerId);
    if (i === -1) return;
    var anterior = ponteiros[i];
    var dx = ev.clientX - anterior.x;
    var dy = ev.clientY - anterior.y;
    ponteiros[i] = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    ev.preventDefault();

    if (ponteiros.length >= 2 && pincaInicial) {
      var razao = distanciaPinca() / pincaInicial.distancia;
      aproximar(pincaInicial.zoom * razao - estado.foto.zoom);
      return;
    }
    var f = fatorTela();
    mover(dx * f, dy * f);
  });

  function soltar(ev) {
    var i = acharPonteiro(ev.pointerId);
    if (i > -1) ponteiros.splice(i, 1);
    if (ponteiros.length < 2) pincaInicial = null;
    if (tela.releasePointerCapture && ev.pointerId !== undefined) {
      try { tela.releasePointerCapture(ev.pointerId); } catch (e) { /* já solto */ }
    }
  }
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);

  tela.addEventListener("wheel", function (ev) {
    if (!estado.foto) return;
    ev.preventDefault();
    aproximar(ev.deltaY < 0 ? 0.08 : -0.08);
  }, { passive: false });

  /* Teclado: quem não usa mouse ou toque precisa poder enquadrar do mesmo
     jeito. O canvas recebe foco (tabindex no HTML) e responde às setas. */
  tela.addEventListener("keydown", function (ev) {
    if (!estado.foto) return;
    var passo = ladoInterno() * (ev.shiftKey ? 0.10 : 0.03);
    var tratou = true;
    switch (ev.key) {
      case "ArrowLeft":  mover(-passo, 0); break;
      case "ArrowRight": mover(passo, 0); break;
      case "ArrowUp":    mover(0, -passo); break;
      case "ArrowDown":  mover(0, passo); break;
      case "+": case "=": aproximar(0.1); break;
      case "-": case "_": aproximar(-0.1); break;
      case "Home": centralizar(); break;
      default: tratou = false;
    }
    if (tratou) ev.preventDefault();
  });

  function centralizar() {
    if (!estado.foto) return;
    estado.foto.zoom = 1;
    estado.foto.dx = 0;
    estado.foto.dy = 0;
    controleZoom.value = "1";
    redesenhar();
    avisar("Enquadramento no ponto de partida.");
  }

  controleZoom.addEventListener("input", function () {
    if (!estado.foto) return;
    estado.foto.zoom = parseFloat(controleZoom.value) || 1;
    prenderDeslocamento(ladoInterno());
    redesenhar();
  });
  btnCentralizar.addEventListener("click", centralizar);

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
        redesenhar();
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
          // O adesivo é montado no tamanho do formato; trocar de formato
          // invalida a lona guardada.
          adesivoPronto = null;
          redesenhar();
        });
      })(botoes[i]);
    }
  }

  var esperaTexto = null;
  function aoDigitar() {
    clearTimeout(esperaTexto);
    esperaTexto = setTimeout(redesenhar, 220);
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
    usarFoto(arquivo);
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

  /* O cartaz vazio é desenhado quando a seção chega perto da tela: quem
     passa longe dela não baixa os recortes nem a faixa do rodapé, e quem
     chega já vê a arte pronta esperando a foto. */
  function primeiroDesenho() {
    if (estado.desenhou) return;
    desenhar().catch(function (erro) {
      if (window.console && console.warn) console.warn("[fcy]", erro);
    });
  }

  if (window.IntersectionObserver) {
    var vigia = new IntersectionObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) {
        if (entradas[i].isIntersecting) {
          vigia.disconnect();
          primeiroDesenho();
        }
      }
    }, { rootMargin: "300px" });
    vigia.observe(raiz);
  } else {
    primeiroDesenho();
  }
})();
