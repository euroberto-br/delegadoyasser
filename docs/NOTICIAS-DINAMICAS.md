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

## 2. Onde hospedar as fotos

Qualquer URL pública de imagem funciona. O caminho mais prático para a equipe
é o **Google Drive**:

1. Suba a foto numa pasta do Drive da campanha.
2. Clique com o botão direito ▸ **Compartilhar** ▸ acesso
   "Qualquer pessoa com o link".
3. Copie o link, que tem o formato
   `https://drive.google.com/file/d/ID-DO-ARQUIVO/view?...`
4. Na planilha, use este formato (troque só o ID):

   ```
   https://drive.google.com/thumbnail?id=ID-DO-ARQUIVO&sz=w1200
   ```

   O `sz=w1200` entrega a imagem já redimensionada para 1200px — não precisa
   tratar a foto antes.

Alternativa: colocar as fotos na pasta `images/` do próprio site (melhor
desempenho, mas exige publicar no GitHub a cada notícia).

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
