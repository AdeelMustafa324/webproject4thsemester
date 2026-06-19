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
import asyncio
import warnings
from typing import Optional, Union, List, Literal

warnings.filterwarnings('ignore', category=FutureWarning, module='google')

# pyrefly: ignore [missing-import]
from google import genai
# pyrefly: ignore [missing-import]
from google.genai import types as genai_types
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

from .ai_tools import TOOL_DECLARATIONS, TOOL_MAP


# ---------------------------------------------------------------------------
# API Key setup
# ---------------------------------------------------------------------------

def _load_api_keys() -> list:
    raw = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY', '')
    return [k.strip() for k in raw.split(',') if k.strip()]


_API_KEYS = _load_api_keys()
_current_key_idx = 0

if not _API_KEYS:
    print("WARNING: No Gemini API Key found. Set GEMINI_API_KEY in your .env file.")


def _get_active_api_key():
    return _API_KEYS[_current_key_idx] if _API_KEYS else None


def _rotate_api_key():
    global _current_key_idx
    if len(_API_KEYS) > 1:
        _current_key_idx = (_current_key_idx + 1) % len(_API_KEYS)
        print(f"[AI] Rotated to Gemini API key #{_current_key_idx + 1}/{len(_API_KEYS)}")


def _make_client():
    key = _get_active_api_key()
    if not key:
        raise RuntimeError("No Gemini API key configured. Set GEMINI_API_KEY in .env.")
    return genai.Client(api_key=key)


# ---------------------------------------------------------------------------
# Environment-based config
# ---------------------------------------------------------------------------

