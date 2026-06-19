document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    initFilters();
    initDelete();
    initEdit();
    initRename();
});

// -----------------------------------------------------------------------
// Upload
// -----------------------------------------------------------------------
function initUpload() {
    const dropArea = document.getElementById('workspaceDropArea');
    const fileInput = document.getElementById('workspaceFileInput');
    if (!dropArea || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropArea.addEventListener(evt, () => dropArea.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, () => dropArea.classList.remove('dragover'));
    });

    dropArea.addEventListener('drop', e => uploadFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', e => uploadFiles(e.target.files));
}

function uploadFiles(files) {
    const csrf = getCSRF();
    Array.from(files).forEach(file => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('csrfmiddlewaretoken', csrf);

        fetch('/api/upload/', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': csrf }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) location.reload();
        });
    });
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function getCSRF() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
}

function getModeForFilename(name) {
    if (!name) return 'text/plain';
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        'js': 'javascript', 'json': 'application/json',
        'css': 'css', 'html': 'htmlmixed', 'htm': 'htmlmixed',
        'xml': 'xml', 'py': 'python',
    };
    return map[ext] || 'text/plain';
}

function loadCKEditor() {
    return new Promise((resolve, reject) => {
        if (window.DecoupledEditor && window.DOMPurify) return resolve();
        let loadedCount = 0;
        const checkDone = () => {
            loadedCount++;
            if (loadedCount === 2) resolve();
        };

        if (!window.DOMPurify) {
            const dompurifyScript = document.createElement('script');
            dompurifyScript.src = '/static/libs/dompurify/purify.min.js';
            dompurifyScript.onload = checkDone;
            dompurifyScript.onerror = reject;
            document.head.appendChild(dompurifyScript);
        } else {
            checkDone();
        }

        if (!window.DecoupledEditor) {
            const ckScript = document.createElement('script');
            ckScript.src = '/static/libs/ckeditor/ckeditor.js';
            ckScript.onload = checkDone;
            ckScript.onerror = reject;
            document.head.appendChild(ckScript);
        } else {
            checkDone();
        }
    });
}

// -----------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------
function initFilters() {
    const chips = document.querySelectorAll('.filter-chip');
    const cards = document.querySelectorAll('.file-card');

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const filter = chip.dataset.filter;

            cards.forEach(card => {
                const source = card.dataset.source;
                const show = filter === 'all' || source === filter;
                card.classList.toggle('filtered-out', !show);
            });
        });
    });
}

