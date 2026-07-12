# Carrossel de fotos dinâmico — pela pasta do Google Drive

O carrossel da seção **"Momentos do movimento"** não usa mais fotos fixas dentro
do projeto. Agora ele lê **direto de uma pasta compartilhada do Google Drive**:
toda foto que você **adicionar** na pasta aparece no site e toda foto que você
**remover** some — inclusive a numeração da legenda (`3 / 27`) se ajusta sozinha.
Você nunca mais precisa mexer no código para trocar as fotos.

Como o site é estático (só HTML/CSS/JS, sem servidor próprio), o navegador **não
consegue** listar o conteúdo de uma pasta do Drive sozinho. Por isso usamos uma
pequena "ponte": um **Web App do Apps Script** (a mesma tecnologia do formulário
de cadastro) que lê a pasta e devolve a lista de fotos. É de graça, roda na sua
conta Google e não expõe nenhuma senha nem chave.

---

## Visão geral — o que você vai montar

```
Pasta no Google Drive  →  Web App do Apps Script  →  js/landing.js  →  Carrossel do site
   (suas fotos)            (lê a pasta e             (busca a lista       (mostra e numera
                            devolve em JSON)          e monta as fotos)     sozinho)
```

## Checklist (uma vez só)

- [ ] **Passo 1** — Pasta do Drive compartilhada como "Qualquer pessoa com o link" (Leitor)
- [ ] **Passo 2** — Fotos dentro da pasta, nomeadas com número na frente (`01-...`, `02-...`)
- [ ] **Passo 3** — Web App do Apps Script publicado (URL termina em `/exec`)
- [ ] **Passo 4** — URL `/exec` colada em `CARROSSEL_ENDPOINT` no `js/landing.js`
- [ ] **Passo 5** — Testado no site (as fotos aparecem)

> Depois de montado, o dia a dia é só **arrastar foto para a pasta** — nada de código.

---

## Passo 1 — Deixar a pasta pública (só leitura)

A pasta oficial já existe:

> https://drive.google.com/drive/folders/1ISZwF1g_bP_5jOrtgbMFHy7eqRzI5Gz1

O código (o `FOLDER_ID` no Passo 3) aponta para o **id** dessa pasta — o trecho
depois de `/folders/`, ou seja `1ISZwF1g_bP_5jOrtgbMFHy7eqRzI5Gz1`. Se um dia
quiser usar **outra** pasta, é só trocar esse id.

Para deixá-la pública:

1. Abra a pasta no Google Drive.
2. Botão direito na pasta ▸ **Compartilhar**.
3. Em **"Acesso geral"**, escolha **"Qualquer pessoa com o link"**, papel **Leitor**.
4. Clique **Concluído**.

> Compartilhando a **pasta**, toda foto que você jogar dentro já nasce pública —
> não precisa repetir isso a cada imagem.

---

## Passo 2 — Colocar as fotos na pasta

1. Suba as fotos para dentro dessa pasta (arraste do computador ou **Novo ▸
   Upload de arquivo**).
2. **Ordem:** o carrossel exibe as fotos **em ordem de nome de arquivo**. Para
   controlar a sequência, coloque um número na frente:
   `01-caminhada.jpg`, `02-comicio.jpg`, `03-encontro.jpg`, …
   > A ordenação é "natural", então `10-...` vem depois de `9-...` normalmente.
3. **Só imagens contam.** O script ignora PDFs, vídeos, documentos etc. — pode
   deixar outros arquivos na pasta sem problema, que não entram no carrossel.
4. **Formatos aceitos:** JPG, PNG, WebP (qualquer coisa que o navegador exiba).
5. **Dica de peso:** fotos muito grandes deixam o site lento. O ideal é o lado
   maior ter ~1600px. O Drive já entrega uma versão redimensionada, então não é
   obrigatório, mas evite subir arquivos de dezenas de MB.

---

