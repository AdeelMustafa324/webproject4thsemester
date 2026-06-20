/* ============ SkipStep Design Studio Engine (Fabric.js) ============ */
(function() {
  'use strict';

  const CFG = window.DESIGN_STUDIO_CONFIG || {};
  let fabricCanvas = null;
  let canvasW = 1080, canvasH = 1080;
  let zoomLevel = 1;
  let designId = CFG.designId || '';

  // ============ INIT ============
  function init() {
    initCanvas();
    bindPanelTabs();
    bindSizeSelector();
    bindShapeButtons();
    bindStickerButtons();
    bindTextButtons();
    bindUploadButtons();
    bindBackgroundControls();
    bindPropertiesPanel();
    bindLayerActions();
    bindZoomControls();
    bindExportModal();
    bindSaveButton();
    bindKeyboardShortcuts();

    // Load existing design if provided
    if (CFG.designData) {
      loadDesignData(CFG.designData);
    }

    fitCanvasToView();
  }

  // ============ CANVAS INIT ============
  function initCanvas() {
    fabricCanvas = new fabric.Canvas('fabricCanvas', {
      width: canvasW,
      height: canvasH,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    });

    // Events
    fabricCanvas.on('selection:created', onSelectionChange);
    fabricCanvas.on('selection:updated', onSelectionChange);
    fabricCanvas.on('selection:cleared', onSelectionCleared);
    fabricCanvas.on('object:modified', onObjectModified);
    fabricCanvas.on('object:moving', onObjectMoving);
    fabricCanvas.on('object:scaling', onObjectMoving);
    fabricCanvas.on('object:rotating', onObjectMoving);
  }

  function fitCanvasToView() {
    const area = document.getElementById('dsCanvasArea');
    if (!area) return;
    const maxW = area.clientWidth - 60;
    const maxH = area.clientHeight - 60;
    const scaleX = maxW / canvasW;
    const scaleY = maxH / canvasH;
    zoomLevel = Math.min(scaleX, scaleY, 1);

    const wrapper = document.getElementById('dsCanvasWrapper');
    if (wrapper) {
      wrapper.style.transform = `scale(${zoomLevel})`;
      wrapper.style.transformOrigin = 'center center';
    }
    updateZoomLabel();
  }

  function resizeCanvas(w, h) {
    canvasW = w;
    canvasH = h;
    fabricCanvas.setDimensions({ width: w, height: h });
    fitCanvasToView();
  }

  function updateZoomLabel() {
    const el = document.getElementById('dsZoomLevel');
    if (el) el.textContent = Math.round(zoomLevel * 100) + '%';
  }

  // ============ PANEL TABS ============
  function bindPanelTabs() {
    document.querySelectorAll('.ds-panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ds-panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panel = tab.dataset.panel;
        document.querySelectorAll('.ds-sub-panel').forEach(p => {
          p.classList.toggle('active', p.dataset.sub === panel);
        });
        if (panel === 'layers') updateLayersList();
      });
    });
  }

  // ============ SIZE SELECTOR ============
  function bindSizeSelector() {
    const btn = document.getElementById('currentSizeBtn');
    const dropdown = document.getElementById('sizeDropdown');

    if (btn && dropdown) {
      btn.addEventListener('click', () => dropdown.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.ds-size-selector')) dropdown.classList.remove('open');
      });
    }

    document.querySelectorAll('.ds-size-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const w = parseInt(opt.dataset.w);
        const h = parseInt(opt.dataset.h);
        resizeCanvas(w, h);
        document.querySelectorAll('.ds-size-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const label = document.getElementById('currentSizeLabel');
        if (label) label.textContent = opt.textContent.split('(')[0].trim();
        dropdown.classList.remove('open');
      });
    });

    const customApply = document.getElementById('customSizeApply');
    if (customApply) {
      customApply.addEventListener('click', () => {
        const w = parseInt(document.getElementById('customW').value) || 1080;
        const h = parseInt(document.getElementById('customH').value) || 1080;
        resizeCanvas(Math.min(5000, Math.max(100, w)), Math.min(5000, Math.max(100, h)));
        const label = document.getElementById('currentSizeLabel');
        if (label) label.textContent = `Custom (${w}×${h})`;
        document.querySelectorAll('.ds-size-option').forEach(o => o.classList.remove('active'));
        dropdown.classList.remove('open');
      });
    }
  }

  // ============ SHAPES ============
  function bindShapeButtons() {
    document.querySelectorAll('.ds-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => addShape(btn.dataset.shape));
    });
  }

  function addShape(type) {
    let obj;
    const defaults = {
      left: canvasW / 2 - 60,
      top: canvasH / 2 - 60,
      fill: '#f3b942',
      stroke: '#0a192f',
      strokeWidth: 2,
      cornerColor: '#f3b942',
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#f3b942',
    };

    switch (type) {
      case 'rect':
        obj = new fabric.Rect({ ...defaults, width: 120, height: 90, rx: 4, ry: 4 });
        break;
      case 'rounded-rect':
        obj = new fabric.Rect({ ...defaults, width: 120, height: 90, rx: 20, ry: 20 });
        break;
      case 'circle':
        obj = new fabric.Circle({ ...defaults, radius: 60, left: canvasW / 2 - 60, top: canvasH / 2 - 60 });
        break;
      case 'triangle':
        obj = new fabric.Triangle({ ...defaults, width: 120, height: 110 });
        break;
      case 'star':
        obj = createStar(canvasW / 2, canvasH / 2, 5, 60, 28, defaults);
        break;
      case 'line':
        obj = new fabric.Line([50, 50, 200, 200], {
          ...defaults, fill: '', strokeWidth: 3,
          left: canvasW / 2 - 75, top: canvasH / 2 - 75,
        });
        break;
      case 'diamond':
        obj = new fabric.Polygon([
          { x: 60, y: 0 }, { x: 120, y: 60 }, { x: 60, y: 120 }, { x: 0, y: 60 }
        ], { ...defaults, left: canvasW / 2 - 60, top: canvasH / 2 - 60 });
        break;
      case 'hexagon':
        obj = createHexagon(canvasW / 2, canvasH / 2, 60, defaults);
        break;
      default: return;
    }

    fabricCanvas.add(obj);
    fabricCanvas.setActiveObject(obj);
    fabricCanvas.renderAll();
    updateLayersList();
  }

  function createStar(cx, cy, spikes, outerR, innerR, opts) {
    const points = [];
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return new fabric.Polygon(points, { ...opts, left: cx - outerR, top: cy - outerR });
  }

  function createHexagon(cx, cy, r, opts) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return new fabric.Polygon(points, { ...opts, left: cx - r, top: cy - r });
  }

  // ============ STICKERS ============
  function bindStickerButtons() {
    document.querySelectorAll('.ds-sticker').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = new fabric.Text(btn.dataset.emoji, {
          left: canvasW / 2 - 30,
          top: canvasH / 2 - 30,
          fontSize: 64,
          cornerColor: '#f3b942',
          cornerStyle: 'circle',
          transparentCorners: false,
          borderColor: '#f3b942',
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        fabricCanvas.renderAll();
        updateLayersList();
      });
    });
  }

  // ============ TEXT ============
  function bindTextButtons() {
    const addH = document.getElementById('addHeading');
    const addSub = document.getElementById('addSubheading');
    const addBody = document.getElementById('addBodyText');

    if (addH) addH.addEventListener('click', () => addTextElement('Your Heading', 48, 'bold'));
    if (addSub) addSub.addEventListener('click', () => addTextElement('Your Subheading', 28, '600'));
    if (addBody) addBody.addEventListener('click', () => addTextElement('Body text goes here. Click to edit.', 18, 'normal'));
  }

  function addTextElement(text, size, weight) {
    const textObj = new fabric.IText(text, {
      left: canvasW / 2 - 100,
      top: canvasH / 2 - size / 2,
      fontSize: size,
      fontWeight: weight,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#0a192f',
      cornerColor: '#f3b942',
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#f3b942',
    });
    fabricCanvas.add(textObj);
    fabricCanvas.setActiveObject(textObj);
    fabricCanvas.renderAll();
    updateLayersList();
  }

  // ============ UPLOADS ============
  function bindUploadButtons() {
    const uploadBtn = document.getElementById('dsUploadBtn');
    const uploadInput = document.getElementById('dsUploadInput');

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = function(ev) {
            fabric.Image.fromURL(ev.target.result, function(img) {
              // Scale to fit in canvas
              const maxDim = Math.min(canvasW, canvasH) * 0.5;
              if (img.width > maxDim || img.height > maxDim) {
                const scale = maxDim / Math.max(img.width, img.height);
                img.scaleToWidth(img.width * scale);
              }
              img.set({
                left: canvasW / 2 - (img.getScaledWidth() / 2),
                top: canvasH / 2 - (img.getScaledHeight() / 2),
                cornerColor: '#f3b942',
                cornerStyle: 'circle',
                transparentCorners: false,
                borderColor: '#f3b942',
              });
              fabricCanvas.add(img);
              fabricCanvas.setActiveObject(img);
              fabricCanvas.renderAll();
              updateLayersList();

              // Add thumbnail to uploads grid
              addUploadThumbnail(ev.target.result);
            });
          };
          reader.readAsDataURL(file);
        });
        uploadInput.value = '';
      });
    }
  }

  function addUploadThumbnail(dataUrl) {
    const grid = document.getElementById('uploadsGrid');
    if (!grid) return;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.title = 'Click to add to canvas';
    img.addEventListener('click', () => {
      fabric.Image.fromURL(dataUrl, function(fImg) {
        const maxDim = Math.min(canvasW, canvasH) * 0.4;
        if (fImg.width > maxDim || fImg.height > maxDim) {
          const scale = maxDim / Math.max(fImg.width, fImg.height);
          fImg.scaleToWidth(fImg.width * scale);
        }
        fImg.set({
          left: Math.random() * (canvasW * 0.5),
          top: Math.random() * (canvasH * 0.5),
          cornerColor: '#f3b942', cornerStyle: 'circle',
          transparentCorners: false, borderColor: '#f3b942',
        });
        fabricCanvas.add(fImg);
        fabricCanvas.setActiveObject(fImg);
        fabricCanvas.renderAll();
        updateLayersList();
      });
    });
    grid.appendChild(img);
  }

  // ============ BACKGROUND ============
  function bindBackgroundControls() {
    const picker = document.getElementById('bgColorPicker');
    if (picker) {
      picker.addEventListener('input', () => {
        fabricCanvas.backgroundColor = picker.value;
        fabricCanvas.renderAll();
      });
    }

    document.querySelectorAll('.ds-bg-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const bg = btn.dataset.bg;
        if (bg.startsWith('linear-gradient')) {
          // For gradients, create a rect covering the canvas
          const parts = bg.match(/#[a-f0-9]{6}/gi);
          if (parts && parts.length >= 2) {
            const grad = new fabric.Gradient({
              type: 'linear',
              coords: { x1: 0, y1: 0, x2: canvasW, y2: canvasH },
              colorStops: [
                { offset: 0, color: parts[0] },
                { offset: 1, color: parts[1] },
              ]
            });
            fabricCanvas.backgroundColor = '';
            fabricCanvas.setBackgroundColor(grad, () => fabricCanvas.renderAll());
          }
        } else {
          fabricCanvas.setBackgroundColor(bg, () => fabricCanvas.renderAll());
          if (picker) picker.value = bg;
        }
      });
    });
  }

  // ============ PROPERTIES PANEL ============
  function bindPropertiesPanel() {
    // Position
    ['propX', 'propY', 'propW', 'propH'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyPropsToObject);
    });

    // Rotation
    const rotSlider = document.getElementById('propRotation');
    if (rotSlider) {
      rotSlider.addEventListener('input', () => {
        document.getElementById('propRotationVal').textContent = rotSlider.value + '°';
        applyPropsToObject();
      });
    }

    // Fill
    const fillPicker = document.getElementById('propFill');
    if (fillPicker) fillPicker.addEventListener('input', applyPropsToObject);

    // Stroke
    const strokePicker = document.getElementById('propStroke');
    const strokeWidth = document.getElementById('propStrokeWidth');
    if (strokePicker) strokePicker.addEventListener('input', applyPropsToObject);
    if (strokeWidth) strokeWidth.addEventListener('change', applyPropsToObject);

    // Opacity
    const opSlider = document.getElementById('propOpacity');
    if (opSlider) {
      opSlider.addEventListener('input', () => {
        document.getElementById('propOpacityVal').textContent = opSlider.value + '%';
        applyPropsToObject();
      });
    }

    // Text props
    const fontFamily = document.getElementById('propFontFamily');
    const fontSize = document.getElementById('propFontSize');
    const boldBtn = document.getElementById('propBold');
    const italicBtn = document.getElementById('propItalic');
    const underlineBtn = document.getElementById('propUnderline');

    if (fontFamily) fontFamily.addEventListener('change', applyPropsToObject);
    if (fontSize) fontSize.addEventListener('change', applyPropsToObject);
    if (boldBtn) boldBtn.addEventListener('click', () => { boldBtn.classList.toggle('active'); applyPropsToObject(); });
    if (italicBtn) italicBtn.addEventListener('click', () => { italicBtn.classList.toggle('active'); applyPropsToObject(); });
    if (underlineBtn) underlineBtn.addEventListener('click', () => { underlineBtn.classList.toggle('active'); applyPropsToObject(); });

    // Delete
    const deleteBtn = document.getElementById('deleteElement');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const obj = fabricCanvas.getActiveObject();
        if (obj) {
          fabricCanvas.remove(obj);
          fabricCanvas.renderAll();
          updateLayersList();
        }
      });
    }

    // Duplicate
    const dupBtn = document.getElementById('duplicateElement');
    if (dupBtn) {
      dupBtn.addEventListener('click', () => {
        const obj = fabricCanvas.getActiveObject();
        if (obj) {
          obj.clone(function(cloned) {
            cloned.set({ left: obj.left + 20, top: obj.top + 20 });
            fabricCanvas.add(cloned);
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.renderAll();
            updateLayersList();
          });
        }
      });
    }
  }

  function onSelectionChange() {
    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;
    document.getElementById('propsEmpty').style.display = 'none';
    document.getElementById('propsContent').style.display = '';

    // Determine type label
    let typeName = 'Element';
    if (obj.type === 'i-text' || obj.type === 'text') typeName = 'Text';
    else if (obj.type === 'rect') typeName = 'Rectangle';
    else if (obj.type === 'circle') typeName = 'Circle';
    else if (obj.type === 'triangle') typeName = 'Triangle';
    else if (obj.type === 'polygon') typeName = 'Shape';
    else if (obj.type === 'image') typeName = 'Image';
    else if (obj.type === 'line') typeName = 'Line';
    document.getElementById('propsTitle').textContent = typeName;

    // Fill values
    document.getElementById('propX').value = Math.round(obj.left);
    document.getElementById('propY').value = Math.round(obj.top);
    document.getElementById('propW').value = Math.round(obj.getScaledWidth());
    document.getElementById('propH').value = Math.round(obj.getScaledHeight());
    document.getElementById('propRotation').value = Math.round(obj.angle || 0);
    document.getElementById('propRotationVal').textContent = Math.round(obj.angle || 0) + '°';
    document.getElementById('propOpacity').value = Math.round((obj.opacity || 1) * 100);
    document.getElementById('propOpacityVal').textContent = Math.round((obj.opacity || 1) * 100) + '%';

    // Fill/stroke
    const fill = obj.fill;
    const fillEl = document.getElementById('propFill');
    const fillGroup = document.getElementById('propFillGroup');
    if (typeof fill === 'string' && fill.startsWith('#')) {
      fillEl.value = fill;
      fillGroup.style.display = '';
    } else if (obj.type === 'image') {
      fillGroup.style.display = 'none';
    } else {
      fillGroup.style.display = '';
    }

    document.getElementById('propStroke').value = obj.stroke || '#000000';
    document.getElementById('propStrokeWidth').value = obj.strokeWidth || 0;

    // Text-specific
    const textGroup = document.getElementById('textPropsGroup');
    if (obj.type === 'i-text' || obj.type === 'text') {
      textGroup.style.display = '';
      document.getElementById('propFontFamily').value = obj.fontFamily || 'Plus Jakarta Sans';
      document.getElementById('propFontSize').value = obj.fontSize || 32;
      document.getElementById('propBold').classList.toggle('active', obj.fontWeight === 'bold' || obj.fontWeight === '700' || obj.fontWeight === '800');
      document.getElementById('propItalic').classList.toggle('active', obj.fontStyle === 'italic');
      document.getElementById('propUnderline').classList.toggle('active', !!obj.underline);
    } else {
      textGroup.style.display = 'none';
    }

    updateLayersList();
  }

  function onSelectionCleared() {
    document.getElementById('propsEmpty').style.display = '';
    document.getElementById('propsContent').style.display = 'none';
    updateLayersList();
  }

  function onObjectModified() {
    onSelectionChange();
  }

  function onObjectMoving() {
    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;
    document.getElementById('propX').value = Math.round(obj.left);
    document.getElementById('propY').value = Math.round(obj.top);
    document.getElementById('propW').value = Math.round(obj.getScaledWidth());
    document.getElementById('propH').value = Math.round(obj.getScaledHeight());
    document.getElementById('propRotation').value = Math.round(obj.angle || 0);
    document.getElementById('propRotationVal').textContent = Math.round(obj.angle || 0) + '°';
  }

  function applyPropsToObject() {
    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;

    const x = parseInt(document.getElementById('propX').value) || 0;
    const y = parseInt(document.getElementById('propY').value) || 0;
    const w = parseInt(document.getElementById('propW').value) || 100;
    const h = parseInt(document.getElementById('propH').value) || 100;
    const rotation = parseInt(document.getElementById('propRotation').value) || 0;
    const opacity = (parseInt(document.getElementById('propOpacity').value) || 100) / 100;
    const fill = document.getElementById('propFill').value;
    const stroke = document.getElementById('propStroke').value;
    const strokeWidth = parseInt(document.getElementById('propStrokeWidth').value) || 0;

    obj.set({
      left: x,
      top: y,
      angle: rotation,
      opacity: opacity,
      stroke: stroke,
      strokeWidth: strokeWidth,
    });

    // Scale to match W/H
    if (obj.type !== 'line') {
      obj.scaleToWidth(w);
      obj.scaleToHeight(h);
    }

    if (typeof obj.fill === 'string' || obj.type !== 'image') {
      obj.set('fill', fill);
    }

    // Text props
    if (obj.type === 'i-text' || obj.type === 'text') {
      obj.set({
        fontFamily: document.getElementById('propFontFamily').value,
        fontSize: parseInt(document.getElementById('propFontSize').value) || 32,
        fontWeight: document.getElementById('propBold').classList.contains('active') ? 'bold' : 'normal',
        fontStyle: document.getElementById('propItalic').classList.contains('active') ? 'italic' : 'normal',
        underline: document.getElementById('propUnderline').classList.contains('active'),
      });
    }

    fabricCanvas.renderAll();
  }

  // ============ LAYERS ============
  function bindLayerActions() {
    const bringFwd = document.getElementById('bringForward');
    const sendBack = document.getElementById('sendBackward');
    const bringFront = document.getElementById('bringToFront');
    const sendToBack = document.getElementById('sendToBack');

    if (bringFwd) bringFwd.addEventListener('click', () => { const o = fabricCanvas.getActiveObject(); if (o) { fabricCanvas.bringForward(o); updateLayersList(); } });
    if (sendBack) sendBack.addEventListener('click', () => { const o = fabricCanvas.getActiveObject(); if (o) { fabricCanvas.sendBackwards(o); updateLayersList(); } });
    if (bringFront) bringFront.addEventListener('click', () => { const o = fabricCanvas.getActiveObject(); if (o) { fabricCanvas.bringToFront(o); updateLayersList(); } });
    if (sendToBack) sendToBack.addEventListener('click', () => { const o = fabricCanvas.getActiveObject(); if (o) { fabricCanvas.sendToBack(o); updateLayersList(); } });
  }

  function updateLayersList() {
    const list = document.getElementById('layersList');
    if (!list) return;
    const objects = fabricCanvas.getObjects();
    const active = fabricCanvas.getActiveObject();

    if (objects.length === 0) {
      list.innerHTML = '<div class="ds-layer-empty">No elements yet.</div>';
      return;
    }

    list.innerHTML = '';
    // Reverse order (top layer first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const item = document.createElement('div');
      item.className = 'ds-layer-item' + (obj === active ? ' selected' : '');

      let icon = 'square', label = 'Element';
      if (obj.type === 'i-text' || obj.type === 'text') { icon = 'type'; label = (obj.text || '').substring(0, 20); }
      else if (obj.type === 'rect') { icon = 'square'; label = 'Rectangle'; }
      else if (obj.type === 'circle') { icon = 'circle'; label = 'Circle'; }
      else if (obj.type === 'triangle') { icon = 'triangle'; label = 'Triangle'; }
      else if (obj.type === 'polygon') { icon = 'hexagon'; label = 'Shape'; }
      else if (obj.type === 'image') { icon = 'image'; label = 'Image'; }
      else if (obj.type === 'line') { icon = 'minus'; label = 'Line'; }

      item.innerHTML = `<i class="lucide lucide-${icon}"></i> <span>${label}</span>`;
      item.addEventListener('click', () => {
        fabricCanvas.setActiveObject(obj);
        fabricCanvas.renderAll();
        updateLayersList();
      });
      list.appendChild(item);
    }
  }

  // ============ ZOOM ============
  function bindZoomControls() {
    const zoomIn = document.getElementById('dsZoomIn');
    const zoomOut = document.getElementById('dsZoomOut');
    const zoomFit = document.getElementById('dsZoomFit');

    if (zoomIn) zoomIn.addEventListener('click', () => { zoomLevel = Math.min(zoomLevel + 0.1, 3); applyZoom(); });
    if (zoomOut) zoomOut.addEventListener('click', () => { zoomLevel = Math.max(zoomLevel - 0.1, 0.1); applyZoom(); });
    if (zoomFit) zoomFit.addEventListener('click', fitCanvasToView);

    const area = document.getElementById('dsCanvasArea');
    if (area) {
      area.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomLevel = Math.max(0.1, Math.min(3, zoomLevel + (e.deltaY > 0 ? -0.05 : 0.05)));
        applyZoom();
      }, { passive: false });
    }
  }

  function applyZoom() {
    const wrapper = document.getElementById('dsCanvasWrapper');
    if (wrapper) {
      wrapper.style.transform = `scale(${zoomLevel})`;
    }
    updateZoomLabel();
  }

  // ============ EXPORT ============
  function bindExportModal() {
    const exportBtn = document.getElementById('dsExportBtn');
    const modal = document.getElementById('dsExportModal');
    const closeBtn = document.getElementById('dsExportClose');
    const cancelBtn = document.getElementById('dsExportCancel');
    const downloadBtn = document.getElementById('dsExportDownload');

    function openM() { if (modal) modal.classList.add('open'); }
    function closeM() { if (modal) modal.classList.remove('open'); }

    if (exportBtn) exportBtn.addEventListener('click', openM);
    if (closeBtn) closeBtn.addEventListener('click', closeM);
    if (cancelBtn) cancelBtn.addEventListener('click', closeM);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeM(); });

    document.querySelectorAll('.ds-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ds-format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.format;
        const qualOpt = document.getElementById('dsQualityOpt');
        if (qualOpt) qualOpt.style.display = f === 'jpeg' ? '' : 'none';
      });
    });

    const qualSlider = document.getElementById('dsExportQuality');
    if (qualSlider) {
      qualSlider.addEventListener('input', () => {
        document.getElementById('dsExportQualityVal').textContent = qualSlider.value + '%';
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const format = document.querySelector('.ds-format-btn.active')?.dataset.format || 'png';

        if (format === 'svg') {
          const svg = fabricCanvas.toSVG();
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          downloadFile(url, 'design.svg');
          URL.revokeObjectURL(url);
        } else {
          const quality = format === 'jpeg' ? (parseInt(qualSlider?.value) || 92) / 100 : 1;
          const dataUrl = fabricCanvas.toDataURL({ format: format, quality: quality, multiplier: 1 });
          const title = document.getElementById('designTitle')?.value || 'design';
          downloadFile(dataUrl, `${title}.${format}`);
        }
        closeM();
      });
    }
  }

  function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ============ SAVE ============
  function bindSaveButton() {
    const saveBtn = document.getElementById('dsSaveBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="lucide lucide-loader-2" style="animation:spin 1s linear infinite;"></i> Saving...';

      try {
        const title = document.getElementById('designTitle')?.value || 'Untitled Design';
        const canvasJson = JSON.stringify(fabricCanvas.toJSON());
        const thumbnail = fabricCanvas.toDataURL({ format: 'png', quality: 0.5, multiplier: 0.25 });

        const res = await fetch(CFG.saveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': CFG.csrfToken,
          },
          body: JSON.stringify({
            design_id: designId,
            title: title,
            canvas_json: canvasJson,
            canvas_width: canvasW,
            canvas_height: canvasH,
            thumbnail: thumbnail,
          }),
        });
        const data = await res.json();
        if (data.success) {
          designId = data.design_id;
          saveBtn.innerHTML = '<i class="lucide lucide-check"></i> Saved!';
          setTimeout(() => {
            saveBtn.innerHTML = '<i class="lucide lucide-save"></i> Save';
            saveBtn.disabled = false;
          }, 2000);
        } else {
          throw new Error(data.message);
        }
      } catch (err) {
        alert('Save failed: ' + err.message);
        saveBtn.innerHTML = '<i class="lucide lucide-save"></i> Save';
        saveBtn.disabled = false;
      }
    });
  }

  // ============ LOAD ============
  function loadDesignData(data) {
    if (!data) return;
    if (data.title) {
      const titleEl = document.getElementById('designTitle');
      if (titleEl) titleEl.value = data.title;
    }
    if (data.canvas_width && data.canvas_height) {
      canvasW = data.canvas_width;
      canvasH = data.canvas_height;
      fabricCanvas.setDimensions({ width: canvasW, height: canvasH });
    }
    if (data.canvas_json) {
      try {
        const json = typeof data.canvas_json === 'string' ? JSON.parse(data.canvas_json) : data.canvas_json;
        fabricCanvas.loadFromJSON(json, () => {
          fabricCanvas.renderAll();
          updateLayersList();
          fitCanvasToView();
        });
      } catch (e) {
        console.error('Failed to load design:', e);
      }
    }
  }

  // ============ KEYBOARD SHORTCUTS ============
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const obj = fabricCanvas.getActiveObject();
        if (obj) {
          fabricCanvas.remove(obj);
          fabricCanvas.renderAll();
          updateLayersList();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('dsSaveBtn')?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        document.getElementById('duplicateElement')?.click();
      }
    });
  }

  // ============ START ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