// -----------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------
function initDelete() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (!confirm('Delete this file?')) return;

            fetch(`/api/workspace/${encodeURIComponent(id)}/delete/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRF() }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const card = document.querySelector(`.file-card[data-id="${id}"]`);
                    card.style.opacity = '0';
                    card.style.transform = 'translateX(-20px)';
                    setTimeout(() => card.remove(), 300);
                }
            })
            .catch(e => console.error('Delete error:', e));
        });
    });
}

// -----------------------------------------------------------------------
// Rename
// -----------------------------------------------------------------------
function initRename() {
    document.querySelectorAll('.btn-rename-ws').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const currentName = btn.dataset.name;
            const newName = prompt('Enter new filename:', currentName);
            
            if (!newName || newName.trim() === '' || newName === currentName) return;

            try {
                const res = await fetch(`/api/workspace/${encodeURIComponent(id)}/rename/`, {
                    method: 'POST',
                    headers: { 
                        'X-CSRFToken': getCSRF(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ new_name: newName.trim() })
                });
                const data = await res.json();
                if (data.status === 'ok') {
                    location.reload();
                } else {
                    alert('Rename failed: ' + data.message);
                }
            } catch (e) {
                console.error('Rename error:', e);
                alert('Failed to rename file.');
            }
        });
    });
}

// -----------------------------------------------------------------------
// Edit (CodeMirror)
// -----------------------------------------------------------------------
function initEdit() {
    const modal = document.getElementById('wsEditorModal');
    const titleEl = document.getElementById('wsEditorTitle');
    const cmContainer = document.getElementById('wsEditorCM');
    const statusEl = document.getElementById('wsEditorStatus');
    const btnCancel = document.getElementById('wsEditorCancel');
    const btnSave = document.getElementById('wsEditorSave');
    const btnClose = document.getElementById('wsEditorClose');
    
    if (!modal || !cmContainer) return;

    let editor = null;
    let currentFileId = null;

    function closeModal() {
        modal.style.display = 'none';
        if (editor) {
            editor.toTextArea();
            editor = null;
        }
        cmContainer.innerHTML = '';
        currentFileId = null;
        statusEl.textContent = '';
        btnSave.disabled = true;
    }

    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
        if (e.key === 'Escape' && docModal && docModal.style.display !== 'none') closeDocModal();
    });

    // Doc Editor Events
    const docModal = document.getElementById('wsDocEditorModal');
    const docBtnCancel = document.getElementById('wsDocEditorCancel');
    const docBtnSave = document.getElementById('wsDocEditorSave');
    const docBtnClose = document.getElementById('wsDocEditorClose');
    const docStatus = document.getElementById('wsDocEditorStatus');

    function closeDocModal() {
        if (docModal) docModal.style.display = 'none';
        currentFileId = null;
    }

    if (docBtnCancel) docBtnCancel.addEventListener('click', closeDocModal);
    if (docBtnClose) docBtnClose.addEventListener('click', closeDocModal);

    if (docModal) {
        docModal.addEventListener('click', (e) => {
            if (e.target === docModal) closeDocModal();
        });
    }

    document.querySelectorAll('.btn-edit-ws').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name || 'file';

            if (name.toLowerCase().endsWith('.csv') || name.toLowerCase().endsWith('.xlsx')) {
                const sheetName = id.startsWith('ai_') ? id.substring(3) : name;
                window.location.href = `/ai/sheet-editor/${encodeURIComponent(sheetName)}/`;
                return;
            }

            // If it's a docx or doc file, redirect to the new Full Screen Doc Editor
            if (name.toLowerCase().endsWith('.docx') || name.toLowerCase().endsWith('.doc')) {
                window.location.href = `/workspace/doc-editor/${encodeURIComponent(id)}/`;
                return;
            }

            currentFileId = id;
            
            titleEl.textContent = 'Loading...';
            statusEl.textContent = '';
            btnSave.disabled = true;
            modal.style.display = 'flex';

            // Create a temporary textarea for CodeMirror
            cmContainer.innerHTML = '';
            const ta = document.createElement('textarea');
            ta.id = 'wsEditorTA_tmp';
            ta.value = 'Loading file content...';
            cmContainer.appendChild(ta);

            editor = CodeMirror.fromTextArea(ta, {
                lineNumbers: true,
                theme: 'dracula',
                mode: getModeForFilename(name),
                lineWrapping: true,
                readOnly: true,
                tabSize: 4,
                indentWithTabs: false,
            });

            try {
                const res = await fetch(`/api/workspace/${encodeURIComponent(id)}/read/`);
                const data = await res.json();
                if (data.status === 'ok') {
                    titleEl.textContent = 'Editing: ' + data.filename;
                    editor.setValue(data.content || '');
                    editor.setOption('readOnly', false);
                    editor.setOption('mode', getModeForFilename(data.filename));
                    
                    // Enable save button immediately on successful load
                    btnSave.disabled = false;
                    btnSave.style.opacity = '1';
                    btnSave.style.cursor = 'pointer';

                    // Ensure it stays enabled if user types
                    editor.on('change', () => {
                        btnSave.disabled = false;
                        statusEl.textContent = 'Unsaved changes...';
                        statusEl.style.color = '#ff9800';
                    });

                    // Refresh so it renders correctly inside the modal
                    setTimeout(() => editor.refresh(), 50);
                } else {
                    titleEl.textContent = 'Error';
                    editor.setValue('Error: ' + data.message);
                }
            } catch (e) {
                console.error('Read error:', e);
                titleEl.textContent = 'Error';
                editor.setValue('Failed to load file content.');
            }
        });
    });

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            if (!currentFileId || !editor) return;
            
            btnSave.disabled = true;
            statusEl.textContent = 'Saving...';
            statusEl.style.color = '#1976d2';

            try {
                const res = await fetch(`/api/workspace/${encodeURIComponent(currentFileId)}/save/`, {
                    method: 'POST',
                    headers: { 
                        'X-CSRFToken': getCSRF(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: editor.getValue() })
                });
                const data = await res.json();
                if (data.status === 'ok') {
                    statusEl.textContent = '✓ Saved successfully!';
                    statusEl.style.color = '#28a745';
                    setTimeout(closeModal, 1200);
                } else {
                    statusEl.textContent = 'Error: ' + data.message;
                    statusEl.style.color = '#dc3545';
                    btnSave.disabled = false;
                }
            } catch (e) {
                console.error('Save error:', e);
                statusEl.textContent = 'Failed to save file.';
                statusEl.style.color = '#dc3545';
                btnSave.disabled = false;
            }
        });
    }
}
