# Agenda dinâmica — publicar eventos pela planilha Google

A seção **"Agenda de ações"** da landing pode ser alimentada por uma planilha
Google. A equipe edita a planilha e o site atualiza sozinho — sem mexer em
código, sem publicar nada no GitHub.

## 1. Criar a planilha

Crie uma planilha no [Google Sheets](https://sheets.google.com) com estas
colunas na **primeira linha** (nomes exatos, sem acento, em minúsculas):

| data | hora | titulo | cidade | local | tipo | link |
|------|------|--------|--------|-------|------|------|
| 15/08/2026 | 19h | Roda de Conversa — Segurança e Comunidade | Goiânia | Setor Central | Presencial | |
| 22/08/2026 | 20h | Mutirão Digital — Tropa de Elite do Amor | Online | Grupo no WhatsApp | Online | https://wa.me/... |

Regras:

- **data** — obrigatória, no formato `DD/MM/AAAA`. Eventos com data passada
  somem do site automaticamente.
- **titulo** — obrigatório. As demais colunas são opcionais.
- **tipo** — vira a etiqueta do evento (`Presencial`, `Online`, `Lançamento`…).
- **link** — se preenchido, o título do evento vira um link (inscrição, grupo etc.).
- A ordem das colunas não importa; linhas em branco são ignoradas.
- O site mostra no máximo os **8 próximos eventos**, em ordem de data.

## 2. Publicar a planilha como CSV

1. Na planilha: **Arquivo ▸ Compartilhar ▸ Publicar na web**.
2. Em "Link", escolha **a aba com os eventos** (não "Documento inteiro").
3. Em formato, escolha **Valores separados por vírgula (.csv)**.
4. Clique em **Publicar** e copie o link gerado
   (algo como `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv`).

> Publicar na web torna público **apenas o conteúdo dessa aba**. Não coloque
> dados sensíveis nela.

## 3. Ligar o site à planilha

Abra `js/landing.js`, localize a constante e cole o link:

```js
var AGENDA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv";
```

Pronto. Faça commit/publicação do site uma única vez; daí em diante basta
editar a planilha.

## Como funciona no dia a dia

- Alguém da equipe adiciona/edita uma linha na planilha → o site reflete a
  mudança em alguns minutos (o Google guarda o CSV publicado em cache por
  ~5 minutos).
- Se a planilha estiver vazia, sem eventos futuros ou fora do ar, o site
  exibe o aviso "As próximas ações serão divulgadas em breve" — a seção
  nunca quebra.
- Eventos passados saem sozinhos; ninguém precisa "limpar" a agenda.

## Dica

Deixe a planilha compartilhada (edição) só com quem publica a agenda, e
fixe-a no Drive da campanha junto com a planilha do formulário de cadastro
(ver `docs/INTEGRACAO-FORMULARIO.md`).
