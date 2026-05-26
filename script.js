/**
 * QR MAKER — script.js
 * ============================================================
 * Lógica completa do gerador de QR Codes permanentes.
 *
 * Fluxo principal:
 *  1. Usuário preenche título + URL e clica "Gerar QR Code".
 *  2. A biblioteca qrcode.js cria um <canvas> com o QR.
 *  3. O QR fica na área de pré-visualização.
 *  4. Ao clicar "Salvar", o dataURL do canvas é guardado no
 *     localStorage junto com os metadados (id, título, url, data).
 *  5. A listagem é renderizada dinamicamente a partir do storage.
 *  6. O botão "Baixar PNG" converte o canvas para download.
 *
 * Dependências externas:
 *  - qrcode.js via CDN (injetada no index.html)
 * ============================================================
 */

/* ── SELEÇÃO DE ELEMENTOS DO DOM ──────────────────────────── */
const form            = document.getElementById('qrForm');
const inputTitle      = document.getElementById('inputTitle');
const inputUrl        = document.getElementById('inputUrl');
const btnGenerate     = document.getElementById('btnGenerate');
const previewArea     = document.getElementById('previewArea');
const qrPreviewCanvas = document.getElementById('qrPreviewCanvas');
const previewTitle    = document.getElementById('previewTitle');
const previewUrl      = document.getElementById('previewUrl');
const btnCopyLink     = document.getElementById('btnCopyLink');
const btnDownloadPrev = document.getElementById('btnDownloadPreview');
const btnSave         = document.getElementById('btnSave');
const qrGrid          = document.getElementById('qrGrid');
const emptyState      = document.getElementById('emptyState');
const searchInput     = document.getElementById('searchInput');
const badgeCount      = document.getElementById('badgeCount');
const toastContainer  = document.getElementById('toastContainer');
const deleteModal     = document.getElementById('deleteModal');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete= document.getElementById('btnConfirmDelete');

/* ── CONSTANTES ───────────────────────────────────────────── */
const STORAGE_KEY    = 'qrmaker_codes_v1'; // chave do localStorage
const DEFAULT_SIZE   = 200;                // tamanho padrão em px

/* ── ESTADO GLOBAL ────────────────────────────────────────── */
let currentQRData   = null;   // dados do QR Code em pré-visualização
let pendingDeleteId = null;   // id do QR Code aguardando confirmação de exclusão
let searchQuery     = '';     // filtro de busca atual

/* ============================================================
   UTILITÁRIOS GERAIS
   ============================================================ */

/**
 * Gera um ID único baseado em timestamp + número aleatório.
 * @returns {string}
 */
