import os
import requests
from dotenv import load_dotenv

load_dotenv()
MODEL = os.getenv("MODEL")
API_KEY = os.getenv("OPENROUTER_API_KEY")

url = "https://openrouter.ai/api/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

clauses = [
    {
        "id": 1,
        "text": "Either party may terminate this Agreement upon thirty (30) days' written notice."
    },
    {
        "id": 2,
        "text": "The Customer shall be liable for all losses, damages, claims, and expenses arising from its use of the Services, without limitation."
    },
    {
        "id": 3,
        "text": "This Agreement shall automatically renew for successive twelve-month periods unless Customer provides written notice of cancellation at least ninety (90) days before the expiration of the then-current term."
    },
    {
        "id": 4,
        "text": "Customer hereby assigns to Service Provider all right, title, and interest in any intellectual property developed by Customer in connection with the Services."
    },
    {
        "id": 5,
        "text": "The Service Provider may modify the terms of this Agreement at any time without obtaining the Customer's consent."
    }
]

prompt = """
You are Clare, an AI contract clause risk analyzer.

Analyze each contract clause independently.

For every clause return:

1. clause_id
2. risk_level: LOW, MEDIUM, or HIGH
3. risk_type
4. explanation
5. why_it_matters
6. recommendation

Do not invent facts that are not present in the clause.

Be conservative. A clause should only be marked HIGH when there is a significant contractual risk.

Return ONLY valid JSON in this format:

{
  "analyses": [
    {
      "clause_id": 1,
      "risk_level": "LOW",
      "risk_type": "...",
      "explanation": "...",
      "why_it_matters": "...",
      "recommendation": "..."
    }
  ]
}

Clauses to analyze:
"""

for clause in clauses:
    prompt += f"\n\nCLAUSE {clause['id']}:\n{clause['text']}"

data = {
    "model": MODEL,
    "messages": [
        {
            "role": "user",
            "content": prompt
        }
    ],
    "temperature": 0.2
}

response = requests.post(
    url,
    headers=headers,
    json=data
)

print(response.status_code)
print(response.json())