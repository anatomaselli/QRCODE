/**
 * QR MAKER — script.js v2
 * 4 layouts · 7 gradientes · preview em tempo real · localStorage
 * O botão PNG renderiza o card COMPLETO (layout + gradiente + QR)
 * usando Canvas 2D API — não apenas a imagem crua do QR Code.
 */

/* ── DOM ──────────────────────────────────────────────────── */
const form               = document.getElementById('qrForm');
const inputTitle         = document.getElementById('inputTitle');
const inputUrl           = document.getElementById('inputUrl');
const btnGenerate        = document.getElementById('btnGenerate');
const previewArea        = document.getElementById('previewArea');
const qrHiddenCanvas     = document.getElementById('qrHiddenCanvas');
const previewCardContainer = document.getElementById('previewCardContainer');
const btnCopyLink        = document.getElementById('btnCopyLink');
const btnDownloadPrev    = document.getElementById('btnDownloadPreview');
const btnSave            = document.getElementById('btnSave');
const qrGrid             = document.getElementById('qrGrid');
const emptyState         = document.getElementById('emptyState');
const searchInput        = document.getElementById('searchInput');
const badgeCount         = document.getElementById('badgeCount');
const toastContainer     = document.getElementById('toastContainer');
const deleteModal        = document.getElementById('deleteModal');
const btnCancelDelete    = document.getElementById('btnCancelDelete');
const btnConfirmDelete   = document.getElementById('btnConfirmDelete');
const gradientPickerWrap = document.getElementById('gradientPickerWrap');

/* ── CONSTANTES ───────────────────────────────────────────── */
const STORAGE_KEY  = 'qrmaker_codes_v1';
const DEFAULT_SIZE = 200;

const GRADIENTS = {
  1: { css: 'linear-gradient(180deg,#b8aee8 0%,#7060c8 100%)', label: 'Lavanda'  },
  2: { css: 'linear-gradient(180deg,#c87888 0%,#8c2858 100%)', label: 'Malva'    },
  3: { css: 'linear-gradient(180deg,#c030e0 0%,#680080 100%)', label: 'Roxo'     },
  4: { css: 'linear-gradient(180deg,#f8e040 0%,#f0a820 100%)', label: 'Ouro'     },
  5: { css: 'linear-gradient(180deg,#9080c0 0%,#483878 100%)', label: 'Ametista' },
  6: { css: 'linear-gradient(180deg,#f8b830 0%,#e06010 100%)', label: 'Âmbar'    },
  7: { css: 'linear-gradient(180deg,#5c5498 0%,#2a2258 100%)', label: 'Marinho'  },
};

/* Cor dos pixels do QR por layout */
const QR_COLOR = {
  portrait:  '#000000',
  landscape: '#000000',
  bubble:    '#3d7a4a', /* verde escuro — layout bubble */
  minimal:   '#000000',
};

/* Layouts que exibem o picker de gradiente */
const GRADIENT_LAYOUTS = new Set(['portrait', 'landscape']);

/* ── ESTADO ───────────────────────────────────────────────── */
let currentQRData   = null;
let pendingDeleteId = null;
let searchQuery     = '';
let currentLayout   = 'portrait';
let currentGradient = 1;

