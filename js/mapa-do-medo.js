/* =============================================================
   Delegado Yasser — Mapa do Medo
   Mapa participativo de insegurança (Leaflet + OpenStreetMap).
   Vanilla JS. Depende apenas de Leaflet (carregado via CDN no HTML).

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

  /* Categorias — fonte única para legenda, <select>, pinos e popups.
     (as 4 pedidas + sugestões: policiamento, drogas, insegurança p/ mulheres) */
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
     3) LEGENDA / FILTROS (gerada a partir das categorias)
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

  // <select> do formulário
  var selCategoria = document.getElementById("rCategoria");
  if (selCategoria) {
    CATEGORIAS.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.emoji + "  " + c.nome;
      selCategoria.appendChild(opt);
    });
  }

  /* =============================================================
     4) MODO "ADICIONAR PONTO"
     ============================================================= */
  var botaoAdicionar = document.getElementById("botaoAdicionar");
  var dicaAdicionar = document.getElementById("dicaAdicionar");
  var cancelarAdicionar = document.getElementById("cancelarAdicionar");
  var mapaDiv = document.getElementById("mapa");

  var modoAdicionar = false;
  var marcadorTemp = null;

  function entrarModoAdd() {
    modoAdicionar = true;
    if (dicaAdicionar) dicaAdicionar.hidden = false;
    if (mapaDiv) mapaDiv.classList.add("mapa--modo-add");
    if (botaoAdicionar) botaoAdicionar.setAttribute("aria-pressed", "true");
  }
  function sairModoAdd() {
    modoAdicionar = false;
    if (dicaAdicionar) dicaAdicionar.hidden = true;
    if (mapaDiv) mapaDiv.classList.remove("mapa--modo-add");
    if (botaoAdicionar) botaoAdicionar.setAttribute("aria-pressed", "false");
  }
  function limparTemp() {
    if (marcadorTemp) { mapa.removeLayer(marcadorTemp); marcadorTemp = null; }
  }

  // "+ Adicionar um ponto" abre o painel; dentro dele a pessoa escolhe como
  // definir o local: buscando o endereço, tocando no mapa ou pela localização.
  if (botaoAdicionar) {
    botaoAdicionar.addEventListener("click", function () { abrirPainel(); });
  }
  if (cancelarAdicionar) {
    cancelarAdicionar.addEventListener("click", function () { sairModoAdd(); });
  }

  var ultimaCoordValida = null;

  function atualizarCoord(lat, lng) {
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    ultimaCoordValida = [lat, lng];
    if (coordTexto) {
      coordTexto.textContent = "📍 " + lat.toFixed(5) + ", " + lng.toFixed(5) + " — arraste o pino para ajustar";
      coordTexto.classList.remove("coord-texto--vazio");
    }
  }

  function marcarLocal(lat, lng) {
    limparTemp();
    marcadorTemp = L.marker([lat, lng], {
      icon: iconeCategoria(selCategoria && selCategoria.value ? selCategoria.value : "infra", "pino--temp"),
      zIndexOffset: 1000,
      draggable: true
    }).addTo(mapa);
    marcadorTemp.on("dragend", function () {
      var p = marcadorTemp.getLatLng();
      if (!dentroDeGoias(p.lat, p.lng)) {
        if (ultimaCoordValida) marcadorTemp.setLatLng(ultimaCoordValida);
        mostrarStatus("O ponto precisa ficar dentro de Goiás. Arraste de volta para o estado.", "erro");
        return;
      }
      atualizarCoord(p.lat, p.lng);
      preencherEndereco(p.lat, p.lng); // ao mover o pino, atualiza os campos do endereço
    });
    atualizarCoord(lat, lng);
  }

  mapa.on("click", function (e) {
    if (!modoAdicionar) return;
    if (!dentroDeGoias(e.latlng.lat, e.latlng.lng)) {
      L.popup({ closeButton: false, className: "aviso-fora" })
        .setLatLng(e.latlng)
        .setContent("Escolha um ponto dentro de Goiás.")
        .openOn(mapa);
      return; // permanece no modo de adição
    }
    marcarLocal(e.latlng.lat, e.latlng.lng);
    preencherEndereco(e.latlng.lat, e.latlng.lng);
    sairModoAdd();
    abrirPainel();
  });

  /* =============================================================
     5) PAINEL DO FORMULÁRIO (relato)
     ============================================================= */
  var painel = document.getElementById("relatoPainel");
  var overlay = document.getElementById("relatoOverlay");
  var fechar = document.getElementById("relatoFechar");
  var form = document.getElementById("formRelato");
  var latInput = document.getElementById("rLat");
  var lngInput = document.getElementById("rLng");
  var coordTexto = document.getElementById("rCoordTexto");
  var statusEl = document.getElementById("relatoStatus");
  var botaoEnviar = document.getElementById("relatoEnviar");
  var usarLocalizacao = document.getElementById("usarLocalizacao");
  var focoAnterior = null;

  function abrirPainel() {
    if (!painel) return;
    focoAnterior = document.activeElement;
    painel.hidden = false;
    if (overlay) overlay.hidden = false;
    painel.focus();
  }
  function fecharPainel() {
    if (!painel) return;
    painel.hidden = true;
    if (overlay) overlay.hidden = true;
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }
  // Esconde o painel sem resetar os campos (usado ao ir marcar no mapa)
  function ocultarPainel() {
    if (painel) painel.hidden = true;
    if (overlay) overlay.hidden = true;
  }

  if (fechar) fechar.addEventListener("click", fecharPainel);
  if (overlay) overlay.addEventListener("click", fecharPainel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && painel && !painel.hidden) fecharPainel();
  });

  // Atualiza a cor do pino temporário quando muda a categoria no form
  if (selCategoria) {
    selCategoria.addEventListener("change", function () {
      if (marcadorTemp && latInput.value) {
        marcadorTemp.setIcon(iconeCategoria(selCategoria.value || "infra", "pino--temp"));
      }
    });
  }

  // Geolocalização opcional
  if (usarLocalizacao) {
    usarLocalizacao.addEventListener("click", function () {
      if (!navigator.geolocation) {
        mostrarStatus("Seu navegador não permite usar a localização. Marque no mapa.", "info");
        return;
      }
      usarLocalizacao.textContent = "Localizando…";
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          usarLocalizacao.textContent = "Usar minha localização";
          if (!dentroDeGoias(lat, lng)) {
            mostrarStatus("Sua localização está fora de Goiás. Marque o ponto no mapa, dentro do estado.", "erro");
            return;
          }
          marcarLocal(lat, lng);
          preencherEndereco(lat, lng);
          mapa.setView([lat, lng], 15);
        },
        function () {
          usarLocalizacao.textContent = "Usar minha localização";
          mostrarStatus("Não foi possível obter sua localização. Marque no mapa.", "info");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // Botão "Marcar tocando no mapa": esconde o painel e ativa o modo de clique
  var marcarNoMapa = document.getElementById("marcarNoMapa");
  if (marcarNoMapa) {
    marcarNoMapa.addEventListener("click", function () {
      ocultarPainel();
      entrarModoAdd();
    });
  }

  // Busca por endereço (geocodificação via Nominatim/OpenStreetMap — grátis, sem chave).
  // Usa campos estruturados (rua, nº, bairro, cidade) → consulta ordenada e mais precisa.
  var logradouroInput = document.getElementById("rLogradouro");
  var numeroInput = document.getElementById("rNumero");
  var bairroInput = document.getElementById("rBairro");
  var cidadeInput = document.getElementById("rCidade");
  var buscarEndereco = document.getElementById("buscarEndereco");

  function val(el) { return el && el.value ? el.value.trim() : ""; }

  // Endereço legível para gravar na planilha (coluna "endereco")
  function enderecoComposto() {
    var rua = val(logradouroInput), num = val(numeroInput), bairro = val(bairroInput);
    var linha = rua + (num ? ", " + num : "");
    return [linha, bairro].filter(Boolean).join(" — ");
  }

  function cidadeDoEndereco(r) {
    var a = (r && r.address) || {};
    return a.city || a.town || a.village || a.municipality || a.county || "";
  }

  function geocodificar() {
    var rua = val(logradouroInput), num = val(numeroInput);
    var bairro = val(bairroInput), cidade = val(cidadeInput);
    if (!rua && !bairro && !cidade) {
      mostrarStatus("Preencha ao menos a rua e a cidade para localizar.", "info");
      return;
    }
    // Consulta ordenada: "rua, nº, bairro, cidade, Goiás, Brasil"
    var partes = [];
    if (rua) partes.push(rua + (num ? ", " + num : ""));
    if (bairro) partes.push(bairro);
    if (cidade) partes.push(cidade);
    partes.push("Goiás");
    partes.push("Brasil");
    var q = partes.join(", ");

    if (buscarEndereco) { buscarEndereco.disabled = true; buscarEndereco.textContent = "Buscando…"; }
    // bounded=1 + viewbox restringe a Goiás (viewbox = minLng,maxLat,maxLng,minLat)
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br" +
      "&addressdetails=1&bounded=1&viewbox=-53.6,-12.3,-45.7,-19.7&q=" + encodeURIComponent(q);
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (lista) {
        if (!lista || !lista.length) {
          mostrarStatus("Endereço não encontrado. Confira a rua/cidade ou marque no mapa.", "erro");
          return;
        }
        var r0 = lista[0];
        var lat = parseFloat(r0.lat), lng = parseFloat(r0.lon);
        if (isNaN(lat) || isNaN(lng)) {
          mostrarStatus("Endereço inválido. Marque no mapa.", "erro");
          return;
        }
        if (!dentroDeGoias(lat, lng)) {
          mostrarStatus("Esse endereço está fora de Goiás. O Mapa do Medo cobre apenas o estado de Goiás.", "erro");
          return;
        }
        marcarLocal(lat, lng);
        mapa.setView([lat, lng], 16);
        var cid = cidadeDoEndereco(r0);
        if (cid && cidadeInput && !cidadeInput.value.trim()) cidadeInput.value = cid;
        mostrarStatus("Local encontrado! Confira no mapa — arraste o pino se precisar ajustar.", "ok");
      })
      .catch(function () {
        mostrarStatus("Não foi possível buscar o endereço agora. Marque no mapa.", "erro");
      })
      .finally(function () {
        if (buscarEndereco) { buscarEndereco.disabled = false; buscarEndereco.textContent = "🔍 Localizar no mapa"; }
      });
  }

  if (buscarEndereco) buscarEndereco.addEventListener("click", geocodificar);
  // Enter em qualquer campo do endereço dispara a busca
  [logradouroInput, numeroInput, bairroInput, cidadeInput].forEach(function (el) {
    if (!el) return;
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); geocodificar(); }
    });
  });

  // Geocodificação reversa: preenche os campos de endereço a partir de uma
  // coordenada (usado ao marcar no mapa, usar a localização ou arrastar o pino).
  function preencherEndereco(lat, lng) {
    var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=" +
      encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng);
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var a = (res && res.address) || {};
        if (logradouroInput) logradouroInput.value = a.road || a.pedestrian || a.footway || a.cycleway || "";
        if (numeroInput) numeroInput.value = a.house_number || "";
        if (bairroInput) bairroInput.value = a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
        var cid = a.city || a.town || a.village || a.municipality || a.county || "";
        if (cidadeInput && cid) cidadeInput.value = cid;
      })
      .catch(function () { /* silencioso: mantém o que já estiver preenchido */ });
  }

  function mostrarStatus(msg, tipo) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = "relato-status relato-status--" + (tipo || "info");
  }

  /* =============================================================
     6) ENVIO DO RELATO
     ============================================================= */
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot: se preenchido, é bot — ignora em silêncio.
      var honeypot = form.querySelector('[name="website"]');
      if (honeypot && honeypot.value.trim() !== "") return;

      if (!form.checkValidity()) {
        mostrarStatus("Preencha os campos obrigatórios (*).", "erro");
        form.reportValidity();
        return;
      }
      if (!latInput.value || !lngInput.value) {
        mostrarStatus("Defina o local: busque o endereço, marque no mapa ou use sua localização.", "erro");
        return;
      }
      if (!dentroDeGoias(parseFloat(latInput.value), parseFloat(lngInput.value))) {
        mostrarStatus("O ponto marcado está fora de Goiás. Ajuste para dentro do estado.", "erro");
        return;
      }
      var emailV = form.email.value.trim();
      var telefoneV = form.telefone.value.trim();
      if (!emailV && !telefoneV) {
        mostrarStatus("Informe ao menos um contato: e-mail ou telefone.", "erro");
        return;
      }

      var d = {
        categoria: selCategoria.value,
        titulo: form.titulo.value.trim(),
        cidade: form.cidade.value.trim(),
        descricao: form.descricao.value.trim(),
        endereco: enderecoComposto(),
        nome: form.nome.value.trim(),
        email: emailV,
        telefone: telefoneV,
        lat: parseFloat(latInput.value),
        lng: parseFloat(lngInput.value)
      };

      // Sem endpoint configurado (ou aberto via file://): simula o envio e
      // mostra o ponto localmente como "pendente" (só você vê), para demonstrar.
      if (!MAPA_ENDPOINT || !SERVIDO_VIA_HTTP) {
        finalizarEnvioLocal(d, true);
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
      corpo.set("consentimento", form.consentimento.checked ? "sim" : "não");

      fetch(MAPA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: corpo.toString()
      })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (res) {
          if (res && res.ok === false) throw new Error("recusado");
          finalizarEnvioLocal(d, true);
        })
        .catch(function () {
          mostrarStatus("Não conseguimos enviar agora. Tente novamente em instantes.", "erro");
        })
        .finally(function () {
          if (botaoEnviar) { botaoEnviar.disabled = false; botaoEnviar.textContent = "Enviar relato"; }
        });
    });
  }

  function finalizarEnvioLocal(d, comMensagem) {
    limparTemp();
    d.pendente = true;
    adicionarPonto(d);
    form.reset();
    if (coordTexto) {
      coordTexto.textContent = "Nenhum local marcado ainda";
      coordTexto.classList.add("coord-texto--vazio");
    }
    latInput.value = "";
    lngInput.value = "";
    if (comMensagem) {
      mostrarStatus(
        "Relato recebido! Ele passará por moderação antes de aparecer no mapa público. Obrigado por ajudar. 💛",
        "ok"
      );
    }
    setTimeout(fecharPainel, 2600);
  }

  /* =============================================================
     7) CARREGAR PONTOS APROVADOS (planilha CSV) — ou exemplos
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