function generateId() {
  return `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Formata uma data ISO para exibição amigável em pt-BR.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

/**
 * Retorna o tamanho selecionado nos radio buttons de tamanho.
 * @returns {number}
 */
function getSelectedSize() {
  const checked = document.querySelector('input[name="qrSize"]:checked');
  return checked ? parseInt(checked.value, 10) : DEFAULT_SIZE;
}

/* ============================================================
   TOAST DE NOTIFICAÇÃO
   ============================================================ */

/**
 * Exibe um toast animado na tela.
 * @param {string} message - Texto da mensagem.
 * @param {'success'|'error'|'info'|'warning'} type - Tipo do toast.
 * @param {number} [duration=3000] - Tempo em ms antes de sumir.
 */
function showToast(message, type = 'info', duration = 3000) {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;

  toastContainer.appendChild(toast);

  // Remove automaticamente após `duration` ms
  const timer = setTimeout(() => removeToast(toast), duration);

  // Clique no toast o remove imediatamente
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast(toast);
  });
}

/**
 * Remove um toast com animação de saída.
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
  if (!toast.parentElement) return;
  toast.classList.add('hiding');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/* ============================================================
   LOCAL STORAGE — persistência dos QR Codes
   ============================================================ */

/**
 * Lê todos os QR Codes salvos no localStorage.
 * @returns {Array<Object>}
 */
function loadCodes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Persiste o array de QR Codes no localStorage.
 * @param {Array<Object>} codes
 */
function saveCodes(codes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
}

/**
 * Adiciona um novo QR Code à lista e salva.
 * @param {Object} entry
 */
function addCode(entry) {
  const codes = loadCodes();
  codes.unshift(entry); // mais recente no topo
  saveCodes(codes);
}

/**
 * Remove um QR Code pelo id e salva.
 * @param {string} id
 */
function removeCode(id) {
  const codes = loadCodes().filter(c => c.id !== id);
  saveCodes(codes);
}

/* ============================================================
   GERAÇÃO DO QR CODE (qrcode.js)
   ============================================================ */

/**
 * Limpa o container e gera um novo QR Code dentro dele.
 * @param {HTMLElement} container - Elemento onde o QR será inserido.
 * @param {string} url            - URL que o QR Code vai codificar.
 * @param {number} size           - Largura/altura em pixels.
 * @returns {Promise<HTMLCanvasElement>} - Resolve com o canvas gerado.
 */
function generateQRCode(container, url, size) {
  return new Promise((resolve) => {
    // Limpa qualquer QR anterior
    container.innerHTML = '';

    /* eslint-disable no-new */
    new QRCode(container, {
      text:           url,
      width:          size,
      height:         size,
      colorDark:      '#000000',
      colorLight:     '#ffffff',
      correctLevel:   QRCode.CorrectLevel.H, // correção alta — melhor para logos
    });

    // qrcode.js é síncrono internamente, mas usa setTimeout(0) internamente;
    // aguardamos um tick para garantir que o canvas/img foi inserido.
    setTimeout(() => {
      const el = container.querySelector('canvas') || container.querySelector('img');
      resolve(el);
    }, 100);
  });
}

/**
 * Extrai o dataURL de um canvas ou img já gerado pelo qrcode.js.
 * @param {HTMLElement} container
 * @returns {string|null}
 */
function getDataURL(container) {
  const canvas = container.querySelector('canvas');
  if (canvas) return canvas.toDataURL('image/png');
  const img = container.querySelector('img');
  if (img) return img.src;
  return null;
}

/**
 * Dispara o download de um PNG a partir de um dataURL.
 * @param {string} dataUrl
 * @param {string} filename
 */
function downloadPNG(dataUrl, filename) {
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = filename;
  a.click();
}

/* ============================================================
   VALIDAÇÃO DO FORMULÁRIO
   ============================================================ */

/**
 * Valida os campos do formulário.
 * @returns {{ valid: boolean, title: string, url: string }}
 */
function validateForm() {
  let valid = true;

  const title = inputTitle.value.trim();
  const url   = inputUrl.value.trim();

  // Valida título
  if (!title) {
    inputTitle.classList.add('is-error');
    valid = false;
  } else {
    inputTitle.classList.remove('is-error');
  }

  // Valida URL (deve começar com http:// ou https://)
  if (!url) {
    inputUrl.classList.add('is-error');
    valid = false;
  } else {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      inputUrl.classList.remove('is-error');
    } catch {
      inputUrl.classList.add('is-error');
      valid = false;
    }
  }

  return { valid, title, url };
}

/* ============================================================
   RENDERIZAÇÃO DA LISTAGEM
   ============================================================ */

/**
 * Re-renderiza toda a grade de QR Codes salvos,
 * aplicando o filtro de busca se houver.
 */
function renderGrid() {
  const codes = loadCodes();

  // Aplica filtro de busca (case-insensitive)
  const filtered = searchQuery
    ? codes.filter(c =>
        c.title.toLowerCase().includes(searchQuery) ||
        c.url.toLowerCase().includes(searchQuery)
      )
    : codes;

  // Atualiza badge
  badgeCount.textContent = `${codes.length} QR${codes.length !== 1 ? 's' : ''}`;

  // Exibe ou oculta estado vazio
  emptyState.hidden = filtered.length > 0;
  qrGrid.hidden     = filtered.length === 0;

  // Limpa grade antes de re-renderizar
  qrGrid.innerHTML = '';

  filtered.forEach(code => {
    const item = buildQRItem(code);
    qrGrid.appendChild(item);
  });
}

/**
 * Constrói o elemento DOM de um card de QR Code.
 * A miniatura é reconstruída via qrcode.js a partir do dataURL salvo
 * (ou recriada pelo QR para garantir qualidade).
 *
 * @param {Object} code - { id, title, url, dataUrl, size, createdAt }
 * @returns {HTMLElement}
 */
function buildQRItem(code) {
  const item = document.createElement('div');
  item.className = 'qr-item';
  item.setAttribute('role', 'listitem');
  item.dataset.id = code.id;

  // ── Miniatura
  const thumb = document.createElement('div');
  thumb.className = 'qr-item__thumb';

  // Usa o dataURL salvo como <img> para a miniatura (leve e rápido)
  if (code.dataUrl) {
    const img = document.createElement('img');
    img.src = code.dataUrl;
    img.alt = `QR Code de ${code.title}`;
    img.style.cssText = 'width:100%;max-width:120px;height:auto;display:block;';
    thumb.appendChild(img);
  } else {
    // Fallback: gera o QR via biblioteca (caso não tenha dataUrl)
    const miniWrap = document.createElement('div');
    miniWrap.style.cssText = 'width:120px;height:120px;';
    thumb.appendChild(miniWrap);
    new QRCode(miniWrap, {
      text:         code.url,
      width:        120,
      height:       120,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  // ── Informações
  const info = document.createElement('div');
  info.className = 'qr-item__info';
  info.innerHTML = `
    <p class="qr-item__name" title="${escapeHtml(code.title)}">${escapeHtml(code.title)}</p>
    <a class="qr-item__url" href="${escapeHtml(code.url)}" target="_blank" rel="noopener noreferrer"
       title="${escapeHtml(code.url)}">${escapeHtml(code.url)}</a>
    <p class="qr-item__date">Criado em ${formatDate(code.createdAt)}</p>
  `;

  // ── Ações
  const actions = document.createElement('div');
  actions.className = 'qr-item__actions';

  // Botão copiar link
  const btnCopy = document.createElement('button');
  btnCopy.className = 'btn btn--outline btn--sm';
  btnCopy.title = 'Copiar URL';
  btnCopy.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    Copiar
  `;
  btnCopy.addEventListener('click', () => {
    copyToClipboard(code.url, 'Link copiado!');
  });

  // Botão baixar PNG
  const btnDL = document.createElement('button');
  btnDL.className = 'btn btn--outline btn--sm';
  btnDL.title = 'Baixar como PNG';
  btnDL.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    PNG
  `;
  btnDL.addEventListener('click', () => {
    if (code.dataUrl) {
      downloadPNG(code.dataUrl, `qr_${slugify(code.title)}.png`);
      showToast('Download iniciado!', 'success');
    } else {
      showToast('Imagem não disponível para download.', 'error');
    }
  });

  // Botão excluir
  const btnDel = document.createElement('button');
  btnDel.className = 'btn btn--danger btn--sm';
  btnDel.title = 'Excluir QR Code';
  btnDel.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
    Excluir
  `;
  btnDel.addEventListener('click', () => openDeleteModal(code.id));

  actions.append(btnCopy, btnDL, btnDel);
  item.append(thumb, info, actions);
  return item;
}