## Passo 3 — Publicar o Web App do Apps Script

1. Acesse **https://script.google.com** ▸ **Novo projeto**.
2. Dê um nome ao projeto (ex.: *Carrossel Yasser*).
3. Apague o conteúdo que vier em `Código.gs` e **cole o código abaixo**:

```javascript
// Lista as imagens de uma pasta compartilhada do Google Drive.
// Publicar como Web App (Implantar ▸ Nova implantação ▸ App da Web).
var FOLDER_ID = '1ISZwF1g_bP_5jOrtgbMFHy7eqRzI5Gz1';

function doGet() {
  var pasta = DriveApp.getFolderById(FOLDER_ID);
  var arquivos = pasta.getFiles();
  var fotos = [];

  while (arquivos.hasNext()) {
    var f = arquivos.next();
    var mime = f.getMimeType() || '';
    // Só imagens (jpg, png, webp, etc.). Ignora PDFs, vídeos, etc.
    if (mime.indexOf('image/') === 0) {
      fotos.push({ id: f.getId(), nome: f.getName() });
    }
  }

  // Ordena por nome de arquivo (01-..., 02-...), com ordenação numérica natural.
  fotos.sort(function (a, b) {
    return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, total: fotos.length, fotos: fotos }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Clique em **Salvar** (ícone do disquete).
5. Clique em **Implantar ▸ Nova implantação**.
6. No ícone de engrenagem (⚙️ "Selecionar tipo"), escolha **"App da Web"**.
7. Preencha:
   - **Descrição:** livre (ex.: *v1*).
   - **Executar como:** *Eu* (sua conta) — é o que dá permissão para ler a pasta.
   - **Quem pode acessar:** **"Qualquer pessoa"**.
8. Clique **Implantar**. Na primeira vez o Google pede autorização — aceite:
   - escolha sua conta Google;
   - se aparecer **"O Google não verificou este app"**, clique em **Avançado ▸
     Acessar (nome do projeto) (não seguro)**. É o **seu próprio** script lendo a
     **sua própria** pasta — é seguro;
   - confirme **Permitir**.
9. Copie a **URL do app da Web** — ela termina em **`/exec`**. É essa que vai no site.

> **Teste rápido (faça agora):** cole essa URL `/exec` no navegador. Deve aparecer
> um texto JSON parecido com:
> ```json
> {"ok":true,"total":27,"fotos":[{"id":"1Ab...","nome":"01-caminhada.jpg"}, ...]}
> ```
> Se `total` bate com o número de fotos da pasta, está funcionando.

---

## Passo 4 — Colar a URL no site

No arquivo **`js/landing.js`**, procure a linha (fica na seção do carrossel):

```javascript
var CARROSSEL_ENDPOINT = "";
```

e coloque a URL `/exec` entre as aspas:

```javascript
var CARROSSEL_ENDPOINT = "https://script.google.com/macros/s/AKfy.../exec";
```

Salve, faça o **commit** e **publique** (o mesmo processo que você já usa para
subir o site). Enquanto essa linha estiver com `""`, o carrossel mostra o aviso
*"As fotos do movimento aparecerão aqui em breve."*.

---

## Passo 5 — Conferir no site

1. Abra a página publicada (ou rode localmente — veja "Testar localmente" abaixo).
2. Vá até a seção **"Momentos do movimento"**.
3. As fotos devem aparecer, com a legenda `1 / N` embaixo e as setas de navegar.

Pronto. A partir daqui você não mexe mais no código.

---

## Como fica o dia a dia

- **Adicionar foto:** arraste a imagem para a pasta do Drive. Aparece no site no
  próximo acesso (pode levar alguns minutos por causa do cache do navegador).
- **Remover foto:** apague (ou mova para fora) da pasta. Some do site.
- **Reordenar:** renomeie os arquivos mudando o número da frente.
- A legenda **`N / total`** e o total sempre refletem a quantidade real de fotos.
- **Você NÃO precisa** republicar o Apps Script nem mexer no site para trocar
  fotos — só quando mudar o **código** do script (aí veja abaixo).

---

## Testar localmente (opcional, para quem desenvolve)

O carrossel só busca as fotos quando a página é servida por **http/https**. Se
você abrir o `landing.html` com duplo-clique (`file://`), ele mostra o aviso "em
breve" de propósito (evita erro de CORS). Para testar de verdade na sua máquina:

