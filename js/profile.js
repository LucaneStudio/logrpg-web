// PHOTO DE PROFIL
// ═══════════════════════════════════════════════════════════════

let _photoCharId = null;

function openProfilePhotoModal(charId) {
  _photoCharId = charId || _selectedCharId;
  getCharacter(_photoCharId).then(char => {
    if (!char) return;
    const preview = document.getElementById('photo-preview');
    if (char.profilePhoto) {
      preview.innerHTML = `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:20px;"/>`;
    } else {
      preview.innerHTML = `<span style="font-size:36px;font-weight:900;color:#fff;">${getInitial(char.name)}</span>`;
      preview.style.background = getAvatarColor(char.id);
    }
  });
  openModal('modal-profile-photo');
}

let _pendingPhoto  = null;
let _cropImgSrc    = null;
let _cropScale     = 1;
let _cropOffsetX   = 0;
let _cropOffsetY   = 0;
let _cropBoxSize   = 0;
let _isDragging    = false;
let _dragStartX    = 0;
let _dragStartY    = 0;
let _dragStartOX   = 0;
let _dragStartOY   = 0;

function triggerPhotoImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('❌ Image trop lourde (max 10 Mo)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      closeModal('modal-profile-photo');
      openCropper(ev.target.result);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function openCropper(src) {
  _cropImgSrc  = src;
  _cropScale   = 1;
  _cropOffsetX = 0;
  _cropOffsetY = 0;

  const screen = document.getElementById('photo-cropper-screen');
  screen.style.display = 'flex';

  const img = document.getElementById('cropper-img');
  img.src = src;
  img.onload = () => {
    initCropperLayout();
    bindCropperEvents();
  };
}

function initCropperLayout() {
  const canvas  = document.getElementById('cropper-canvas');
  const img     = document.getElementById('cropper-img');
  const cropBox = document.getElementById('crop-box');
  const cw = canvas.clientWidth, ch = canvas.clientHeight;

  // Taille du carré de recadrage : 80% du plus petit côté
  _cropBoxSize = Math.min(cw, ch) * 0.80;
  const bx = (cw - _cropBoxSize) / 2, by = (ch - _cropBoxSize) / 2;
  cropBox.style.left   = bx + 'px';
  cropBox.style.top    = by + 'px';
  cropBox.style.width  = _cropBoxSize + 'px';
  cropBox.style.height = _cropBoxSize + 'px';

  // Positionner l'image centrée, mise à l'échelle pour couvrir le carré
  const natW = img.naturalWidth, natH = img.naturalHeight;
  const minScale = _cropBoxSize / Math.min(natW, natH);
  _cropScale   = Math.max(minScale, 1);
  _cropOffsetX = cw / 2;
  _cropOffsetY = ch / 2;
  applyCropTransform();
}

function applyCropTransform() {
  const img = document.getElementById('cropper-img');
  img.style.left   = '0';
  img.style.top    = '0';
  img.style.transformOrigin = '0 0';
  img.style.transform = `translate(${_cropOffsetX - img.naturalWidth * _cropScale / 2}px, ${_cropOffsetY - img.naturalHeight * _cropScale / 2}px) scale(${_cropScale})`;
}

function bindCropperEvents() {
  const canvas = document.getElementById('cropper-canvas');
  canvas.onmousedown = (e) => {
    _isDragging = true;
    _dragStartX = e.clientX;
    _dragStartY = e.clientY;
    _dragStartOX = _cropOffsetX;
    _dragStartOY = _cropOffsetY;
    canvas.style.cursor = 'grabbing';
  };
  canvas.onmousemove = (e) => {
    if (!_isDragging) return;
    _cropOffsetX = _dragStartOX + (e.clientX - _dragStartX);
    _cropOffsetY = _dragStartOY + (e.clientY - _dragStartY);
    applyCropTransform();
  };
  canvas.onmouseup = canvas.onmouseleave = () => { _isDragging = false; canvas.style.cursor = 'grab'; };
  canvas.onwheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    _cropScale = Math.max(0.3, Math.min(10, _cropScale * delta));
    applyCropTransform();
  };
  // Touch
  let lastDist = 0, lastTX = 0, lastTY = 0;
  canvas.ontouchstart = (e) => {
    if (e.touches.length === 1) {
      lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
      _dragStartOX = _cropOffsetX; _dragStartOY = _cropOffsetY;
    } else if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };
  canvas.ontouchmove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      _cropOffsetX = _dragStartOX + (e.touches[0].clientX - lastTX);
      _cropOffsetY = _dragStartOY + (e.touches[0].clientY - lastTY);
      applyCropTransform();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      _cropScale = Math.max(0.3, Math.min(10, _cropScale * (dist / lastDist)));
      lastDist = dist;
      applyCropTransform();
    }
  };
}