/* ============================================================
   MODAL DE EXCLUSÃO
   ============================================================ */

/**
 * Abre o modal de confirmação de exclusão para o QR Code dado.
 * @param {string} id
 */
function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteModal.hidden = false;
  document.body.style.overflow = 'hidden'; // previne scroll do fundo
  btnConfirmDelete.focus();
}

/** Fecha o modal de exclusão sem excluir. */
function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModal.hidden = true;
  document.body.style.overflow = '';
}

// Confirmar exclusão
btnConfirmDelete.addEventListener('click', () => {
  if (!pendingDeleteId) return;

  // Anima o card antes de remover
  const item = qrGrid.querySelector(`[data-id="${pendingDeleteId}"]`);
  if (item) {
    item.classList.add('removing');
    item.addEventListener('animationend', () => {
      removeCode(pendingDeleteId);
      renderGrid();
    }, { once: true });
  } else {
    removeCode(pendingDeleteId);
    renderGrid();
  }

  closeDeleteModal();
  showToast('QR Code excluído.', 'info');
});

// Cancelar exclusão
btnCancelDelete.addEventListener('click', closeDeleteModal);

// Fechar modal clicando no overlay
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

// Fechar modal com Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !deleteModal.hidden) closeDeleteModal();
});

/* ============================================================
   AÇÕES DE PRÉ-VISUALIZAÇÃO
   ============================================================ */

/**
 * Copia texto para a área de transferência.
 * @param {string} text
 * @param {string} [successMessage]
 */
function copyToClipboard(text, successMessage = 'Copiado!') {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMessage, 'success'))
      .catch(() => showToast('Não foi possível copiar.', 'error'));
  } else {
    // Fallback para browsers antigos
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMessage, 'success');
    } catch {
      showToast('Não foi possível copiar.', 'error');
    }
    ta.remove();
  }
}

