# Notícias dinâmicas — publicar pela planilha Google

A seção **"Notícias da campanha"** funciona como a agenda (`docs/AGENDA-DINAMICA.md`):
a equipe edita uma planilha Google e o site atualiza sozinho. Cada notícia pode
ter uma ou mais fotos, resumo e texto completo — o visitante lê tudo num
painel que abre no próprio site.

## 1. Criar a planilha

Crie uma planilha (ou uma **nova aba** na planilha da agenda) com estas colunas
na primeira linha (nomes exatos, sem acento, em minúsculas):

| data | titulo | resumo | conteudo | fotos | link |
|------|--------|--------|----------|-------|------|
| 20/07/2026 | Caminhada reúne apoiadores em Goiânia | Centenas de pessoas caminharam pelo centro… | Texto completo da notícia… | https://…/foto1.jpg\|https://…/foto2.jpg | https://jornal.com/materia |

Regras:

- **data** — obrigatória, `DD/MM/AAAA`. As notícias aparecem da mais recente
  para a mais antiga (máximo de 9 no site).
- **titulo** — obrigatório.
- **resumo** — texto curto exibido no card (1 a 2 frases).
- **conteudo** — texto completo, exibido ao clicar em "Ler mais". Para criar
  parágrafos, quebre a linha dentro da célula com `Alt + Enter`.
- **fotos** — uma ou mais URLs de imagem, separadas por `|` (barra vertical).
  A primeira foto vira a capa do card; todas aparecem no "Ler mais".
- **link** — opcional. Se preenchido, aparece como "Ler na íntegra" no fim da
  notícia (bom para matérias de jornais).

## 2. Onde hospedar as fotos — Google Drive (passo a passo)

O caminho mais prático é uma **pasta do Google Drive** da campanha. O site
converte o link do Drive sozinho, então **basta colar o link normal** — não
precisa montar URL nenhuma.

### 2.1 Preparar a pasta (uma vez só)

1. No Google Drive, crie uma pasta, ex.: **Fotos do site — Notícias**.
2. Clique com o botão direito na **pasta** ▸ **Compartilhar** ▸ em "Acesso geral"
   escolha **"Qualquer pessoa com o link"** (papel **Leitor**).
   > Compartilhando a pasta, toda foto que você jogar dentro já nasce pública —
   > não precisa repetir isso a cada imagem.

### 2.2 Para cada foto

1. Suba a foto para essa pasta.
2. Clique com o botão direito na foto ▸ **Compartilhar** ▸ **Copiar link**.
3. Cole esse link na coluna **fotos** da planilha. Ele terá um destes formatos —
   **todos funcionam**:

   ```
   https://drive.google.com/file/d/1AbCdEf.../view?usp=drive_link   ← o padrão do "Copiar link"
   https://drive.google.com/open?id=1AbCdEf...
   1AbCdEf...                                                       ← só o ID também vale
   ```

4. Para **várias fotos** na mesma notícia, separe os links com `|` (barra vertical):

   ```
   https://drive.google.com/file/d/AAA.../view|https://drive.google.com/file/d/BBB.../view
   ```

### Como o site trata isso

Ao carregar a notícia, o site lê o link, extrai o **ID do arquivo** e monta a URL
de imagem real do Drive automaticamente:

```
https://drive.google.com/thumbnail?id=ID-DO-ARQUIVO&sz=w1600
```

O `sz=w1600` já entrega a foto redimensionada (até 1600px de largura), então
**não precisa tratar/comprimir a imagem antes** de subir. A primeira foto vira a
capa do card; todas aparecem no "Ler mais".

> **Importante:** a foto (ou a pasta) precisa estar como **"Qualquer pessoa com o
> link"**. Se estiver privada/"restrito", ela não aparece no site — só um ícone
> quebrado. Se a imagem não carregar, o primeiro suspeito é sempre a permissão.

**Alternativa** ao Drive: colocar as fotos na pasta `images/` do próprio site e
usar o caminho relativo (ex.: `images/noticias/foto1.jpg`). Melhor desempenho,
mas exige publicar no GitHub a cada notícia nova.

## 3. Publicar a planilha e ligar o site

1. **Arquivo ▸ Compartilhar ▸ Publicar na web** ▸ escolha a **aba de notícias**
   ▸ formato **CSV** ▸ Publicar ▸ copie o link.
2. Em `js/landing.js`, cole o link na constante:

   ```js
   var NOTICIAS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=123/single=true&output=csv";
   ```

> Atenção: se a agenda e as notícias estiverem na mesma planilha, cada aba tem
> um link de publicação próprio (o `gid=` muda). Publique as duas abas e use o
> link certo em cada constante.

## Como funciona no dia a dia

- Nova linha na planilha → notícia no ar em ~5 minutos.
- Sem planilha configurada, com erro ou vazia → o site exibe o aviso
  "As notícias da campanha serão publicadas em breve"; a seção nunca quebra.
- O conteúdo é sempre tratado como texto puro (sem HTML), o que impede que
  alguém quebre o layout ou injete código pela planilha.
