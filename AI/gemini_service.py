"""
gemini_service.py — Handles communication with Google Gemini API.

Uses the NEW google-genai SDK (google.genai) for ALL operations:
  - Chat sessions with function calling (replaces old google.generativeai)
  - Structured JSON output for sheet operations

API keys are loaded from os.environ, pre-populated by load_dotenv()
in settings.py. Supports comma-separated GEMINI_API_KEY for rotation.
"""

import os
import json
import time
import warnings
from typing import Optional, Union, List, Literal

# Suppress the FutureWarning from any leftover google.generativeai imports
warnings.filterwarnings('ignore', category=FutureWarning, module='google')

# pyrefly: ignore [missing-import]
from google import genai
# pyrefly: ignore [missing-import]
from google.genai import types as genai_types
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

from .ai_tools import TOOL_DECLARATIONS, TOOL_MAP


# ---------------------------------------------------------------------------
# API Key setup — reads from os.environ (load_dotenv already ran in settings)
# ---------------------------------------------------------------------------

def _load_api_keys() -> list:
    """Load API keys from environment. Supports comma-separated keys for rotation."""
    raw = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY', '')
    return [k.strip() for k in raw.split(',') if k.strip()]


_API_KEYS = _load_api_keys()
_current_key_idx = 0

if not _API_KEYS:
    print("WARNING: No Gemini API Key found. Set GEMINI_API_KEY in your .env file.")


def _get_active_api_key():
    """Return the currently active API key, or None if none configured."""
    return _API_KEYS[_current_key_idx] if _API_KEYS else None


def _rotate_api_key():
    """Rotate to next API key. Only useful when multiple keys are configured."""
    global _current_key_idx
    if len(_API_KEYS) > 1:
        _current_key_idx = (_current_key_idx + 1) % len(_API_KEYS)
        print(f"[AI] Rotated to Gemini API key #{_current_key_idx + 1}/{len(_API_KEYS)}")


def _make_client():
    """Create a new google.genai Client with the active API key."""
    key = _get_active_api_key()
    if not key:
        raise RuntimeError("No Gemini API key configured. Set GEMINI_API_KEY in .env.")
    return genai.Client(api_key=key)


# ---------------------------------------------------------------------------
# Environment-based config
# ---------------------------------------------------------------------------

def _env_int(name, default, minimum=None, maximum=None):
    """Read a bounded integer from the environment."""
    try:
        value = int(os.environ.get(name, default))
    except (TypeError, ValueError):
        value = default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


GEMINI_MODEL          = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
GEMINI_MAX_INPUT_CHARS  = _env_int('GEMINI_MAX_INPUT_CHARS',  8000,  minimum=1,  maximum=20000)
GEMINI_MAX_OUTPUT_TOKENS= _env_int('GEMINI_MAX_OUTPUT_TOKENS', 4096, minimum=64, maximum=65536)
GEMINI_MAX_TOOL_CALLS   = _env_int('GEMINI_MAX_TOOL_CALLS',   6,    minimum=0,  maximum=10)
GEMINI_MAX_HISTORY_ITEMS= _env_int('GEMINI_MAX_HISTORY_ITEMS', 8,   minimum=0,  maximum=30)


# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are **SkipStep AI**, an advanced data engineering assistant embedded inside the SkipStep workspace.

Your capabilities:
• Create, read, edit, append to, and delete text/CSV files in the user's workspace.
• Use the 'execute_python' tool to write robust pandas/openpyxl scripts to manipulate Excel or CSV files flawlessly.
• List files to understand what the user is working with.

Rules:
1. NEVER DELETE FILES TO EDIT THEM: If the user asks you to add a row to an existing file, DO NOT use `delete_file` and `create_excel_file`. Instead, use `append_to_excel_file` or `add_row_to_csv` directly. Recreating files destroys all existing data!
2. NO RAW GUESSING: If you need to make complex modifications (like editing specific cells or pivoting), use 'execute_python' to read the file, process it logically with pandas/openpyxl, and save the result.
3. If the user asks you to generate sample data, generate realistic, highly-detailed rows.
4. Always explain what you are doing. If you run a Python script, output a brief summary of what the script accomplished.
5. Python Execution Rules: Your code is run securely in the same directory as the user's files. Just `import pandas as pd`, do `df = pd.read_excel('file.xlsx')`, apply the edits, and `df.to_excel('file.xlsx', index=False)`.

