# SkipStep Project Guidelines & Rules

The following 100+ rules dictate the architecture, design, and coding standards for the SkipStep AI Workspace project. 

## 1. General Architecture & Structure
1. **Separation of Concerns:** Keep business logic (AI parsing) separate from routing (views.py) and data models.
2. **App Modularity:** Maintain strict boundaries between `core_app`, `AI`, and future apps (e.g., `users`).
3. **MVT Pattern:** Strictly adhere to Django's Model-View-Template architecture.
4. **DRY Principle:** "Don't Repeat Yourself". Centralize common logic like file parsers and status helpers.
5. **KISS Principle:** "Keep It Simple, Stupid". Avoid over-engineering solutions, especially in the frontend DOM.
6. **YAGNI Principle:** "You Aren't Gonna Need It". Don't build cloud DB sync until the local version is 100% stable.
7. **Single Source of Truth:** The `.env` file is the only place API keys should live.
8. **Stateless APIs:** AI endpoints must remain stateless to support multi-user concurrency in the future.
9. **Environment Parity:** Ensure `requirements.txt` perfectly matches the active `venv`.
10. **Versioning:** Use semantic versioning for major feature releases.

## 2. Django Backend Standards
11. **Fat Models, Skinny Views:** Keep `views.py` clean by moving heavy data manipulation to utility files.
12. **CSRF Protection:** Always use `@csrf_protect` or `{% csrf_token %}` for state-changing requests.
13. **Require POST:** Use `@require_POST` decorators for endpoints that modify data (e.g., `/ai/api/save/`).
14. **JSON Responses:** All API endpoints must return strictly formatted JSON (`JsonResponse`).
15. **Error Handling:** Wrap all API routes in `try/except` blocks and return a standard `{"status": "error", "message": "..."}` format.
16. **Logging:** Use Python's built-in `logging` module instead of `print()` for production debugging.
17. **Path Security:** Sanitize all filenames before joining them to the workspace path to prevent Directory Traversal.
18. **Dependency Management:** Never install global pip packages; always activate the `venv` first.
19. **PEP 8 Compliance:** Follow standard Python formatting (4 spaces, max line length 120, standard docstrings).
20. **Admin Panel:** Register all new database models in `admin.py` for easy debugging.

## 3. AI Integration & Gemini API
21. **API Key Rotation:** The backend must dynamically cycle through multiple API keys to bypass rate limits.
22. **Dynamic Reloading:** Read the `.env` file dynamically so API key updates don't require a server restart.
23. **Function Calling Constraint:** The AI must *only* manipulate files using explicitly defined Python tools.
24. **JSON Output Enforcement:** The Sheet Editor AI must only ever return valid JSON. No conversational markdown.
25. **Safe Data Editing:** The AI is strictly forbidden from overwriting existing columns unless explicitly requested.
26. **Creative Dummy Data:** The AI must creatively generate realistic data rows when "dummy data" is requested.
27. **Token Optimization:** Trim the `chat.history` array continuously to prevent `Token Limit Exceeded` errors.
28. **Graceful Degradation:** If the AI fails, return a friendly, human-readable error to the frontend.
29. **Tool Response Turn:** Always ensure a `functionResponse` is sent immediately after a `functionCall` to prevent 400 errors.
30. **Orphaned Call Purging:** Actively `pop()` orphaned function calls from the chat history if a rate-limit crash occurs.

## 4. File Handling & Local Storage
31. **Sandbox Root:** All user files must be contained strictly within `C:/adeel/WEB/SkipStep/WORKSPACE/`.
32. **Path Validations:** Use `os.path.abspath` and `startswith` to verify files cannot escape the sandbox.
33. **Metadata Sidecars:** Save physical formatting data in `.meta.json` sidecar files to preserve CSV integrity.
34. **Excel Native Support:** Use `openpyxl` to actively generate `.xlsx` files when requested.
35. **Encoding:** Always open and save files using `encoding='utf-8'` to prevent unicode crashes.
36. **Atomic Saves:** Avoid partial saves; write to a temporary file and rename if necessary for large datasets.
37. **Folder Hierarchy:** Keep the workspace flat for now, but design APIs to support future subdirectories.
38. **File Size Limits:** Restrict AI file reads to `AI_MAX_FILE_READ_CHARS` to prevent context window overflow.
39. **File Write Limits:** Restrict AI file writes to `AI_MAX_FILE_WRITE_CHARS`.
40. **Deletion Safety:** Do not permanently delete files without explicit intent.

## 5. Frontend UI/UX & Aesthetics
41. **Premium Aesthetics:** Always strive for a modern, Google Workspace/Notion-like feel.
42. **Glassmorphism:** Use subtle blurs (`backdrop-filter`) and semi-transparent backgrounds for floating elements.
43. **Consistent Color Palette:** Stick to the predefined CSS variables for primary, secondary, and accent colors.
44. **Micro-animations:** Add `transition: all 0.2s ease;` to buttons and interactive elements.
45. **Responsive Design:** Ensure the workspace UI collapses gracefully on mobile devices.
46. **Feedback States:** Always show a loading spinner or status text ("🤖 AI is processing...") during async calls.
47. **Error States:** Display clear, color-coded (red) error messages when things fail.
48. **Success States:** Display clear, color-coded (green) success messages when saves complete.
49. **Typography:** Use modern, legible fonts (e.g., Inter, Roboto, or system fonts).
50. **Iconography:** Use consistent, scalable SVG icons (e.g., FontAwesome or Heroicons) for the toolbar.