function resetCropper() { initCropperLayout(); }

function closeCropper() {
  document.getElementById('photo-cropper-screen').style.display = 'none';
  openModal('modal-profile-photo');
}

function validateCrop() {
  const canvas  = document.getElementById('cropper-canvas');
  const img     = document.getElementById('cropper-img');
  const cropBox = document.getElementById('crop-box');
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const bx = parseFloat(cropBox.style.left), by = parseFloat(cropBox.style.top);

  // Coordonnées du carré dans l'espace image
  const imgDisplayX = _cropOffsetX - img.naturalWidth  * _cropScale / 2;
  const imgDisplayY = _cropOffsetY - img.naturalHeight * _cropScale / 2;
  const srcX = (bx - imgDisplayX) / _cropScale;
  const srcY = (by - imgDisplayY) / _cropScale;
  const srcS = _cropBoxSize / _cropScale;

  const out = document.createElement('canvas');
  out.width = out.height = 480;
  const ctx = out.getContext('2d');
  // PAS de fillRect → transparence préservée
  ctx.drawImage(img, srcX, srcY, srcS, srcS, 0, 0, 480, 480);
  const cropped = out.toDataURL('image/png');
  _pendingPhoto = cropped;

  // Aperçu dans le modal
  const preview = document.getElementById('photo-preview');
  if (preview) {
    preview.style.background = 'transparent';
    preview.innerHTML = '<img src="' + cropped + '" style="width:100%;height:100%;object-fit:cover;border-radius:20px;"/>';
  }

  document.getElementById('photo-cropper-screen').style.display = 'none';
  openModal('modal-profile-photo');
}



async function confirmProfilePhoto() {
  if (!_pendingPhoto) { closeModal('modal-profile-photo'); return; }
  const photo = _pendingPhoto;
  _pendingPhoto = null;
  // Sauvegarder dans IndexedDB
  await db.characters.update(_photoCharId, { profilePhoto: photo });
  closeModal('modal-profile-photo');
  // Mettre à jour sidebar (liste ouverte)
  document.querySelectorAll('.char-avatar').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(String(_photoCharId))) {
      el.style.background = getAvatarColor(_photoCharId);
      el.innerHTML = '<img src="' + photo + '" style="width:100%;height:100%;object-fit:cover;"/>';
    }
  });
  // Mettre à jour rail (sidebar fermée)
  document.querySelectorAll('.rail-avatar').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(String(_photoCharId))) {
      el.style.overflow = 'hidden';
      el.style.padding = '0';
      el.innerHTML = '<img src="' + photo + '" style="width:100%;height:100%;object-fit:cover;" alt=""/>';
    }
  });
  // Mettre à jour la topbar si c'est le perso sélectionné
  if (_photoCharId === _selectedCharId) {
    const av = document.getElementById('topbar-char-avatar');
    if (av) {
      av.style.background = getAvatarColor(_photoCharId);
      av.innerHTML = '<img src="' + photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:7px;"/>';
    }
  }
  showToast('✅ Photo mise à jour !');
}

async function removeProfilePhoto() {
  _pendingPhoto = null;
  await deleteProfilePhoto(_photoCharId);
  closeModal('modal-profile-photo');
  await loadCharacterList();
  const char2 = await getCharacter(_photoCharId);
  if (char2) {
    const initial = '<span style="font-size:16px;font-weight:900;color:#fff;">' + getInitial(char2.name) + '</span>';
    // Reset sidebar liste
    document.querySelectorAll('.char-avatar').forEach(el => {
      if (el.getAttribute('onclick')?.includes(String(_photoCharId))) {
        el.style.background = getAvatarColor(_photoCharId);
        el.innerHTML = initial;
      }
    });
    // Reset rail
    document.querySelectorAll('.rail-avatar').forEach(el => {
      if (el.getAttribute('onclick')?.includes(String(_photoCharId))) {
        el.style.background = getAvatarColor(_photoCharId);
        el.style.overflow = '';
        el.style.padding = '';
        el.innerHTML = getInitial(char2.name);
      }
    });
    // Reset topbar
    if (_photoCharId === _selectedCharId) {
      const av = document.getElementById('topbar-char-avatar');
      if (av) {
        av.style.background = getAvatarColor(_photoCharId);
        av.innerHTML = '<span>' + getInitial(char2.name) + '</span>';
      }
    }
  }
  showToast('🗑️ Photo supprimée');
}

// ═══════════════════════════════════════════════════════════════
// ÉCRAN D'ACCUEIL
// ═══════════════════════════════════════════════════════════════

