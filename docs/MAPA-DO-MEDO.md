# Mapa do Medo — como publicar (relatos + moderação)

O **Mapa do Medo** (`mapa-do-medo.html`) deixa as pessoas marcarem pontos de
insegurança no mapa de Goiás. Segue o mesmo padrão do resto do site: **site
estático** na frente + **Google Apps Script + Planilha** por trás. Nada de
servidor ou banco de dados próprios.

Fluxo:

1. A pessoa marca um ponto e envia o relato → o site faz um **POST** para um
   **Web App do Apps Script**, que grava uma linha na planilha com status
   `pendente`.
2. Você (equipe) abre a planilha e muda o status para `aprovado` (ou apaga).
3. O mapa público lê a planilha **publicada como CSV** e mostra **apenas as
   linhas `aprovado`**.

Enquanto os dois endereços abaixo estiverem vazios, o mapa mostra **pontos de
exemplo** e o botão de envio só **simula** (marca o ponto como "pendente", que
some ao recarregar). Isso serve para você ver o visual antes de publicar.

---

## Passo 1 — Criar a planilha

1. Crie uma planilha no Google Sheets (ex.: **"Mapa do Medo — relatos"**).
2. Na primeira linha, crie estas colunas (os nomes precisam bater; a ordem é livre):

   | data | status | categoria | titulo | cidade | descricao | lat | lng | endereco | nome | email | telefone |
   |------|--------|-----------|--------|--------|-----------|-----|-----|----------|------|-------|----------|

   - **status**: `pendente` (padrão ao chegar) ou `aprovado` (aparece no mapa).
   - **categoria**: um destes códigos — `iluminacao`, `mato`, `violencia`,
     `policiamento`, `drogas`, `mulheres`, `infra`.
   - **lat / lng**: coordenadas (o site preenche sozinho).
   - **endereco**: endereço digitado pela pessoa (ajuda a conferir o ponto).
   - **nome / email / telefone**: contato de quem enviou — **dados privados**,
     usados só pela equipe. **Nunca** são exibidos no mapa público.

> **Já publicou a versão anterior?** Adicione as 4 colunas novas (`endereco`,
> `nome`, `email`, `telefone`) ao final da planilha e **atualize o código do
> Apps Script** com a versão abaixo (que grava pelos nomes das colunas).

## Passo 2 — Publicar o Apps Script (recebe os relatos)

1. Na planilha: menu **Extensões → Apps Script**.
2. Apague o conteúdo e cole o código do final deste guia.
3. **Implantar → Nova implantação → Tipo: App da Web**.
   - Executar como: **Eu**.
   - Quem pode acessar: **Qualquer pessoa**.
4. Copie a URL que termina em **`/exec`**.
5. Abra `js/mapa-do-medo.js` e cole em:
   ```js
   var MAPA_ENDPOINT = "https://script.google.com/macros/s/XXXX/exec";
   ```

## Passo 3 — Publicar a planilha como CSV (mostra no mapa)

1. Na planilha: **Arquivo → Compartilhar → Publicar na web**.
2. Escolha a **aba** dos relatos e o formato **CSV**. Clique em **Publicar**.
3. Copie o link (termina em `pub?output=csv`).
4. Em `js/mapa-do-medo.js`, cole em:
   ```js
   var MAPA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv";
   ```

## Passo 4 — Moderar

- Relatos chegam com status `pendente` → **não** aparecem no mapa.
- Para publicar um ponto, mude o status da linha para `aprovado`.
- Para recusar, apague a linha (ou deixe como `pendente`).

> Dica: a publicação em CSV do Google atualiza com alguns minutos de atraso
> (cache). É normal um ponto aprovado levar um tempinho para aparecer.

---

## Código do Apps Script

```javascript
// Mapa do Medo — recebe relatos e grava na planilha como "pendente".
// Grava cada campo na coluna de mesmo nome do cabeçalho (a ordem das colunas
// pode mudar; colunas a mais são ignoradas). "data" e "status" são preenchidas
// automaticamente. Colunas usadas: data | status | categoria | titulo | cidade |
// descricao | lat | lng | endereco | nome | email | telefone
function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    // Validação mínima
    var lat = parseFloat(p.lat), lng = parseFloat(p.lng);
    if (isNaN(lat) || isNaN(lng) || !p.categoria || !p.titulo) {
      return json({ ok: false, erro: "dados incompletos" });
    }
    // Fora de Goiás? recusa (evita spam aleatório)
    if (lat < -20 || lat > -12 || lng < -54 || lng > -45) {
      return json({ ok: false, erro: "fora da área" });
    }

    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];

    // Valores por nome de coluna (limitados no tamanho)
    var valores = {
      data: new Date(),
      status: "pendente",             // você aprova depois
      categoria: corta(p.categoria, 30),
      titulo: corta(p.titulo, 120),
      cidade: corta(p.cidade, 80),
      descricao: corta(p.descricao, 500),
      lat: lat,
      lng: lng,
      endereco: corta(p.endereco, 160),
      nome: corta(p.nome, 80),
      email: corta(p.email, 120),
      telefone: corta(p.telefone, 20)
    };

    var linha = cabecalho.map(function (nome) {
      var chave = String(nome).trim().toLowerCase();
      return valores.hasOwnProperty(chave) ? valores[chave] : "";
    });
    aba.appendRow(linha);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, erro: String(err) });
  }
}

function corta(v, n) { return String(v || "").slice(0, n); }

function doGet() {
  return json({ ok: true, servico: "mapa-do-medo" });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> **Importante — republique após editar:** trocar o código do Apps Script só vale
> depois de **Implantar → Gerenciar implantações → (editar) → Nova versão**. Sem
> isso, o `/exec` continua rodando o código antigo.

---

## Observações importantes

- **URLSearchParams, não FormData.** O site já envia o corpo como
  `application/x-www-form-urlencoded` — é o formato que `e.parameter` do Apps
  Script lê corretamente. Não troque por `FormData` (o Apps Script não parseia
  `multipart/form-data` e embaralha os campos).
- **Moderação é essencial.** Conteúdo público sobre violência tem risco de
  difamação/trote. O status `pendente` protege a imagem do movimento — nada
  aparece sem sua conferência.
- **Contato é privado (LGPD).** Nome, e-mail e telefone servem só para a equipe
  validar o relato e dar retorno — **nunca** aparecem no mapa (o site nem lê
  essas colunas). O ponto em si é público e anônimo. Trate a planilha como base
  com dados pessoais: acesso restrito e 2FA. Oriente a não citar nomes de
  terceiros na descrição.
- **Busca de endereço (geocodificação).** É feita pelo
  [Nominatim](https://nominatim.org/) do OpenStreetMap, gratuito e sem chave,
  restrito a Goiás. A política de uso pede volume baixo (≈1 busca/seg) — tranquilo
  para um site de campanha. Se um dia precisar de escala, dá para trocar por um
  provedor com plano próprio (MapTiler, LocationIQ) mudando só a URL no
  `js/mapa-do-medo.js`.
- **Tiles do OpenStreetMap.** Para um site de campanha o uso é tranquilo. Se o
  tráfego crescer muito, considere um provedor de tiles com plano próprio
  (ex.: Carto, MapTiler, Thunderforest) — é só trocar a URL do `L.tileLayer`.
- **2FA** na conta Google dona da planilha e restrinja quem pode editá-la.
