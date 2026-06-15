/**
 * sheet_editor.js — Handsontable + AI live sheet editing
 */
document.addEventListener('DOMContentLoaded', () => {
    const filename = window.__SHEET_FILENAME__;
    const gridEl = document.getElementById('sheetGrid');
    const promptInput = document.getElementById('aiSheetPrompt');
    const sendBtn = document.getElementById('aiSheetSendBtn');
    const saveBtn = document.getElementById('sheetSaveBtn');
    const statusEl = document.getElementById('aiSheetStatus');

    if (!gridEl || !filename) return;

    let hot = null;
    let loadedMeta = null;

    // -----------------------------------------------------------------------
    // Load CSV data and Metadata from the backend
    // -----------------------------------------------------------------------
    async function loadSheet() {
        setStatus('Loading spreadsheet...', 'loading');
        try {
            const res = await fetch(`/ai/api/read/${encodeURIComponent(filename)}/`);
            const data = await res.json();
            if (data.status === 'ok') {
                if (data.meta) {
                    try { loadedMeta = JSON.parse(data.meta); } catch(e) {}
                }
                const rows = parseCSV(data.content);
                initHandsontable(rows);
                setStatus('', '');
            } else {
                setStatus('Error loading file: ' + data.message, 'error');
            }
        } catch (e) {
            console.error('Load error:', e);
            setStatus('Failed to load spreadsheet.', 'error');
        }
    }

    // -----------------------------------------------------------------------
    // Parse CSV into 2D array
    // -----------------------------------------------------------------------
    function parseCSV(text) {
        const rows = [];
        let current = '';
        let inQuotes = false;
        let row = [];

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];

            if (inQuotes) {
                if (ch === '"' && next === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    row.push(current);
                    current = '';
                } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                    row.push(current);
                    current = '';
                    if (row.length > 0) rows.push(row);
                    row = [];
                    if (ch === '\r') i++;
                } else {
                    current += ch;
                }
            }
        }
        row.push(current);
        if (row.some(c => c !== '')) rows.push(row);
        return rows;
    }

    // -----------------------------------------------------------------------
    // Custom Cell Renderer for Formatting
    // -----------------------------------------------------------------------
    function customRenderer(instance, td, row, col, prop, value, cellProperties) {
        Handsontable.renderers.TextRenderer.apply(this, arguments);
        
        td.style.fontWeight = cellProperties.bold ? 'bold' : 'normal';
        td.style.fontStyle = cellProperties.italic ? 'italic' : 'normal';
        td.style.textDecoration = cellProperties.underline ? 'underline' : 'none';
        
        if (cellProperties.textColor) td.style.color = cellProperties.textColor;
        else td.style.color = '';

        if (cellProperties.bgColor) td.style.backgroundColor = cellProperties.bgColor;
        else td.style.backgroundColor = '';
        
        if (cellProperties.align) td.style.textAlign = cellProperties.align;
        else td.style.textAlign = 'left';
        
        if (cellProperties.fontFamily) td.style.fontFamily = cellProperties.fontFamily;
        if (cellProperties.fontSize) td.style.fontSize = cellProperties.fontSize;
    }

    // -----------------------------------------------------------------------
    // Initialize Handsontable
    // -----------------------------------------------------------------------
    function initHandsontable(data) {
        if (hot) hot.destroy();

        const headers = data.length > 0 ? data[0] : [];
        // Real Excel starts with a grid, and headers are just the first row of data
        const bodyData = data.length > 0 ? data : [Array(10).fill('')];

        hot = new Handsontable(gridEl, {
            data: bodyData,
            colHeaders: true, // This enables A, B, C... Excel style headers
            rowHeaders: true, // This enables 1, 2, 3... Excel style row numbers
            minRows: 100,     // Pre-build 100 rows
            minCols: 26,      // Pre-build 26 columns (A to Z)
            minSpareRows: 1,
            minSpareCols: 1,
            renderer: customRenderer,
            width: '100%',
            height: '100%',
            stretchH: 'all',
            autoWrapRow: true,
            autoWrapCol: true,
            contextMenu: true,
            manualColumnResize: true,
            manualRowResize: true,
            undo: true,
            outsideClickDeselects: false,
            licenseKey: 'non-commercial-and-evaluation',
            afterSelection: syncToolbar,
            afterChange: updateUndoRedo,
            afterRender: updateUndoRedo
        });

        // Apply loaded metadata
        if (loadedMeta) {
            Object.keys(loadedMeta).forEach(row => {
                Object.keys(loadedMeta[row]).forEach(col => {
                    const styles = loadedMeta[row][col];
                    Object.keys(styles).forEach(key => {
                        hot.setCellMeta(parseInt(row), parseInt(col), key, styles[key]);
                    });
                });
            });
            hot.render();
        }
    }

    // -----------------------------------------------------------------------
    // Toolbar UI Sync & Control
    // -----------------------------------------------------------------------
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const selFontFamily = document.getElementById('selFontFamily');
    const selFontSize = document.getElementById('selFontSize');
    const btnBold = document.getElementById('btnBold');
    const btnItalic = document.getElementById('btnItalic');
    const btnUnderline = document.getElementById('btnUnderline');
    const colorText = document.getElementById('colorText');
    const colorBg = document.getElementById('colorBg');
    const btnAlignLeft = document.getElementById('btnAlignLeft');
    const btnAlignCenter = document.getElementById('btnAlignCenter');
    const btnAlignRight = document.getElementById('btnAlignRight');

    function updateUndoRedo() {
        if (!hot) return;
        btnUndo.disabled = !hot.isUndoAvailable();
        btnRedo.disabled = !hot.isRedoAvailable();
    }

    function syncToolbar(row, col) {
        if (!hot) return;
        const meta = hot.getCellMeta(row, col);
        btnBold.classList.toggle('active', !!meta.bold);
        btnItalic.classList.toggle('active', !!meta.italic);
        btnUnderline.classList.toggle('active', !!meta.underline);
        colorText.value = meta.textColor || '#000000';
        colorBg.value = meta.bgColor || '#ffffff';
        selFontFamily.value = meta.fontFamily || 'Arial, sans-serif';
        selFontSize.value = meta.fontSize || '12px';
        
        btnAlignLeft.classList.toggle('active', meta.align === 'left');
        btnAlignCenter.classList.toggle('active', meta.align === 'center');
        btnAlignRight.classList.toggle('active', meta.align === 'right');
        
        updateUndoRedo();
    }

    function applyFormat(key, value, toggle = false) {
        if (!hot) return;
        const selected = hot.getSelected();
        if (!selected) return;

        selected.forEach(([row1, col1, row2, col2]) => {
            const startRow = Math.min(row1, row2);
            const endRow = Math.max(row1, row2);
            const startCol = Math.min(col1, col2);
            const endCol = Math.max(col1, col2);

            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    let finalVal = value;
                    if (toggle) {
                        const current = hot.getCellMeta(r, c)[key];
                        finalVal = !current;
                    }
                    hot.setCellMeta(r, c, key, finalVal);
                }
            }
        });
        hot.render();
        const firstRange = selected[0];
        syncToolbar(firstRange[0], firstRange[1]);
    }

    // Bind toolbar buttons
    btnUndo.addEventListener('click', () => { if (hot) hot.undo(); });
    btnRedo.addEventListener('click', () => { if (hot) hot.redo(); });
    
    btnBold.addEventListener('click', () => applyFormat('bold', true, true));
    btnItalic.addEventListener('click', () => applyFormat('italic', true, true));
    btnUnderline.addEventListener('click', () => applyFormat('underline', true, true));
    
    btnAlignLeft.addEventListener('click', () => applyFormat('align', 'left'));
    btnAlignCenter.addEventListener('click', () => applyFormat('align', 'center'));
    btnAlignRight.addEventListener('click', () => applyFormat('align', 'right'));

    colorText.addEventListener('input', (e) => applyFormat('textColor', e.target.value));
    colorBg.addEventListener('input', (e) => applyFormat('bgColor', e.target.value));
    selFontFamily.addEventListener('change', (e) => applyFormat('fontFamily', e.target.value));
    selFontSize.addEventListener('change', (e) => applyFormat('fontSize', e.target.value));


    // -----------------------------------------------------------------------
    // Get current sheet data as 2D array (including headers)
    // -----------------------------------------------------------------------
    function getSheetData() {
        if (!hot) return [];
        const data = hot.getData();
        
        let lastRow = -1;
        let lastCol = -1;
        
        // Find the bounding box of actual data to trim empty spaces
        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                if (data[r][c] !== null && data[r][c] !== '') {
                    if (r > lastRow) lastRow = r;
                    if (c > lastCol) lastCol = c;
                }
            }
        }
        
        if (lastRow === -1) return []; // Empty sheet
        
        const trimmedData = [];
        for (let r = 0; r <= lastRow; r++) {
            trimmedData.push(data[r].slice(0, lastCol + 1));
        }
        
        return trimmedData;
    }

    // -----------------------------------------------------------------------
    // Extract formatting metadata for saving
    // -----------------------------------------------------------------------
    function getSheetMeta() {
        if (!hot) return {};
        const rows = hot.countRows();
        const cols = hot.countCols();
        const metaToSave = {};
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellMeta = hot.getCellMeta(r, c);
                const styles = {};
                ['bold', 'italic', 'underline', 'textColor', 'bgColor', 'align', 'fontFamily', 'fontSize'].forEach(k => {
                    if (cellMeta[k]) styles[k] = cellMeta[k];
                });
                
                if (Object.keys(styles).length > 0) {
                    if (!metaToSave[r]) metaToSave[r] = {};
                    metaToSave[r][c] = styles;
                }
            }
        }
        return metaToSave;
    }

    // -----------------------------------------------------------------------
    // AI Instruction
    // -----------------------------------------------------------------------
    async function sendAIInstruction() {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        sendBtn.disabled = true;
        setStatus('🤖 AI is processing: "' + prompt + '"...', 'loading');

        const sheetData = getSheetData();

        try {
            const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const res = await fetch('/ai/api/sheet-edit/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrf,
                },
                body: JSON.stringify({
                    sheet_data: sheetData,
                    prompt: prompt,
                    filename: filename,
                }),
            });

            const data = await res.json();

            if (data.status === 'ok' && data.operations) {
                applyOperations(data.operations);
                const msg = data.message || `Applied ${data.operations.length} operation(s).`;
                setStatus('✓ ' + msg, 'success');
                promptInput.value = '';
            } else {
                setStatus('Error: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (e) {
            console.error('AI error:', e);
            setStatus('Failed to communicate with AI.', 'error');
        }

        sendBtn.disabled = false;
    }

    // -----------------------------------------------------------------------
    // Apply AI operations to Handsontable
    // -----------------------------------------------------------------------
    function applyOperations(operations) {
        if (!hot || !operations) return;

        operations.forEach(op => {
            switch (op.op) {
                case 'set_cell': {
                    const dataRow = op.row;
                    if (dataRow >= 0) {
                        hot.setDataAtCell(dataRow, op.col, op.value);
                    }
                    break;
                }
                case 'insert_row': {
                    const afterRow = op.after_row;
                    const insertAt = afterRow + 1;
                    const values = op.values || [];
                    hot.alter('insert_row_below', Math.max(0, insertAt - 1), 1);
                    values.forEach((val, col) => {
                        hot.setDataAtCell(Math.max(0, insertAt), col, val);
                    });
                    break;
                }
                case 'delete_row': {
                    const dataRow = op.row;
                    if (dataRow >= 0 && dataRow < hot.countRows()) {
                        hot.alter('remove_row', dataRow, 1);
                    }
                    break;
                }
                case 'insert_col': {
                    const afterCol = op.after_col;
                    hot.alter('insert_col_end', afterCol >= 0 ? afterCol : 0, 1);
                    (op.values || []).forEach((val, row) => {
                        hot.setDataAtCell(row, afterCol + 1, val);
                    });
                    break;
                }
                case 'delete_col': {
                    hot.alter('remove_col', op.col, 1);
                    break;
                }
                case 'set_format': {
                    const dataRow = op.row;
                    if (dataRow >= 0 && op.format) {
                        Object.keys(op.format).forEach(key => {
                            hot.setCellMeta(dataRow, op.col, key, op.format[key]);
                        });
                    }
                    break;
                }
            }
        });

        hot.render();
    }

    // -----------------------------------------------------------------------
    // Save back to file
    // -----------------------------------------------------------------------
    async function saveSheet() {
        if (!hot) return;
        saveBtn.disabled = true;
        setStatus('Saving...', 'loading');

        const sheetData = getSheetData();
        const csv = sheetData.map(row =>
            row.map(cell => {
                const s = String(cell == null ? '' : cell);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(',')
        ).join('\n');
        
        const metaJson = JSON.stringify(getSheetMeta());

        try {
            const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const res = await fetch(`/ai/api/save/${encodeURIComponent(filename)}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrf,
                },
                body: JSON.stringify({ 
                    content: csv,
                    meta: metaJson
                }),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                setStatus('✓ Saved successfully!', 'success');
            } else {
                setStatus('Save failed: ' + data.message, 'error');
            }
        } catch (e) {
            console.error('Save error:', e);
            setStatus('Failed to save.', 'error');
        }

        saveBtn.disabled = false;
    }

    // -----------------------------------------------------------------------
    // Status helper
    // -----------------------------------------------------------------------
    function setStatus(msg, type) {
        statusEl.textContent = msg;
        statusEl.className = 'ai-sheet-status' + (type ? ' ' + type : '');
    }

    // -----------------------------------------------------------------------
    // Event listeners
    // -----------------------------------------------------------------------
    sendBtn.addEventListener('click', sendAIInstruction);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendAIInstruction();
    });
    saveBtn.addEventListener('click', saveSheet);

    // Load the sheet!
    loadSheet();
});
