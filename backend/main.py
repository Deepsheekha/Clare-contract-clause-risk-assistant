import asyncio
import pymupdf
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.chunking import create_chunks
from backend.model import ask_model
from backend.prompts import REVIEW_PROMPT, RISK_PROMPT
import time
load_dotenv()

app = FastAPI(
    title="Clare - Contract Clause Risk Assistant",
    description="AI-powered contract risk analysis assistant",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HOME
# =========================================================


@app.get("/")
def home():
    return {"message": "Clare is running!", "status": "ok"}


# =========================================================
# CHAT
# =========================================================


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        response = ask_model(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# =========================================================
# PDF TEXT EXTRACTION
# =========================================================


async def extract_contract(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        document = pymupdf.open(stream=contents, filetype="pdf")
        pages = []

        for page_number, page in enumerate(document, start=1):
            text = page.get_text()
            if text.strip():
                pages.append({"page": page_number, "text": text})

        page_count = len(document)
        document.close()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF: {str(e)}")

    if not pages:
        raise HTTPException(
            status_code=400,
            detail="No readable text could be extracted from the PDF.",
        )

    return pages, page_count


# =========================================================
# UPLOAD CONTRACT
# =========================================================


@app.post("/upload-contract")
async def upload_contract(file: UploadFile = File(...)):
    pages, page_count = await extract_contract(file)

    try:
        chunks = create_chunks(pages)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create contract chunks: {str(e)}"
        )

    return {
        "filename": file.filename,
        "page_count": page_count,
        "chunk_count": len(chunks),
        "chunks": chunks,
    }


# =========================================================
# ANALYZE CONTRACT
# =========================================================

@app.post("/analyze-contract")
async def analyze_contract(
    file: UploadFile = File(...),
    concern: str = Form("")
):
    import time

    start = time.time()

    print("\n==============================")
    print("CLARE ANALYSIS STARTED")
    print("==============================")

    # -------------------------------------------------
    # 1. EXTRACT PDF
    # -------------------------------------------------

    print("1. Extracting PDF...")

    step_start = time.time()

    pages, page_count = await extract_contract(file)

    print(
        f"   PDF extraction: "
        f"{time.time() - step_start:.2f}s"
    )

    # -------------------------------------------------
    # 2. CREATE CLAUSES
    # -------------------------------------------------

    print("2. Creating clauses...")

    step_start = time.time()

    try:
        chunks = create_chunks(pages)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create contract chunks: {str(e)}"
        )

    print(
        f"   Chunking: "
        f"{time.time() - step_start:.2f}s"
    )

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No contract clauses could be identified."
        )

    print(f"   Total clauses: {len(chunks)}")

    # -------------------------------------------------
    # 3. FILTER RISKY CLAUSES
    # -------------------------------------------------

    print("3. Filtering risky clauses...")

    step_start = time.time()

    risk_keywords = [
        "terminate",
        "termination",
        "renew",
        "renewal",
        "notice",
        "cure",
        "breach",
        "default",

        "fee",
        "fees",
        "price",
        "pricing",
        "increase",
        "payment",
        "interest",
        "penalty",
        "cost",
        "charge",

        "liability",
        "liable",
        "indemn",
        "indemnity",
        "indemnification",
        "indemnify",
        "damages",
        "limitation",
        "limit",
        "cap",
        "uncapped",

        "warranty",
        "warranties",
        "warrant",
        "disclaimer",

        "data",
        "customer data",
        "privacy",
        "security",
        "breach",

        "intellectual property",
        "intellectual",
        "property",
        "IP",
        "ownership",
        "owned",
        "license",
        "licensed",
        "sublicense",

        "confidential",
        "confidentiality",

        "audit",
        "compliance",

        "assign",
        "assignment",
        "change of control",

        "governing law",
        "jurisdiction",
        "arbitration",
        "dispute",

        "force majeure",

        "survive",
        "survival",

        "modify",
        "modification",
        "amend",
        "amendment",
        "unilateral",

        "non-compete",
        "non compete",
        "non-solicitation",
        "non solicitation",

        "exclusivity",
        "exclusive",

        "suspend",
        "suspension",
        "restrict",
        "restriction",

        "obligation",
        "responsible",
        "responsibility"
    ]

    selected_chunks = []

    for chunk in chunks:
        title = chunk.get("title", "").lower()
        text = chunk.get("text", "").lower()
        searchable_content = f"{title} {text}"

        if any(
            keyword.lower() in searchable_content
            for keyword in risk_keywords
        ):
            selected_chunks.append(chunk)

    # Limit model input to approximately 12–15 candidate clauses
    selected_chunks = selected_chunks[:15]

    print(
        f"   Filtering: "
        f"{time.time() - step_start:.2f}s"
    )

    print(
        f"   Selected clauses: "
        f"{len(selected_chunks)}"
    )

    # -------------------------------------------------
    # 4. BUILD SMALL CONTRACT INPUT
    # -------------------------------------------------

    print("4. Building model input...")

    step_start = time.time()

    contract_parts = []

    for chunk in selected_chunks:

        clause_text = chunk.get(
            "text",
            ""
        )[:1200]

        contract_parts.append(
            f"""
            SECTION {chunk.get('section', 'Unknown')}
            TITLE: {chunk.get('title', '')}
            PAGE: {chunk.get('page', 'Unknown')}

            {clause_text}
            """
        )

    contract_text = "\n".join(contract_parts)

    print(
        f"   Prompt preparation: "
        f"{time.time() - step_start:.2f}s"
    )

    # -------------------------------------------------
    # 5. USER CONCERN
    # -------------------------------------------------

    user_concern = concern.strip()

    if not user_concern:

        user_concern = (
            "Find the most important risky clauses "
            "for the customer."
        )

    # -------------------------------------------------
    # 6. BUILD PROMPT
    # -------------------------------------------------

    print("5. Building final prompt...")

    prompt = REVIEW_PROMPT.format(
        concern=user_concern,
        contract_text=contract_text
    )

    print(
        f"   Prompt length: "
        f"{len(prompt)} characters"
    )

    # -------------------------------------------------
    # 7. CALL MODEL
    # -------------------------------------------------

    print("6. CALLING OPENROUTER...")
    print("   This is probably the slow part.")

    model_start = time.time()

    try:
        response = ask_model(prompt)
    except Exception as e:
        model_time = time.time() - model_start
        print(f"   MODEL TIME: {model_time:.2f}s")
        total_time = time.time() - start
        print("==============================")
        print(f"TOTAL TIME: {total_time:.2f}s")
        print("==============================")
        raise HTTPException(
            status_code=500,
            detail=f"Contract analysis failed: {str(e)}"
        )

    model_time = time.time() - model_start
    total_time = time.time() - start

    print(f"   MODEL TIME: {model_time:.2f}s")
    print("==============================")
    print(f"TOTAL TIME: {total_time:.2f}s")
    print("==============================\n")

    return {
        "filename": file.filename,
        "page_count": page_count,
        "total_clauses": len(chunks),
        "analyzed_clauses": len(selected_chunks),
        "response": response,
        "processing_time_seconds": round(
            total_time,
            2
        )
    }