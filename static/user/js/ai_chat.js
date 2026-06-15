/**
 * ai_chat.js — SkipStep AI Chat Popup Controller
 *
 * Features:
 *  - Persistent chat sessions (saved to DB via session_id)
 *  - History tab to browse and resume past sessions
 *  - New Chat button
 *  - File explorer tab
 *  - Quick-action chips
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // DOM refs
    // -----------------------------------------------------------------------
    const fab           = document.getElementById('aiFab');
    const chatContainer = document.getElementById('aiChatContainer');
    const messagesEl    = document.getElementById('aiChatMessages');
    const inputEl       = document.getElementById('aiChatInput');
    const sendBtn       = document.getElementById('aiChatSendBtn');
    const clearBtn      = document.getElementById('aiClearBtn');
    const closeBtn      = document.getElementById('aiCloseBtn');
    const newChatBtn    = document.getElementById('aiNewChatBtn');
    const modelSelect   = document.getElementById('aiModelSelect');
    const tabs          = document.querySelectorAll('.ai-chat-tab');
    const panels        = document.querySelectorAll('.ai-chat-panel');
    const fileListEl    = document.getElementById('aiFileList');
    const historyListEl = document.getElementById('aiHistoryList');
    const sessionTitleEl = document.getElementById('aiSessionTitle');

    if (!fab || !chatContainer) return;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let isOpen          = false;
    let isSending       = false;
    let currentSessionId = null;   // DB session ID (int), null = ephemeral
    const MAX_MESSAGE_CHARS = 2000;

    if (inputEl) inputEl.maxLength = MAX_MESSAGE_CHARS;

    // -----------------------------------------------------------------------
    // Initialization — create or load a session on open
    // -----------------------------------------------------------------------
    async function initSession() {
        // Create a fresh DB session automatically on first open
        try {
            const res = await fetch('/ai/api/sessions/new/', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'ok') {
                currentSessionId = data.session_id;
                updateSessionTitle(data.title);
            }
        } catch (_) {
            // Fall back to ephemeral (no session_id sent to API)
            currentSessionId = null;
        }
    }

    function updateSessionTitle(title) {
        if (sessionTitleEl) {
            sessionTitleEl.textContent = title || 'SkipStep AI';
        }
    }

    // -----------------------------------------------------------------------
    // Toggle chat
    // -----------------------------------------------------------------------
    fab.addEventListener('click', async () => {
        isOpen = !isOpen;
        chatContainer.classList.toggle('open', isOpen);
        fab.classList.toggle('active', isOpen);
        if (isOpen) {
            inputEl?.focus();
            // Create a session if we don't have one yet
            if (currentSessionId === null) {
                await initSession();
            }
        }
    });

    closeBtn?.addEventListener('click', () => {
        isOpen = false;
        chatContainer.classList.remove('open');
        fab.classList.remove('active');
    });

    // -----------------------------------------------------------------------
    // New Chat
    // -----------------------------------------------------------------------
    newChatBtn?.addEventListener('click', async () => {
        // Clear the messages panel
        messagesEl.innerHTML = buildWelcomeHTML();
        // Clear the in-memory Gemini context for old session
        if (currentSessionId) {
            try {
                await fetch('/ai/api/clear/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: currentSessionId }),
                });
            } catch (_) {}
        }
        // Create a new DB session
        currentSessionId = null;
        await initSession();
        // Rebind chips after rebuilding welcome
        bindChips();
        switchTab('aiMessagesPanel');
    });

    // -----------------------------------------------------------------------
    // Model Switcher
    // -----------------------------------------------------------------------
    if (modelSelect) {
        modelSelect.addEventListener('change', async (e) => {
            const selectedModel = e.target.value;
            try {
                const res = await fetch('/ai/api/switch-model/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedModel })
                });
                const data = await res.json();
                if (data.status === 'ok') {
                    appendSystemMessage(`Model successfully switched to ${selectedModel}.`);
                } else {
                    appendSystemMessage(`Failed to switch model: ${data.response}`);
                }
            } catch (err) {
                appendSystemMessage('Network error while switching model.');
            }
        });
    }

    function appendSystemMessage(text) {
        const d = document.createElement('div');
        d.className = 'ai-msg ai-sys';
        d.style.textAlign = 'center';
        d.style.color = '#888';
        d.style.fontSize = '0.75rem';
        d.style.margin = '8px 0';
        d.textContent = text;
        messagesEl.appendChild(d);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // -----------------------------------------------------------------------
    // Tabs
    // -----------------------------------------------------------------------
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            switchTab(target);
        });
    });

    function switchTab(tabId) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        panels.forEach(p => p.classList.toggle('active', p.id === tabId));
        if (tabId === 'aiFilesPanel') refreshFileList();
        if (tabId === 'aiHistoryPanel') refreshHistoryList();
    }

    // -----------------------------------------------------------------------
    // Quick-action chips (delegated — works after DOM rebuild)
    // -----------------------------------------------------------------------
    function bindChips() {
        document.querySelectorAll('.ai-chat-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (inputEl) {
                    inputEl.value = chip.textContent.trim();
                    handleSend();
                }
            });
        });
    }
    bindChips();

    // -----------------------------------------------------------------------
    // Send message
    // -----------------------------------------------------------------------
    sendBtn?.addEventListener('click', handleSend);

    inputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-resize textarea
    inputEl?.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    });

    async function handleSend() {
        const text = inputEl.value.trim();
        if (!text || isSending) return;
        if (text.length > MAX_MESSAGE_CHARS) {
            appendMessage('bot', `Message is too long. Please keep it under ${MAX_MESSAGE_CHARS} characters.`);
            return;
        }

        // Remove welcome screen on first message
        const welcome = messagesEl.querySelector('.ai-chat-welcome');
        if (welcome) welcome.remove();

        appendMessage('user', text);
        inputEl.value = '';
        inputEl.style.height = 'auto';
        isSending = true;
        sendBtn.disabled = true;

        const typingEl = showTyping();

        try {
            const payload = { message: text };
            if (currentSessionId) payload.session_id = currentSessionId;
            if (window.SKIPSTEP_ACTIVE_FILE) payload.active_file = window.SKIPSTEP_ACTIVE_FILE;

            const res = await fetch('/ai/api/chat/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            typingEl.remove();

            if (data.status === 'ok') {
                appendMessage('bot', data.response, data.file_actions);
                // Update the session title in the header if it changed
                if (currentSessionId) {
                    refreshCurrentSessionTitle();
                }
            } else if (data.status === 'error' && data.login_url) {
                // Not authenticated
                appendMessage('bot', data.response || 'Please log in to use SkipStep AI.');
            } else {
                appendMessage('bot', data.response || 'Something went wrong.');
            }
        } catch (err) {
            typingEl.remove();
            appendMessage('bot', 'Network error — please try again.');
        }

        isSending = false;
        sendBtn.disabled = false;
    }

    async function refreshCurrentSessionTitle() {
        if (!currentSessionId) return;
        try {
            const res = await fetch(`/ai/api/session/${currentSessionId}/`);
            const data = await res.json();
            if (data.status === 'ok') {
                updateSessionTitle(data.title);
            }
        } catch (_) {}
    }

    // -----------------------------------------------------------------------
    // Clear chat (resets in-memory Gemini context, not DB records)
    // -----------------------------------------------------------------------
    clearBtn?.addEventListener('click', async () => {
        try {
            const payload = currentSessionId ? { session_id: currentSessionId } : {};
            await fetch('/ai/api/clear/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (_) { /* swallow */ }
        messagesEl.innerHTML = buildWelcomeHTML();
        bindChips();
    });

    // -----------------------------------------------------------------------
    // History Panel
    // -----------------------------------------------------------------------
    async function refreshHistoryList() {
        if (!historyListEl) return;
        historyListEl.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">Loading...</p>';
        try {
            const res = await fetch('/ai/api/sessions/');
            const data = await res.json();

            if (data.status === 'ok' && data.sessions.length > 0) {
                historyListEl.innerHTML = '<ul class="ai-history-list">' +
                    data.sessions.map(s => `
                        <li class="ai-history-item" data-id="${s.id}">
                            <div class="ai-history-info">
                                <div class="ai-history-title">${escapeHtml(s.title)}</div>
                                <div class="ai-history-date">${formatDate(s.updated_at)}</div>
                            </div>
                            <div class="ai-history-actions">
                                <button class="ai-history-load-btn" data-id="${s.id}" title="Resume session">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                                <button class="ai-history-delete-btn" data-id="${s.id}" title="Delete session">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                                </button>
                            </div>
                        </li>`).join('') +
                    '</ul>';

                // Load session
                historyListEl.querySelectorAll('.ai-history-load-btn').forEach(btn => {
                    btn.addEventListener('click', () => loadSession(parseInt(btn.dataset.id)));
                });

                // Delete session
                historyListEl.querySelectorAll('.ai-history-delete-btn').forEach(btn => {
                    btn.addEventListener('click', () => deleteSession(parseInt(btn.dataset.id), btn));
                });
            } else {
                historyListEl.innerHTML = `
                    <div class="ai-files-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <p>No chat history yet.<br>Start a conversation!</p>
                    </div>`;
            }
        } catch (_) {
            historyListEl.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Could not load history.</p>';
        }
    }

    async function loadSession(sessionId) {
        try {
            const res = await fetch(`/ai/api/session/${sessionId}/`);
            const data = await res.json();
            if (data.status !== 'ok') return;

            // Set current session
            currentSessionId = sessionId;
            updateSessionTitle(data.title);

            // Render messages
            messagesEl.innerHTML = '';
            if (data.messages.length === 0) {
                messagesEl.innerHTML = buildWelcomeHTML();
                bindChips();
            } else {
                data.messages.forEach(m => {
                    appendMessage(m.role === 'user' ? 'user' : 'bot', m.content, m.file_actions);
                });
            }

            // Switch to chat tab
            switchTab('aiMessagesPanel');
        } catch (_) {
            appendMessage('bot', 'Could not load session. Please try again.');
        }
    }

    async function deleteSession(sessionId, btn) {
        if (!confirm('Delete this chat session? This cannot be undone.')) return;
        try {
            const res = await fetch(`/ai/api/session/${sessionId}/delete/`, { method: 'POST' });
            const data = await res.json();
            if (data.status === 'ok') {
                // If deleting the current session, start fresh
                if (currentSessionId === sessionId) {
                    currentSessionId = null;
                    messagesEl.innerHTML = buildWelcomeHTML();
                    bindChips();
                    updateSessionTitle('SkipStep AI');
                    await initSession();
                }
                refreshHistoryList();
            }
        } catch (_) {}
    }

    function formatDate(isoString) {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------
    function appendMessage(role, text, fileActions) {
        const div = document.createElement('div');
        div.className = `ai-msg ai-msg--${role}`;

        if (role === 'bot') {
            div.innerHTML = formatBotText(text);
        } else {
            div.textContent = text;
        }

        // Show file action badges
        if (fileActions && fileActions.length > 0) {
            fileActions.forEach(fa => {
                const badge = document.createElement('button');
                badge.className = 'ai-file-badge';
                badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${escapeHtml(fa.action.replace(/_/g, ' '))}: ${escapeHtml(fa.filename)}`;
                badge.style.cursor = 'pointer';
                badge.onclick = () => openAiFileEditor(fa.filename);
                div.appendChild(badge);
            });
        }

        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
        const el = document.createElement('div');
        el.className = 'ai-typing';
        el.innerHTML = '<div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div>';
        messagesEl.appendChild(el);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return el;
    }

    function formatBotText(text) {
        if (!text) return '';
        let html = escapeHtml(text);
        // Code blocks: ```...```
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Inline code: `...`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold: **...**
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Bullet points: lines starting with •
        html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        // Sanitize output
        if (window.DOMPurify) {
            html = window.DOMPurify.sanitize(html);
        }
        return html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // -----------------------------------------------------------------------
    // File explorer
    // -----------------------------------------------------------------------
    async function refreshFileList() {
        try {
            const res = await fetch('/ai/api/files/');
            const data = await res.json();

            if (data.status === 'ok' && data.files.length > 0) {
                fileListEl.innerHTML = '<ul class="ai-file-list">' +
                    data.files.map(f => `
                        <li class="ai-file-item">
                            <div class="ai-file-info">
                                <div class="ai-file-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <div>
                                    <div class="ai-file-name">${escapeHtml(f.name)}</div>
                                    <div class="ai-file-size">${formatBytes(f.size_bytes)}</div>
                                </div>
                            </div>
                            <div class="ai-file-actions">
                                <button type="button" class="ai-file-edit-btn" data-filename="${escapeHtml(f.name)}" title="Edit">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <a href="/ai/api/download/${encodeURIComponent(f.name)}/" title="Download">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </a>
                            </div>
                        </li>`).join('') +
                    '</ul>';

                document.querySelectorAll('.ai-file-edit-btn').forEach(btn => {
                    btn.addEventListener('click', () => openAiFileEditor(btn.dataset.filename));
                });
            } else {
                fileListEl.innerHTML = `
                    <div class="ai-files-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <p>No files yet.<br>Ask the AI to create or generate files!</p>
                    </div>`;
            }
        } catch (_) {
            fileListEl.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Could not load files.</p>';
        }
    }

    window.refreshAiFileList = refreshFileList;

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // -----------------------------------------------------------------------
    // File Editor
    // -----------------------------------------------------------------------
    window.openAiFileEditor = async function(filename) {
        if (!isOpen) {
            isOpen = true;
            chatContainer.classList.add('open');
            fab.classList.add('active');
        }

        switchTab('aiFilesPanel');

        fileListEl.innerHTML = `
        <div class="ai-editor-container">
            <div class="ai-editor-header">
                <h4 title="${escapeHtml(filename)}">Editing: ${escapeHtml(filename)}</h4>
                <div class="ai-editor-actions">
                    <button id="aiEditorSaveBtn" class="ai-chat-chip" style="background:#28a745; color:white; border:none;">Save</button>
                    <button id="aiEditorCancelBtn" class="ai-chat-chip">Cancel</button>
                </div>
            </div>
            <textarea id="aiEditorTextarea" class="ai-editor-textarea" disabled>Loading...</textarea>
            <div id="aiEditorStatus" class="ai-editor-status"></div>
        </div>`;

        const textarea = document.getElementById('aiEditorTextarea');
        const saveBtn  = document.getElementById('aiEditorSaveBtn');
        const cancelBtn = document.getElementById('aiEditorCancelBtn');
        const statusEl = document.getElementById('aiEditorStatus');

        cancelBtn.onclick = () => refreshFileList();

        try {
            const res = await fetch(`/ai/api/read/${encodeURIComponent(filename)}/`);
            const data = await res.json();
            if (data.status === 'ok') {
                textarea.value = data.content;
                textarea.disabled = false;
            } else {
                textarea.value = `Error: ${data.message}`;
            }
        } catch (e) {
            textarea.value = 'Failed to load file.';
        }

        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            statusEl.textContent = 'Saving...';
            try {
                const res = await fetch(`/ai/api/save/${encodeURIComponent(filename)}/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: textarea.value })
                });
                const data = await res.json();
                if (data.status === 'ok') {
                    statusEl.textContent = 'Saved successfully!';
                    statusEl.style.color = 'green';
                    setTimeout(() => refreshFileList(), 1500);
                } else {
                    statusEl.textContent = `Error: ${data.message}`;
                    statusEl.style.color = 'red';
                }
            } catch (e) {
                statusEl.textContent = 'Failed to save.';
                statusEl.style.color = 'red';
            }
            saveBtn.disabled = false;
        };
    };

    // -----------------------------------------------------------------------
    // Welcome HTML
    // -----------------------------------------------------------------------
    function buildWelcomeHTML() {
        return `
        <div class="ai-chat-welcome">
            <div class="ai-chat-welcome-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>
            </div>
            <h4>SkipStep AI</h4>
            <p>I can create, read, edit, and manage your files. Ask me anything!</p>
            <div class="ai-chat-chips">
                <button class="ai-chat-chip">Create a spreadsheet</button>
                <button class="ai-chat-chip">List my files</button>
                <button class="ai-chat-chip">Write a report</button>
                <button class="ai-chat-chip">Help me edit a file</button>
            </div>
        </div>`;
    }
})();