function showWelcomeScreen() {
  let overlay = document.getElementById('welcome-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'welcome-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#EEF6F4;z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:100vh;width:100%;padding:40px 32px;text-align:center;gap:20px;">

      <!-- Logo typographique grand format -->
      <svg width="180" height="48" viewBox="0 0 52 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M27.2646 0.754883C28.4646 0.754883 29.39 1.04967 30.04 1.63965C30.7 2.21965 31.0303 3.03031 31.0303 4.07031C31.0302 4.74012 30.88 5.32531 30.5801 5.8252C30.2901 6.3151 29.8646 6.69488 29.3047 6.96484C29.1293 7.04775 28.9401 7.11541 28.7383 7.17188C28.9184 7.22426 29.0877 7.29926 29.2451 7.39941C29.5751 7.59941 29.8503 7.91008 30.0703 8.33008L30.8203 9.67969C30.9803 9.96967 31.0549 10.2552 31.0449 10.5352C31.0348 10.805 30.9248 11.03 30.7148 11.21C30.5149 11.3799 30.2199 11.4648 29.8301 11.4648C29.4401 11.4648 29.1201 11.3846 28.8701 11.2246C28.6301 11.0646 28.4146 10.8146 28.2246 10.4746L26.8604 7.96973C26.7404 7.74973 26.5845 7.59953 26.3945 7.51953C26.2146 7.42968 26.0045 7.38477 25.7646 7.38477H24.9404V9.58984C24.9404 10.8698 24.4143 11.8395 23.6943 12.4795C22.9743 13.1295 21.9445 13.4551 20.6045 13.4551C20.0545 13.4551 19.5395 13.415 19.0596 13.335C18.5796 13.265 18.1644 13.1595 17.8145 13.0195C17.5246 12.9195 17.3192 12.7749 17.1992 12.585C17.0794 12.3951 17.0243 12.1951 17.0342 11.9854C17.0442 11.7755 17.0993 11.585 17.1992 11.415C17.3092 11.245 17.4548 11.12 17.6348 11.04C17.8147 10.9701 18.0145 10.9748 18.2344 11.0547C18.6743 11.2347 19.0746 11.3494 19.4346 11.3994C19.7946 11.4594 20.0996 11.4902 20.3496 11.4902C20.9596 11.4902 21.4148 11.3596 21.7148 11.0996C22.0246 10.8496 22.1797 10.4548 22.1797 9.91504V9.22949C22.0096 9.53383 21.7458 9.79295 21.3848 10.0049C20.9248 10.2649 20.4247 10.3945 19.8848 10.3945C19.2248 10.3945 18.6492 10.2453 18.1592 9.94531C17.6694 9.6354 17.2848 9.20503 17.0049 8.65527C16.7349 8.10527 16.5996 7.45973 16.5996 6.71973C16.5996 6.15983 16.6799 5.65501 16.8398 5.20508C16.9998 4.75508 17.22 4.3698 17.5 4.0498C17.7899 3.72998 18.1344 3.48441 18.5342 3.31445C18.9442 3.13445 19.3948 3.04492 19.8848 3.04492C20.4447 3.04495 20.9448 3.1746 21.3848 3.43457C21.7265 3.632 21.9807 3.87634 22.1494 4.16602C22.1566 4.10422 22.1667 4.04506 22.1797 3.98828V2.14941C22.1798 1.69971 22.3002 1.35515 22.54 1.11523C22.79 0.875234 23.1352 0.754883 23.5752 0.754883H27.2646ZM20.71 5.00977C20.4301 5.00977 20.1799 5.07986 19.96 5.21973C19.74 5.34972 19.5692 5.54469 19.4492 5.80469C19.3392 6.05465 19.2842 6.35979 19.2842 6.71973C19.2842 7.25965 19.4149 7.6795 19.6748 7.97949C19.9348 8.27949 20.28 8.42969 20.71 8.42969C21.0097 8.42964 21.2647 8.36521 21.4746 8.23535C21.6846 8.09535 21.8497 7.89941 21.9697 7.64941C22.0896 7.3895 22.1494 7.07953 22.1494 6.71973C22.1494 6.17987 22.0197 5.75992 21.7598 5.45996C21.4998 5.16004 21.1498 5.00985 20.71 5.00977ZM24.9395 5.43457H26.7695C27.2995 5.43457 27.7054 5.33012 27.9854 5.12012C28.2653 4.91011 28.4053 4.58446 28.4053 4.14453C28.4052 3.72491 28.265 3.41014 27.9854 3.2002C27.7054 2.9802 27.2995 2.87012 26.7695 2.87012H24.9395V5.43457Z" fill="url(#g1)"/><path d="M47.8584 0.589844C48.3582 0.589859 48.8679 0.640299 49.3877 0.740234C49.9076 0.83022 50.418 1.00472 50.918 1.26465C51.1778 1.38459 51.3533 1.55456 51.4434 1.77441C51.5434 1.98441 51.5732 2.21019 51.5332 2.4502C51.5032 2.68001 51.4182 2.89487 51.2783 3.09473C51.1484 3.28466 50.9682 3.41436 50.7383 3.48438C50.5083 3.54437 50.248 3.50988 49.958 3.37988C49.6581 3.23993 49.3333 3.13444 48.9834 3.06445C48.6334 2.98445 48.263 2.94531 47.873 2.94531C47.2032 2.94533 46.6433 3.06478 46.1934 3.30469C45.7534 3.54469 45.4231 3.90012 45.2031 4.37012C44.9832 4.84005 44.8731 5.41489 44.873 6.09473C44.873 7.11473 45.123 7.88527 45.623 8.40527C46.123 8.9251 46.8631 9.1845 47.8428 9.18457C48.1428 9.18457 48.4684 9.15473 48.8184 9.09473C49.0082 9.06309 49.1979 9.02406 49.3877 8.97852V7.30957H48.3379C47.998 7.30952 47.7329 7.22464 47.543 7.05469C47.3631 6.88472 47.2735 6.6448 47.2734 6.33496C47.2734 6.02504 47.3631 5.78988 47.543 5.62988C47.7329 5.45993 47.998 5.37505 48.3379 5.375H50.5586C50.9084 5.37508 51.1736 5.47023 51.3535 5.66016C51.5433 5.84015 51.6377 6.10528 51.6377 6.45508V9.76953C51.6377 10.0695 51.5734 10.3252 51.4434 10.5352C51.3234 10.745 51.1282 10.8944 50.8584 10.9844C50.3884 11.1444 49.8781 11.2694 49.3281 11.3594C48.7781 11.4494 48.2277 11.4951 47.6777 11.4951C46.4679 11.4951 45.4378 11.2703 44.5879 10.8203C43.7479 10.3703 43.108 9.73968 42.668 8.92969C42.228 8.11973 42.0078 7.17463 42.0078 6.09473C42.0078 5.25482 42.1385 4.50002 42.3984 3.83008C42.6684 3.15018 43.0528 2.5698 43.5527 2.08984C44.0527 1.59989 44.6629 1.22949 45.3828 0.979492C46.1128 0.719493 46.9384 0.589844 47.8584 0.589844Z" fill="url(#g2)"/><path fill-rule="evenodd" clip-rule="evenodd" d="M37.5557 0.754883C38.7557 0.754883 39.6811 1.06457 40.3311 1.68457C40.991 2.29455 41.3203 3.1398 41.3203 4.21973C41.3203 5.29955 40.9908 6.14956 40.3311 6.76953C39.6811 7.37953 38.7557 7.68457 37.5557 7.68457H35.2305V10.0703C35.2304 10.51 35.1155 10.8546 34.8857 11.1045C34.6557 11.3445 34.3106 11.4648 33.8506 11.4648C33.4107 11.4648 33.071 11.3445 32.8311 11.1045C32.5912 10.8546 32.4708 10.5101 32.4707 10.0703V2.14941C32.4708 1.69965 32.5912 1.35516 32.8311 1.11523C33.0811 0.875234 33.4262 0.754883 33.8662 0.754883H37.5557ZM35.2305 5.57031H37.0762C37.5957 5.57025 37.9955 5.45996 38.2754 5.24023C38.5554 5.01023 38.6953 4.66973 38.6953 4.21973C38.6953 3.75979 38.5554 3.42018 38.2754 3.2002C37.9955 2.98028 37.5959 2.87018 37.0762 2.87012H35.2305V5.57031Z" fill="url(#g3)"/><path fill-rule="evenodd" clip-rule="evenodd" d="M11.9561 3.04492C12.7761 3.04492 13.4916 3.19977 14.1016 3.50977C14.7113 3.81971 15.1808 4.26496 15.5107 4.84473C15.8507 5.41462 16.0214 6.09961 16.0215 6.89941C16.0215 7.48939 15.9263 8.0249 15.7363 8.50488C15.5463 8.98488 15.2711 9.39535 14.9111 9.73535C14.5612 10.0652 14.131 10.32 13.6211 10.5C13.1211 10.67 12.566 10.7549 11.9561 10.7549C11.1363 10.7549 10.4214 10.5999 9.81152 10.29C9.20152 9.98004 8.72574 9.53508 8.38574 8.95508C8.04576 8.37509 7.87598 7.6894 7.87598 6.89941C7.87603 6.29962 7.9712 5.76479 8.16113 5.29492C8.35113 4.81493 8.62634 4.41008 8.98633 4.08008C9.34633 3.74008 9.77637 3.48445 10.2764 3.31445C10.7763 3.13454 11.3362 3.04493 11.9561 3.04492ZM11.9561 5.00977C11.6861 5.00978 11.4463 5.07511 11.2363 5.20508C11.0263 5.33508 10.8612 5.54031 10.7412 5.82031C10.6214 6.09018 10.5616 6.44982 10.5615 6.89941C10.5615 7.5594 10.6912 8.03984 10.9512 8.33984C11.2111 8.63982 11.5461 8.79001 11.9561 8.79004C12.226 8.79004 12.4658 8.72464 12.6758 8.59473C12.8858 8.45473 13.0462 8.24949 13.1562 7.97949C13.2761 7.69954 13.3359 7.33923 13.3359 6.89941C13.3359 6.22974 13.2062 5.7499 12.9463 5.45996C12.6863 5.15996 12.3561 5.00977 11.9561 5.00977Z" fill="url(#g4)"/><path d="M1.37988 0C1.82988 0 2.17039 0.120352 2.40039 0.360352C2.64004 0.600272 2.7597 0.944971 2.75977 1.39453V8.29492H6.41992C6.79989 8.29492 7.09004 8.39476 7.29004 8.59473C7.49998 8.78467 7.60541 9.06472 7.60547 9.43457C7.60547 9.80457 7.50004 10.09 7.29004 10.29C7.09004 10.49 6.79988 10.5898 6.41992 10.5898H1.39453C0.954755 10.5898 0.610263 10.4694 0.360352 10.2295C0.120447 9.97958 7.88719e-05 9.63509 0 9.19531V1.39453C6.16112e-05 0.944739 0.120454 0.600287 0.360352 0.360352C0.60033 0.120373 0.93994 2.13056e-05 1.37988 0Z" fill="url(#g5)"/><defs><linearGradient id="g1" x1="0" y1="0" x2="52" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#5CC8A8"/><stop offset="1" stop-color="#3DAF8E"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="52" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#5CC8A8"/><stop offset="1" stop-color="#3DAF8E"/></linearGradient><linearGradient id="g3" x1="0" y1="0" x2="52" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#5CC8A8"/><stop offset="1" stop-color="#3DAF8E"/></linearGradient><linearGradient id="g4" x1="0" y1="0" x2="52" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#5CC8A8"/><stop offset="1" stop-color="#3DAF8E"/></linearGradient><linearGradient id="g5" x1="0" y1="0" x2="52" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#5CC8A8"/><stop offset="1" stop-color="#3DAF8E"/></linearGradient></defs></svg>
      <p style="font-size:14px;color:var(--text-mid);margin:0;font-weight:600;">Ton compagnon de jeu de rôle sur table</p>

      <!-- Features -->
      <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:460px;margin:4px 0;">
        ${[
          ['🎭', 'Plusieurs personnages', 'Crée et gère autant de personnages que tu veux'],
          ['📊', 'Suivi complet', 'PV, mana, emplacements de sorts, monnaie en temps réel'],
          ['⚔️', 'Caractéristiques & Capacités', 'Sections personnalisables, templates D&D, CoC, Cyberpunk…'],
          ['🎒', 'Inventaire', 'Objets, consommables, équipements avec filtres'],
          ['📝', 'Notes', 'Éditeur markdown avec auto-sauvegarde'],
          ['🔒', '100% local & privé', 'Aucune pub, aucun serveur, tes données restent sur ton appareil'],
        ].map(([emoji, title, desc]) => `
          <div style="display:flex;align-items:center;gap:14px;background:var(--white);
                      border-radius:14px;padding:12px 16px;
                      box-shadow:0 2px 10px var(--shadow);border:1.5px solid rgba(255,255,255,.9);
                      text-align:left;">
            <span style="font-size:22px;flex-shrink:0;">${emoji}</span>
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--text);">${title}</div>
              <div style="font-size:11.5px;color:var(--text-mid);font-weight:600;">${desc}</div>
            </div>
          </div>`).join('')}
      </div>

      <!-- CTA -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px;">
        <button class="btn btn-primary" style="font-size:14px;padding:12px 28px;gap:8px;" onclick="openCreateCharModal()">
          ✨ Créer un personnage
        </button>
        <button class="btn btn-secondary" style="font-size:14px;padding:12px 28px;gap:8px;" onclick="triggerImport()">
          📥 Importer un personnage
        </button>
      </div>

    </div>`;
}

function hideWelcomeScreen() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) overlay.remove();
}

// ═══════════════════════════════════════════════════════════════
// ONGLET FICHE — Viewer PDF
// ═══════════════════════════════════════════════════════════════

let _ficheCharId = null;

async function renderFicheTab() {
  const char = await getCharacter(_selectedCharId);
  if (!char) return;
  _ficheCharId = char.id;
  const area = document.getElementById('content-area');

  // Récupérer le PDF stocké (base64) depuis IndexedDB
  const pdfData = await getPdfData(char.id);

  if (!pdfData) {
    // État vide
    area.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100%;padding:40px 24px;text-align:center;gap:16px;">
        <div style="font-size:56px;opacity:.35;">📄</div>
        <div>
          <div style="font-size:16px;font-weight:900;color:var(--text);margin-bottom:6px;">Aucune fiche PDF</div>
          <div style="font-size:13px;color:var(--text-mid);font-weight:600;line-height:1.5;">
            Importe ta fiche de personnage PDF<br>pour la consulter directement ici.
          </div>
        </div>
        <button class="btn btn-primary" style="gap:8px;" onclick="triggerPdfImport()">
          📎 Importer un PDF
        </button>
      </div>`;
    return;
  }

  // Afficher le PDF
  const { name, size, dataUrl } = pdfData;
  const sizeStr = size > 1024*1024 ? (size/1024/1024).toFixed(1)+' Mo' : Math.round(size/1024)+' Ko';

  area.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 140px);gap:0;">
      <!-- Barre d'outils -->
      <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;flex-shrink:0;">
        <span style="font-size:13px;">📄</span>
        <span style="font-size:12px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${escapeHtml(name)}</span>
        <span style="font-size:11px;color:var(--text-light);font-weight:700;white-space:nowrap;">${sizeStr}</span>
        <button class="ctr-icon-btn" onclick="openPdfFullscreen()" title="Ouvrir dans un nouvel onglet">⛶</button>
        <button class="ctr-icon-btn" onclick="openPdfOptionsModal()" title="Options">⋯</button>
      </div>
      <!-- Viewer -->
      <div style="flex:1;border-radius:12px;overflow:hidden;border:1.5px solid #E8ECF0;background:#EEF6F4;position:relative;">
        <!-- Loader -->
        <div id="pdf-loader" style="position:absolute;inset:0;display:flex;flex-direction:column;
             align-items:center;justify-content:center;gap:12px;background:#EEF6F4;z-index:1;">
          <div style="width:36px;height:36px;border:4px solid #D4F2EA;border-top-color:#5CC8A8;
               border-radius:50%;animation:pdfSpin 0.8s linear infinite;"></div>
          <p style="color:#3DAF8E;font-weight:800;font-size:13px;margin:0;">Chargement du PDF…</p>
        </div>
        <style>@keyframes pdfSpin{to{transform:rotate(360deg)}}</style>
        <iframe id="pdf-iframe"
          src="${dataUrl}#page=1&view=FitH&toolbar=1"
          style="width:100%;height:100%;border:none;position:relative;z-index:2;"
          title="Fiche PDF"
          onload="document.getElementById('pdf-loader').style.display='none'">
        </iframe>
      </div>
    </div>`;
}

// ── Stockage PDF dans IndexedDB ────────────────────────────────────────────────
async function getPdfData(charId) {
  try {
    const result = await db.characters.get(charId);
    if (!result?.pdfData) return null;
    return JSON.parse(result.pdfData);
  } catch { return null; }
}

async function savePdfData(charId, pdfObj) {
  await updateCharacterFields(charId, { pdfData: JSON.stringify(pdfObj) });
}

async function deletePdfData(charId) {
  await updateCharacterFields(charId, { pdfData: null });
}

// ── Import PDF ────────────────────────────────────────────────────────────────
function triggerPdfImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast('❌ PDF trop lourd (max 20 Mo)');
      return;
    }
    showToast('⏳ Import en cours…');
    const dataUrl = await fileToDataUrl(file);
    await savePdfData(_ficheCharId, { name: file.name, size: file.size, dataUrl });
    showToast('✅ PDF importé !');
    renderFicheTab();
    mobRefreshCurrentTab();
  };
  input.click();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Plein écran ────────────────────────────────────────────────────────────────
async function openPdfFullscreen(charId) {
  const id = charId || _ficheCharId;
  const pdfData = await getPdfData(id);
  if (!pdfData) return;
  // Ouvrir la fenêtre d'abord (synchrone) pour éviter le popup blocker
  const win = window.open('', '_blank');
  if (!win) { showToast('❌ Autorise les popups pour ce site'); return; }
  // Page de chargement intermédiaire
  win.document.write(`<!DOCTYPE html><html><head><title>Chargement…</title>
    <style>body{margin:0;display:flex;align-items:center;justify-content:center;
    height:100vh;background:#EEF6F4;font-family:Nunito,sans-serif;flex-direction:column;gap:16px;}
    .spin{width:40px;height:40px;border:4px solid #D4F2EA;border-top-color:#5CC8A8;
    border-radius:50%;animation:s 0.8s linear infinite;}
    @keyframes s{to{transform:rotate(360deg)}}
    p{color:#3DAF8E;font-weight:800;font-size:15px;margin:0;}</style></head>
    <body><div class="spin"></div><p>Chargement du PDF…</p></body></html>`);
  const res  = await fetch(pdfData.dataUrl);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  win.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── Context menu PDF ───────────────────────────────────────────────────────────
let _ctxPdfCharId = null;
function openPdfContextMenu(e, charId) {
  e.stopPropagation();
  _ctxPdfCharId = charId;
  const menu = document.getElementById('pdf-context-menu');
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 240 > window.innerWidth)  x = window.innerWidth  - 244;
  if (y + 130 > window.innerHeight) y = window.innerHeight - 134;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function closePdfContextMenu() {
  document.getElementById('pdf-context-menu').style.display = 'none';
  _ctxPdfCharId = null;
}
function openPdfOptionsModal() {
  openModal('modal-pdf-options');
}
async function replacePdf() {
  closePdfContextMenu();
  closeModal('modal-pdf-options');
  triggerPdfImport();
}
async function unlinkPdf() {
  closePdfContextMenu();
  closeModal('modal-pdf-options');
  const id = _ctxPdfCharId || _ficheCharId;
  await deletePdfData(id);
  showToast('🗑️ PDF délié');
  renderFicheTab();
  mobRefreshCurrentTab();
}

// ═══════════════════════════════════════════════════════════════
// IMPORT / EXPORT JSON
// ═══════════════════════════════════════════════════════════════

// ── Export ────────────────────────────────────────────────────────────────────
async function exportCharacter(charId) {
  const char    = await getCharacter(charId);
  if (!char) return;
  const abilities = getAbilities(char);
  const items     = getItems(char);
  const sections  = getStatSections(char);
  const notes     = getNotes(char);

  // notes web → concaténées en string pour compatibilité Android
  // (le champ notes de CharacterExport est une string, pas une liste)
  const notesAndroid = notes.length > 0
    ? notes.map(n => (n.title ? '# ' + n.title + '\n' : '') + (n.content || '')).join('\n\n---\n\n')
    : (char.notesLegacy || null);

  const exported = {
    name:          char.name,
    currentHealth: char.hpCurrent     || 0,
    maxHealth:     char.hpMax         || 20,
    currentMana:   char.manaCurrent   || 0,
    maxMana:       char.manaMax       || 0,
    currencyMode:  char.currencyMode  || 'SINGLE',
    credits:       char.credits       || 0,
    notes:         notesAndroid,
    abilities:     abilities.map(a => ({
      name:        a.name,
      description: a.description || '',
      cost:        a.cost        || null,
      range:       a.range       || null,
      duration:    a.duration    || null,
      damage:      a.damage      || null,
      category:    a.category    || null,
      notes:       a.notes       || null,
    })),
    items: items.map(i => ({
      name:        i.name,
      description: i.description  || '',
      quantity:    i.quantity      || 1,
      weight:      i.weight        || null,
      category:    i.category      || null,
      isEquipped:  !!i.isEquipped,
      isConsumable:!!i.isConsumable,
      notes:       i.notes         || null,
    })),
    stats: sections.map((s, si) => ({
      title:    s.title,
      position: si,
      widgets:  (s.widgets || []).map((w, wi) => ({
        title:      w.title,
        type:       w.type       || 'FREE',
        value:      w.value      || '',
        modifier:   w.modifier   || '',
        accentColor:w.accentColor|| 'PURPLE',
        position:   wi,
      })),
    })),
  };

  const json = JSON.stringify(exported, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (char.name || 'personnage') + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 ' + char.name + ' exporté !');
}

// ── Import ────────────────────────────────────────────────────────────────────
function triggerImport() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = '.json,application/json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importCharacterFromJson(text);
    } catch(err) {
      showToast('❌ Erreur de lecture du fichier');
      console.error(err);
    }
  };
  input.click();
}

// Données JSON en attente si un doublon est détecté
let _pendingImportData = null;

async function importCharacterFromJson(json) {
  let data;
  try { data = JSON.parse(json); }
  catch { showToast('❌ JSON invalide'); return; }

  if (!data.name) { showToast('❌ Champ "name" manquant'); return; }

  // Vérifier si un personnage du même nom existe déjà
  const existing = (await getAllCharacters()).find(c => c.name.trim().toLowerCase() === data.name.trim().toLowerCase());
  if (existing) {
    _pendingImportData = { data, existingId: existing.id };
    document.getElementById('import-conflict-name').textContent = data.name;
    openModal('modal-import-conflict');
    return;
  }

  await doImport(data, null);
}

async function importConflictOverwrite() {
  if (!_pendingImportData) return;
  const { data, existingId } = _pendingImportData;
  _pendingImportData = null;
  closeModal('modal-import-conflict');
  await doImport(data, existingId);
}

async function importConflictNew() {
  if (!_pendingImportData) return;
  const { data } = _pendingImportData;
  _pendingImportData = null;
  closeModal('modal-import-conflict');
  // Ajouter un suffixe pour éviter le doublon
  data._forceName = data.name + ' (importé)';
  await doImport(data, null);
}

async function doImport(data, overwriteId) {

  // Convertir le champ notes Android → liste de notes web
  // On découpe par "---" si présent, sinon une seule note
  const webNotes = [];
  if (data.notes && typeof data.notes === 'string' && data.notes.trim()) {
    const parts = data.notes.split(/\n---\n/);
    parts.forEach((part, i) => {
      if (!part.trim()) return;
      // Extraire le titre si la note commence par "# Titre"
      const lines = part.trim().split('\n');
      let title = 'Note ' + (i + 1);
      let body  = part.trim();
      if (lines[0].startsWith('# ')) {
        title = lines[0].slice(2).trim();
        body  = lines.slice(1).join('\n').trim();
      }
      webNotes.push({
        id: newNoteId(), title,
        content: body, createdAt: Date.now(), updatedAt: Date.now(),
      });
    });
  }

  // Convertir stats Android → sections web
  const webSections = (data.stats || []).map(s => ({
    id:      newSectionId(),
    title:   s.title,
    widgets: (s.widgets || []).map(w => ({
      id:         newWidgetId(),
      sectionId:  '',
      title:      w.title,
      type:       w.type        || 'FREE',
      value:      w.value       || '',
      modifier:   w.modifier    || '',
      accentColor:w.accentColor || 'PURPLE',
    })),
  }));

  // Convertir abilities
  const webAbilities = (data.abilities || []).map(a => ({
    id:          newAbilityId(),
    name:        a.name,
    description: a.description || '',
    cost:        a.cost        || null,
    range:       a.range       || null,
    duration:    a.duration    || null,
    damage:      a.damage      || null,
    category:    a.category    || null,
    notes:       a.notes       || null,
  }));

  // Convertir items
  const webItems = (data.items || []).map(i => ({
    id:          newItemId(),
    name:        i.name,
    description: i.description  || '',
    quantity:    i.quantity      || 1,
    weight:      i.weight        || null,
    category:    i.category      || null,
    isEquipped:  !!i.isEquipped,
    isConsumable:!!i.isConsumable,
    notes:       i.notes         || null,
  }));

  const finalName = data._forceName || data.name;

  let charId;
  if (overwriteId) {
    // ── Écraser : conserver profilePhoto et pdfData du perso existant ─────────
    charId = overwriteId;
    const existing = await getCharacter(overwriteId);
    await db.characters.update(charId, {
      name:            finalName,
      hpMax:           data.maxHealth        || 20,
      manaMax:         data.maxMana          || 0,
      hpCurrent:       data.currentHealth    ?? data.maxHealth ?? 20,
      manaCurrent:     data.currentMana      ?? data.maxMana   ?? 0,
      temporaryHealth: data.temporaryHealth  || 0,
      currencyMode:    data.currencyMode     || 'SINGLE',
      credits:         data.credits          || 0,
      abilities:       JSON.stringify(webAbilities),
      items:           JSON.stringify(webItems),
      statSections:    JSON.stringify(webSections),
      notes:           JSON.stringify(webNotes),
      manaMode:        data.manaMode         || 'MANA',
      // On conserve profilePhoto et pdfData existants
      profilePhoto:    existing.profilePhoto || null,
      pdfData:         existing.pdfData      || null,
    });
    showToast('✅ ' + finalName + ' mis à jour !');
  } else {
    // ── Créer nouveau ──────────────────────────────────────────────────────────
    charId = await createCharacter({ name: finalName, hpMax: data.maxHealth || 20, manaMax: data.maxMana || 0 });
    await updateCharacterFields(charId, {
      hpCurrent:       data.currentHealth    ?? data.maxHealth ?? 20,
      manaCurrent:     data.currentMana      ?? data.maxMana   ?? 0,
      temporaryHealth: data.temporaryHealth  || 0,
      currencyMode:    data.currencyMode     || 'SINGLE',
      credits:         data.credits          || 0,
      abilities:       JSON.stringify(webAbilities),
      items:           JSON.stringify(webItems),
      statSections:    JSON.stringify(webSections),
      notes:           JSON.stringify(webNotes),
      manaMode:        data.manaMode         || 'MANA',
    });
    showToast('✅ ' + finalName + ' importé !');
  }

  await loadCharacterList();
  await selectCharacter(charId);
}


// ═══════════════════════════════════════════════════════════════