def _env_int(name, default, minimum=None, maximum=None):
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
GEMINI_MAX_INPUT_TOKENS = _env_int('GEMINI_MAX_INPUT_TOKENS', 32000, minimum=1000, maximum=1000000)
GEMINI_MAX_OUTPUT_TOKENS= _env_int('GEMINI_MAX_OUTPUT_TOKENS', 4096, minimum=64, maximum=65536)
GEMINI_MAX_TOOL_CALLS   = _env_int('GEMINI_MAX_TOOL_CALLS',   6,    minimum=0,  maximum=10)


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
AI Action: `execute_python(code="import pandas as pd\\ndf = pd.read_excel('sales.xlsx')\\ndf['Price'] = df['Price'] * 1.2\\ndf.to_excel('sales.xlsx', index=False)")`
AI Response: "I have successfully multiplied the Price column by 1.2 using a Python script."
-----------------------------------------
"""


def _build_tools():
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


async def execute_code_in_sandbox(code: str, workspace_id: str) -> dict:
    """
    Stub for secure Python execution in an isolated sandbox (e.g., E2B, Modal).
    TODO: Integrate third-party sandbox service here.
    """
    return {
        'status': 'error',
        'message': 'Security constraint: Raw Python execution is currently disabled pending sandbox integration.'
    }


async def _execute_tool_call(workspace_id, function_call):
    """Execute a tool function asynchronously and return the result dict."""
    name = function_call.name
    args = dict(function_call.args) if function_call.args else {}
    
    if name == 'execute_python':
        return await execute_code_in_sandbox(args.get('code', ''), workspace_id)
        
    func = TOOL_MAP.get(name)
    if func is None:
        return {'status': 'error', 'message': f'Unknown tool: {name}'}
    # Run the synchronous tool function in a separate thread
    return await asyncio.to_thread(func, workspace_id, **args)


def _friendly_error(error):
    message = str(error)
    if '404' in message and 'models/' in message:
        return (
            f'AI Error: Model "{GEMINI_MODEL}" not found. '
            'Set GEMINI_MODEL in .env to a valid model name like gemini-2.5-flash.'
        )
    if 'API key not valid' in message or 'API_KEY_INVALID' in message:
        return 'AI Error: Invalid Gemini API key. Check the GEMINI_API_KEY value in your .env file.'
    if 'PERMISSION_DENIED' in message:
        return 'AI Error: API key does not have permission to use this model. Check your Google AI Studio quota and billing settings.'
    return f'AI Error: {message}'


async def _trim_history_by_tokens(client, history):
    """
    Use native count_tokens to ensure history is within GEMINI_MAX_INPUT_TOKENS.
    Trims oldest turns iteratively if necessary, skipping system instruction.
    """
    if not history:
        return history
    
    while len(history) > 1:
        try:
            resp = await client.aio.models.count_tokens(
                model=GEMINI_MODEL,
                contents=history
            )
            if resp.total_tokens <= GEMINI_MAX_INPUT_TOKENS:
                break
            # Remove the oldest turn (usually index 0, or 0/1 if pairs of user/model)
            # Try to remove a user/model pair to keep history balanced
            if len(history) >= 2 and history[0]['role'] == 'user' and history[1]['role'] == 'model':
                history = history[2:]
            else:
                history.pop(0)
        except Exception as e:
            # If counting fails, fallback to keeping last 8
            print(f"Token counting failed: {e}")
            if len(history) > 8:
                history = history[-8:]
            break
    return history


# ---------------------------------------------------------------------------
# Main send_message (Stateless, Async, Token-aware)
# ---------------------------------------------------------------------------

async def send_message(messages_data: list, workspace_id: str, user_message: str):
    """
    messages_data: list of dicts [{'role': 'user'/'model', 'content': '...'}] from DB
    Returns a dict with 'status', 'response', 'file_actions' and internally manages tool calls asynchronously.
    """
    if not _API_KEYS:
        return {
            'status': 'error',
            'response': 'AI is not configured. Set GEMINI_API_KEY in your .env file.',
            'file_actions': [],
        }

    user_message = user_message.strip()

    history = []
    for msg in messages_data:
        content = msg.get('content', '').strip()
        if content:
            history.append({'role': msg.get('role'), 'parts': [{'text': content}]})

    # Add the current message
    history.append({'role': 'user', 'parts': [{'text': user_message}]})

    retries = len(_API_KEYS) if len(_API_KEYS) > 1 else 1
    file_actions = []

    for attempt in range(retries):
        try:
            client = _make_client()
            
            # Trim history to fit token limits
            history = await _trim_history_by_tokens(client, history)

            config = genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=_TOOLS,
                max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
                temperature=0.4,
            )

            iterations = 0

            while iterations < GEMINI_MAX_TOOL_CALLS:
                iterations += 1

                response = await client.aio.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=history,
                    config=config,
                )

                if not response.candidates:
                    break

                candidate = response.candidates[0]
                content = candidate.content

                if not content or not content.parts:
                    break

                has_tool_call = False
                for part in content.parts:
                    if part.function_call and part.function_call.name:
                        has_tool_call = True
                        fc = part.function_call

                        result = await _execute_tool_call(workspace_id, fc)

                        if fc.name in ('create_file', 'edit_file', 'append_to_file',
                                       'delete_file', 'add_row_to_csv', 'create_excel_file'):
                            file_actions.append({
                                'action': fc.name,
                                'filename': dict(fc.args).get('filename', '') if fc.args else '',
                            })

                        history.append({
                            'role': 'model',
                            'parts': [{'function_call': {'name': fc.name, 'args': dict(fc.args) if fc.args else {}}}]
                        })

                        history.append({
                            'role': 'user',
                            'parts': [{
                                'function_response': {
                                    'name': fc.name,
                                    'response': {'result': result},
                                }
                            }]
                        })
                        break

                if not has_tool_call:
                    text = ''
                    for part in content.parts:
                        if hasattr(part, 'text') and part.text:
                            text += part.text

                    if not text and iterations >= GEMINI_MAX_TOOL_CALLS:
                        text = 'I reached the tool-call limit. Try a smaller, more specific request.'

                    return {'status': 'ok', 'response': text, 'file_actions': file_actions}

            return {
                'status': 'ok',
                'response': 'I completed the requested operations.',
                'file_actions': file_actions,
            }

        except Exception as e:
            error_str = str(e)
            if '429' in error_str and attempt < retries - 1:
                _rotate_api_key()
                await asyncio.sleep(0.5)
                # Remove the newly added user message to avoid duplicate if we retry
                if history and history[-1].get('role') == 'user' and not hasattr(history[-1]['parts'][0], 'function_response'):
                    history.pop()
                continue
            return {'status': 'error', 'response': _friendly_error(e), 'file_actions': []}

    return {
        'status': 'error',
        'response': 'All API keys exhausted. Please try again later.',
        'file_actions': [],
    }


async def generate_content_with_retry(system_instruction, prompt):
    retries = max(len(_API_KEYS), 1)
    last_error = None
    for attempt in range(retries):
        try:
            client = _make_client()
            response = await client.aio.models.generate_content(
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
                await asyncio.sleep(0.5)
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

async def generate_sheet_ops(sheet_data, user_prompt):
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

            response = await client.aio.models.generate_content(
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

            parsed = response.parsed
            if parsed is not None:
                return {
                    'status': 'ok',
                    'operations': [op.model_dump() for op in parsed.operations],
                    'message': parsed.message,
                }

            if response.candidates:
                cand = response.candidates[0]
                finish = str(getattr(cand, 'finish_reason', ''))
                if 'MAX_TOKENS' in finish.upper():
                    return {
                        'status': 'error',
                        'message': 'Spreadsheet too large for one AI operation. Try a smaller instruction.',
                    }

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
                await asyncio.sleep(0.5)
                continue
            if ('500' in error_str or '503' in error_str) and attempt < retries - 1:
                await asyncio.sleep(1)
                continue
            break

    return {'status': 'error', 'message': f'AI error after {retries} attempt(s): {str(last_error)}'}
