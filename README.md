# Clare – AI-Powered Contract Clause Risk Analysis Assistant

Clare helps non-legal users quickly identify risky clauses in contracts. It extracts text from a PDF, detects relevant clauses, sends a focused subset to a large language model, and returns a structured risk report with evidence and negotiation recommendations — all from the customer's perspective.

The name "Clare" was inspired by "clarity", reflecting its goal of bringing clear insight to complex contract language.

---

## Problem Statement

Contracts are lengthy, densely worded, and often written to favour the drafter. Important obligations, liabilities, auto-renewals, and unfavourable terms are easy to miss — especially for non-legal readers. By the time a problematic clause is discovered, it may already be binding. Clare is designed to surface these risks before they become a problem.

---

## Solution

Clare accepts a PDF contract upload, extracts all readable text, and identifies individual clauses by section number and title. It then filters the full clause set down to a smaller group of potentially risk-relevant clauses using keyword matching, keeping LLM input compact and processing time low. The selected clauses are sent to an LLM via OpenRouter, which analyses each one from the customer's perspective and returns a structured markdown report covering risk level, explanation, supporting evidence, and a negotiation recommendation.

---

## Features

- Upload a PDF contract through the browser
- Automatic text extraction from PDF pages
- Clause detection and segmentation by section number and title
- Keyword-based filtering to select risk-relevant clauses
- LLM analysis via OpenRouter (NVIDIA Nemotron 3.5 Lightning, free tier)
- Risk classification: **HIGH**, **MEDIUM**, or **LOW** per clause
- Structured output per finding: Why it is risky, Evidence, Negotiate
- Risk Summary table and disclaimer appended to every report
- Optional free-text concern field to focus the analysis (with preset shortcuts)
- Markdown rendered result cards in the browser
- Copy-to-clipboard for the full analysis output

---

## How It Works

```
PDF Upload
  → PDF Text Extraction      (PyMuPDF, page by page)
  → Clause Detection         (regex-based section numbering)
  → Risk-Relevant Filtering  (keyword match, capped at 15 clauses)
  → LLM Analysis             (OpenRouter → NVIDIA Nemotron 3.5 Lightning)
  → Structured Risk Report   (markdown rendered in the browser)
```

| Step | What happens |
|---|---|
| **PDF Upload** | User uploads a contract PDF through the React frontend |
| **Text Extraction** | PyMuPDF reads each page and returns plain text |
| **Clause Detection** | `chunking.py` splits text into clauses using section-number patterns (e.g. `4.3`, `10.1`) |
| **Risk Filtering** | A keyword list (termination, liability, indemnity, interest, fee, etc.) selects up to 15 candidate clauses |
| **LLM Analysis** | The filtered clause set and optional user concern are sent to the model via OpenRouter |
| **Risk Report** | The model returns a markdown report; the frontend parses and renders it as cards with a Risk Summary table |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Python, FastAPI, Uvicorn |
| PDF extraction | PyMuPDF (`pymupdf`) |
| LLM gateway | OpenRouter API |
| LLM model | NVIDIA Nemotron 3.5 Lightning (`nvidia/nemotron-3.5-lightning:free`) |
| Frontend framework | React 19, Vite 8 |
| Frontend UI libraries | lucide-react, react-markdown, remark-gfm |
| Environment config | python-dotenv |

---

## Project Structure

```
Clare-contract-clause-risk-assistant/
├── backend/
│   ├── chunking.py          # Regex-based clause detection and segmentation
│   ├── main.py              # FastAPI app and all API endpoints
│   ├── model.py             # OpenRouter API client
│   ├── model_test.py        # Standalone LLM integration test script
│   ├── prompts.py           # RISK_PROMPT and REVIEW_PROMPT templates
│   ├── models/
│   │   └── clause.py        # (placeholder)
│   └── services/
│       ├── llm.py           # (experimental, not wired into main pipeline)
│       ├── pdf.py           # (placeholder)
│       └── rag.py           # (experimental, not wired into main pipeline)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── droplet.jpeg
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── App.jsx          # Main application component
│       ├── App.css
│       ├── index.css
│       └── main.jsx
├── .env                     # API key and model config (not committed)
├── .gitignore
└── README.md
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai/) account and API key

---

### 1. Clone the repository

```powershell
git clone https://github.com/your-username/Clare-contract-clause-risk-assistant.git
cd Clare-contract-clause-risk-assistant
```

---

### 2. Create and activate the Python virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

---

### 3. Install Python dependencies

```powershell
pip install fastapi uvicorn pymupdf python-dotenv requests
```

---

### 4. Configure environment variables

Create a `.env` file in the project root:

```
OPENROUTER_API_KEY=your_api_key_here
MODEL=nvidia/nemotron-3.5-lightning:free
```

> **Important:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

### 5. Start the backend

```powershell
uvicorn backend.main:app --reload
```

The backend runs at: **http://127.0.0.1:8000**

---

### 6. Install frontend dependencies

```powershell
cd frontend
npm install
```

---

### 7. Start the frontend

```powershell
npm run dev
```

The frontend runs at: **http://localhost:5173** (Vite default)

Open that URL in your browser and upload a contract PDF.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check — confirms Clare is running |
| `POST` | `/chat` | Send a single message to the LLM (basic chat) |
| `POST` | `/upload-contract` | Upload a PDF and receive its extracted clauses |
| `POST` | `/analyze-contract` | Upload a PDF and receive the full risk analysis |

### `POST /analyze-contract`

**Accepts** (multipart form data):

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | PDF file | Yes | The contract to analyse |
| `concern` | string | No | Optional focus area (e.g. "liability and termination") |

**Returns** (JSON):

| Field | Description |
|---|---|
| `filename` | Name of the uploaded PDF |
| `page_count` | Total number of pages in the PDF |
| `total_clauses` | Total clauses detected across all pages |
| `analyzed_clauses` | Number of clauses sent to the LLM after filtering |
| `response` | Full Clare risk analysis as a markdown string |
| `processing_time_seconds` | Total wall-clock time for the analysis |

---

## Risk Analysis Output

Each risk finding in Clare's report follows this structure:

```
### [Section] – [Short risk description]

**Level:** HIGH / MEDIUM / LOW

**Why:** Brief explanation of the practical legal or commercial risk for the customer.

**Evidence:** "Exact quote from the clause."

**Negotiate:** Actionable suggestion for what the customer should request or clarify.
```

At the end of the report, Clare always appends:

- **Risk Summary table** — one row per risk finding, with section, summary, and risk level
- **Disclaimer** — a reminder that this is AI-generated informational analysis and not legal advice

---

## Limitations

- Only a filtered subset of clauses (up to 15) is sent to the LLM. Clauses not matching the keyword list will not be analysed.
- Analysis quality depends on the quality of the extracted PDF text. Scanned or image-only PDFs are not supported — OCR is not implemented.
- The LLM response may vary. Clare is an AI-assisted informational tool and not a substitute for qualified legal counsel.
- There is no user authentication or login system in this version.
- Analysis history is not saved — results exist only for the current session.

---

## Future Improvements

The following are planned for a future phase and are **not currently implemented**:

- User authentication and login
- Database-backed analysis history (storing PDF metadata and generated reports)
- Semantic retrieval of relevant clauses using embeddings (replacing keyword filtering)
- OCR support for scanned contracts
- More efficient or parallelised clause analysis
- Deployment to a cloud platform

---

## Disclaimer

Clare provides AI-generated informational analysis only. It does not constitute legal advice. Important legal or business decisions should always be reviewed by qualified legal counsel.