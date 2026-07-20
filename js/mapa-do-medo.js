/* =============================================================
   Delegado Yasser — Mapa do Medo
   Mapa participativo de insegurança (Leaflet + OpenStreetMap).
   Vanilla JS. Depende apenas de Leaflet (carregado via CDN no HTML).

   Relato em 3 passos (wizard):
   1) Local  — busca de endereço com sugestões (autocomplete),
               geolocalização ou "apontar no mapa" (pino central:
               arrasta-se o mapa sob um pino fixo e confirma).
   2) Relato — categoria em chips visuais, referência e descrição.
   3) Envio  — identificado (com contato) OU anônimo (sem nenhum
               dado pessoal), consentimento e envio.

   Fluxo de dados (mesmo padrão do resto do site):
   - Envio do relato  → POST (URLSearchParams) para um Web App do
     Apps Script (MAPA_ENDPOINT), que grava numa planilha Google.
   - Pontos no mapa   → GET de uma planilha publicada como CSV
     (MAPA_CSV_URL), exibindo apenas linhas com status "aprovado".
   Enquanto os dois estiverem vazios, o mapa mostra PONTOS DE EXEMPLO
   e o envio é apenas simulado (marcado como "pendente", só você vê).
   Guia de publicação em docs/MAPA-DO-MEDO.md.
   ============================================================= */