```bash
# na pasta do projeto:
python -m http.server 8000
# depois abra no navegador:
# http://localhost:8000/landing.html
```

---

## Problemas comuns

**As fotos não aparecem (fica no "em breve").**
- Confira se `CARROSSEL_ENDPOINT` no `js/landing.js` está preenchido com a URL
  `/exec` (e não vazio).
- Abra a URL `/exec` direto no navegador: se der erro em vez do JSON, o problema
  está no Apps Script (veja os itens abaixo).
- Você está abrindo o site por `http/https`? Em `file://` o aviso é esperado.

**A URL `/exec` mostra erro de autorização / "You do not have permission".**
- Na implantação, **"Quem pode acessar"** precisa ser **"Qualquer pessoa"** (não
  "Qualquer pessoa da organização").
- **"Executar como"** precisa ser **"Eu"** (sua conta, que enxerga a pasta).

**Editei o código do script e nada mudou no site.**
- Cada implantação é uma versão "congelada". Depois de editar o `Código.gs`:
  **Implantar ▸ Gerenciar implantações ▸** (lápis para editar) ▸ em **Versão**
  escolha **"Nova versão" ▸ Implantar**. Isso mantém a **mesma URL** `/exec`.
  (Se criar uma implantação totalmente nova, a URL muda e você precisa atualizar
  o `CARROSSEL_ENDPOINT`.)

**Uma foto específica não carrega (aparece quebrada).**
- Confirme que a **pasta** está como "Qualquer pessoa com o link". Se você
  compartilhou arquivo por arquivo antes, uma foto nova pode não estar pública —
  garanta o compartilhamento no nível da **pasta**.
- Arquivos que não são imagem (PDF, vídeo) não entram no carrossel — isso é o
  esperado.

**Troquei/removi foto e o site ainda mostra a antiga.**
- É cache do navegador/Drive. Aguarde alguns minutos e recarregue com
  **Ctrl + F5** (recarga forçada).

**A ordem das fotos está errada.**
- Renomeie os arquivos com número na frente (`01-`, `02-`, …). Sem numeração, a
  ordem segue o nome do arquivo, que pode não ser a que você espera.

---

## Detalhes técnicos (para quem for dar manutenção no código)

- O site chama `CARROSSEL_ENDPOINT`, recebe `{ ok, total, fotos: [{id, nome}, …] }`
  e monta cada slide com `https://drive.google.com/thumbnail?id=ID&sz=w1600`
  (mesmo esquema já usado nas fotos das notícias).
- A lógica fica em `js/landing.js`, na função `montarCarrossel(fotos)`. Ela
  preserva: *lazy-load* (só carrega a foto atual e as vizinhas), autoplay que
  pausa no hover/foco/aba oculta e respeita `prefers-reduced-motion`, navegação
  por setas, teclado e toque.
- Estados sem fotos usam o elemento `#carrosselNota` + `hidden` na janela/contador,
  no mesmo padrão da agenda e das notícias:
  - endpoint vazio ou `file://` → *"As fotos do movimento aparecerão aqui em breve."*;
  - falha no fetch (deploy fora do ar/rede) → *"Não foi possível carregar as fotos
    agora. Tente recarregar a página."* — sem quebrar o resto da página.
- Se a pasta tiver **uma só foto**, o carrossel esconde as setas e o autoplay.
- O `data-autoplay` (em ms) fica no HTML, no elemento `#carrossel` (`landing.html`).
