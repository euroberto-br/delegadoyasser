# Solicitação de reunião — integração com Google Sheets

A página **`solicitar-reuniao.html`** permite que qualquer pessoa peça uma data
de reunião com o Yasser (nome, CPF, e-mail, telefone, quem participará do
encontro, nome da organização ou grupo, motivo, local, data e período). Como o site é **estático** (GitHub Pages), cada solicitação é enviada
para uma **planilha do Google** usando um **Web App do Google Apps Script** —
o mesmo esquema do cadastro de voluntários (`docs/INTEGRACAO-FORMULARIO.md`).

Cada pedido entra na planilha com **status "Pendente"**. A equipe de moderação
analisa a viabilidade, muda o status para **Aprovada** ou **Recusada** e
responde ao solicitante pelo contato informado (WhatsApp ou e-mail).

Enquanto a integração não estiver configurada, o formulário funciona em
**modo demonstração**: valida os campos e mostra uma confirmação, sem enviar
os dados para lugar nenhum.

---

## Passo 1 — Criar a planilha

1. Acesse <https://sheets.google.com> e crie uma planilha nova.
2. Dê um nome (ex.: **Solicitações de Reunião — Delegado Yasser**).
3. Anote/mantenha a primeira aba (geralmente chamada `Página1` ou `Sheet1`).

## Passo 2 — Colar o código do Apps Script

1. Na planilha, vá em **Extensões ▸ Apps Script**.
2. Apague o conteúdo padrão e cole o código abaixo.
3. Salve (ícone de disquete).

```javascript
// Recebe as solicitações de reunião do site e grava na planilha
// com status inicial "Pendente". Cabeçalho criado automaticamente.
var CABECALHO = [
  'data_hora', 'status', 'nome', 'cpf', 'email', 'telefone',
  'participantes', 'organizacao', 'motivo', 'local', 'data_reuniao',
  'periodo', 'consentimento'
];
var PERIODOS = ['manhã', 'tarde', 'noite'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // evita gravações simultâneas embaralhadas
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    // Validação mínima no servidor
    if (!p.nome || !p.email || !p.telefone || !p.motivo || !p.data_reuniao) {
      return resposta({ ok: false, erro: 'dados incompletos' });
    }
    if (String(p.cpf || '').replace(/\D/g, '').length !== 11) {
      return resposta({ ok: false, erro: 'cpf inválido' });
    }
    if (PERIODOS.indexOf(String(p.periodo || '').toLowerCase()) === -1) {
      return resposta({ ok: false, erro: 'período inválido' });
    }

    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Cria o cabeçalho se a planilha estiver vazia
    if (aba.getLastRow() === 0) {
      aba.appendRow(CABECALHO);
    }

    aba.appendRow([
      new Date(),
      'Pendente',
      corta(p.nome, 80),
      corta(p.cpf, 14),
      corta(p.email, 120),
      corta(p.telefone, 20),
      corta(p.participantes, 140),
      corta(p.organizacao, 120),
      corta(p.motivo, 600),
      corta(p.local, 160),
      corta(p.data_reuniao, 10),
      corta(p.periodo, 10),
      p.consentimento ? 'sim' : 'não'
    ]);

    return resposta({ ok: true });
  } catch (erro) {
    return resposta({ ok: false, erro: String(erro) });
  } finally {
    lock.releaseLock();
  }
}

function corta(v, n) { return String(v || '').slice(0, n); }

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

1. Abra `js/agenda.js`.
2. Localize a linha:

   ```javascript
   var AGENDA_ENDPOINT = "";
   ```

3. Cole a URL entre as aspas:

   ```javascript
   var AGENDA_ENDPOINT = "https://script.google.com/macros/s/AKfyc.../exec";
   ```

4. Salve, faça o commit/publish. Pronto — as solicitações passam a cair na planilha.

---

## Fluxo de moderação

1. Cada solicitação chega com a coluna **`status` = "Pendente"**.
2. A equipe avalia agenda, deslocamento e pauta.
3. Muda o status para **"Aprovada"** ou **"Recusada"** direto na planilha.
4. Responde ao solicitante pelo telefone/e-mail informado, confirmando a data
   ou propondo uma alternativa.

### Deixar a planilha visual (recomendado)

**Dropdown de status** — evita erros de digitação:

1. Selecione a coluna `status` (coluna B).
2. **Dados ▸ Validação de dados ▸ Adicionar regra**.
3. Critério: **Menu suspenso** com os itens `Pendente`, `Aprovada`, `Recusada`.

**Formatação condicional** — cores por status:

1. Selecione a coluna `status` (coluna B).
2. **Formatar ▸ Formatação condicional**.
3. Crie três regras "O texto contém":
   - `Pendente` → fundo **amarelo**;
   - `Aprovada` → fundo **verde**;
   - `Recusada` → fundo **vermelho claro**.

Assim a equipe bate o olho e sabe o que ainda precisa de resposta.

---

## Como testar

1. Abra `solicitar-reuniao.html` e envie uma solicitação de teste
   (um CPF válido de teste: `529.982.247-25`).
2. Confira se a nova linha apareceu na planilha com status **Pendente**.
3. Se aparecer a mensagem de erro no site, verifique:
   - A URL termina em `/exec` (e não `/dev`).
   - A implantação está com **"Qualquer pessoa"** no acesso.
   - Após alterar o código do Apps Script, é preciso **criar uma nova implantação**
     (ou **Gerenciar implantações ▸ Editar ▸ Nova versão**).

## Observações de segurança e LGPD

- O **honeypot** (campo oculto `website`) descarta envios automáticos de bots
  no próprio navegador, antes de chamar a planilha.
- O CPF é validado (dígitos verificadores) no navegador **e** conferido no
  Apps Script (11 dígitos).
- O Apps Script roda na sua conta Google; a URL `/exec` só **aceita gravação**
  (`doPost`) — ela não expõe o conteúdo da planilha.
- A planilha continua **privada**: compartilhe apenas com a equipe de moderação.
- **LGPD:** os dados (nome, CPF, contato) devem ser usados **apenas** para
  organizar e responder a solicitação de reunião — é exatamente isso que o
  solicitante autoriza no formulário. Não use a lista para disparos em massa ou
  qualquer outra finalidade, e exclua solicitações antigas periodicamente.