/* ── UTILITÁRIOS ──────────────────────────────────────────── */
const generateId  = () => `qr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const formatDate  = iso => new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const getSize     = () => { const r=document.querySelector('input[name="qrSize"]:checked'); return r?parseInt(r.value,10):DEFAULT_SIZE; };
const truncateUrl = (url,max=38) => url.length>max?url.slice(0,max)+'…':url;
const escapeHtml  = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const slugify     = str => str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,50);

/* ── RENDERIZAÇÃO DO CARD EM CANVAS (para download PNG) ────── */

/**
 * Extrai os dois hex-colors de um CSS gradient string.
 * Ex: "linear-gradient(180deg,#b8aee8 0%,#7060c8 100%)"
 *     → ['#b8aee8','#7060c8']
 */
function parseGradientColors(css) {
  const m = (css || '').match(/#[0-9a-fA-F]{3,8}/g);
  return m && m.length >= 2 ? [m[0], m[1]] : ['#7a10be', '#2a2258'];
}

/** Carrega uma imagem a partir de um dataURL e resolve com o HTMLImageElement. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Desenha um retângulo com bordas arredondadas no canvas.
 */
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,    y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

/**
 * Renderiza o card completo em um <canvas> e retorna o elemento.
 * @param {Object} code  – { layout, gradientKey, title, url, dataUrl, createdAt }
 * @param {string} qrDataUrl – opcional: dataUrl alternativo do QR (para preview não salvo)
 * @returns {Promise<HTMLCanvasElement>}
 */
async function renderCardToCanvas(code, qrDataUrl) {
  const layout   = code.layout || 'minimal';
  const gradCss  = GRADIENT_LAYOUTS.has(layout)
    ? (GRADIENTS[code.gradientKey]?.css || GRADIENTS[1].css)
    : '';
  const colors   = parseGradientColors(gradCss);
  const qrImg    = await loadImage(qrDataUrl || code.dataUrl);

  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const dpr    = 2; // resolução 2× para qualidade alta

  /* Helper: aplica escala e retorna [W, H] em pontos lógicos */
  function setup(W, H) {
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    return [W, H];
  }

  /* Helper: cria gradiente linear */
  function makeGrad(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    return g;
  }

  /* Helper: shadow leve */
  function shadow(blur = 10) { ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = blur; }
  function noShadow()         { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

  /* Helper: draw white QR container + QR image */
  function drawQRBox(x, y, size) {
    const pad = 10, r = 12;
    ctx.fillStyle = '#ffffff';
    shadow(12);
    drawRoundRect(ctx, x - pad, y - pad, size + pad*2, size + pad*2, r);
    ctx.fill();
    noShadow();
    ctx.drawImage(qrImg, x, y, size, size);
  }

  /* ── PORTRAIT ─────────────────────────────────────────────── */
  if (layout === 'portrait') {
    const [W, H] = setup(300, 460);

    // Fundo com gradiente
    drawRoundRect(ctx, 0, 0, W, H, 20);
    ctx.fillStyle = makeGrad(0, 0, 0, H);
    ctx.fill();

    // "SCAN TO DISCOVER!"
    ctx.fillStyle  = 'rgba(255,255,255,.88)';
    ctx.font       = 'bold 12px sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText('SCAN TO DISCOVER!', W / 2, 46);

    // QR
    const qrS = 180, qrX = (W - qrS) / 2, qrY = 62;
    drawQRBox(qrX, qrY, qrS);

    // Título
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillText(code.title.slice(0, 28), W / 2, qrY + qrS + 44);

    // URL
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.font      = '11px monospace';
    ctx.fillText(truncateUrl(code.url, 34), W / 2, qrY + qrS + 66);

  /* ── LANDSCAPE ────────────────────────────────────────────── */
  } else if (layout === 'landscape') {
    const [W, H] = setup(520, 240);

    drawRoundRect(ctx, 0, 0, W, H, 20);
    ctx.fillStyle = makeGrad(0, 0, W, H); // diagonal
    ctx.fill();

    const qrS = 170, qrX = W - qrS - 28, qrY = (H - qrS) / 2;
    drawQRBox(qrX, qrY, qrS);

    ctx.textAlign  = 'left';
    const tx = 32;

    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.font      = 'bold 11px sans-serif';
    ctx.fillText('SCAN TO DISCOVER!', tx, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 22px sans-serif';
    ctx.fillText(code.title.slice(0, 22), tx, 90);

    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.font      = '10px monospace';
    ctx.fillText(truncateUrl(code.url, 38), tx, 114);

  /* ── BUBBLE ───────────────────────────────────────────────── */
  } else if (layout === 'bubble') {
    const [W, H] = setup(280, 370);

    // Fundo branco
    ctx.fillStyle = '#f8f8f8';
    drawRoundRect(ctx, 0, 0, W, H, 20);
    ctx.fill();

    // Badge verde
    const bW = 140, bH = 28, bX = (W - bW) / 2, bY = 22;
    ctx.fillStyle = '#5a9a6a';
    drawRoundRect(ctx, bX, bY, bW, bH, 6);
    ctx.fill();

    // Seta do badge
    ctx.beginPath();
    ctx.moveTo(W/2 - 9, bY + bH);
    ctx.lineTo(W/2 + 9, bY + bH);
    ctx.lineTo(W/2,     bY + bH + 9);
    ctx.closePath();
    ctx.fillStyle = '#5a9a6a';
    ctx.fill();

    // Texto do badge
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN ME!', W/2, bY + 19);

    // QR
    const qrS = 160, qrX = (W - qrS) / 2, qrY = bY + bH + 16;
    drawQRBox(qrX, qrY, qrS);

    // Título e URL
    const ty = qrY + qrS + 30;
    ctx.fillStyle = '#1c1530';
    ctx.font      = 'bold 16px sans-serif';
    ctx.fillText(code.title.slice(0, 28), W/2, ty);

    ctx.fillStyle = '#9e94b8';
    ctx.font      = '10px monospace';
    ctx.fillText(truncateUrl(code.url, 32), W/2, ty + 22);

  /* ── MINIMAL ──────────────────────────────────────────────── */
  } else {
    const [W, H] = setup(400, 160);

    // Fundo branco com bordas arredondadas
    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, 0, 0, W, H, 16);
    ctx.fill();

    // Barra gradiente no topo
    const barGrd = ctx.createLinearGradient(0, 0, W, 0);
    barGrd.addColorStop(0, '#7a10be');
    barGrd.addColorStop(1, '#f0a820');
    ctx.fillStyle = barGrd;
    // Clipar o topo para respeitar as bordas arredondadas
    ctx.save();
    drawRoundRect(ctx, 0, 0, W, H, 16);
    ctx.clip();
    ctx.fillRect(0, 0, W, 6);
    ctx.restore();

    // QR
    const qrS = 110, qrX = 18, qrY = 18;
    shadow(6);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e0d8f0';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, qrX - 4, qrY - 4, qrS + 8, qrS + 8, 8);
    ctx.fill();
    ctx.stroke();
    noShadow();
    ctx.drawImage(qrImg, qrX, qrY, qrS, qrS);

    // Textos
    const tx = qrX + qrS + 22;
    ctx.textAlign  = 'left';
    ctx.fillStyle  = '#1c1530';
    ctx.font       = 'bold 17px sans-serif';
    ctx.fillText(code.title.slice(0, 24), tx, 44);

    ctx.fillStyle = '#9e94b8';
    ctx.font      = '10px monospace';
    ctx.fillText(truncateUrl(code.url, 30), tx, 66);

    ctx.fillStyle = '#b0a8d0';
    ctx.font      = '10px sans-serif';
    ctx.fillText(formatDate(code.createdAt), tx, 90);
  }

  return canvas;
}

/**
 * Gera o PNG do card completo e dispara o download.
 * @param {Object} code       – metadados do QR Code salvo
 * @param {string} [altDataUrl] – dataUrl do QR para preview (antes de salvar)
 */
async function downloadCardAsPNG(code, altDataUrl) {
  try {
    const canvas  = await renderCardToCanvas(code, altDataUrl);
    const dataUrl = canvas.toDataURL('image/png');
    downloadPNG(dataUrl, `qr_${slugify(code.title)}_card.png`);
    showToast('Download do card iniciado!', 'success');
  } catch (err) {
    console.error('Erro ao renderizar card:', err);
    showToast('Erro ao gerar imagem do card.', 'error');
  }
}

/* ── TOAST ────────────────────────────────────────────────── */
const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

function showToast(msg, type='info', ms=3200) {
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.setAttribute('role','status');
  t.innerHTML = `${ICONS[type]||ICONS.info}<span>${msg}</span>`;
  toastContainer.appendChild(t);
  const id = setTimeout(()=>removeToast(t), ms);
  t.addEventListener('click',()=>{ clearTimeout(id); removeToast(t); });
}
function removeToast(t) {
  if(!t.parentElement) return;
  t.classList.add('hiding');
  t.addEventListener('animationend',()=>t.remove(),{once:true});
}

/* ── STORAGE ──────────────────────────────────────────────── */
const loadCodes = () => { try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } };
const saveCodes = c  => localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
const addCode   = e  => { const c=loadCodes(); c.unshift(e); saveCodes(c); };
const removeCode= id => saveCodes(loadCodes().filter(c=>c.id!==id));

/* ── QR CODE ──────────────────────────────────────────────── */
function generateQRCode(container, url, size, colorDark='#000000') {
  return new Promise(resolve => {
    container.innerHTML = '';
    new QRCode(container, { text:url, width:size, height:size, colorDark, colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.H });
    setTimeout(resolve, 120);
  });
}
function getDataURL(container) {
  const canvas = container.querySelector('canvas');
  if(canvas) return canvas.toDataURL('image/png');
  const img = container.querySelector('img');
  return img ? img.src : null;
}
function downloadPNG(dataUrl, filename) {
  const a = document.createElement('a');
  a.href=dataUrl; a.download=filename; a.click();
}

/* ── VALIDAÇÃO ────────────────────────────────────────────── */
function validateForm() {
  const title = inputTitle.value.trim();
  const url   = inputUrl.value.trim();
  let valid = true;
  inputTitle.classList.toggle('is-error', !title);
  if(!title) valid=false;
  let urlOk=false;
  if(url){ try{ const p=new URL(url); urlOk=['http:','https:'].includes(p.protocol); }catch{} }
  inputUrl.classList.toggle('is-error', !urlOk);
  if(!urlOk) valid=false;
  return { valid, title, url };
}

/* ── PICKERS ──────────────────────────────────────────────── */
function syncGradientPickerVisibility() {
  gradientPickerWrap.hidden = !GRADIENT_LAYOUTS.has(currentLayout);
}

document.querySelectorAll('input[name="qrLayout"]').forEach(r => {
  r.addEventListener('change', () => { currentLayout=r.value; syncGradientPickerVisibility(); });
});

document.querySelectorAll('.grad-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    currentGradient = parseInt(btn.dataset.grad, 10);
    document.querySelectorAll('.grad-swatch').forEach(s => s.classList.remove('is-selected'));
    btn.classList.add('is-selected');
  });
});

document.querySelectorAll('input[name="qrSize"]').forEach(r => {
  r.addEventListener('change', () => {
    document.querySelectorAll('.size-option').forEach(l =>
      l.classList.toggle('size-option--selected', l.querySelector('input').checked));
  });
});

function resetForm() {
  form.reset();
  previewArea.hidden = true;
  previewCardContainer.innerHTML = '';
  currentQRData = null;
  currentLayout = 'portrait';
  currentGradient = 1;
  document.querySelector('input[name="qrLayout"][value="portrait"]').checked = true;
  document.querySelectorAll('input[name="qrSize"]').forEach(r => r.checked = r.value==='200');
  document.querySelectorAll('.size-option').forEach(l =>
    l.classList.toggle('size-option--selected', l.querySelector('input').value==='200'));
  document.querySelectorAll('.grad-swatch').forEach((s,i) => s.classList.toggle('is-selected', i===0));
  syncGradientPickerVisibility();
}

/* ── BUILD CARD ───────────────────────────────────────────── */
function buildCard(layout, gradientCss, title, url, dataUrl, isPreview=false) {
  const card = document.createElement('div');
  card.className = `qr-item qr-item--${layout}`;
  if(isPreview) card.style.cssText='animation:none;pointer-events:none;max-width:320px;width:100%';

  const thumb = `<div class="qr-item__thumb"><img src="${escapeHtml(dataUrl)}" alt="QR Code de ${escapeHtml(title)}" /></div>`;
  const urlS  = escapeHtml(truncateUrl(url));
  const hint  = layout==='bubble'
    ? '<div class="qr-item__bubble-badge">SCAN ME!</div>'
    : '<p class="qr-item__scan-hint">Scan to discover!</p>';

  if(layout==='portrait') {
    card.style.background = gradientCss;
    card.innerHTML=`${hint}${thumb}<div class="qr-item__info-block"><p class="qr-item__name">${escapeHtml(title)}</p><span class="qr-item__url-short" title="${escapeHtml(url)}">${urlS}</span></div>`;

  } else if(layout==='landscape') {
    card.style.background = gradientCss.replace('180deg','135deg');
    card.innerHTML=`<div class="qr-item__left">${hint}<p class="qr-item__name">${escapeHtml(title)}</p><span class="qr-item__url-short" title="${escapeHtml(url)}">${urlS}</span><div class="qr-item__actions"></div></div>${thumb}`;

  } else if(layout==='bubble') {
    card.innerHTML=`${hint}${thumb}<p class="qr-item__name">${escapeHtml(title)}</p><span class="qr-item__url-short" title="${escapeHtml(url)}">${urlS}</span><div class="qr-item__actions"></div>`;

  } else { // minimal
    card.innerHTML=`<div class="qr-item__top-bar"></div><div class="qr-item__body">${thumb}<div class="qr-item__info"><p class="qr-item__name">${escapeHtml(title)}</p><span class="qr-item__url-short" title="${escapeHtml(url)}">${urlS}</span></div></div><div class="qr-item__actions"></div>`;
  }
  return card;
}

/* ── GRID ─────────────────────────────────────────────────── */
function mkBtn(variant, text, icon) {
  const b = document.createElement('button');
  b.className=`btn btn--${variant} btn--sm`;
  b.innerHTML=`${icon}${text}`;
  return b;
}

const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_DL   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const ICON_DEL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

function buildQRItem(code) {
  const gradCss = (code.layout && GRADIENT_LAYOUTS.has(code.layout) && code.gradientKey)
    ? (GRADIENTS[code.gradientKey]?.css || GRADIENTS[1].css)
    : '';

  const card = buildCard(code.layout||'minimal', gradCss, code.title, code.url, code.dataUrl, false);
  card.setAttribute('role','listitem');
  card.dataset.id = code.id;

  const bCopy = mkBtn('outline','Copiar',ICON_COPY);
  bCopy.addEventListener('click',()=>copyToClipboard(code.url,'Link copiado!'));

  const bDL = mkBtn('outline','PNG',ICON_DL);
  bDL.addEventListener('click', () => {
    if (code.dataUrl) downloadCardAsPNG(code);
    else showToast('Imagem não disponível.', 'error');
  });

  const bDel = mkBtn('danger','Excluir',ICON_DEL);
  bDel.addEventListener('click',()=>openDeleteModal(code.id));

  const ac = card.querySelector('.qr-item__actions');
  if(ac) ac.append(bCopy, bDL, bDel);

  if(code.layout==='minimal') {
    const d = document.createElement('p');
    d.className='qr-item__date';
    d.textContent=formatDate(code.createdAt);
    card.querySelector('.qr-item__info')?.appendChild(d);
  }
  return card;
}

function renderGrid() {
  const codes    = loadCodes();
  const filtered = searchQuery
    ? codes.filter(c=>c.title.toLowerCase().includes(searchQuery)||c.url.toLowerCase().includes(searchQuery))
    : codes;
  badgeCount.textContent=`${codes.length} QR${codes.length!==1?'s':''}`;
  emptyState.hidden = filtered.length>0;
  qrGrid.hidden     = filtered.length===0;
  qrGrid.innerHTML  = '';
  filtered.forEach(c=>qrGrid.appendChild(buildQRItem(c)));
}

/* ── MODAL ────────────────────────────────────────────────── */
function openDeleteModal(id) { pendingDeleteId=id; deleteModal.hidden=false; document.body.style.overflow='hidden'; btnConfirmDelete.focus(); }
function closeDeleteModal()  { pendingDeleteId=null; deleteModal.hidden=true; document.body.style.overflow=''; }

btnConfirmDelete.addEventListener('click',()=>{
  if(!pendingDeleteId) return;
  const item=qrGrid.querySelector(`[data-id="${pendingDeleteId}"]`);
  if(item){ item.classList.add('removing'); item.addEventListener('animationend',()=>{ removeCode(pendingDeleteId); renderGrid(); },{once:true}); }
  else { removeCode(pendingDeleteId); renderGrid(); }
  closeDeleteModal();
  showToast('QR Code excluído.','info');
});
btnCancelDelete.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', e=>{ if(e.target===deleteModal) closeDeleteModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'&&!deleteModal.hidden) closeDeleteModal(); });

/* ── CLIPBOARD ────────────────────────────────────────────── */
function copyToClipboard(text, msg='Copiado!') {
  if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=>showToast(msg,'success')).catch(()=>showToast('Falha ao copiar.','error'));
  else {
    const ta=document.createElement('textarea'); ta.value=text; ta.style.cssText='position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast(msg,'success'); }catch{ showToast('Falha ao copiar.','error'); }
    ta.remove();
  }
}

/* ── PREVIEW ACTIONS ──────────────────────────────────────── */
btnCopyLink.addEventListener('click',()=>{ if(currentQRData) copyToClipboard(currentQRData.url,'Link copiado!'); });
btnDownloadPrev.addEventListener('click', () => {
  if (!currentQRData) return;
  const qrDataUrl = getDataURL(qrHiddenCanvas);
  if (qrDataUrl) downloadCardAsPNG(currentQRData, qrDataUrl);
});
btnSave.addEventListener('click',()=>{
  if(!currentQRData) return;
  if(loadCodes().some(c=>c.url===currentQRData.url&&c.title===currentQRData.title)){
    showToast('Este QR Code já está salvo!','warning'); return;
  }
  const dataUrl=getDataURL(qrHiddenCanvas);
  addCode({...currentQRData, dataUrl});
  renderGrid();
  showToast(`"${currentQRData.title}" salvo com sucesso!`,'success');
  resetForm();
});

/* ── SUBMIT ───────────────────────────────────────────────── */
form.addEventListener('submit', async e => {
  e.preventDefault();
  const {valid,title,url} = validateForm();
  if(!valid){ showToast('Preencha todos os campos corretamente.','error'); return; }

  btnGenerate.disabled=true;
  btnGenerate.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"><animateTransform attributeName="transform" type="rotate" dur=".8s" values="0 12 12;360 12 12" repeatCount="indefinite"/></circle></svg> Gerando…`;

  try {
    const size      = getSize();
    const layout    = document.querySelector('input[name="qrLayout"]:checked')?.value||'portrait';
    const gradKey   = currentGradient;
    const gradCss   = GRADIENT_LAYOUTS.has(layout)?(GRADIENTS[gradKey]?.css||GRADIENTS[1].css):'';
    const colorDark = QR_COLOR[layout]||'#000000';

    await generateQRCode(qrHiddenCanvas, url, size, colorDark);
    const dataUrl = getDataURL(qrHiddenCanvas);

    currentQRData   = { id:generateId(), title, url, layout, gradientKey:gradKey, size, createdAt:new Date().toISOString() };
    currentLayout   = layout;
    currentGradient = gradKey;

    previewCardContainer.innerHTML='';
    previewCardContainer.appendChild(buildCard(layout, gradCss, title, url, dataUrl, true));
    previewArea.hidden=false;
    previewArea.scrollIntoView({behavior:'smooth',block:'nearest'});
    showToast('QR Code gerado! Clique em "Salvar" para guardar.','success');

  } catch(err) {
    console.error(err);
    showToast('Erro ao gerar QR Code. Tente novamente.','error');
  } finally {
    btnGenerate.disabled=false;
    btnGenerate.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg> Gerar QR Code`;
  }
});

/* ── BUSCA ────────────────────────────────────────────────── */
searchInput.addEventListener('input',()=>{ searchQuery=searchInput.value.trim().toLowerCase(); renderGrid(); });

/* ── INIT ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{ renderGrid(); syncGradientPickerVisibility(); inputTitle.focus(); });
