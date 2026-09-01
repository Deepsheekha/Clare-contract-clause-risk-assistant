import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = os.getenv("MODEL")

URL = "https://openrouter.ai/api/v1/chat/completions"


def ask_model(prompt: str) -> str:

    # --------------------------------------------------
    # Check configuration
    # --------------------------------------------------

    if not API_KEY:
        raise RuntimeError(
            "OPENROUTER_API_KEY is missing from .env"
        )

    if not MODEL:
        raise RuntimeError(
            "MODEL is missing from .env"
        )

    # --------------------------------------------------
    # Headers
    # --------------------------------------------------

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Clare Contract Risk Assistant",
    }

    # --------------------------------------------------
    # Request body
    # --------------------------------------------------

    data = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Clare, a contract risk analysis assistant. "
                    "Return ONLY the final answer requested by the user. "
                    "Never output chain-of-thought, internal reasoning, "
                    "planning, self-critique, analysis steps, or draft reasoning. "
                    "Do not write phrases such as 'thinking process', "
                    "'Analyze User Request', 'Examine Provided Contract Clauses', "
                    "'Let's analyze', or 'I need to evaluate'. "
                    "Start directly with the final Clare Contract Risk Analysis."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        "temperature": 0.1,
        "max_tokens": 2500,
        "reasoning": {
            "max_tokens": 0,
        },
    }

    # --------------------------------------------------
    # Send request
    # --------------------------------------------------

    try:

        response = requests.post(
            URL,
            headers=headers,
            json=data,
            timeout=45,
        )

    except requests.exceptions.Timeout:

        raise RuntimeError(
            "OpenRouter request timed out."
        )

    except requests.exceptions.RequestException as e:

        raise RuntimeError(
            f"Could not connect to OpenRouter: {str(e)}"
        )

    # --------------------------------------------------
    # Parse response
    # --------------------------------------------------

    try:
        result = response.json()

    except ValueError:

        raise RuntimeError(
            f"OpenRouter returned invalid JSON. "
            f"HTTP {response.status_code}: "
            f"{response.text[:500]}"
        )

    # --------------------------------------------------
    # Handle API errors
    # --------------------------------------------------

    if response.status_code != 200:

        error_message = result.get(
            "error",
            {}
        )

        if isinstance(error_message, dict):

            message = error_message.get(
                "message",
                "Unknown OpenRouter error"
            )

        else:

            message = str(error_message)

        raise RuntimeError(
            f"OpenRouter API error "
            f"(HTTP {response.status_code}): "
            f"{message}"
        )

    # --------------------------------------------------
    # Validate response
    # --------------------------------------------------

    if "choices" not in result:

        raise RuntimeError(
            "OpenRouter response did not contain "
            f"'choices'. Full response: {result}"
        )

    if not result["choices"]:

        raise RuntimeError(
            "OpenRouter returned an empty choices list."
        )

    # --------------------------------------------------
    # Extract model response
    # --------------------------------------------------

    message = result["choices"][0].get(
        "message",
        {}
    )

    content = message.get("content")

    if content is None:

        raise RuntimeError(
            "OpenRouter returned no message content. "
            f"Response: {result}"
        )

    # --------------------------------------------------
    # Defensive response cleanup
    # --------------------------------------------------

    content = content.strip()

    target_heading = "# Clare Contract Risk Analysis"
    if target_heading in content:
        heading_index = content.find(target_heading)
        content = content[heading_index:].strip()

    return content


# ------------------------------------------------------
# TEST
# ------------------------------------------------------

if __name__ == "__main__":

    result = ask_model(
        "Explain this contract clause in one sentence: "
        "'Either party may terminate this agreement with "
        "30 days written notice.'"
    )

    print(result)