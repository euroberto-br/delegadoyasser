# Integração do formulário com Google Sheets

O site é **estático** (GitHub Pages), então o formulário de cadastro
(`landing.html`) envia os dados para uma **planilha do Google** usando um
**Web App do Google Apps Script**. Não é preciso servidor próprio.

Enquanto a integração não estiver configurada, o formulário funciona em
**modo demonstração**: valida os campos e mostra uma confirmação, sem enviar
os dados para lugar nenhum.

---

## Passo 1 — Criar a planilha

1. Acesse <https://sheets.google.com> e crie uma planilha nova.
2. Dê um nome (ex.: **Cadastros — Goiás sem Medo**).
3. Anote/mantenha a primeira aba (geralmente chamada `Página1` ou `Sheet1`).

## Passo 2 — Colar o código do Apps Script

1. Na planilha, vá em **Extensões ▸ Apps Script**.
2. Apague o conteúdo padrão e cole o código abaixo.
3. Salve (ícone de disquete).

```javascript
// Recebe os cadastros do site e grava na planilha.
// Cabeçalho criado automaticamente na primeira execução.
var CABECALHO = [
  'data_hora', 'nome', 'whatsapp', 'email',
  'cidade', 'bairro', 'missao', 'consentimento'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // evita gravações simultâneas embaralhadas
  try {
    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Cria o cabeçalho se a planilha estiver vazia
    if (aba.getLastRow() === 0) {
      aba.appendRow(CABECALHO);
    }

    var p = (e && e.parameter) ? e.parameter : {};
    aba.appendRow([
      new Date(),
      p.nome || '',
      p.whatsapp || '',
      p.email || '',
      p.cidade || '',
      p.bairro || '',
      p.missao || '',
      p.consentimento ? 'sim' : 'não'
    ]);

    return resposta({ ok: true });
  } catch (erro) {
    return resposta({ ok: false, erro: String(erro) });
  } finally {
    lock.releaseLock();
  }
}

function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Passo 3 — Publicar como Web App

1. Clique em **Implantar ▸ Nova implantação**.
2. Em **Tipo**, escolha **App da Web**.
3. Configure:
   - **Executar como:** Eu (sua conta).
   - **Quem pode acessar:** Qualquer pessoa.
4. Clique em **Implantar** e autorize o acesso quando for solicitado.
5. Copie a **URL do app da Web** (termina em `/exec`).

## Passo 4 — Ligar o site à planilha

1. Abra `js/main.js`.
2. Localize a linha:

   ```javascript
   var CADASTRO_ENDPOINT = "";
   ```

3. Cole a URL entre as aspas:

   ```javascript
   var CADASTRO_ENDPOINT = "https://script.google.com/macros/s/AKfyc.../exec";
   ```

4. Salve, faça o commit/publish. Pronto — os cadastros passam a cair na planilha.

---

## Como testar

1. Abra `landing.html`, role até **"Entre para o time"** e envie um cadastro de teste.
2. Confira se a nova linha apareceu na planilha.
3. Se aparecer a mensagem de erro no site, verifique:
   - A URL termina em `/exec` (e não `/dev`).
   - A implantação está com **"Qualquer pessoa"** no acesso.
   - Após alterar o código do Apps Script, é preciso **criar uma nova implantação**
     (ou **Gerenciar implantações ▸ Editar ▸ Nova versão**).

## Observações de segurança

- O **honeypot** (campo oculto `website`) descarta envios automáticos de bots
  no próprio navegador, antes de chamar a planilha.
- O Apps Script roda na sua conta Google; a URL `/exec` só **aceita gravação**
  (`doPost`) — ela não expõe o conteúdo da planilha.
- A planilha continua privada: só quem você compartilhar consegue ver os dados.
- Nenhuma chave secreta fica no site. A URL pública só permite **adicionar**
  cadastros, então não há dado sensível embutido no código do front-end.
