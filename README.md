# QR Maker — Gerador de QR Codes Permanentes

> QR Codes que nunca expiram. 100% estático, gratuito e hospedável no GitHub Pages.

![Licença MIT](https://img.shields.io/badge/licença-MIT-blue.svg)
![GitHub Pages](https://img.shields.io/badge/hospedagem-GitHub%20Pages-222?logo=github)
![Sem backend](https://img.shields.io/badge/backend-nenhum-green)

---

## Visão geral

**QR Maker** é uma aplicação web estática para gerar e gerenciar QR Codes permanentes. Não há servidor, banco de dados ou prazo de expiração — tudo roda no navegador e os dados ficam salvos no `localStorage` do dispositivo.

### Funcionalidades

- Geração instantânea de QR Codes a partir de qualquer URL
- Pré-visualização antes de salvar
- Listagem persistente de todos os QR Codes gerados
- Download individual em PNG
- Botão "Copiar link" com um clique
- Busca/filtro na listagem
- Dark mode automático (segue o sistema operacional)
- Modal de confirmação antes de excluir
- Toasts animados de feedback
- Interface responsiva — funciona em mobile e desktop

---

## Tecnologias utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 semântico | Estrutura da página |
| CSS3 (variáveis, grid, animações) | Estilo e responsividade |
| JavaScript ES2020 (Vanilla) | Toda a lógica da aplicação |
| [qrcode.js](https://github.com/davidshimjs/qrcodejs) | Geração dos QR Codes no navegador |
| localStorage | Persistência dos dados no dispositivo |
| GitHub Pages | Hospedagem gratuita e permanente |

---

## Estrutura do projeto

```
QRCODE/
├── index.html    ← Estrutura HTML da interface
├── style.css     ← Estilos (light + dark mode automático)
├── script.js     ← Toda a lógica JavaScript
├── favicon.svg   ← Ícone da aba do navegador
└── README.md     ← Este arquivo
```

---

## Como rodar localmente

Não é necessário nenhum servidor ou instalação. Basta abrir o arquivo diretamente:

### Opção 1 — Abrir o arquivo diretamente
1. Clone ou baixe o repositório
2. Abra a pasta `QRCODE/`
3. Dê dois cliques em `index.html`

> ⚠️ Alguns navegadores bloqueiam recursos de arquivos locais. Se o QR Code não aparecer, use a Opção 2.

### Opção 2 — Servidor local com Python (recomendado)
```bash
# Entre na pasta do projeto
cd QRCODE

# Python 3
python3 -m http.server 8080

# Acesse no navegador:
# http://localhost:8080
```

### Opção 3 — Servidor local com Node.js
```bash
# Instale o servidor estático (uma vez)
npm install -g serve

# Rode na pasta do projeto
cd QRCODE
serve .

# Acesse no navegador:
# http://localhost:3000
```

---

## Como publicar no GitHub Pages

### Passo 1 — Crie o repositório no GitHub
1. Acesse [github.com/new](https://github.com/new)
2. Nome sugerido: `qr-maker` (ou qualquer nome)
3. Deixe **público**
4. Clique em **Create repository**

### Passo 2 — Suba os arquivos pelo terminal
```bash
# Entre na pasta do projeto
cd /caminho/para/QRCODE

# Inicie o repositório Git (se ainda não inicializou)
git init
git branch -M main

# Adicione todos os arquivos
git add .
git commit -m "feat: QR Maker inicial"

# Conecte ao GitHub (substitua SEU_USUARIO e SEU_REPOSITORIO)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# Faça o push
git push -u origin main
```

### Passo 3 — Ative o GitHub Pages
1. No seu repositório, clique em **Settings** (⚙️)
2. No menu lateral, clique em **Pages**
3. Em **Branch**, selecione `main` e pasta `/ (root)`
4. Clique em **Save**
5. Aguarde ~1 minuto

### Passo 4 — Acesse o site
Após ativado, sua URL será:
```
https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

> 💡 A URL será permanente enquanto o repositório existir e o GitHub Pages estiver ativado.

---

## Como usar

1. **Preencha o título** — dê um nome descritivo ao QR Code (ex.: "WhatsApp Suporte")
2. **Cole a URL de destino** — qualquer link válido (ex.: `https://api.whatsapp.com/send?phone=5547996798784`)
3. **Escolha o tamanho** — Pequeno (128px), Médio (200px) ou Grande (300px)
4. **Clique em "Gerar QR Code"** — o QR aparece na pré-visualização
5. **Clique em "Salvar"** — o QR é adicionado à lista abaixo e fica salvo no seu navegador
6. **Baixe em PNG** — clique no botão de download para salvar a imagem
7. **Copie o link** — botão rápido para copiar a URL para a área de transferência

---

## Persistência dos dados

Os QR Codes são salvos no `localStorage` do navegador com a chave `qrmaker_codes_v1`. Isso significa:

- ✅ Os QR Codes continuam aparecendo após atualizar a página
- ✅ Os dados ficam no dispositivo, sem enviar nada para servidores
- ⚠️ Limpar o cache/dados do navegador apaga os registros locais
- ⚠️ Os dados são específicos por dispositivo/navegador

Para backup, baixe os PNGs dos QR Codes importantes.

---

## Personalização

### Alterar cores / tema
Edite as variáveis CSS no início do `style.css`:
```css
:root {
  --color-accent: #5b6af0; /* cor principal (botões, destaques) */
  /* ... outras variáveis */
}
```

### Alterar cor dos QR Codes gerados
No `script.js`, localize a função `generateQRCode` e altere:
```javascript
colorDark:  '#000000', // cor dos quadradinhos
colorLight: '#ffffff', // cor do fundo
```

---

## Licença

MIT — use à vontade, modifique, distribua.

---

*Feito com HTML, CSS e JavaScript puro. Sem frameworks, sem backend, sem complicação.*
