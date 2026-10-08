"""
AI Campus Guide — server-side proxy to Groq.

The Groq API key stays on the server. The model can request 3D-scene actions
(fly_to_building / highlight_buildings); those are validated here and returned
to the frontend as `actions`, which the browser applies to the scene.
"""
import json
import time
from collections import defaultdict, deque
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.core.security import get_current_user

router = APIRouter()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

VALID_BUILDINGS = [
    "R&D", "Canteen", "CAD Lab", "Examination Department", "S&H Block",
    "ECE", "CSE", "Mech & EEE", "Civil & IT",
    "Library", "Auditorium", "Suhruth University (Main Gate)", "Back Gate", "Security Room",
]

GUIDE_PROMPT = f"""You are the Suhruth Digital Twin AI Assistant, an interactive and highly intelligent campus guide.
Your job is to help users navigate the 3D campus map, find buildings, and understand the layout.

Here are the exact names of the buildings that exist on the map:
{", ".join(VALID_BUILDINGS)}

CRITICAL: You have access to tools that manipulate the user's 3D view:
1. fly_to_building(buildingName): Use this when a user asks where a SPECIFIC building is (e.g., "Where is the CAD lab?").
   IMPORTANT: You must pass one of the exact building names listed above! Do not make up building names. If the user asks for "3d design", you should map that to "CAD Lab".
2. highlight_buildings(categories): Use this when a user asks to see a TYPE of building (e.g., "Show me all Academic buildings"). Pass an empty array to clear highlights.

Whenever a user asks to find something, you MUST use the appropriate tool to show them, and then reply conversationally explaining what you are showing them. Be concise, friendly, and helpful."""

# Student personas live on the server so clients can't inject arbitrary system prompts.
STUDENT_PERSONAS = {
    "student_0": ("Alex", "Computer Science", "Always talking about hackathons and coding in the dark."),
    "student_1": ("Sam", "Mechanical Engineering", "Stressed about thermodynamics, drinks way too much coffee."),
    "student_2": ("Jordan", "Architecture", "Constantly admiring the campus buildings and sketching in a notebook."),
    "student_3": ("Casey", "Business", "Always pitching startup ideas to anyone who will listen."),
    "student_4": ("Taylor", "Arts", "Very chill, loves sitting in the garden."),
    "student_5": ("Sneha Reddy", "Civil Engineering", "Focused on structures and concrete mixtures, very practical."),
    "student_6": ("Karthik Nair", "Science & Humanities", "Philosophical and loves talking about quantum physics."),
    "student_7": ("Meera Joshi", "Computer Science", "Loves open source and is always looking for contributors."),
}

def _student_prompt(name: str, major: str, trait: str) -> str:
    return f"""You are {name}, a student majoring in {major} at Suhruth University.
Your defining personality trait is: {trait}.
You are currently walking around the campus. The user has just stopped to talk to you.
Respond completely in character as this student. Keep your answers relatively brief (1-2 sentences max), as you are busy walking around. Do not act like an AI assistant."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "fly_to_building",
            "description": "Flies the 3D camera to look at a specific building on the campus map.",
            "parameters": {
                "type": "object",
                "properties": {
                    "buildingName": {"type": "string", "description": "The exact name of the building to fly to (e.g., 'CAD Lab')"},
                },
                "required": ["buildingName"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "highlight_buildings",
            "description": "Makes buildings of specific categories glow brightly while dimming the rest of the campus. Pass an empty array to reset highlights.",
            "parameters": {
                "type": "object",
                "properties": {
                    "categories": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of building types to highlight (e.g., ['Academic'], ['Research', 'Facilities'], or [] to clear)",
                    },
                },
                "required": ["categories"],
            },
        },
    },
]

# ── Simple per-user rate limit (in-memory; fine for a single backend instance) ──
RATE_LIMIT = 20          # requests
RATE_WINDOW = 60.0       # seconds
_recent: dict = defaultdict(deque)

def _check_rate_limit(user_id: str):
    now = time.monotonic()
    q = _recent[user_id]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many AI requests. Please wait a minute.")
    q.append(now)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=2000)

class AIChatRequest(BaseModel):
    messages: List[ChatTurn] = Field(..., min_length=1, max_length=20)
    target: Optional[str] = None  # None = campus guide, otherwise a student persona id

class AIAction(BaseModel):
    name: Literal["fly_to_building", "highlight_buildings"]
    args: dict

class AIChatResponse(BaseModel):
    reply: str
    actions: List[AIAction] = []


def _groq(messages: list, use_tools: bool) -> dict:
    body = {"model": settings.GROQ_MODEL, "messages": messages, "temperature": 0.2}
    if use_tools:
        body["tools"] = TOOLS
    try:
        r = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json=body,
            timeout=30,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="AI service is unreachable.")
    if r.status_code != 200:
        print(f"[ai] Groq error {r.status_code}: {r.text[:300]}")
        raise HTTPException(status_code=502, detail="AI service returned an error.")
    return r.json()["choices"][0]["message"]


def _run_tool(name: str, raw_args: str, actions: list) -> str:
    try:
        args = json.loads(raw_args or "{}")
    except json.JSONDecodeError:
        return "Error: invalid arguments."
    if name == "fly_to_building":
        building = args.get("buildingName")
        if building not in VALID_BUILDINGS:
            return f"Error: unknown building '{building}'. Valid names: {', '.join(VALID_BUILDINGS)}"
        actions.append(AIAction(name=name, args={"buildingName": building}))
        return f"Successfully initiated camera flight to {building}."
    if name == "highlight_buildings":
        cats = args.get("categories", [])
        if not isinstance(cats, list):
            return "Error: categories must be an array."
        cats = [str(c)[:50] for c in cats[:10]]
        actions.append(AIAction(name=name, args={"categories": cats}))
        return f"Successfully highlighted buildings of categories: {', '.join(cats)}."
    return f"Error: unknown tool '{name}'."


@router.post("/chat", response_model=AIChatResponse, summary="Chat with the campus guide or a student persona")
def ai_chat(req: AIChatRequest, current: dict = Depends(get_current_user)):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI assistant is not configured (GROQ_API_KEY missing on server).")
    _check_rate_limit(current["sub"])

    if req.target is None:
        system, use_tools = GUIDE_PROMPT, True
    else:
        persona = STUDENT_PERSONAS.get(req.target)
        if not persona:
            raise HTTPException(status_code=404, detail="Unknown chat target.")
        system, use_tools = _student_prompt(*persona), False

    messages = [{"role": "system", "content": system}] + [m.model_dump() for m in req.messages]
    actions: List[AIAction] = []

    # Minimal ReAct loop: let the model call tools, feed results back, then get the final reply.
    for _ in range(3):
        msg = _groq(messages, use_tools)
        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return AIChatResponse(reply=msg.get("content") or "", actions=actions)
        messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": tool_calls})
        for call in tool_calls:
            fn = call.get("function", {})
            result = _run_tool(fn.get("name"), fn.get("arguments"), actions)
            messages.append({"role": "tool", "tool_call_id": call.get("id"), "content": result})

    final = _groq(messages, use_tools=False)
    return AIChatResponse(reply=final.get("content") or "", actions=actions)
