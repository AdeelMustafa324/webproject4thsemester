# SkipStep Project Rulebook & Troubleshooting Guide

This document contains critical project-specific rules, architectural decisions, and troubleshooting steps to avoid common pitfalls during development.

## 1. Document Conversion & `win32com`

### The Headless Word Problem
When converting legacy `.doc` files to `.docx` via `pywin32` (`win32com.client`), we use `Word.Application` in the background.
- **Rule:** Never assume `word.Quit()` or `doc.Close()` will execute without exceptions. When running headlessly, the COM server's RPC connection often drops prematurely as it shuts down, throwing a `pywintypes.com_error (-2147023170)`.
- **Solution:** Always wrap `doc.Close()` and `word.Quit()` in generic `try/except` blocks that safely `pass` and ignore the error. Verify success by checking if `os.path.exists(new_path)` rather than relying on an exception-free execution.

## 2. AI Context Awareness

### Active File Injection
The AI Chat widget (`ai_chat.js`) is globally accessible. By default, the AI does not know what page the user is on.
- **Rule:** For editor pages (Document Editor, Sheet Editor), the frontend MUST declare a global variable:
  ```html
  <script>window.SKIPSTEP_ACTIVE_FILE = "{{ filename|escapejs }}";</script>
  ```
- **How it works:** `ai_chat.js` intercepts this variable and automatically injects a `[System Context: ...]` string into the prompt payload. This allows the user to simply say "Add dates to this file" without specifying the filename.

## 3. Data Flow & Security

### Read-Modify-Write Cycles
When the AI modifies tabular data (CSV/Excel) or documents:
- **Rule:** Destructive updates or overwrites must be avoided unless the AI has read the full state first. 
- **Rule:** HTML payloads passed back from the client editor (like CKEditor) MUST be sanitized using `DOMPurify.sanitize()` before rendering, and XSS risks must be mitigated server-side.

## 4. Frontend Lazy Loading
- **Rule:** Heavy dependencies (like `ckeditor.js` or `handsontable.full.min.js`) should be lazy-loaded or strictly confined to their specific pages (`doc_editor.html`, `sheet_editor.html`). Avoid putting massive CDN scripts in `base.html` to keep the main application lightweight.