(function () {
  "use strict";

  if (typeof window.L === "undefined") {
    var alvoErro = document.getElementById("mapaNota");
    if (alvoErro) alvoErro.textContent = "Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.";
    return;
  }

  /* =============================================================
     1) CONFIGURAÇÃO — troque quando publicar o backend
     ============================================================= */
  var MAPA_ENDPOINT = "https://script.google.com/macros/s/AKfycbzWzAUEDmvQCQbW_GwhTYtHbz7W5-n8OaxknSojOzbu38CKiWYKjoPyW2OwHSIORdew-w/exec"; // Web App do Apps Script (/exec) — recebe os relatos
  var MAPA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOdq3tocrX-iVKYZbdO_4VmDZZ0iwFNRQncCXoFh8SXHTeojgNukScoAPHBs6IWzxTfUh2rizujZbz/pub?output=csv";  // Planilha publicada como CSV — pontos aprovados

  var SERVIDO_VIA_HTTP =
    location.protocol === "http:" || location.protocol === "https:";

  // Nominatim (OpenStreetMap) — geocodificação gratuita, sem chave.
  // viewbox = minLng,maxLat,maxLng,minLat → caixa de Goiás.
  var NOMINATIM = "https://nominatim.openstreetmap.org";
  var VIEWBOX_GO = "&bounded=1&viewbox=-53.6,-12.3,-45.7,-19.7";

  /* Categorias — fonte única para legenda, chips, pinos e popups. */
  var CATEGORIAS = [
    { id: "iluminacao",   nome: "Iluminação / ruas escuras",       emoji: "💡", cor: "#d98200" },
    { id: "mato",         nome: "Mato alto / abandono",            emoji: "🌿", cor: "#2e7d32" },
    { id: "violencia",    nome: "Alto índice de violência",        emoji: "⚠️", cor: "#c8102e" },
    { id: "policiamento", nome: "Falta de policiamento / câmeras", emoji: "🚔", cor: "#1d63d8" },
    { id: "drogas",       nome: "Uso / tráfico de drogas",         emoji: "🚬", cor: "#6d28d9" },
    { id: "mulheres",     nome: "Insegurança para mulheres",       emoji: "🚺", cor: "#c2185b" },
    { id: "infra",        nome: "Infraestrutura / outros",         emoji: "🛠️", cor: "#55606b" }
  ];
  var CAT = {};
  CATEGORIAS.forEach(function (c) { CAT[c.id] = c; });

  /* Pontos de exemplo (usados só enquanto não há planilha configurada) */
  var EXEMPLOS = [
    { lat: -16.686, lng: -49.264, categoria: "violencia",    titulo: "Terminal e entorno à noite", cidade: "Goiânia",              descricao: "Movimento intenso e pouca presença policial após as 22h." },
    { lat: -16.328, lng: -48.953, categoria: "iluminacao",   titulo: "Avenida sem iluminação",     cidade: "Anápolis",             descricao: "Trecho longo com postes queimados; pedestres evitam passar à noite." },
    { lat: -15.537, lng: -47.334, categoria: "mato",         titulo: "Terreno baldio com mato alto", cidade: "Formosa",            descricao: "Lote abandonado que favorece esconderijo e descarte de lixo." },
    { lat: -16.252, lng: -47.950, categoria: "policiamento", titulo: "Praça sem ronda",            cidade: "Luziânia",             descricao: "Moradores relatam ausência de policiamento nos fins de semana." },
    { lat: -16.823, lng: -49.246, categoria: "mulheres",     titulo: "Passagem isolada",           cidade: "Aparecida de Goiânia", descricao: "Passarela mal iluminada onde já houve casos de assédio." },
    { lat: -17.797, lng: -50.930, categoria: "drogas",       titulo: "Praça com uso de drogas",    cidade: "Rio Verde",            descricao: "Ponto de uso frequente; famílias deixaram de usar a praça." }
  ];

  /* Utilitários */
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  function val(el) { return el && el.value ? el.value.trim() : ""; }

  /* =============================================================
     2) MAPA
     ============================================================= */
  var CENTRO_GO = [-15.93, -49.83];
  var mapa = L.map("mapa", {
    center: CENTRO_GO,
    zoom: 7,
    minZoom: 6,
    maxZoom: 18,
    zoomControl: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(mapa);

  // Restringe a navegação à região de Goiás (com folga)
  var LIMITES = L.latLngBounds([-19.7, -53.6], [-12.3, -45.7]);
  mapa.setMaxBounds(LIMITES.pad(0.15));

  // Contorno + máscara de Goiás (malha oficial IBGE, embutida em js/goias-geo.js)
  var GOIAS_RING = null; // anel externo em [lng, lat] p/ teste ponto-em-polígono
  if (window.GOIAS_GEOJSON && window.GOIAS_GEOJSON.features && window.GOIAS_GEOJSON.features[0]) {
    var geomGO = window.GOIAS_GEOJSON.features[0].geometry;
    GOIAS_RING = geomGO.type === "Polygon"
      ? geomGO.coordinates[0]
      : geomGO.coordinates[0][0]; // MultiPolygon → 1º anel do 1º polígono

    // Máscara: escurece tudo FORA de Goiás (mundo com o estado recortado como buraco)
    var mundo = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
    var anelGoiasLatLng = GOIAS_RING.map(function (p) { return [p[1], p[0]]; });
    L.polygon([mundo, anelGoiasLatLng], {
      stroke: false,
      fillColor: "#141013",
      fillOpacity: 0.6,
      interactive: false // deixa o clique passar para o mapa (marcação)
    }).addTo(mapa);

    // Contorno vermelho da marca por cima da máscara
    var contorno = L.geoJSON(window.GOIAS_GEOJSON, {
      interactive: false,
      style: { color: "#c8102e", weight: 3, opacity: 0.95, fill: false }
    }).addTo(mapa);

    try {
      var bordas = contorno.getBounds();
      mapa.fitBounds(bordas, { padding: [14, 14] });
      mapa.setMaxBounds(bordas.pad(0.4));
      mapa.setMinZoom(mapa.getBoundsZoom(bordas) - 1);
    } catch (e) {}
  }

  // Ponto está dentro do estado de Goiás? (ray casting no anel do IBGE)
  function dentroDeGoias(lat, lng) {
    if (!GOIAS_RING) return true; // sem malha carregada → não bloqueia
    var x = lng, y = lat, dentro = false;
    for (var i = 0, j = GOIAS_RING.length - 1; i < GOIAS_RING.length; j = i++) {
      var xi = GOIAS_RING[i][0], yi = GOIAS_RING[i][1];
      var xj = GOIAS_RING[j][0], yj = GOIAS_RING[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }

  var camadaPontos = L.layerGroup().addTo(mapa);

  var filtros = {};
  CATEGORIAS.forEach(function (c) { filtros[c.id] = true; });

  var pontos = []; // { dados, marker, categoria }

  function iconeCategoria(catId, extraClasse) {
    var c = CAT[catId] || CAT.infra;
    var span = "<span class='pino__corpo' style='--cor:" + c.cor + "'><span>" + c.emoji + "</span></span>";
    return L.divIcon({
      className: "pino " + (extraClasse || ""),
      html: span,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    });
  }

  // Monta o conteúdo do popup via DOM + textContent (nunca innerHTML com
  // dado externo → sem risco de XSS a partir da planilha).
  function popupEl(d) {
    var c = CAT[d.categoria] || CAT.infra;
    var wrap = document.createElement("div");
    wrap.className = "popup";

    var cat = document.createElement("span");
    cat.className = "popup__cat";
    cat.style.setProperty("--cor", c.cor);
    cat.textContent = c.emoji + " " + c.nome;
    wrap.appendChild(cat);

    var titulo = document.createElement("strong");
    titulo.className = "popup__titulo";
    titulo.textContent = d.titulo || "Ponto marcado";
    wrap.appendChild(titulo);

    if (d.descricao) {
      var desc = document.createElement("p");
      desc.className = "popup__desc";
      desc.textContent = d.descricao;
      wrap.appendChild(desc);
    }

    var meta = document.createElement("span");
    meta.className = "popup__meta";
    var partes = [];
    if (d.cidade) partes.push(d.cidade);
    if (d.data) partes.push(d.data);
    if (d.pendente) partes.push("aguardando moderação");
    meta.textContent = partes.join(" · ");
    wrap.appendChild(meta);

    return wrap;
  }

  function adicionarPonto(d) {
    var classe = d.pendente ? "pino--pendente" : "";
    var m = L.marker([d.lat, d.lng], {
      icon: iconeCategoria(d.categoria, classe),
      keyboard: true,
      title: (CAT[d.categoria] || CAT.infra).nome + " — " + (d.titulo || "")
    });
    m.bindPopup(popupEl(d));
    var registro = { dados: d, marker: m, categoria: d.categoria };
    pontos.push(registro);
    if (filtros[d.categoria] !== false) m.addTo(camadaPontos);
    return registro;
  }

  function aplicarFiltros() {
    pontos.forEach(function (p) {
      var visivel = filtros[p.categoria] !== false;
      if (visivel && !camadaPontos.hasLayer(p.marker)) p.marker.addTo(camadaPontos);
      else if (!visivel && camadaPontos.hasLayer(p.marker)) camadaPontos.removeLayer(p.marker);
    });
  }

  /* =============================================================
     3) LEGENDA / FILTROS + CHIPS DE CATEGORIA (do formulário)
     ============================================================= */
  var legendaEl = document.getElementById("legenda");
  if (legendaEl) {
    CATEGORIAS.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "legenda__item";

      var label = document.createElement("label");
      label.className = "legenda__label";

      var check = document.createElement("input");
      check.type = "checkbox";
      check.className = "legenda__check";
      check.checked = true;
      check.setAttribute("aria-label", "Mostrar: " + c.nome);
      check.addEventListener("change", function () {
        filtros[c.id] = check.checked;
        li.classList.toggle("legenda__item--off", !check.checked);
        aplicarFiltros();
      });

      var pino = document.createElement("span");
      pino.className = "legenda__pino";
      pino.style.setProperty("--cor", c.cor);
      pino.setAttribute("aria-hidden", "true");
      pino.textContent = c.emoji;

      var txt = document.createElement("span");
      txt.textContent = c.nome;

      label.appendChild(check);
      label.appendChild(pino);
      label.appendChild(txt);
      li.appendChild(label);
      legendaEl.appendChild(li);
    });
  }

  // Chips de categoria (passo 2) — escolha visual em 1 toque
  var chipsWrap = document.getElementById("chipsCategorias");
  if (chipsWrap) {
    CATEGORIAS.forEach(function (c) {
      var label = document.createElement("label");
      label.className = "chip";

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "categoria";
      input.value = c.id;
      input.className = "chip__radio";

      var pino = document.createElement("span");
      pino.className = "chip__pino";
      pino.style.setProperty("--cor", c.cor);
      pino.setAttribute("aria-hidden", "true");
      pino.textContent = c.emoji;

      var nome = document.createElement("span");
      nome.className = "chip__nome";
      nome.textContent = c.nome;

      label.appendChild(input);
      label.appendChild(pino);
      label.appendChild(nome);
      chipsWrap.appendChild(label);
    });

    chipsWrap.addEventListener("change", function () {
      atualizarChips();
      if (marcadorTemp) marcadorTemp.setIcon(iconeCategoria(categoriaSelecionada() || "infra", "pino--temp"));
    });
  }

  function categoriaSelecionada() {
    var el = document.querySelector('input[name="categoria"]:checked');
    return el ? el.value : "";
  }
  function atualizarChips() {
    if (!chipsWrap) return;
    Array.prototype.forEach.call(chipsWrap.querySelectorAll(".chip"), function (l) {
      var i = l.querySelector("input");
      l.classList.toggle("chip--ativa", !!(i && i.checked));
    });
  }

  /* =============================================================
     4) PAINEL (dialog) + NAVEGAÇÃO POR PASSOS
     ============================================================= */
  var painel = document.getElementById("relatoPainel");
  var overlay = document.getElementById("relatoOverlay");
  var fechar = document.getElementById("relatoFechar");
  var form = document.getElementById("formRelato");
  var stepperEl = document.getElementById("stepper");
  var stepperItens = stepperEl ? stepperEl.querySelectorAll(".stepper__item") : [];
  var secoesPasso = [
    document.getElementById("passo1"),
    document.getElementById("passo2"),
    document.getElementById("passo3")
  ];
  var latInput = document.getElementById("rLat");
  var lngInput = document.getElementById("rLng");
  var statusEl = document.getElementById("relatoStatus");
  var botaoEnviar = document.getElementById("relatoEnviar");
  var sucessoEl = document.getElementById("relatoSucesso");

  var focoAnterior = null;
  var passoAtual = 1;

  function abrirPainel() {
    if (!painel) return;
    focoAnterior = document.activeElement;
    painel.hidden = false;
    if (overlay) overlay.hidden = false;
    painel.focus();
  }
  function fecharPainel() {
    if (!painel) return;
    if (sucessoEl && !sucessoEl.hidden) resetTudo(); // saiu da tela de sucesso → próxima abertura começa limpa
    painel.hidden = true;
    if (overlay) overlay.hidden = true;
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }
  // Esconde o painel sem resetar os campos (usado ao ir apontar no mapa)
  function ocultarPainel() {
    if (painel) painel.hidden = true;
    if (overlay) overlay.hidden = true;
  }

  if (fechar) fechar.addEventListener("click", fecharPainel);
  if (overlay) overlay.addEventListener("click", fecharPainel);

  var botaoAdicionar = document.getElementById("botaoAdicionar");
  if (botaoAdicionar) botaoAdicionar.addEventListener("click", abrirPainel);

  function irPara(n) {
    passoAtual = n;
    secoesPasso.forEach(function (sec, i) { if (sec) sec.hidden = i + 1 !== n; });
    Array.prototype.forEach.call(stepperItens, function (li, i) {
      var num = i + 1;
      li.classList.toggle("stepper__item--ativo", num === n);
      li.classList.toggle("stepper__item--feito", num < n);
      if (num === n) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
      var numEl = li.querySelector(".stepper__num");
      if (numEl) numEl.textContent = num < n ? "✓" : String(num);
    });
    esconderStatus();
    if (painel) painel.scrollTop = 0;
    var pergunta = secoesPasso[n - 1] && secoesPasso[n - 1].querySelector(".passo__pergunta");
    if (pergunta && !painel.hidden) pergunta.focus();
  }

  function mostrarStatus(msg, tipo) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = "relato-status relato-status--" + (tipo || "info");
  }
  function esconderStatus() {
    if (statusEl) { statusEl.hidden = true; statusEl.textContent = ""; }
  }

  /* =============================================================
     5) PASSO 1 — LOCAL
     (busca com sugestões · geolocalização · pino central no mapa)
     ============================================================= */
  var buscaInput = document.getElementById("rBusca");
  var sugestoesEl = document.getElementById("listaSugestoes");
  var localCard = document.getElementById("localCard");
  var localCardEndereco = document.getElementById("localCardEndereco");
  var editarEndereco = document.getElementById("editarEndereco");
  var ajustarNoMapa = document.getElementById("ajustarNoMapa");
  var logradouroInput = document.getElementById("rLogradouro");
  var numeroInput = document.getElementById("rNumero");
  var bairroInput = document.getElementById("rBairro");
  var cidadeInput = document.getElementById("rCidade");
  var usarLocalizacao = document.getElementById("usarLocalizacao");
  var usarLocalizacaoNota = document.getElementById("usarLocalizacaoNota");
  var escolherNoMapa = document.getElementById("escolherNoMapa");
  var btnParaPasso2 = document.getElementById("paraPasso2");

  var mapaWrap = document.getElementById("mapaWrap");
  var mira = document.getElementById("mira");
  var barraConfirmar = document.getElementById("mapaConfirmar");
  var barraTxt = document.getElementById("mapaConfirmarTxt");
  var btnConfirmarLocal = document.getElementById("confirmarLocal");
  var btnCancelarLocal = document.getElementById("cancelarLocal");

  var marcadorTemp = null;
  var ultimaCoordValida = null;
  var modoMapa = false;

  function limparTemp() {
    if (marcadorTemp) { mapa.removeLayer(marcadorTemp); marcadorTemp = null; }
  }

  function colocarMarcadorTemp(lat, lng) {
    limparTemp();
    marcadorTemp = L.marker([lat, lng], {
      icon: iconeCategoria(categoriaSelecionada() || "infra", "pino--temp"),
      zIndexOffset: 1000,
      draggable: true
    }).addTo(mapa);
    marcadorTemp.on("dragend", function () {
      var p = marcadorTemp.getLatLng();
      if (!dentroDeGoias(p.lat, p.lng)) {
        if (ultimaCoordValida) marcadorTemp.setLatLng(ultimaCoordValida);
        mostrarStatus("O ponto precisa ficar dentro de Goiás.", "erro");
        return;
      }
      definirLocal(p.lat, p.lng, { vista: false });
    });
  }

  // ---- Endereço (Nominatim) ----
  function reverso(lat, lng) {
    var url = NOMINATIM + "/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=" +
      encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng);
    return fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (res) { return (res && res.address) || {}; });
  }

  function aplicarEndereco(a) {
    if (logradouroInput) logradouroInput.value = a.road || a.pedestrian || a.footway || a.cycleway || "";
    if (numeroInput) numeroInput.value = a.house_number || "";
    if (bairroInput) bairroInput.value = a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
    var cid = a.city || a.town || a.village || a.municipality || a.county || "";
    if (cidadeInput && cid) cidadeInput.value = cid;
  }

  function enderecoCurto(a) {
    var rua = a.road || a.pedestrian || a.footway || "";
    if (rua && a.house_number) rua += ", " + a.house_number;
    var bairro = a.suburb || a.neighbourhood || a.quarter || "";
    var cid = a.city || a.town || a.village || a.municipality || "";
    return [rua, bairro, cid].filter(Boolean).join(" · ");
  }

  // Resumo legível do que está nos campos (mostrado no cartão do local)
  function resumoEndereco() {
    var rua = val(logradouroInput), num = val(numeroInput);
    var linha = rua ? rua + (num ? ", " + num : "") : "";
    var texto = [linha, val(bairroInput), val(cidadeInput)].filter(Boolean).join(" · ");
    return texto || "Ponto marcado no mapa (sem endereço mapeado)";
  }

  // Endereço legível para gravar na planilha (coluna "endereco")
  function enderecoComposto() {
    var rua = val(logradouroInput), num = val(numeroInput), bairro = val(bairroInput);
    var linha = rua + (num ? ", " + num : "");
    return [linha, bairro].filter(Boolean).join(" — ");
  }

  // ---- Coração do passo 1: registrar a coordenada escolhida ----
  function definirLocal(lat, lng, opcoes) {
    opcoes = opcoes || {};
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    ultimaCoordValida = [lat, lng];
    colocarMarcadorTemp(lat, lng);
    if (opcoes.vista !== false) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 16));

    if (localCard) localCard.hidden = false;
    if (btnParaPasso2) btnParaPasso2.disabled = false;
    esconderStatus();

    if (opcoes.buscarEndereco === false) {
      if (localCardEndereco) localCardEndereco.textContent = resumoEndereco();
      return;
    }
    if (localCardEndereco) localCardEndereco.textContent = "Buscando endereço aproximado…";
    reverso(lat, lng)
      .then(function (a) { aplicarEndereco(a); })
      .catch(function () { /* silencioso: usuário pode corrigir por escrito */ })
      .then(function () {
        if (localCardEndereco) localCardEndereco.textContent = resumoEndereco();
      });
  }

  // Corrigir endereço por escrito atualiza o cartão na hora
  [logradouroInput, numeroInput, bairroInput, cidadeInput].forEach(function (el) {
    if (!el) return;
    el.addEventListener("input", function () {
      if (latInput.value && localCardEndereco) localCardEndereco.textContent = resumoEndereco();
    });
  });

  // ---- Busca com sugestões (autocomplete) ----
  var sugDados = [];
  var sugAtiva = -1;
  var buscaToken = 0;

  function fecharSugestoes() {
    if (!sugestoesEl) return;
    sugestoesEl.hidden = true;
    sugestoesEl.innerHTML = "";
    sugDados = [];
    sugAtiva = -1;
    if (buscaInput) {
      buscaInput.setAttribute("aria-expanded", "false");
      buscaInput.removeAttribute("aria-activedescendant");
    }
  }

  function destacarSugestao(i) {
    sugAtiva = i;
    Array.prototype.forEach.call(sugestoesEl.children, function (li, idx) {
      li.setAttribute("aria-selected", idx === i ? "true" : "false");
    });
    if (i >= 0 && sugestoesEl.children[i]) {
      buscaInput.setAttribute("aria-activedescendant", sugestoesEl.children[i].id);
      sugestoesEl.children[i].scrollIntoView({ block: "nearest" });
    } else {
      buscaInput.removeAttribute("aria-activedescendant");
    }
  }

  function escolherSugestao(i) {
    var r = sugDados[i];
    if (!r) return;
    var a = r.address || {};
    var lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    aplicarEndereco(a);
    if (buscaInput) buscaInput.value = enderecoCurto(a) || (r.display_name || "").split(",").slice(0, 2).join(",");
    fecharSugestoes();
    definirLocal(lat, lng, { buscarEndereco: false });
  }

  function renderSugestoes(lista) {
    if (!sugestoesEl) return;
    sugDados = (lista || []).filter(function (r) {
      var lat = parseFloat(r.lat), lng = parseFloat(r.lon);
      return !isNaN(lat) && !isNaN(lng) && dentroDeGoias(lat, lng);
    });
    sugestoesEl.innerHTML = "";
    sugAtiva = -1;

    if (!sugDados.length) {
      var vazio = document.createElement("li");
      vazio.className = "sugestoes__vazio";
      vazio.textContent = "Nada encontrado em Goiás — tente incluir a cidade, ou aponte no mapa.";
      sugestoesEl.appendChild(vazio);
    } else {
      sugDados.forEach(function (r, i) {
        var a = r.address || {};
        var li = document.createElement("li");
        li.id = "sugestao-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");

        var principal = document.createElement("strong");
        var rua = a.road || a.pedestrian || (r.display_name || "").split(",")[0];
        principal.textContent = rua + (a.house_number ? ", " + a.house_number : "");

        var sec = document.createElement("small");
        var bairro = a.suburb || a.neighbourhood || "";
        var cid = a.city || a.town || a.village || a.municipality || "";
        sec.textContent = [bairro, cid].filter(Boolean).join(" · ") || "Goiás";

        li.appendChild(principal);
        li.appendChild(sec);
        // mousedown (não click) para vencer o blur do input
        li.addEventListener("mousedown", function (e) { e.preventDefault(); escolherSugestao(i); });
        li.addEventListener("mousemove", function () { destacarSugestao(i); });
        sugestoesEl.appendChild(li);
      });
    }
    sugestoesEl.hidden = false;
    buscaInput.setAttribute("aria-expanded", "true");
  }

  var buscarSugestoes = debounce(function () {
    var q = val(buscaInput);
    if (q.length < 3) { fecharSugestoes(); return; }
    var token = ++buscaToken;
    var url = NOMINATIM + "/search?format=jsonv2&limit=5&countrycodes=br&addressdetails=1" +
      VIEWBOX_GO + "&q=" + encodeURIComponent(q);
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (lista) {
        if (token !== buscaToken) return; // resposta antiga → ignora
        renderSugestoes(lista);
      })
      .catch(function () {
        if (token === buscaToken) fecharSugestoes();
      });
  }, 400);

  if (buscaInput) {
    buscaInput.addEventListener("input", buscarSugestoes);
    buscaInput.addEventListener("blur", function () { setTimeout(fecharSugestoes, 150); });
    buscaInput.addEventListener("keydown", function (e) {
      var abertas = sugestoesEl && !sugestoesEl.hidden && sugDados.length;
      if (e.key === "ArrowDown" && abertas) {
        e.preventDefault();
        destacarSugestao(Math.min(sugAtiva + 1, sugDados.length - 1));
      } else if (e.key === "ArrowUp" && abertas) {
        e.preventDefault();
        destacarSugestao(Math.max(sugAtiva - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault(); // nunca envia o form a partir da busca
        if (abertas) escolherSugestao(sugAtiva >= 0 ? sugAtiva : 0);
      } else if (e.key === "Escape") {
        fecharSugestoes();
      }
    });
  }

  // ---- Geolocalização ----
  if (usarLocalizacao) {
    usarLocalizacao.addEventListener("click", function () {
      if (!navigator.geolocation) {
        mostrarStatus("Seu navegador não permite usar a localização. Busque o endereço ou aponte no mapa.", "info");
        return;
      }
      usarLocalizacao.disabled = true;
      if (usarLocalizacaoNota) usarLocalizacaoNota.textContent = "Localizando…";
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          usarLocalizacao.disabled = false;
          if (usarLocalizacaoNota) usarLocalizacaoNota.textContent = "Ideal se você está no local agora";
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          if (!dentroDeGoias(lat, lng)) {
            mostrarStatus("Sua localização está fora de Goiás. Busque o endereço ou aponte no mapa, dentro do estado.", "erro");
            return;
          }
          definirLocal(lat, lng);
        },
        function () {
          usarLocalizacao.disabled = false;
          if (usarLocalizacaoNota) usarLocalizacaoNota.textContent = "Ideal se você está no local agora";
          mostrarStatus("Não foi possível obter sua localização. Busque o endereço ou aponte no mapa.", "info");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // ---- "Apontar no mapa" — pino central (arrasta-se o mapa, não o pino) ----
  var barraToken = 0;

  function atualizarBarra() {
    if (!modoMapa || !barraTxt) return;
    var c = mapa.getCenter();
    if (!dentroDeGoias(c.lat, c.lng)) {
      barraTxt.textContent = "Fora de Goiás — arraste de volta para dentro do estado.";
      barraTxt.classList.add("mapa-confirmar__txt--erro");
      if (btnConfirmarLocal) btnConfirmarLocal.disabled = true;
      return;
    }
    barraTxt.classList.remove("mapa-confirmar__txt--erro");
    if (btnConfirmarLocal) btnConfirmarLocal.disabled = false;
    barraTxt.textContent = "Buscando endereço…";
    var token = ++barraToken;
    reverso(c.lat, c.lng)
      .then(function (a) {
        if (token !== barraToken || !modoMapa) return;
        var txt = enderecoCurto(a);
        barraTxt.textContent = txt ? "📍 " + txt : "📍 Local sem endereço mapeado — confira o pino e confirme.";
      })
      .catch(function () {
        if (token === barraToken && modoMapa) barraTxt.textContent = "📍 Ajuste o pino e confirme o local.";
      });
  }
  var atualizarBarraDebounce = debounce(atualizarBarra, 450);

  function entrarModoMapa() {
    modoMapa = true;
    ocultarPainel();
    fecharSugestoes();
    limparTemp(); // enquanto escolhe, o pino central representa o ponto
    if (mapaWrap) mapaWrap.classList.add("mapa-wrap--escolher");
    if (mira) mira.hidden = false;
    if (barraConfirmar) barraConfirmar.hidden = false;
    if (latInput.value && lngInput.value) {
      mapa.setView([parseFloat(latInput.value), parseFloat(lngInput.value)], Math.max(mapa.getZoom(), 16));
    }
    if (barraTxt) {
      barraTxt.classList.remove("mapa-confirmar__txt--erro");
      barraTxt.textContent = "Arraste o mapa até o pino apontar o local exato.";
    }
    if (mapaWrap) mapaWrap.scrollIntoView({ behavior: "smooth", block: "center" });
    atualizarBarraDebounce();
  }

  function sairModoMapa() {
    modoMapa = false;
    if (mapaWrap) mapaWrap.classList.remove("mapa-wrap--escolher");
    if (mira) mira.hidden = true;
    if (barraConfirmar) barraConfirmar.hidden = true;
  }

  function cancelarModoMapa() {
    sairModoMapa();
    // Se já havia um ponto escolhido antes, devolve o marcador dele
    if (latInput.value && lngInput.value) {
      colocarMarcadorTemp(parseFloat(latInput.value), parseFloat(lngInput.value));
    }
    abrirPainel();
  }

  if (escolherNoMapa) escolherNoMapa.addEventListener("click", entrarModoMapa);
  if (ajustarNoMapa) ajustarNoMapa.addEventListener("click", entrarModoMapa);
  if (btnCancelarLocal) btnCancelarLocal.addEventListener("click", cancelarModoMapa);
  if (btnConfirmarLocal) {
    btnConfirmarLocal.addEventListener("click", function () {
      var c = mapa.getCenter();
      if (!dentroDeGoias(c.lat, c.lng)) return;
      sairModoMapa();
      definirLocal(c.lat, c.lng, { vista: false });
      abrirPainel();
    });
  }

  mapa.on("moveend", function () { if (modoMapa) atualizarBarraDebounce(); });
  mapa.on("movestart", function () {
    if (modoMapa && barraTxt && !barraTxt.classList.contains("mapa-confirmar__txt--erro")) {
      barraTxt.textContent = "…";
    }
  });
  // Tocar no mapa durante a escolha centraliza o pino ali (atalho natural)
  mapa.on("click", function (e) { if (modoMapa) mapa.panTo(e.latlng); });

  /* =============================================================
     6) NAVEGAÇÃO ENTRE PASSOS + VALIDAÇÃO
     ============================================================= */
  var tituloInput = document.getElementById("rTitulo");
  var descricaoInput = document.getElementById("rDescricao");
  var descContador = document.getElementById("descContador");
  var resumoRelato = document.getElementById("resumoRelato");
  var dadosContato = document.getElementById("dadosContato");
  var nomeInput = document.getElementById("rNome");
  var emailInput = document.getElementById("rEmail");
  var telefoneInput = document.getElementById("rTelefone");
  var consentInput = document.getElementById("rConsent");

  if (btnParaPasso2) {
    btnParaPasso2.addEventListener("click", function () {
      if (!latInput.value || !lngInput.value) {
        mostrarStatus("Defina o local: busque o endereço, use sua localização ou aponte no mapa.", "erro");
        return;
      }
      if (!dentroDeGoias(parseFloat(latInput.value), parseFloat(lngInput.value))) {
        mostrarStatus("O ponto marcado está fora de Goiás. Ajuste para dentro do estado.", "erro");
        return;
      }
      if (!val(cidadeInput)) {
        if (editarEndereco) editarEndereco.open = true;
        mostrarStatus("Não conseguimos identificar a cidade. Preencha em “Corrigir o endereço”.", "erro");
        if (cidadeInput) cidadeInput.focus();
        return;
      }
      irPara(2);
    });
  }

  var voltarPasso1 = document.getElementById("voltarPasso1");
  if (voltarPasso1) voltarPasso1.addEventListener("click", function () { irPara(1); });

  var btnParaPasso3 = document.getElementById("paraPasso3");
  if (btnParaPasso3) {
    btnParaPasso3.addEventListener("click", function () {
      if (!categoriaSelecionada()) {
        mostrarStatus("Escolha o tipo de risco.", "erro");
        return;
      }
      if (!val(tituloInput)) {
        mostrarStatus("Dê um ponto de referência (ex.: “praça central, ao lado da escola”).", "erro");
        if (tituloInput) tituloInput.focus();
        return;
      }
      if (resumoRelato) {
        var c = CAT[categoriaSelecionada()];
        resumoRelato.textContent = (c ? c.emoji + " " + c.nome : "") + " — " + resumoEndereco();
      }
      irPara(3);
    });
  }

  var voltarPasso2 = document.getElementById("voltarPasso2");
  if (voltarPasso2) voltarPasso2.addEventListener("click", function () { irPara(2); });

  // Contador de caracteres da descrição
  if (descricaoInput && descContador) {
    descricaoInput.addEventListener("input", function () {
      descContador.textContent = String(descricaoInput.value.length);
    });
  }

  // Identificado × anônimo
  function relatoAnonimo() {
    return !!(form && form.identidade && form.identidade.value === "anonimo");
  }
  function atualizarIdentidade() {
    var anon = relatoAnonimo();
    if (dadosContato) dadosContato.hidden = anon;
    Array.prototype.forEach.call(document.querySelectorAll(".identidade__opcao"), function (label) {
      var input = label.querySelector("input");
      label.classList.toggle("identidade__opcao--ativa", !!(input && input.checked));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="identidade"]'), function (radio) {
    radio.addEventListener("change", function () { atualizarIdentidade(); esconderStatus(); });
  });

  // Esc: cancela o modo mapa > fecha sugestões > fecha o painel
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (modoMapa) { cancelarModoMapa(); return; }
    if (sugestoesEl && !sugestoesEl.hidden) { fecharSugestoes(); return; }
    if (painel && !painel.hidden) fecharPainel();
  });

  /* =============================================================
     7) ENVIO DO RELATO
     ============================================================= */
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot: se preenchido, é bot — ignora em silêncio.
      var honeypot = form.querySelector('[name="website"]');
      if (honeypot && honeypot.value.trim() !== "") return;

      // Enter num campo dos passos 1–2 (submit implícito) → avança o passo
      if (passoAtual === 1) { if (btnParaPasso2) btnParaPasso2.click(); return; }
      if (passoAtual === 2) { if (btnParaPasso3) btnParaPasso3.click(); return; }

      if (!latInput.value || !lngInput.value ||
          !dentroDeGoias(parseFloat(latInput.value), parseFloat(lngInput.value))) {
        irPara(1);
        mostrarStatus("Defina o local do ponto, dentro de Goiás.", "erro");
        return;
      }

      var anon = relatoAnonimo();
      if (!anon) {
        if (!val(nomeInput)) {
          mostrarStatus("Informe seu nome — ou escolha relatar anonimamente.", "erro");
          if (nomeInput) nomeInput.focus();
          return;
        }
        if (!val(emailInput) && !val(telefoneInput)) {
          mostrarStatus("Informe ao menos um contato (e-mail ou telefone) — ou escolha relatar anonimamente.", "erro");
          if (emailInput) emailInput.focus();
          return;
        }
      }
      if (!consentInput || !consentInput.checked) {
        mostrarStatus("Confirme que o relato é verdadeiro e de boa-fé.", "erro");
        return;
      }

      var d = {
        categoria: categoriaSelecionada(),
        titulo: val(tituloInput),
        cidade: val(cidadeInput),
        descricao: val(descricaoInput),
        endereco: enderecoComposto(),
        nome: anon ? "" : val(nomeInput),
        email: anon ? "" : val(emailInput),
        telefone: anon ? "" : val(telefoneInput),
        anonimo: anon,
        lat: parseFloat(latInput.value),
        lng: parseFloat(lngInput.value)
      };

      // Sem endpoint configurado (ou aberto via file://): simula o envio e
      // mostra o ponto localmente como "pendente" (só você vê), para demonstrar.
      if (!MAPA_ENDPOINT || !SERVIDO_VIA_HTTP) {
        aposEnvio(d);
        return;
      }

      if (botaoEnviar) { botaoEnviar.disabled = true; botaoEnviar.textContent = "Enviando…"; }

      var corpo = new URLSearchParams();
      corpo.set("categoria", d.categoria);
      corpo.set("titulo", d.titulo);
      corpo.set("cidade", d.cidade);
      corpo.set("descricao", d.descricao);
      corpo.set("lat", String(d.lat));
      corpo.set("lng", String(d.lng));
      corpo.set("endereco", d.endereco);
      corpo.set("nome", d.nome);
      corpo.set("email", d.email);
      corpo.set("telefone", d.telefone);
      corpo.set("anonimo", anon ? "sim" : "não");
      corpo.set("consentimento", "sim");

      fetch(MAPA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: corpo.toString()
      })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (res) {
          if (res && res.ok === false) throw new Error("recusado");
          aposEnvio(d);
        })
        .catch(function () {
          mostrarStatus("Não conseguimos enviar agora. Tente novamente em instantes.", "erro");
        })
        .finally(function () {
          if (botaoEnviar) { botaoEnviar.disabled = false; botaoEnviar.textContent = "Enviar relato"; }
        });
    });
  }

  // Sucesso: pino "pendente" no mapa + tela de confirmação
  function aposEnvio(d) {
    limparTemp();
    d.pendente = true;
    adicionarPonto(d);
    if (form) form.hidden = true;
    if (stepperEl) stepperEl.hidden = true;
    if (sucessoEl) {
      sucessoEl.hidden = false;
      var h = sucessoEl.querySelector("h3");
      if (h) h.focus();
    }
  }

  function resetTudo() {
    if (form) form.reset(); // radios voltam ao padrão (identificado marcado)
    limparTemp();
    latInput.value = "";
    lngInput.value = "";
    ultimaCoordValida = null;
    if (localCard) localCard.hidden = true;
    if (editarEndereco) editarEndereco.open = false;
    if (btnParaPasso2) btnParaPasso2.disabled = true;
    if (descContador) descContador.textContent = "0";
    fecharSugestoes();
    atualizarChips();
    atualizarIdentidade();
    esconderStatus();
    if (sucessoEl) sucessoEl.hidden = true;
    if (form) form.hidden = false;
    if (stepperEl) stepperEl.hidden = false;
    irPara(1);
  }

  var relatarOutro = document.getElementById("relatarOutro");
  if (relatarOutro) relatarOutro.addEventListener("click", resetTudo);
  var sucessoFechar = document.getElementById("sucessoFechar");
  if (sucessoFechar) sucessoFechar.addEventListener("click", fecharPainel);

  atualizarIdentidade();

  /* =============================================================
     8) CARREGAR PONTOS APROVADOS (planilha CSV) — ou exemplos
     ============================================================= */
  function parseCSV(texto) {
    var linhas = [], linha = [], campo = "", aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ",") { linha.push(campo); campo = ""; }
      else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
      else if (c === "\r") { /* ignora */ }
      else campo += c;
    }
    if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  function csvParaObjetos(linhas) {
    if (!linhas.length) return [];
    var cab = linhas[0].map(function (h) { return h.trim().toLowerCase(); });
    return linhas.slice(1).map(function (l) {
      var o = {};
      cab.forEach(function (h, i) { o[h] = (l[i] || "").trim(); });
      return o;
    });
  }

  var mapaNota = document.getElementById("mapaNota");

  function carregarExemplos() {
    EXEMPLOS.forEach(adicionarPonto);
    if (mapaNota) mapaNota.textContent = "Exibindo pontos de exemplo. Configure a planilha (docs/MAPA-DO-MEDO.md) para mostrar os relatos reais aprovados.";
  }

  if (MAPA_CSV_URL && SERVIDO_VIA_HTTP) {
    fetch(MAPA_CSV_URL)
      .then(function (r) { return r.text(); })
      .then(function (texto) {
        var linhas = csvParaObjetos(parseCSV(texto));
        var validos = 0;
        linhas.forEach(function (o) {
          var status = (o.status || "").toLowerCase();
          if (status && status !== "aprovado") return; // só aprovados
          var lat = parseFloat((o.lat || "").replace(",", "."));
          var lng = parseFloat((o.lng || o.lon || o.long || "").replace(",", "."));
          if (isNaN(lat) || isNaN(lng)) return;
          var cat = (o.categoria || "infra").toLowerCase();
          if (!CAT[cat]) cat = "infra";
          adicionarPonto({
            lat: lat, lng: lng, categoria: cat,
            titulo: o.titulo || o.local || "Ponto marcado",
            cidade: o.cidade || "",
            descricao: o.descricao || "",
            data: o.data || ""
          });
          validos++;
        });
        if (mapaNota) {
          mapaNota.textContent = validos
            ? validos + (validos === 1 ? " ponto aprovado no mapa." : " pontos aprovados no mapa.")
            : "Ainda não há pontos aprovados. Seja o primeiro a contribuir!";
        }
      })
      .catch(function () {
        carregarExemplos();
      });
  } else {
    carregarExemplos();
  }
})();