## 6. Handsontable & Sheet Editor
51. **Custom Rendering:** Use a custom `TextRenderer` to support dynamic bold, italic, colors, and alignment.
52. **Header Preservation:** Treat the first row of CSV data strictly as headers in `initHandsontable`.
53. **Undo/Redo Native:** Bind custom Undo/Redo toolbar buttons to Handsontable's native history hooks.
54. **Toolbar Sync:** Use `afterSelection` to actively sync the toolbar's state to match the currently selected cell.
55. **Multi-cell Formatting:** Ensure formatting buttons loop through and apply changes to all cells in a selected range.
56. **Data Extraction:** When saving, extract headers and body data separately, then recombine them.
57. **Metadata Extraction:** Extract cell styles into a structured JSON map: `meta[row][col] = {styles}`.
58. **Metadata Injection:** Upon loading, loop through the metadata map and apply `hot.setCellMeta()`.
59. **AI Format Application:** Map AI `set_format` operations to `hot.setCellMeta` to paint styles programmatically.
60. **License Key:** Always include `licenseKey: 'non-commercial-and-evaluation'` to suppress console warnings.

## 7. JavaScript & DOM Manipulation
61. **Vanilla JS Priority:** Rely on Vanilla JavaScript (`document.getElementById`) instead of heavy wrappers like jQuery.
62. **Async/Await:** Use modern `async` / `await` syntax for all API fetch calls.
63. **Event Delegation:** Use event delegation for dynamically created elements (like file lists).
64. **Variable Scoping:** Use `const` and `let`. Never use `var`.
65. **Component Isolation:** Keep `ai_chat.js` logic completely separate from `sheet_editor.js` logic.
66. **Sanitize Inputs:** Prevent XSS by escaping HTML when rendering text directly to the DOM.
67. **Fetch Error Handling:** Always check `res.ok` or `data.status === 'ok'` before proceeding.
68. **DOM Caching:** Cache frequently accessed DOM elements at the top of the script.
69. **Debouncing:** Debounce rapid inputs (like dragging color pickers) to prevent performance lag.
70. **Console Cleansing:** Remove `console.log` statements before deploying to production.

## 8. Security & Environment Variables
71. **.env Exclusivity:** Never hardcode API keys or secret keys in source code.
72. **Gitignore:** Ensure `.env`, `venv/`, and `db.sqlite3` are strictly added to `.gitignore`.
73. **Debug Mode:** `DEBUG = True` must be disabled in a production environment.
74. **Allowed Hosts:** explicitly define `ALLOWED_HOSTS` in `settings.py`.
75. **CORS:** Restrict CORS origins if the frontend and backend are ever split.
76. **CSRF Tokens:** All `fetch` POST requests must include the `X-CSRFToken` header.
77. **Rate Limiting:** (Future) Implement backend rate-limiting per user to prevent API abuse.
78. **SQL Injection:** Always use Django's ORM to prevent raw SQL vulnerabilities.
79. **Input Validation:** Backend must validate all filenames (e.g., regex for valid extensions).
80. **Permissions:** (Future) Isolate workspaces by User ID using Django's `@login_required`.

## 9. Performance & Optimization
81. **Lazy Loading:** Load heavy libraries (like Handsontable) only on the pages that explicitly need them.
82. **CSS Minification:** Minify CSS for production deployment.
83. **Static Caching:** Use Django's `whitenoise` to serve static files efficiently in production.
84. **JSON Size Limits:** Cap the number of rows sent to the AI in `sheet_editor.js` to prevent huge payload crashes.
85. **Partial Re-rendering:** Only use `hot.render()` once at the end of a bulk AI operation block, not after every cell edit.
86. **CSV Parsing Efficiency:** The custom CSV parser must operate in `O(n)` time complexity.
87. **Memory Leaks:** Always call `hot.destroy()` before re-initializing a new Handsontable instance.
88. **Connection Pooling:** Ensure the Django DB uses connection pooling for scaling.
89. **Asynchronous Tasks:** (Future) Move long-running AI requests to Celery background workers.
90. **Image Optimization:** Compress all SVG and image assets used in the workspace UI.

## 10. Deployment & Future Scalability
91. **Database Migration:** Prepare to migrate from SQLite to PostgreSQL for production.
92. **Cloud Storage:** Prepare to swap the local `WORKSPACE` directory for AWS S3 or Google Cloud Storage via `django-storages`.
93. **Dockerization:** Containerize the Django app and Redis/Celery queues for easy deployment.
94. **CI/CD:** Implement GitHub Actions to run tests and linters before deployment.
95. **User Authentication:** Integrate Django Allauth for Google/Email signups.
96. **Stripe Integration:** Prepare the architecture to handle Stripe webhooks for premium tier API access.
97. **Model Flexibility:** Keep the AI engine abstract so it can swap between Gemini 2.5 Flash, Pro, or Claude 3.5.
98. **Websockets:** (Future) Implement Django Channels for real-time multiplayer sheet editing.
99. **Localization:** Keep hardcoded text out of templates to support future i18n translation.
100. **Continuous Iteration:** Always gather user feedback on AI hallucinations and refine the System Prompt accordingly.