--- FEW SHOT EXAMPLE FOR DATA EDITING ---
User: "Multiply all values in the 'Price' column of sales.xlsx by 1.2"
AI Action: `execute_python(code="import pandas as pd\ndf = pd.read_excel('sales.xlsx')\ndf['Price'] = df['Price'] * 1.2\ndf.to_excel('sales.xlsx', index=False)")`
AI Response: "I have successfully multiplied the Price column by 1.2 using a Python script."
-----------------------------------------
"""


# ---------------------------------------------------------------------------
# Tool declarations for the new SDK
# ---------------------------------------------------------------------------

def _build_tools():
    """Convert TOOL_DECLARATIONS to google.genai FunctionDeclaration objects."""
    declarations = []
    for decl in TOOL_DECLARATIONS:
        declarations.append(
            genai_types.FunctionDeclaration(
                name=decl['name'],
                description=decl['description'],
                parameters=decl.get('parameters'),
            )
        )
    return [genai_types.Tool(function_declarations=declarations)]


_TOOLS = _build_tools()


# ---------------------------------------------------------------------------
# In-memory chat history keyed by session_id
# New SDK uses a history list of Content objects (dicts are fine)
# ---------------------------------------------------------------------------

_chat_histories = {}  # session_id -> list of {"role": ..., "parts": [...]} dicts


def _get_history(session_id):
    """Return the mutable history list for a session."""
    if session_id not in _chat_histories:
        _chat_histories[session_id] = []
    return _chat_histories[session_id]


def _trim_history(session_id):
    """Keep only recent turns in memory."""
    history = _chat_histories.get(session_id)
    if history and GEMINI_MAX_HISTORY_ITEMS > 0 and len(history) > GEMINI_MAX_HISTORY_ITEMS:
        _chat_histories[session_id] = history[-GEMINI_MAX_HISTORY_ITEMS:]
    elif GEMINI_MAX_HISTORY_ITEMS <= 0:
        _chat_histories.pop(session_id, None)


def _execute_tool_call(workspace_id, function_call):
    """Execute a tool function and return the result dict."""
    name = function_call.name
    args = dict(function_call.args) if function_call.args else {}
    func = TOOL_MAP.get(name)
    if func is None:
        return {'status': 'error', 'message': f'Unknown tool: {name}'}
    return func(workspace_id, **args)


def _friendly_error(error):
    message = str(error)
    if '404' in message and 'models/' in message:
        return (
            f'AI Error: Model "{GEMINI_MODEL}" not found. '
            'Set GEMINI_MODEL in .env to a valid model name like gemini-2.5-flash.'
        )
    if 'API key not valid' in message or 'API_KEY_INVALID' in message:
        return (
            'AI Error: Invalid Gemini API key. '
            'Check the GEMINI_API_KEY value in your .env file.'
        )
    if 'PERMISSION_DENIED' in message:
        return (
            'AI Error: API key does not have permission to use this model. '
            'Check your Google AI Studio quota and billing settings.'
        )
    return f'AI Error: {message}'


# ---------------------------------------------------------------------------
# Main send_message (new SDK, stateless — history passed explicitly)
# ---------------------------------------------------------------------------

def send_message(history_key, workspace_id, user_message):
    """
    Send a message, handle tool calls in a loop, return final text + file_actions.
    Uses the new google.genai SDK with explicit history management.
    """
    if not _API_KEYS:
        return {
            'status': 'error',
            'response': 'AI is not configured. Set GEMINI_API_KEY in your .env file.',
            'file_actions': [],
        }

    user_message = user_message.strip()
    if len(user_message) > GEMINI_MAX_INPUT_CHARS:
        return {
            'status': 'error',
            'response': f'Message too long. Max {GEMINI_MAX_INPUT_CHARS} characters.',
            'file_actions': [],
        }

    history = _get_history(history_key)
    file_actions = []

    # Add user message to history
    history.append({'role': 'user', 'parts': [{'text': user_message}]})

    retries = len(_API_KEYS) if len(_API_KEYS) > 1 else 1

    for attempt in range(retries):
        try:
            client = _make_client()

            config = genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=_TOOLS,
                max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
                temperature=0.4,
            )

            # Tool-call loop
            iterations = 0
            current_history = list(history)  # copy so we can append within loop

            while iterations < GEMINI_MAX_TOOL_CALLS:
                iterations += 1

                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=current_history,
                    config=config,
                )

                # Extract the response candidate
                if not response.candidates:
                    break

                candidate = response.candidates[0]
                content = candidate.content

                if not content or not content.parts:
                    break

                # Check for function calls
                has_tool_call = False
                for part in content.parts:
                    if part.function_call and part.function_call.name:
                        has_tool_call = True
                        fc = part.function_call

                        # Execute the tool
                        result = _execute_tool_call(workspace_id, fc)

                        # Track file actions for the frontend
                        if fc.name in ('create_file', 'edit_file', 'append_to_file',
                                       'delete_file', 'add_row_to_csv', 'create_excel_file'):
                            file_actions.append({
                                'action': fc.name,
                                'filename': dict(fc.args).get('filename', '') if fc.args else '',
                            })

                        # Add model's tool call to history
                        current_history.append({
                            'role': 'model',
                            'parts': [{'function_call': {'name': fc.name, 'args': dict(fc.args) if fc.args else {}}}]
                        })

                        # Add tool result to history
                        current_history.append({
                            'role': 'user',
                            'parts': [{
                                'function_response': {
                                    'name': fc.name,
                                    'response': {'result': result},
                                }
                            }]
                        })
                        break  # process one tool call per iteration

                if not has_tool_call:
                    # No more tool calls — collect final text
                    text = ''
                    for part in content.parts:
                        if hasattr(part, 'text') and part.text:
                            text += part.text

                    # Persist the final model response to in-memory history
                    history.append({
                        'role': 'model',
                        'parts': [{'text': text}]
                    })
                    _trim_history(history_key)

                    if not text and iterations >= GEMINI_MAX_TOOL_CALLS:
                        text = 'I reached the tool-call limit. Try a smaller, more specific request.'

                    return {'status': 'ok', 'response': text, 'file_actions': file_actions}

            # Hit the tool call limit with no final text
            _trim_history(history_key)
            return {
                'status': 'ok',
                'response': 'I completed the requested operations.',
                'file_actions': file_actions,
            }

        except Exception as e:
            error_str = str(e)
            if '429' in error_str and attempt < retries - 1:
                _rotate_api_key()
                time.sleep(0.5)
                # Remove the user message we added so we don't duplicate it
                if history and history[-1].get('role') == 'user':
                    history.pop()
                continue
            # On unrecoverable error, remove the last user message to avoid corrupting history
            if history and history[-1].get('role') == 'user':
                history.pop()
            _trim_history(history_key)
            return {'status': 'error', 'response': _friendly_error(e), 'file_actions': []}

    return {
        'status': 'error',
        'response': 'All API keys exhausted. Please try again later.',
        'file_actions': [],
    }


def clear_session(session_id):
    """Clear in-memory chat history for a session."""
    _chat_histories.pop(session_id, None)


def rebuild_memory_history(session_id, messages_data):
    """
    Rebuild in-memory history from DB records.
    Strips out historical tool calls and trims context window safely.
    messages_data is a list of dicts: [{'role': 'user'/'model', 'content': '...'}]
    """
    if session_id in _chat_histories:
        return  # already loaded

    history = []
    total_chars = 0
    # Process newest messages first to ensure we keep the most recent context
    # using a safe threshold limit (e.g., 20,000 chars)
    limit = GEMINI_MAX_INPUT_CHARS * 2

    for msg in reversed(messages_data):
        content = msg.get('content', '').strip()
        # Only load standard text roles, explicitly stripping tool-call artifacts
        if not content:
            continue

        if total_chars + len(content) > limit:
            break

        total_chars += len(content)
        history.append({
            'role': msg.get('role'),
            'parts': [{'text': content}]
        })

    # Reverse back to chronological order for Gemini API
    history.reverse()
    _chat_histories[session_id] = history



def generate_content_with_retry(system_instruction, prompt):
    """Ad-hoc single generation (no tools, no history)."""
    retries = max(len(_API_KEYS), 1)
    last_error = None
    for attempt in range(retries):
        try:
            client = _make_client()
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
                ),
            )
            return response
        except Exception as e:
            last_error = e
            if '429' in str(e) and attempt < retries - 1:
                _rotate_api_key()
                time.sleep(0.5)
                continue
            raise
    raise last_error


# ---------------------------------------------------------------------------
# Structured-Output Sheet Operations (google.genai + Pydantic)
# ---------------------------------------------------------------------------




class SetCellOp(BaseModel):
    op: Literal['set_cell']
    row: int
    col: int
    value: Union[str, int, float]


class InsertRowOp(BaseModel):
    op: Literal['insert_row']
    after_row: int
    values: List[Union[str, int, float, None]]


class DeleteRowOp(BaseModel):
    op: Literal['delete_row']
    row: int


class InsertColOp(BaseModel):
    op: Literal['insert_col']
    after_col: int
    header: str
    values: List[Union[str, int, float, None]]


class DeleteColOp(BaseModel):
    op: Literal['delete_col']
    col: int


class FormatSpec(BaseModel):
    bgColor: Optional[str] = None
    textColor: Optional[str] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    align: Optional[Literal['left', 'center', 'right']] = None


class SetFormatOp(BaseModel):
    op: Literal['set_format']
    row: int
    col: int
    format: FormatSpec


class SheetOperationsResponse(BaseModel):
    operations: List[Union[SetCellOp, InsertRowOp, DeleteRowOp, InsertColOp, DeleteColOp, SetFormatOp]]
    message: str


_SHEET_SYSTEM_INSTRUCTION = """You are a strict spreadsheet operation engine for a Django backend.
Never use conversational filler. Output ONLY the structured data.

