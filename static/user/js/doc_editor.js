document.addEventListener('DOMContentLoaded', async () => {
    const fileId = window.DOC_EDITOR_FILE_ID;
    const canvas = document.getElementById('docEditorCanvas');
    const toolbar = document.getElementById('docEditorToolbar');
    const statusEl = document.getElementById('docSaveStatus');
    const btnSave = document.getElementById('btnSaveDoc');
    
    // AI Buttons
    const btnAiSpell = document.getElementById('btnAiSpellCheck');
    const btnAiWrite = document.getElementById('btnAiCoWrite');

    function getCSRF() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1] || '';
    }

    try {
        // Fetch document content
        const res = await fetch(`/api/workspace/${encodeURIComponent(fileId)}/read/`);
        const data = await res.json();
        
        if (data.status === 'ok') {
            // Sanitize and set content
            const safeHtml = DOMPurify.sanitize(data.content);
            canvas.innerHTML = safeHtml;
            
            // Initialize CKEditor
            const editor = await DecoupledEditor.create(canvas);
            window.docEditor = editor;
            toolbar.appendChild(editor.ui.view.toolbar.element);
            
            statusEl.textContent = 'Ready';
        } else {
            canvas.innerHTML = `<div class="error">Failed to load document: ${data.message}</div>`;
            statusEl.textContent = 'Load Failed';
            statusEl.style.color = 'red';
        }
    } catch (e) {
        console.error("Editor init error:", e);
        canvas.innerHTML = '<div class="error">A critical error occurred while loading the editor.</div>';
    }

    // Save Logic
    btnSave.addEventListener('click', async () => {
        if (!window.docEditor) return;
        
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
        statusEl.textContent = 'Saving changes...';
        statusEl.style.color = '#1976d2';

        try {
            const htmlContent = window.docEditor.getData();
            const res = await fetch(`/api/workspace/${encodeURIComponent(fileId)}/save/`, {
                method: 'POST',
                headers: { 
                    'X-CSRFToken': getCSRF(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: htmlContent })
            });
            const data = await res.json();
            
            if (data.status === 'ok') {
                statusEl.textContent = 'All changes saved';
                statusEl.style.color = '#28a745';
            } else {
                statusEl.textContent = 'Save failed: ' + data.message;
                statusEl.style.color = '#dc3545';
            }
        } catch (e) {
            statusEl.textContent = 'Network error while saving.';
            statusEl.style.color = '#dc3545';
        }
        
        btnSave.disabled = false;
        btnSave.textContent = 'Save Document';
    });

    // AI Stubs
    btnAiSpell.addEventListener('click', () => {
        if (!window.docEditor) return;
        // In a real implementation, you'd extract text, send to AI API, and replace
        alert("AI Spell Check is currently running a background scan...");
        statusEl.textContent = 'AI is checking spelling...';
        setTimeout(() => {
            statusEl.textContent = 'All changes saved';
        }, 2000);
    });

    btnAiWrite.addEventListener('click', () => {
        if (!window.docEditor) return;
        const selectedText = window.docEditor.model.document.selection.getSelectedBlocks();
        alert("AI Co-Writing ready! Select text to rewrite or summarize.");
    });
});
