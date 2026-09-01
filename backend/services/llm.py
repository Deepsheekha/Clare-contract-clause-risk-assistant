import os
import httpx
from dotenv import load_dotenv


load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

MODEL = "nvidia/nemotron-3-ultra"


async def analyze_contract(
    concern,
    clauses
):

    clause_text = "\n\n".join(
        f"""
SECTION {clause['section']}
PAGE {clause['page']}
{clause['text']}
"""
        for clause in clauses
    )

    prompt = f"""
You are Clare, an AI contract risk analysis assistant.

Analyze the following contract clauses.

USER'S CONCERN:
{concern if concern else "Identify all significant risks for the customer."}

CONTRACT CLAUSES:
{clause_text}

For every significant risk, provide:

1. Risk level: HIGH, MEDIUM, or LOW
2. Clause number
3. Clause title
4. What the clause says
5. Why it is risky for the customer
6. Recommended negotiation/change

Do not invent contract terms.
Only identify risks supported by the provided clauses.

Return the result as valid JSON in this format:

{{
    "summary": "short overall assessment",
    "risks": [
        {{
            "risk_level": "HIGH",
            "section": "10.2",
            "title": "Customer Liability",
            "explanation": "...",
            "recommendation": "..."
        }}
    ]
}}
"""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.1
    }

    async with httpx.AsyncClient(timeout=120) as client:

        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload
        )

        response.raise_for_status()

        data = response.json()

        return data["choices"][0]["message"]["content"]