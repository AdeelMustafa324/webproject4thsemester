import json
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Union, Literal, Optional
import os

key = None
with open('.env') as f:
    for line in f:
        if line.startswith('GEMINI_API_KEY='):
            key = line.split('=', 1)[1].strip()
            break

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


sheet_data = [
    ["Students", "Roll Number", "Date"],
    ["", "1", "2023-01-01"],
    ["Tabish Ahmad Faiz", "2", "2023-01-02"],
    ["", "3", "2023-01-03"],
    ["Zainab Shahid", "4", "2023-01-04"],
    ["", "5", "2023-01-05"],
    ["Safi Ullah", "6", "2023-01-06"],
    ["", "7", "2023-01-07"],
    ["Husnena", "8", "2023-01-08"],
]

user_prompt = "remove empty spaces date is coloms not in rows"

client = genai.Client(api_key=key)

system_instruction = """You are a strict spreadsheet operation engine for a Django backend.
Never use conversational filler. Output ONLY the structured data.

You receive a 2D array representing a spreadsheet and a natural language instruction.
Your job is to produce the minimal set of operations to fulfill the instruction.

SAFETY RULES:
1. DO NOT overwrite or delete existing data unless the user explicitly asks to remove it.
2. If adding new data, use insert_col or insert_row. Never overwrite existing cells.
3. Only target the exact cells, rows, or columns the user specified.
4. Preserve leading zeros in strings.
5. Headers are in row index 0. Data rows start at index 1.
"""

contents = f"""Current sheet data (JSON):
{json.dumps(sheet_data)}

User instruction: "{user_prompt}"

Produce the operations to fulfill this instruction exactly."""

print("Testing with gemini-2.5-flash-lite...")
try:
    response = client.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=contents,
        config={
            'system_instruction': system_instruction,
            'response_mime_type': 'application/json',
            'response_schema': SheetOperationsResponse,
            'temperature': 0.1,
            'max_output_tokens': 65536,
            'thinking_config': {'thinking_budget': 0},
        },
    )
    print('Parsed type:', type(response.parsed))
    if response.parsed is None:
        print('Parsed is none, finish reason:', getattr(response.candidates[0], 'finish_reason', 'none') if response.candidates else 'No candidates')
    else:
        print(f'Operations count: {len(response.parsed.operations)}')
    print('Usage metadata:', response.usage_metadata)
except Exception as e:
    import traceback
    print(f'ERROR: {type(e).__name__}: {e}')
    traceback.print_exc()

