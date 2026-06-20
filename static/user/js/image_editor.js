/* ============ SkipStep Image Editor Engine ============ */
(function() {
  'use strict';

  const CFG = window.IMAGE_EDITOR_CONFIG || {};
  const canvas = document.getElementById('imageCanvas');
  const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;

  // State
  let originalImage = null;   // Original loaded Image object
  let currentImageData = null; // Current pixel data (pre-overlay)
  let baseImageData = null;    // After filters/adjustments (before overlays)
  let overlays = [];           // Text, shapes, stickers, drawings
  let drawingPaths = [];       // Freehand paths
  let activeOverlay = null;
  let currentTool = 'select';
  let zoom = 1;
  let history = [];
  let historyIndex = -1;
  let isDirty = false;
  let currentFilter = 'none';
  let filterIntensity = 100;

  // Adjustment values
  let adjustments = {
    brightness: 0, contrast: 0, saturation: 0, exposure: 0,
    temperature: 0, tint: 0, highlights: 0, shadows: 0, vignette: 0
  };

  // Crop state
  let cropState = { x: 0, y: 0, w: 0, h: 0, ratio: 'free', active: false };

  // Draw state
  let drawState = { active: false, mode: 'brush', color: '#ffffff', size: 5, opacity: 100, points: [] };

  // DOM refs
  const els = {};
  const selectors = {
    canvasArea: '#canvasArea', canvasContainer: '#canvasContainer',
    canvasDropzone: '#canvasDropzone', cropOverlay: '#cropOverlay',
    cropBox: '#cropBox', zoomControls: '#zoomControls', zoomLevel: '#zoomLevel',
    propsPanel: '#propsPanel', toolsPanel: '#toolsPanel',
    editorLoading: '#editorLoading', exportModal: '#exportModal',
    infoWidth: '#infoWidth', infoHeight: '#infoHeight', infoFormat: '#infoFormat',
    undoBtn: '#undoBtn', redoBtn: '#redoBtn',
    filtersGrid: '#filtersGrid', filterIntensity: '#filterIntensity',
    filterIntensitySlider: '#filterIntensitySlider', filterIntensityValue: '#filterIntensityValue',
  };

  function initRefs() {
    for (const [key, sel] of Object.entries(selectors)) {
      els[key] = document.querySelector(sel);
    }
  }

  // ============ INITIALIZATION ============
  function init() {
    initRefs();
    bindToolButtons();
    bindCropPresets();
    bindRotateActions();
    bindFilterCards();
    bindAdjustmentSliders();
    bindTextTool();
    bindDrawTool();
    bindShapeTool();
    bindStickerTool();
    bindZoomControls();
    bindExportModal();
    bindSaveButton();
    bindUploadButtons();
    bindKeyboardShortcuts();
    bindCanvasInteraction();

    // If we have a file URL from the server, load it
    if (CFG.fileUrl) {
      loadImageFromUrl(CFG.fileUrl);
    }
  }

  // ============ IMAGE LOADING ============
  function loadImageFromUrl(url) {
    showLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      originalImage = img;
      resetEditorState();
      renderImageToCanvas(img);
      showCanvas(true);
      pushHistory();
      showLoading(false);
    };
    img.onerror = function() {
      showLoading(false);
      alert('Failed to load image.');
    };
    img.src = url;
  }

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    showLoading(true);
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        originalImage = img;
        resetEditorState();
        renderImageToCanvas(img);
        showCanvas(true);
        pushHistory();
        showLoading(false);
        // Update title
        const titleEl = document.getElementById('editorTitle');
        if (titleEl) titleEl.textContent = file.name;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetEditorState() {
    overlays = [];
    drawingPaths = [];
    activeOverlay = null;
    currentFilter = 'none';
    filterIntensity = 100;
    adjustments = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, vignette: 0 };
    zoom = 1;
    history = [];
    historyIndex = -1;
    cropState = { x: 0, y: 0, w: 0, h: 0, ratio: 'free', active: false };
    // Reset UI sliders
    document.querySelectorAll('[data-adj]').forEach(s => { s.value = 0; s.nextElementSibling.textContent = '0'; });
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
    const noneFilter = document.querySelector('.filter-card[data-filter="none"]');
    if (noneFilter) noneFilter.classList.add('active');
  }

  function renderImageToCanvas(img) {
    // Fit to canvas area
    const area = els.canvasArea;
    if (!area) return;
    const maxW = area.clientWidth - 40;
    const maxH = area.clientHeight - 80;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;

    // Scale to fit
    const scaleX = maxW / w;
    const scaleY = maxH / h;
    const fitScale = Math.min(scaleX, scaleY, 1);

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // Apply CSS transform for display
    zoom = fitScale;
    updateCanvasZoom();

    // Store base data
    currentImageData = ctx.getImageData(0, 0, w, h);
    baseImageData = ctx.getImageData(0, 0, w, h);

    // Update info
    if (els.infoWidth) els.infoWidth.textContent = w + 'px';
    if (els.infoHeight) els.infoHeight.textContent = h + 'px';
    if (els.infoFormat) {
      const name = (CFG.filename || '').toLowerCase();
      if (name.endsWith('.png')) els.infoFormat.textContent = 'PNG';
      else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) els.infoFormat.textContent = 'JPEG';
      else if (name.endsWith('.webp')) els.infoFormat.textContent = 'WebP';
      else if (name.endsWith('.gif')) els.infoFormat.textContent = 'GIF';
      else els.infoFormat.textContent = 'Image';
    }
  }

  function showCanvas(show) {
    if (els.canvasDropzone) els.canvasDropzone.style.display = show ? 'none' : '';
    if (els.canvasContainer) els.canvasContainer.style.display = show ? '' : 'none';
    if (els.zoomControls) els.zoomControls.style.display = show ? '' : 'none';
  }

  function showLoading(show) {
    if (els.editorLoading) els.editorLoading.style.display = show ? '' : 'none';
  }

  function updateCanvasZoom() {
    if (els.canvasContainer) {
      els.canvasContainer.style.transform = `scale(${zoom})`;
      els.canvasContainer.style.transformOrigin = 'center center';
    }
    if (els.zoomLevel) els.zoomLevel.textContent = Math.round(zoom * 100) + '%';
  }

  // ============ HISTORY (UNDO/REDO) ============
  function pushHistory() {
    if (!canvas) return;
    // Trim future history
    history = history.slice(0, historyIndex + 1);
    // Save state
    const state = {
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      width: canvas.width,
      height: canvas.height,
      overlays: JSON.parse(JSON.stringify(overlays)),
      drawingPaths: JSON.parse(JSON.stringify(drawingPaths)),
      filter: currentFilter,
      adjustments: { ...adjustments },
    };
    history.push(state);
    if (history.length > 30) history.shift();
    historyIndex = history.length - 1;
    isDirty = true;
    updateHistoryButtons();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreState(history[historyIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreState(history[historyIndex]);
  }

  function restoreState(state) {
    canvas.width = state.width;
    canvas.height = state.height;
    ctx.putImageData(state.imageData, 0, 0);
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    overlays = JSON.parse(JSON.stringify(state.overlays));
    drawingPaths = JSON.parse(JSON.stringify(state.drawingPaths));
    currentFilter = state.filter;
    adjustments = { ...state.adjustments };
    renderOverlays();
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const undoBtn = els.undoBtn || document.getElementById('undoBtn');
    const redoBtn = els.redoBtn || document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
  }

  // ============ TOOL SWITCHING ============
  function bindToolButtons() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        switchTool(tool);
      });
    });
  }

  function switchTool(tool) {
    currentTool = tool;
    // Highlight active button
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    // Show/hide property sections
    document.querySelectorAll('.props-section').forEach(s => {
      s.style.display = s.dataset.for === tool ? '' : 'none';
    });
    // Special handling
    if (tool === 'crop') {
      initCrop();
    } else {
      hideCrop();
    }
    // Canvas cursor
    if (canvas) {
      if (tool === 'draw') canvas.style.cursor = 'crosshair';
      else if (tool === 'text') canvas.style.cursor = 'text';
      else if (tool === 'crop') canvas.style.cursor = 'crosshair';
      else canvas.style.cursor = 'default';
    }
  }

  // ============ CROP TOOL ============
  function initCrop() {
    if (!canvas || !els.cropOverlay) return;
    const w = canvas.width;
    const h = canvas.height;
    cropState = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8, ratio: 'free', active: true };
    els.cropOverlay.style.display = '';
    updateCropBox();
  }

  function hideCrop() {
    if (els.cropOverlay) els.cropOverlay.style.display = 'none';
    cropState.active = false;
  }

  function updateCropBox() {
    if (!els.cropBox) return;
    const z = zoom;
    els.cropBox.style.left = (cropState.x * z) + 'px';
    els.cropBox.style.top = (cropState.y * z) + 'px';
    els.cropBox.style.width = (cropState.w * z) + 'px';
    els.cropBox.style.height = (cropState.h * z) + 'px';
  }

  function bindCropPresets() {
    document.querySelectorAll('.crop-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.crop-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cropState.ratio = btn.dataset.ratio;
        applyCropRatio();
      });
    });

    // Crop apply/cancel
    const applyBtn = document.getElementById('cropApplyBtn');
    const cancelBtn = document.getElementById('cropCancelBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyCrop);
    if (cancelBtn) cancelBtn.addEventListener('click', () => switchTool('select'));

    // Make crop box draggable/resizable
    if (els.cropOverlay) {
      let dragType = null;
      let startX, startY, startCrop;

      els.cropOverlay.addEventListener('mousedown', function(e) {
        const target = e.target;
        if (target.classList.contains('crop-handle')) {
          dragType = 'resize-' + target.dataset.handle;
        } else if (target === els.cropBox || target.closest('.crop-box') === els.cropBox) {
          dragType = 'move';
        } else {
          return;
        }
        startX = e.clientX;
        startY = e.clientY;
        startCrop = { ...cropState };
        e.preventDefault();
      });

      document.addEventListener('mousemove', function(e) {
        if (!dragType) return;
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        if (dragType === 'move') {
          cropState.x = Math.max(0, Math.min(canvas.width - startCrop.w, startCrop.x + dx));
          cropState.y = Math.max(0, Math.min(canvas.height - startCrop.h, startCrop.y + dy));
        } else if (dragType.startsWith('resize-')) {
          const handle = dragType.split('-')[1];
          resizeCrop(handle, dx, dy, startCrop);
        }
        updateCropBox();
      });

      document.addEventListener('mouseup', function() {
        dragType = null;
      });
    }
  }

  function resizeCrop(handle, dx, dy, start) {
    let { x, y, w, h } = start;
    if (handle.includes('e')) { w = Math.max(20, w + dx); }
    if (handle.includes('w')) { x = x + dx; w = Math.max(20, w - dx); }
    if (handle.includes('s')) { h = Math.max(20, h + dy); }
    if (handle.includes('n')) { y = y + dy; h = Math.max(20, h - dy); }
    // Clamp
    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(w, canvas.width - x);
    h = Math.min(h, canvas.height - y);
    cropState.x = x;
    cropState.y = y;
    cropState.w = w;
    cropState.h = h;
    if (cropState.ratio !== 'free') {
      applyCropRatio();
    }
  }

  function applyCropRatio() {
    if (cropState.ratio === 'free') return;
    const parts = cropState.ratio.split(':').map(Number);
    const r = parts[0] / parts[1];
    const centerX = cropState.x + cropState.w / 2;
    const centerY = cropState.y + cropState.h / 2;
    let newW = cropState.w;
    let newH = newW / r;
    if (newH > canvas.height * 0.8) {
      newH = canvas.height * 0.8;
      newW = newH * r;
    }
    cropState.w = newW;
    cropState.h = newH;
    cropState.x = Math.max(0, centerX - newW / 2);
    cropState.y = Math.max(0, centerY - newH / 2);
    updateCropBox();
  }

  function applyCrop() {
    if (!canvas) return;
    const { x, y, w, h } = cropState;
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iw = Math.round(w);
    const ih = Math.round(h);

    const croppedData = ctx.getImageData(ix, iy, iw, ih);
    canvas.width = iw;
    canvas.height = ih;
    ctx.putImageData(croppedData, 0, 0);

    currentImageData = ctx.getImageData(0, 0, iw, ih);
    baseImageData = ctx.getImageData(0, 0, iw, ih);

    // Update display
    zoom = Math.min(
      (els.canvasArea.clientWidth - 40) / iw,
      (els.canvasArea.clientHeight - 80) / ih,
      1
    );
    updateCanvasZoom();

    // Update info
    if (els.infoWidth) els.infoWidth.textContent = iw + 'px';
    if (els.infoHeight) els.infoHeight.textContent = ih + 'px';

    hideCrop();
    switchTool('select');
    pushHistory();
  }

  // ============ ROTATE & FLIP ============
  function bindRotateActions() {
    document.querySelectorAll('.rotate-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        performRotate(action);
      });
    });

    const slider = document.getElementById('rotationSlider');
    const value = document.getElementById('rotationValue');
    if (slider) {
      slider.addEventListener('input', () => {
        value.textContent = slider.value + '°';
      });
    }

    const applyBtn = document.getElementById('rotationApplyBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const deg = parseInt(slider.value) || 0;
        if (deg !== 0) {
          rotateByDegrees(deg);
          slider.value = 0;
          value.textContent = '0°';
        }
      });
    }
  }

  function performRotate(action) {
    if (!canvas) return;
    showLoading(true);
    requestAnimationFrame(() => {
      if (action === 'rotate-cw') rotateByDegrees(90);
      else if (action === 'rotate-ccw') rotateByDegrees(-90);
      else if (action === 'flip-h') flipImage('horizontal');
      else if (action === 'flip-v') flipImage('vertical');
      showLoading(false);
    });
  }

  function rotateByDegrees(deg) {
    const w = canvas.width;
    const h = canvas.height;
    const rad = (deg * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const newW = Math.round(w * absCos + h * absSin);
    const newH = Math.round(w * absSin + h * absCos);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newW;
    tempCanvas.height = newH;
    const tCtx = tempCanvas.getContext('2d');

    tCtx.translate(newW / 2, newH / 2);
    tCtx.rotate(rad);
    tCtx.drawImage(canvas, -w / 2, -h / 2);

    canvas.width = newW;
    canvas.height = newH;
    ctx.drawImage(tempCanvas, 0, 0);

    currentImageData = ctx.getImageData(0, 0, newW, newH);
    baseImageData = ctx.getImageData(0, 0, newW, newH);

    zoom = Math.min(
      (els.canvasArea.clientWidth - 40) / newW,
      (els.canvasArea.clientHeight - 80) / newH,
      1
    );
    updateCanvasZoom();
    if (els.infoWidth) els.infoWidth.textContent = newW + 'px';
    if (els.infoHeight) els.infoHeight.textContent = newH + 'px';
    pushHistory();
  }

  function flipImage(direction) {
    const w = canvas.width;
    const h = canvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');

    if (direction === 'horizontal') {
      tCtx.translate(w, 0);
      tCtx.scale(-1, 1);
    } else {
      tCtx.translate(0, h);
      tCtx.scale(1, -1);
    }
    tCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tempCanvas, 0, 0);

    currentImageData = ctx.getImageData(0, 0, w, h);
    baseImageData = ctx.getImageData(0, 0, w, h);
    pushHistory();
  }

  // ============ FILTERS ============
  function bindFilterCards() {
    document.querySelectorAll('.filter-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentFilter = card.dataset.filter;

        // Show intensity slider for non-none filters
        const intensityDiv = els.filterIntensity || document.getElementById('filterIntensity');
        if (intensityDiv) intensityDiv.style.display = currentFilter !== 'none' ? '' : 'none';

        applyFilterAndAdjustments();
      });
    });

    const slider = els.filterIntensitySlider || document.getElementById('filterIntensitySlider');
    const value = els.filterIntensityValue || document.getElementById('filterIntensityValue');
    if (slider) {
      slider.addEventListener('input', () => {
        filterIntensity = parseInt(slider.value);
        if (value) value.textContent = filterIntensity + '%';
        applyFilterAndAdjustments();
      });
    }
  }

  function getFilterCSS(filter, intensity) {
    const i = intensity / 100;
    const filters = {
      'none': '',
      'grayscale': `grayscale(${i})`,
      'sepia': `sepia(${0.8 * i})`,
      'vintage': `sepia(${0.4 * i}) contrast(${1 - 0.2 * i}) brightness(${1 - 0.1 * i})`,
      'warm': `sepia(${0.2 * i}) saturate(${1 + 0.4 * i}) brightness(${1 + 0.05 * i})`,
      'cool': `saturate(${1 - 0.2 * i}) hue-rotate(${20 * i}deg) brightness(${1 - 0.05 * i})`,
      'dramatic': `contrast(${1 + 0.5 * i}) saturate(${1 + 0.2 * i}) brightness(${1 - 0.1 * i})`,
      'fade': `contrast(${1 - 0.2 * i}) saturate(${1 - 0.4 * i}) brightness(${1 + 0.15 * i})`,
      'vivid': `saturate(${1 + 0.8 * i}) contrast(${1 + 0.1 * i})`,
      'noir': `grayscale(${i}) contrast(${1 + 0.4 * i}) brightness(${1 - 0.15 * i})`,
      'chrome': `saturate(${1 - i}) contrast(${1 + 0.3 * i}) brightness(${1 + 0.2 * i})`,
      'invert': `invert(${i})`,
      'blur': `blur(${3 * i}px)`,
      'sharpen': `contrast(${1 + 0.2 * i}) brightness(${1 + 0.05 * i})`,
      'emboss': `grayscale(${0.5 * i}) contrast(${1 + i})`,
    };
    return filters[filter] || '';
  }

  function applyFilterAndAdjustments() {
    if (!canvas || !originalImage) return;

    // Start with the base image data (after crop/rotate but before overlays)
    const w = canvas.width;
    const h = canvas.height;

    // Create a temp canvas for filter+adjustments
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');

    // Draw base state
    tCtx.putImageData(baseImageData, 0, 0);

    // Build CSS filter string combining filter + adjustments
    let filterStr = getFilterCSS(currentFilter, filterIntensity);

    // Add adjustment filters
    const adj = adjustments;
    const b = 100 + adj.brightness;
    const c = 100 + adj.contrast;
    const s = 100 + adj.saturation;

    filterStr += ` brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

    if (adj.exposure !== 0) {
      const exp = 100 + adj.exposure * 0.5;
      filterStr += ` brightness(${exp}%)`;
    }
    if (adj.temperature !== 0) {
      filterStr += ` sepia(${Math.abs(adj.temperature) * 0.3}%)`;
      if (adj.temperature > 0) filterStr += ` hue-rotate(-${adj.temperature * 0.1}deg)`;
      else filterStr += ` hue-rotate(${Math.abs(adj.temperature) * 0.15}deg)`;
    }

    // Apply via a second temp canvas
    const filterCanvas = document.createElement('canvas');
    filterCanvas.width = w;
    filterCanvas.height = h;
    const fCtx = filterCanvas.getContext('2d');
    fCtx.filter = filterStr.trim();
    fCtx.drawImage(tempCanvas, 0, 0);

    // Apply vignette
    if (adj.vignette > 0) {
      const vigIntensity = adj.vignette / 100;
      const gradient = fCtx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
      gradient.addColorStop(0, `rgba(0,0,0,0)`);
      gradient.addColorStop(1, `rgba(0,0,0,${vigIntensity * 0.8})`);
      fCtx.fillStyle = gradient;
      fCtx.fillRect(0, 0, w, h);
    }

    // Draw result back
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(filterCanvas, 0, 0);
    currentImageData = ctx.getImageData(0, 0, w, h);

    // Redraw overlays
    renderOverlays();
  }

  // ============ ADJUSTMENTS ============
  function bindAdjustmentSliders() {
    document.querySelectorAll('[data-adj]').forEach(slider => {
      slider.addEventListener('input', () => {
        const adj = slider.dataset.adj;
        const val = parseInt(slider.value);
        adjustments[adj] = val;
        slider.nextElementSibling.textContent = val;
        applyFilterAndAdjustments();
      });
    });

    const resetBtn = document.getElementById('resetAdjBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        adjustments = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, vignette: 0 };
        document.querySelectorAll('[data-adj]').forEach(s => {
          s.value = 0;
          s.nextElementSibling.textContent = '0';
        });
        applyFilterAndAdjustments();
        pushHistory();
      });
    }

    const autoBtn = document.getElementById('autoAdjustBtn');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        adjustments = { brightness: 8, contrast: 12, saturation: 15, exposure: 5, temperature: 3, tint: 0, highlights: -10, shadows: 15, vignette: 10 };
        document.querySelectorAll('[data-adj]').forEach(s => {
          const adj = s.dataset.adj;
          s.value = adjustments[adj];
          s.nextElementSibling.textContent = adjustments[adj];
        });
        applyFilterAndAdjustments();
        pushHistory();
      });
    }
  }

  // ============ TEXT TOOL ============
  function bindTextTool() {
    // Text presets
    document.querySelectorAll('.text-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        addTextOverlay(btn.textContent.trim(), parseInt(btn.dataset.size), btn.dataset.weight);
      });
    });

    // Text property updates
    const updateBtn = document.getElementById('updateTextBtn');
    if (updateBtn) {
      updateBtn.addEventListener('click', updateActiveText);
    }
    const deleteBtn = document.getElementById('deleteTextBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (activeOverlay && activeOverlay.type === 'text') {
          overlays = overlays.filter(o => o !== activeOverlay);
          activeOverlay = null;
          document.getElementById('textProps').style.display = 'none';
          recomposite();
          pushHistory();
        }
      });
    }
  }

  function addTextOverlay(text, fontSize, fontWeight) {
    const overlay = {
      type: 'text',
      text: text,
      x: canvas.width / 2,
      y: canvas.height / 2,
      fontSize: fontSize || 32,
      fontWeight: fontWeight || '700',
      fontFamily: 'Plus Jakarta Sans',
      color: '#ffffff',
      bold: fontWeight === '800' || fontWeight === '700',
      italic: false,
      underline: false,
      strokeWidth: 0,
      strokeColor: '#000000',
      opacity: 1,
    };
    overlays.push(overlay);
    activeOverlay = overlay;
    showTextProps(overlay);
    recomposite();
    pushHistory();
  }

  function showTextProps(overlay) {
    const props = document.getElementById('textProps');
    if (!props) return;
    props.style.display = '';
    document.getElementById('textContent').value = overlay.text;
    document.getElementById('fontSize').value = overlay.fontSize;
    document.getElementById('fontColor').value = overlay.color;
    document.getElementById('fontFamily').value = overlay.fontFamily;
    document.getElementById('textStrokeWidth').value = overlay.strokeWidth || 0;
    document.getElementById('textStrokeColor').value = overlay.strokeColor || '#000000';
    const opSlider = document.getElementById('textOpacity');
    if (opSlider) {
      opSlider.value = Math.round(overlay.opacity * 100);
      document.getElementById('textOpacityValue').textContent = Math.round(overlay.opacity * 100) + '%';
    }
  }

  function updateActiveText() {
    if (!activeOverlay || activeOverlay.type !== 'text') return;
    activeOverlay.text = document.getElementById('textContent').value;
    activeOverlay.fontSize = parseInt(document.getElementById('fontSize').value) || 32;
    activeOverlay.color = document.getElementById('fontColor').value;
    activeOverlay.fontFamily = document.getElementById('fontFamily').value;
    activeOverlay.strokeWidth = parseInt(document.getElementById('textStrokeWidth').value) || 0;
    activeOverlay.strokeColor = document.getElementById('textStrokeColor').value;
    const opSlider = document.getElementById('textOpacity');
    if (opSlider) activeOverlay.opacity = parseInt(opSlider.value) / 100;
    recomposite();
    pushHistory();
  }

  // ============ DRAW TOOL ============
  function bindDrawTool() {
    document.querySelectorAll('.draw-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.draw-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawState.mode = btn.dataset.mode;
      });
    });

    const brushSize = document.getElementById('brushSize');
    if (brushSize) {
      brushSize.addEventListener('input', () => {
        drawState.size = parseInt(brushSize.value);
        document.getElementById('brushSizeValue').textContent = drawState.size + 'px';
      });
    }

    const brushOpacity = document.getElementById('brushOpacity');
    if (brushOpacity) {
      brushOpacity.addEventListener('input', () => {
        drawState.opacity = parseInt(brushOpacity.value);
        document.getElementById('brushOpacityValue').textContent = drawState.opacity + '%';
      });
    }

    document.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(sw => sw.classList.remove('active'));
        s.classList.add('active');
        drawState.color = s.dataset.color;
        document.getElementById('brushColor').value = s.dataset.color;
      });
    });

    const colorPicker = document.getElementById('brushColor');
    if (colorPicker) {
      colorPicker.addEventListener('input', () => {
        drawState.color = colorPicker.value;
        document.querySelectorAll('.swatch').forEach(sw => sw.classList.remove('active'));
      });
    }

    const clearBtn = document.getElementById('clearDrawBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        drawingPaths = [];
        recomposite();
        pushHistory();
      });
    }
  }

  // ============ SHAPES TOOL ============
  function bindShapeTool() {
    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        addShape(btn.dataset.shape);
      });
    });
  }

  function addShape(type) {
    const fill = document.getElementById('shapeFill')?.value || '#f3b942';
    const stroke = document.getElementById('shapeStroke')?.value || '#0a192f';
    const strokeW = parseInt(document.getElementById('shapeStrokeWidth')?.value) || 2;
    const opacity = (parseInt(document.getElementById('shapeOpacity')?.value) || 100) / 100;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.15;

    const shape = {
      type: 'shape',
      shape: type,
      x: cx - size / 2,
      y: cy - size / 2,
      w: size,
      h: size,
      fill: fill,
      stroke: stroke,
      strokeWidth: strokeW,
      opacity: opacity,
    };
    overlays.push(shape);
    recomposite();
    pushHistory();
  }

  // ============ STICKERS TOOL ============
  function bindStickerTool() {
    document.querySelectorAll('.sticker-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        addSticker(btn.dataset.emoji);
      });
    });
  }

  function addSticker(emoji) {
    const overlay = {
      type: 'sticker',
      emoji: emoji,
      x: canvas.width / 2,
      y: canvas.height / 2,
      fontSize: Math.min(canvas.width, canvas.height) * 0.12,
    };
    overlays.push(overlay);
    recomposite();
    pushHistory();
  }

  // ============ OVERLAY RENDERING ============
  function renderOverlays() {
    // Draw text, shapes, stickers, and drawings on top of current image
    drawAllDrawingPaths();
    drawAllOverlays();
  }

  function recomposite() {
    // Restore base filtered image, then overlay everything
    if (currentImageData) {
      ctx.putImageData(currentImageData, 0, 0);
    }
    renderOverlays();
  }

  function drawAllDrawingPaths() {
    drawingPaths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.save();
      ctx.globalAlpha = path.opacity / 100;
      ctx.strokeStyle = path.mode === 'eraser' ? '#000000' : path.color;
      ctx.lineWidth = path.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (path.mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawAllOverlays() {
    overlays.forEach(o => {
      ctx.save();
      ctx.globalAlpha = o.opacity || 1;

      if (o.type === 'text') {
        const weight = o.bold ? '800' : (o.fontWeight || '400');
        const style = o.italic ? 'italic' : '';
        ctx.font = `${style} ${weight} ${o.fontSize}px ${o.fontFamily}`;
        ctx.fillStyle = o.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (o.strokeWidth > 0) {
          ctx.strokeStyle = o.strokeColor || '#000000';
          ctx.lineWidth = o.strokeWidth;
          ctx.strokeText(o.text, o.x, o.y);
        }
        ctx.fillText(o.text, o.x, o.y);

        if (o.underline) {
          const metrics = ctx.measureText(o.text);
          ctx.beginPath();
          ctx.moveTo(o.x - metrics.width / 2, o.y + o.fontSize * 0.35);
          ctx.lineTo(o.x + metrics.width / 2, o.y + o.fontSize * 0.35);
          ctx.strokeStyle = o.color;
          ctx.lineWidth = o.fontSize * 0.05;
          ctx.stroke();
        }

        // Highlight active overlay
        if (o === activeOverlay) {
          const metrics = ctx.measureText(o.text);
          ctx.strokeStyle = '#f3b942';
          ctx.lineWidth = 2 / zoom;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(
            o.x - metrics.width / 2 - 8,
            o.y - o.fontSize / 2 - 8,
            metrics.width + 16,
            o.fontSize + 16
          );
          ctx.setLineDash([]);
        }
      } else if (o.type === 'shape') {
        drawShape(o);
      } else if (o.type === 'sticker') {
        ctx.font = `${o.fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.emoji, o.x, o.y);
      }
      ctx.restore();
    });
  }

  function drawShape(o) {
    ctx.fillStyle = o.fill;
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.strokeWidth;

    switch (o.shape) {
      case 'rect':
        ctx.fillRect(o.x, o.y, o.w, o.h);
        if (o.strokeWidth) ctx.strokeRect(o.x, o.y, o.w, o.h);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (o.strokeWidth) ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, o.y);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.lineTo(o.x, o.y + o.h);
        ctx.closePath();
        ctx.fill();
        if (o.strokeWidth) ctx.stroke();
        break;
      case 'star': {
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        const outerR = o.w / 2;
        const innerR = outerR * 0.4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        if (o.strokeWidth) ctx.stroke();
        break;
      }
      case 'line':
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h);
        ctx.lineTo(o.x + o.w, o.y);
        ctx.stroke();
        break;
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h / 2);
        ctx.lineTo(o.x + o.w * 0.8, o.y + o.h / 2);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(o.x + o.w, o.y + o.h / 2);
        ctx.lineTo(o.x + o.w * 0.75, o.y + o.h * 0.25);
        ctx.lineTo(o.x + o.w * 0.75, o.y + o.h * 0.75);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  // ============ CANVAS INTERACTION ============
  function bindCanvasInteraction() {
    if (!canvas) return;
    let isDrawing = false;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', function(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      if (currentTool === 'draw') {
        isDrawing = true;
        const path = {
          points: [{ x, y }],
          color: drawState.color,
          size: drawState.size,
          opacity: drawState.opacity,
          mode: drawState.mode,
        };
        drawingPaths.push(path);
        drawState.currentPath = path;
      } else if (currentTool === 'text' || currentTool === 'select') {
        // Check if clicking on an overlay
        const hit = hitTestOverlays(x, y);
        if (hit) {
          activeOverlay = hit;
          isDragging = true;
          dragOffset = { x: x - hit.x, y: y - hit.y };
          if (hit.type === 'text') showTextProps(hit);
          recomposite();
        } else {
          activeOverlay = null;
          isDragging = false;
          recomposite();
        }
      }
    });

    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing && !isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      if (isDrawing && drawState.currentPath) {
        drawState.currentPath.points.push({ x, y });
        recomposite();
      }
      if (isDragging && activeOverlay) {
        activeOverlay.x = x - dragOffset.x;
        activeOverlay.y = y - dragOffset.y;
        recomposite();
      }
    });

    canvas.addEventListener('mouseup', function() {
      if (isDrawing) {
        isDrawing = false;
        drawState.currentPath = null;
        pushHistory();
      }
      if (isDragging) {
        isDragging = false;
        pushHistory();
      }
    });

    canvas.addEventListener('mouseleave', function() {
      if (isDrawing) {
        isDrawing = false;
        drawState.currentPath = null;
        pushHistory();
      }
    });

    // Dropzone handlers
    const dropzone = els.canvasDropzone;
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) loadImageFromFile(file);
      });
    }

    // Also allow drop on canvas area
    const canvasArea = els.canvasArea;
    if (canvasArea) {
      canvasArea.addEventListener('dragover', (e) => e.preventDefault());
      canvasArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) loadImageFromFile(file);
      });
    }
  }

  function hitTestOverlays(x, y) {
    // Reverse iterate for top-most
    for (let i = overlays.length - 1; i >= 0; i--) {
      const o = overlays[i];
      if (o.type === 'text') {
        ctx.font = `${o.bold ? '800' : o.fontWeight} ${o.fontSize}px ${o.fontFamily}`;
        const metrics = ctx.measureText(o.text);
        const halfW = metrics.width / 2;
        const halfH = o.fontSize / 2;
        if (x >= o.x - halfW - 10 && x <= o.x + halfW + 10 &&
            y >= o.y - halfH - 10 && y <= o.y + halfH + 10) {
          return o;
        }
      } else if (o.type === 'shape') {
        if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o;
      } else if (o.type === 'sticker') {
        const halfS = o.fontSize / 2;
        if (x >= o.x - halfS && x <= o.x + halfS && y >= o.y - halfS && y <= o.y + halfS) return o;
      }
    }
    return null;
  }

  // ============ ZOOM ============
  function bindZoomControls() {
    const zoomIn = document.getElementById('zoomInBtn');
    const zoomOut = document.getElementById('zoomOutBtn');
    const zoomFit = document.getElementById('zoomFitBtn');

    if (zoomIn) zoomIn.addEventListener('click', () => { zoom = Math.min(zoom + 0.1, 3); updateCanvasZoom(); });
    if (zoomOut) zoomOut.addEventListener('click', () => { zoom = Math.max(zoom - 0.1, 0.1); updateCanvasZoom(); });
    if (zoomFit) zoomFit.addEventListener('click', () => {
      if (!canvas || !els.canvasArea) return;
      zoom = Math.min(
        (els.canvasArea.clientWidth - 40) / canvas.width,
        (els.canvasArea.clientHeight - 80) / canvas.height,
        1
      );
      updateCanvasZoom();
    });

    // Scroll zoom
    if (els.canvasArea) {
      els.canvasArea.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        zoom = Math.max(0.1, Math.min(3, zoom + delta));
        updateCanvasZoom();
      }, { passive: false });
    }
  }

  // ============ EXPORT ============
  function bindExportModal() {
    const exportBtn = document.getElementById('exportBtn');
    const modal = document.getElementById('exportModal');
    const closeBtn = document.getElementById('exportModalClose');
    const cancelBtn = document.getElementById('exportCancelBtn');
    const downloadBtn = document.getElementById('exportDownloadBtn');

    function openModal() {
      if (modal) {
        modal.classList.add('open');
        const dims = document.getElementById('exportDimensions');
        if (dims && canvas) dims.textContent = `${canvas.width} × ${canvas.height} pixels`;
      }
    }
    function closeModal() { if (modal) modal.classList.remove('open'); }

    if (exportBtn) exportBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const format = btn.dataset.format;
        const qualityOpt = document.getElementById('qualityOption');
        if (qualityOpt) qualityOpt.style.display = format === 'png' ? 'none' : '';
      });
    });

    // Quality slider
    const qualitySlider = document.getElementById('exportQuality');
    const qualityValue = document.getElementById('exportQualityValue');
    if (qualitySlider) {
      qualitySlider.addEventListener('input', () => {
        if (qualityValue) qualityValue.textContent = qualitySlider.value + '%';
      });
    }

    // Download
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const format = document.querySelector('.format-btn.active')?.dataset.format || 'png';
        const quality = (parseInt(qualitySlider?.value) || 92) / 100;
        const mimeType = `image/${format}`;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        const link = document.createElement('a');
        const name = (CFG.filename || 'image').replace(/\.[^.]+$/, '');
        link.download = `${name}_edited.${format}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        closeModal();
      });
    }
  }

  // ============ SAVE ============
  function bindSaveButton() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!canvas) return;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="lucide lucide-loader-2" style="animation:spin 1s linear infinite;"></i> Saving...';

        try {
          const dataUrl = canvas.toDataURL('image/png');
          const res = await fetch(CFG.saveUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': CFG.csrfToken,
            },
            body: JSON.stringify({
              image_data: dataUrl,
              filename: CFG.filename || 'edited_image.png',
              file_id: CFG.fileId || '',
            }),
          });
          const data = await res.json();
          if (data.success) {
            saveBtn.innerHTML = '<i class="lucide lucide-check"></i> Saved!';
            isDirty = false;
            setTimeout(() => {
              saveBtn.innerHTML = '<i class="lucide lucide-save"></i> Save';
              saveBtn.disabled = false;
            }, 2000);
          } else {
            throw new Error(data.message || 'Save failed');
          }
        } catch (err) {
          alert('Save failed: ' + err.message);
          saveBtn.innerHTML = '<i class="lucide lucide-save"></i> Save';
          saveBtn.disabled = false;
        }
      });
    }
  }

  // ============ UPLOAD ============
  function bindUploadButtons() {
    const uploadBtn = document.getElementById('uploadNewBtn');
    const uploadInput = document.getElementById('newImageInput');
    const dzBtn = document.getElementById('dropzoneUploadBtn');
    const dzInput = document.getElementById('dropzoneFileInput');

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadImageFromFile(e.target.files[0]);
      });
    }
    if (dzBtn && dzInput) {
      dzBtn.addEventListener('click', () => dzInput.click());
      dzInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadImageFromFile(e.target.files[0]);
      });
    }
  }

  // ============ KEYBOARD SHORTCUTS ============
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
      else if (ctrl && e.key === 'y') { e.preventDefault(); redo(); }
      else if (ctrl && e.key === 's') { e.preventDefault(); document.getElementById('saveBtn')?.click(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeOverlay && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          overlays = overlays.filter(o => o !== activeOverlay);
          activeOverlay = null;
          recomposite();
          pushHistory();
        }
      }
    });

    // Undo/Redo buttons
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
  }

  // ============ INIT ON DOM READY ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