You receive a 2D array representing a spreadsheet and a natural language instruction.
Produce the minimal set of operations to fulfill the instruction.

SAFETY RULES:
1. DO NOT overwrite or delete existing data unless the user explicitly asks.
2. Use insert_col or insert_row for new data — never overwrite existing cells.
3. Only target exactly the cells/rows/columns specified. Leave all other data untouched.
4. Preserve leading zeros (phone numbers, IDs, zip codes) as strings.
5. If the user asks to add a column that already exists, add a new column beside it.
6. Headers are in row index 0. Data rows start at index 1.
7. NEVER rewrite the entire sheet cell-by-cell. Max 500 operations or abort.
"""


def generate_sheet_ops(sheet_data, user_prompt):
    """
    Call Gemini with a strict Pydantic schema for structured spreadsheet operations.
    Returns {'status': 'ok', 'operations': [...], 'message': '...'} or error dict.
    """
    if not _API_KEYS:
        return {'status': 'error', 'message': 'No Gemini API key configured. Set GEMINI_API_KEY in .env.'}

    retries = max(len(_API_KEYS), 1)
    last_error = None

    for attempt in range(retries):
        try:
            client = _make_client()

            contents = (
                f"Current sheet data (JSON):\n{json.dumps(sheet_data)}\n\n"
                f'User instruction: "{user_prompt}"\n\n'
                f"Produce the operations to fulfill this instruction exactly."
            )

            print(f"[AI] Sheet ops: model={GEMINI_MODEL}, rows={len(sheet_data)}")

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=_SHEET_SYSTEM_INSTRUCTION,
                    response_mime_type='application/json',
                    response_schema=SheetOperationsResponse,
                    temperature=0.1,
                    max_output_tokens=65536,
                    thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
                ),
            )

            # Primary: use parsed output
            parsed = response.parsed
            if parsed is not None:
                return {
                    'status': 'ok',
                    'operations': [op.model_dump() for op in parsed.operations],
                    'message': parsed.message,
                }

            # Check for truncation
            if response.candidates:
                cand = response.candidates[0]
                finish = str(getattr(cand, 'finish_reason', ''))
                if 'MAX_TOKENS' in finish.upper():
                    return {
                        'status': 'error',
                        'message': 'Spreadsheet too large for one AI operation. Try a smaller instruction.',
                    }

            # Fallback: parse text manually
            raw_text = getattr(response, 'text', '') or ''
            if raw_text:
                text = raw_text.strip()
                if text.startswith('```'):
                    text = text.split('\n', 1)[1] if '\n' in text else text[3:]
                if text.endswith('```'):
                    text = text[:-3]
                text = text.strip()
                try:
                    result = json.loads(text)
                    ops = result.get('operations', [])
                    return {
                        'status': 'ok',
                        'operations': ops,
                        'message': result.get('message', f'Applied {len(ops)} operation(s).'),
                    }
                except json.JSONDecodeError:
                    return {'status': 'error', 'message': 'AI returned incomplete data. Try a simpler instruction.'}

            reason = 'Unknown'
            if response.candidates:
                reason = str(getattr(response.candidates[0], 'finish_reason', 'Unknown'))
            return {'status': 'error', 'message': f'AI returned empty response (reason: {reason}).'}

        except Exception as e:
            last_error = e
            error_str = str(e)
            print(f"[AI] generate_sheet_ops attempt {attempt + 1}/{retries} failed: {error_str}")
            if '429' in error_str and attempt < retries - 1:
                _rotate_api_key()
                time.sleep(0.5)
                continue
            if ('500' in error_str or '503' in error_str) and attempt < retries - 1:
                time.sleep(1)
                continue
            break

    return {'status': 'error', 'message': f'AI error after {retries} attempt(s): {str(last_error)}'}
