/**
 * QR MAKER — script.js v2
 * 4 layouts · 7 gradientes · preview em tempo real · localStorage
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
  bDL.addEventListener('click',()=>{
    if(code.dataUrl){ downloadPNG(code.dataUrl,`qr_${slugify(code.title)}.png`); showToast('Download iniciado!','success'); }
    else showToast('Imagem não disponível.','error');
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
btnDownloadPrev.addEventListener('click',()=>{
  if(!currentQRData) return;
  const d=getDataURL(qrHiddenCanvas);
  if(d){ downloadPNG(d,`qr_${slugify(currentQRData.title)}.png`); showToast('Download iniciado!','success'); }
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