// Botão "Copiar link" na pré-visualização
btnCopyLink.addEventListener('click', () => {
  if (currentQRData) copyToClipboard(currentQRData.url, 'Link copiado!');
});

// Botão "Baixar PNG" na pré-visualização
btnDownloadPrev.addEventListener('click', () => {
  if (!currentQRData) return;
  const dataUrl = getDataURL(qrPreviewCanvas);
  if (dataUrl) {
    downloadPNG(dataUrl, `qr_${slugify(currentQRData.title)}.png`);
    showToast('Download iniciado!', 'success');
  }
});

// Botão "Salvar" na pré-visualização
btnSave.addEventListener('click', () => {
  if (!currentQRData) return;

  const codes = loadCodes();
  const alreadySaved = codes.some(c => c.url === currentQRData.url && c.title === currentQRData.title);

  if (alreadySaved) {
    showToast('Este QR Code já está na lista!', 'warning');
    return;
  }

  // Captura o dataURL do canvas para persistência
  const dataUrl = getDataURL(qrPreviewCanvas);
  const entry = { ...currentQRData, dataUrl };

  addCode(entry);
  renderGrid();
  showToast(`"${currentQRData.title}" salvo com sucesso!`, 'success');

  // Reseta o formulário e oculta a pré-visualização
  form.reset();
  previewArea.hidden = true;
  currentQRData = null;
  resetSizeOptions();
});

/* ============================================================
   ENVIO DO FORMULÁRIO — geração do QR Code
   ============================================================ */

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { valid, title, url } = validateForm();
  if (!valid) {
    showToast('Preencha todos os campos corretamente.', 'error');
    return;
  }

  // Estado de carregamento
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Gerando…';

  try {
    const size = getSelectedSize();

    // Gera o QR Code no container de pré-visualização
    await generateQRCode(qrPreviewCanvas, url, size);

    // Atualiza informações de pré-visualização
    previewTitle.textContent = title;
    previewUrl.textContent   = url;
    previewUrl.href          = url;

    // Salva estado atual em memória
    currentQRData = {
      id:        generateId(),
      title:     title,
      url:       url,
      size:      size,
      createdAt: new Date().toISOString(),
    };

    // Exibe área de pré-visualização com animação
    previewArea.hidden = false;
    previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showToast('QR Code gerado! Clique em "Salvar" para guardar.', 'success');

  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
    showToast('Erro ao gerar QR Code. Tente novamente.', 'error');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5"/>
        <rect x="13" y="3" width="8" height="8" rx="1.5"/>
        <rect x="3" y="13" width="8" height="8" rx="1.5"/>
      </svg>
      Gerar QR Code
    `;
  }
});

/* ============================================================
   BUSCA / FILTRO
   ============================================================ */

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderGrid();
});

/* ============================================================
   SINCRONIZAÇÃO DE RADIO BUTTONS DE TAMANHO
   ============================================================ */

/**
 * Destaca visualmente o radio button de tamanho selecionado.
 */
function syncSizeOptions() {
  document.querySelectorAll('.size-option').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    label.classList.toggle('size-option--selected', radio.checked);
  });
}

/** Volta ao estado padrão (Médio) após reset do formulário. */
function resetSizeOptions() {
  document.querySelectorAll('input[name="qrSize"]').forEach(r => {
    r.checked = r.value === '200';
  });
  syncSizeOptions();
}

document.querySelectorAll('input[name="qrSize"]').forEach(radio => {
  radio.addEventListener('change', syncSizeOptions);
});

/* ============================================================
   UTILITÁRIOS DE STRINGS
   ============================================================ */

/**
 * Escapa caracteres HTML especiais para evitar XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converte uma string em slug adequado para nome de arquivo.
 * Ex.: "WhatsApp Suporte" → "whatsapp_suporte"
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

/**
 * Ponto de entrada: executado quando o DOM estiver pronto.
 */
function init() {
  // Carrega e exibe QR Codes já salvos
  renderGrid();

  // Sincroniza visual dos radio buttons
  syncSizeOptions();

  // Foca no primeiro campo para UX ágil
  inputTitle.focus();
}

// Inicializa após o carregamento da página
document.addEventListener('DOMContentLoaded', init);
