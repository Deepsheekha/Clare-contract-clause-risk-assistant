import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  UploadCloud,
  X,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Check,
  Copy,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Info
} from 'lucide-react';
import logoImg from './assets/logo.png';
import dropletImg from './assets/droplet.jpeg';

const BACKEND_URL = 'http://localhost:8000';

const LOADING_STAGES = [
  'Analyzing your contract…',
  'Reading your contract…',
  'Identifying clauses…',
  'Assessing risk levels…',
  'Almost there…'
];

const PRESET_CONCERNS = [
  'Customer-focused general risk review',
  'Auto-renewal, termination & exit lock-ins',
  'Liability caps, indemnities & uncapped exposures',
  'IP ownership, data privacy & licensing rights'
];

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Parses LLM markdown response into structured clause cards, summary, and disclaimer
function parseAnalysisResponse(rawMarkdown) {
  if (!rawMarkdown) return { cards: [], summary: null, disclaimer: null, cleanedText: '', fallback: '' };

  // 1. Normalize line endings and remove internal reasoning tags (e.g. <think>...</think>)
  let text = rawMarkdown.replace(/\r\n/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Locate the beginning of the actual analysis:
  // If "# Clare Contract Risk Analysis" exists in the response, use that as the beginning
  const clareHeaderRegex = /#\s+Clare(?:\s+Contract)?\s+Risk\s+Analysis/i;
  const match = text.match(clareHeaderRegex);
  if (match && match.index !== undefined) {
    text = text.substring(match.index).trim();
  } else {
    // If not found, look for first clause header or risk section
    const firstClauseIndex = text.search(/^(?:###|##)\s+(?:\[?\d|\w)/m);
    if (firstClauseIndex !== -1) {
      text = text.substring(firstClauseIndex).trim();
    }
  }

  const fullCleanedText = text;

  // 3. Extract Disclaimer if present at the end
  let disclaimer = null;
  const disclaimerMatch = text.match(/(?:^|\n)(##\s+Disclaimer[\s\S]*|\*AI-generated[\s\S]*|AI-generated informational analysis only[\s\S]*)$/i);
  if (disclaimerMatch) {
    disclaimer = disclaimerMatch[1].trim();
    text = text.substring(0, text.length - disclaimerMatch[0].length).trim();
  }

  // 4. Extract Risk Summary table if present
  let summary = null;
  const summaryMatch = text.match(/(?:^|\n)(##\s+Risk\s+Summary[\s\S]*?)(?=(?:^|\n)##\s+Disclaimer|$)/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
    text = text.replace(summaryMatch[0], '').trim();
  }

  // 5. Split text into clause sections
  // Match headers starting with ### or ## that define a clause (e.g. "### 4.3 - Late Payment...")
  const sections = text.split(/(?=^[ \t]*###?\s+)/m);
  const cards = [];
  let fallbackParts = [];

  for (const sec of sections) {
    const trimmed = sec.trim();
    if (!trimmed) continue;

    // Skip the main title if it was caught as a section
    if (/^#\s+Clare/i.test(trimmed)) {
      continue;
    }

    if (/^###?\s+/i.test(trimmed)) {
      const lines = trimmed.split('\n');
      const headerLine = lines[0].replace(/^[ \t]*###?\s+/, '').replace(/^\[|\]$/g, '').trim();
      const bodyLines = lines.slice(1).join('\n').trim();

      // Detect risk level with multiple fallback patterns
      let riskLevel = null;

      // Pattern A: **Level:** HIGH, **Risk Level:** HIGH, Level: HIGH, etc.
      const levelMatch = trimmed.match(/\*{0,2}(?:Risk\s*)?Level:?\*{0,2}\s*:?\s*\*{0,2}(HIGH|MEDIUM|LOW)\b/i);
      if (levelMatch) {
        riskLevel = levelMatch[1].toUpperCase();
      }

      // Pattern B: Look in header or first 3 lines for HIGH / MEDIUM / LOW
      if (!riskLevel) {
        const topLines = lines.slice(0, 3).join(' ');
        const badgeMatch = topLines.match(/\b(HIGH|MEDIUM|LOW)\b/i);
        if (badgeMatch) {
          riskLevel = badgeMatch[1].toUpperCase();
        }
      }

      // Pattern C: Any occurrence of HIGH/MEDIUM/LOW
      if (!riskLevel) {
        const bodyMatch = trimmed.match(/\b(HIGH|MEDIUM|LOW)\b/i);
        if (bodyMatch) {
          riskLevel = bodyMatch[1].toUpperCase();
        } else {
          riskLevel = 'LOW';
        }
      }

      cards.push({
        id: Math.random().toString(36).substring(2, 9),
        title: headerLine,
        riskLevel,
        body: bodyLines,
        raw: trimmed
      });
    } else {
      fallbackParts.push(trimmed);
    }
  }

  // If cards were not split by headers, try regex block extraction
  if (cards.length === 0) {
    const blockRegex = /###?\s+([^\n]+)\n([\s\S]*?)(?=(?:^[ \t]*###?\s+|$))/gm;
    let bMatch;
    while ((bMatch = blockRegex.exec(text)) !== null) {
      const title = bMatch[1].trim();
      const body = bMatch[2].trim();
      if (/Risk\s+Summary/i.test(title) || /Disclaimer/i.test(title)) continue;

      let riskLevel = 'LOW';
      const lvlMatch = body.match(/\*{0,2}(?:Risk\s*)?Level:?\*{0,2}\s*:?\s*\*{0,2}(HIGH|MEDIUM|LOW)\b/i) ||
                       body.match(/\b(HIGH|MEDIUM|LOW)\b/i);
      if (lvlMatch) {
        riskLevel = lvlMatch[1].toUpperCase();
      }

      cards.push({
        id: Math.random().toString(36).substring(2, 9),
        title,
        riskLevel,
        body,
        raw: bMatch[0]
      });
    }
  }

  // Sort cards High -> Medium -> Low
  const priority = { HIGH: 1, MEDIUM: 2, LOW: 3 };
  cards.sort((a, b) => (priority[a.riskLevel] || 4) - (priority[b.riskLevel] || 4));

  return {
    cards,
    summary,
    disclaimer,
    cleanedText: fullCleanedText,
    fallback: fallbackParts.join('\n\n')
  };
}

export default function App() {
  const [state, setState] = useState('idle'); // 'idle' | 'analyzing' | 'results' | 'error'
  const [file, setFile] = useState(null);
  const [concern, setConcern] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [filterRisks, setFilterRisks] = useState({ HIGH: true, MEDIUM: true, LOW: true });
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Scroll detection for header shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Loading copy interval
  useEffect(() => {
    let interval;
    if (state === 'analyzing') {
      interval = setInterval(() => {
        setLoadingStageIndex((prev) => (prev + 1) % LOADING_STAGES.length);
      }, 2500);
    } else {
      setLoadingStageIndex(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const handleFileSelect = (selectedFile) => {
    setValidationError(null);
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setValidationError('Please upload a PDF under 20MB.');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setValidationError('Please upload a PDF under 20MB.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startAnalysis = async () => {
    if (!file) return;

    setState('analyzing');
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    if (concern.trim()) {
      formData.append('concern', concern.trim());
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${BACKEND_URL}/analyze-contract`, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        let errDetail = 'Something went wrong reaching Clare. Please try again.';
        try {
          const errJson = await response.json();
          if (errJson.detail) errDetail = errJson.detail;
        } catch {
          // fallback to status text
          errDetail = `Analysis failed (${response.status}: ${response.statusText})`;
        }
        throw new Error(errDetail);
      }

      const data = await response.json();
      setResultData(data);
      setState('results');
    } catch (err) {
      if (err.name === 'AbortError') {
        setState('idle');
        return;
      }
      setErrorMessage(err.message || 'Something went wrong reaching Clare. Please try again.');
      setState('error');
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState('idle');
  };

  const handleReset = () => {
    setFile(null);
    setConcern('');
    setResultData(null);
    setErrorMessage(null);
    setValidationError(null);
    setFilterRisks({ HIGH: true, MEDIUM: true, LOW: true });
    setState('idle');
  };

  const toggleRiskFilter = (level) => {
    setFilterRisks((prev) => ({
      ...prev,
      [level]: !prev[level]
    }));
  };

  const handleCopyMarkdown = () => {
    const textToCopy = parsed?.cleanedText || resultData?.response;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const parsed = resultData ? parseAnalysisResponse(resultData.response) : null;
  const highCount = parsed?.cards.filter((c) => c.riskLevel === 'HIGH').length || 0;
  const mediumCount = parsed?.cards.filter((c) => c.riskLevel === 'MEDIUM').length || 0;
  const lowCount = parsed?.cards.filter((c) => c.riskLevel === 'LOW').length || 0;

  const filteredCards = parsed?.cards.filter((c) => filterRisks[c.riskLevel]) || [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)', position: 'relative' }}>
      {/* Droplet Background Motif with 10% opacity */}
      <div className="droplet-bg" aria-hidden="true" />

      {/* 2. Global Shell Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          height: '64px',
          backgroundColor: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: isScrolled ? 'var(--shadow-sm)' : 'none',
          transition: 'box-shadow var(--duration-base) var(--ease-standard)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={logoImg}
            alt="Clare"
            style={{ height: '26px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {state === 'results' && (
          <button
            onClick={handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '13.5px',
              fontWeight: '500',
              color: 'var(--color-teal-700)',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) var(--ease-standard)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-sunken)';
              e.currentTarget.style.borderColor = 'var(--color-teal-600)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--color-border-strong)';
            }}
          >
            <RefreshCw size={15} />
            <span>New Analysis</span>
          </button>
        )}
      </header>

      {/* Main Content Flow */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 64px' }}>
        {/* ========================================================================= */}
        {/* SCREEN 1: IDLE / UPLOAD */}
        {/* ========================================================================= */}
        {state === 'idle' && (
          <div style={{ width: '100%', maxWidth: '1040px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Hero Zone */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                marginBottom: '36px',
                position: 'relative'
              }}
            >
              <h1 style={{ marginBottom: '12px', maxWidth: '680px' }}>
                Understand what you're signing before you sign it.
              </h1>
              <p
                style={{
                  fontSize: '16px',
                  color: 'var(--color-text-secondary)',
                  maxWidth: '480px',
                  lineHeight: '1.6'
                }}
              >
                Clare analyzes contract clauses from the customer's perspective to uncover hidden risks, strict liabilities, and actionable negotiation leverage.
              </p>
            </div>

            {/* Upload Card */}
            <div
              style={{
                width: '100%',
                maxWidth: '640px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--color-border)',
                padding: '36px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}
            >
              {/* Dropzone */}
              <div>
                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: isDragging
                        ? '1.5px solid var(--color-teal-600)'
                        : validationError
                        ? '1.5px solid var(--color-risk-high)'
                        : '1.5px dashed var(--color-border-strong)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isDragging ? 'var(--color-teal-100)' : 'var(--color-surface-sunken)',
                      minHeight: '160px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: '24px',
                      textAlign: 'center',
                      transition: 'all var(--duration-fast) var(--ease-standard)'
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                      accept="application/pdf"
                      style={{ display: 'none' }}
                    />
                    <UploadCloud
                      size={36}
                      color="var(--color-teal-600)"
                      style={{
                        marginBottom: '12px',
                        transform: isDragging ? 'scale(1.08)' : 'scale(1)',
                        transition: 'transform var(--duration-fast) var(--ease-standard)'
                      }}
                    />
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                      Drag & drop your contract PDF, or click to browse
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                      PDF only, up to 20MB
                    </div>
                  </div>
                ) : (
                  /* File Chip */
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--color-teal-100)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      padding: '14px 18px',
                      transition: 'all var(--duration-base) var(--ease-standard)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          backgroundColor: 'var(--color-teal-700)',
                          color: '#FFFFFF',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px',
                          display: 'flex'
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--color-teal-900)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {file.name}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      aria-label="Remove file"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color var(--duration-fast) var(--ease-standard)'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-risk-high)')}
                      onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}

                {validationError && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '13px',
                      color: 'var(--color-risk-high)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>

              {/* Concern Input Area */}
              <div style={{ opacity: file ? 1 : 0.65, transition: 'opacity var(--duration-base) var(--ease-standard)' }}>
                <label
                  htmlFor="concern-input"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '8px'
                  }}
                >
                  What should Clare focus on?
                </label>
                <textarea
                  id="concern-input"
                  rows={3}
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  disabled={!file}
                  placeholder="e.g. Flag any auto-renewal, liability, or termination clauses that lock us in."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: '14.5px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Preset Suggestions */}
                {file && (
                  <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {PRESET_CONCERNS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setConcern(preset)}
                        style={{
                          backgroundColor: concern === preset ? 'var(--color-teal-100)' : 'var(--color-surface-sunken)',
                          border: concern === preset ? '1px solid var(--color-teal-600)' : '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 10px',
                          fontSize: '12px',
                          color: concern === preset ? 'var(--color-teal-900)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          transition: 'all var(--duration-fast) var(--ease-standard)'
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                  Optional but recommended — a specific concern produces sharper analysis.
                </div>
              </div>

              {/* Primary CTA */}
              <button
                type="button"
                onClick={startAnalysis}
                disabled={!file}
                style={{
                  width: '100%',
                  height: '48px',
                  backgroundColor: file ? 'var(--color-teal-600)' : 'var(--color-surface-sunken)',
                  color: file ? '#FFFFFF' : 'var(--color-text-tertiary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '15px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: file ? 'pointer' : 'not-allowed',
                  boxShadow: file ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--duration-fast) var(--ease-standard)'
                }}
                onMouseOver={(e) => {
                  if (file) {
                    e.currentTarget.style.backgroundColor = 'var(--color-teal-500)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }
                }}
                onMouseOut={(e) => {
                  if (file) {
                    e.currentTarget.style.backgroundColor = 'var(--color-teal-600)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }
                }}
              >
                <span>Analyze Contract</span>
                <ArrowRight size={17} />
              </button>
            </div>

            {/* Footer on Idle */}
            <footer style={{ marginTop: '48px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              Clare — AI contract risk analysis
            </footer>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: ANALYZING STATE */}
        {/* ========================================================================= */}
        {state === 'analyzing' && (
          <div style={{ width: '100%', maxWidth: '640px', marginTop: '40px' }}>
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--color-border)',
                padding: '48px 36px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              {/* Concentric Ripple Animation Motif */}
              <div
                style={{
                  position: 'relative',
                  width: '96px',
                  height: '96px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '28px'
                }}
              >
                <div
                  className="ripple-ring-1"
                  style={{
                    position: 'absolute',
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-teal-600)'
                  }}
                />
                <div
                  className="ripple-ring-2"
                  style={{
                    position: 'absolute',
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-teal-600)'
                  }}
                />
                <div
                  className="ripple-ring-3"
                  style={{
                    position: 'absolute',
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-teal-600)'
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-teal-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF'
                  }}
                >
                  <Sparkles size={20} />
                </div>
              </div>

              {/* Rotating Status Message */}
              <div
                aria-live="polite"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: 'var(--color-text-primary)',
                  minHeight: '30px',
                  marginBottom: '10px',
                  transition: 'opacity var(--duration-fast) ease'
                }}
              >
                {LOADING_STAGES[loadingStageIndex]}
              </div>

              <div style={{ fontSize: '13.5px', color: 'var(--color-text-tertiary)', marginBottom: '28px' }}>
                Analyzing {file?.name || 'document'}
              </div>

              {/* Cancel Action */}
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '13.5px',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '6px 12px'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-risk-high)')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN: ERROR STATE */}
        {/* ========================================================================= */}
        {state === 'error' && (
          <div style={{ width: '100%', maxWidth: '640px', marginTop: '40px' }}>
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--color-risk-high)',
                outline: '4px solid var(--color-risk-high-bg)',
                padding: '40px 36px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-risk-high-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-risk-high)',
                  marginBottom: '20px'
                }}
              >
                <AlertCircle size={28} />
              </div>

              <h2 style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                Analysis failed
              </h2>

              <p style={{ fontSize: '14.5px', color: 'var(--color-text-secondary)', maxWidth: '440px', marginBottom: '28px' }}>
                {errorMessage || 'Something went wrong reaching Clare. Please try again.'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  type="button"
                  onClick={startAnalysis}
                  style={{
                    backgroundColor: 'var(--color-teal-600)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 22px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'background var(--duration-fast) ease'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-teal-500)')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-teal-600)')}
                >
                  Try Again
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '8px 12px'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-teal-700)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 3: RESULTS STATE */}
        {/* ========================================================================= */}
        {state === 'results' && resultData && (
          <div style={{ width: '100%', maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* 6a. Breadcrumb & Stat Bar */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13.5px',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '12px'
                }}
              >
                <FileText size={16} color="var(--color-teal-700)" />
                <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{resultData.filename}</span>
              </div>

              {/* Row of 3 Stat Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px'
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '20px'
                  }}
                >
                  <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Pages
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                    {resultData.page_count}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '20px'
                  }}
                >
                  <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Clauses Found
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                    {resultData.total_clauses}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '20px'
                  }}
                >
                  <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Clauses Analyzed
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: '600', color: 'var(--color-teal-700)' }}>
                    {resultData.analyzed_clauses || resultData.chunks_analyzed || 0}
                  </div>
                  {resultData.analyzed_clauses < resultData.total_clauses && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                      Clare focused on clauses most relevant to your concern.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reading Column Container (Max Width 880px) */}
            <div style={{ width: '100%', maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 6b. Risk Legend + Filter Pills */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                    Filter by Risk:
                  </span>

                  {/* High Pill */}
                  <button
                    type="button"
                    onClick={() => toggleRiskFilter('HIGH')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: filterRisks.HIGH ? 'var(--color-risk-high-bg)' : 'var(--color-surface-sunken)',
                      color: filterRisks.HIGH ? 'var(--color-risk-high)' : 'var(--color-text-tertiary)',
                      transition: 'all var(--duration-fast) var(--ease-standard)'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-risk-high)' }} />
                    <span>High ({highCount})</span>
                  </button>

                  {/* Medium Pill */}
                  <button
                    type="button"
                    onClick={() => toggleRiskFilter('MEDIUM')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: filterRisks.MEDIUM ? 'var(--color-risk-medium-bg)' : 'var(--color-surface-sunken)',
                      color: filterRisks.MEDIUM ? 'var(--color-risk-medium)' : 'var(--color-text-tertiary)',
                      transition: 'all var(--duration-fast) var(--ease-standard)'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-risk-medium)' }} />
                    <span>Medium ({mediumCount})</span>
                  </button>

                  {/* Low Pill */}
                  <button
                    type="button"
                    onClick={() => toggleRiskFilter('LOW')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: filterRisks.LOW ? 'var(--color-risk-low-bg)' : 'var(--color-surface-sunken)',
                      color: filterRisks.LOW ? 'var(--color-risk-low)' : 'var(--color-text-tertiary)',
                      transition: 'all var(--duration-fast) var(--ease-standard)'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-risk-low)' }} />
                    <span>Low ({lowCount})</span>
                  </button>
                </div>

                {/* Copy Markdown button */}
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast) ease'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-sunken)')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {copied ? <Check size={14} color="var(--color-risk-low)" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy Analysis'}</span>
                </button>
              </div>

              {/* 6c. Rendered Clause Cards */}
              {filteredCards.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredCards.map((card) => {
                    const isHigh = card.riskLevel === 'HIGH';
                    const isMedium = card.riskLevel === 'MEDIUM';
                    const accentColor = isHigh
                      ? 'var(--color-risk-high)'
                      : isMedium
                      ? 'var(--color-risk-medium)'
                      : 'var(--color-risk-low)';
                    const badgeBg = isHigh
                      ? 'var(--color-risk-high-bg)'
                      : isMedium
                      ? 'var(--color-risk-medium-bg)'
                      : 'var(--color-risk-low-bg)';

                    return (
                      <div
                        key={card.id}
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-sm)',
                          border: '1px solid var(--color-border)',
                          borderLeft: `4px solid ${accentColor}`,
                          padding: '24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Header: Risk badge + Title */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <h3 style={{ color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: '600' }}>
                            {card.title}
                          </h3>
                          <span
                            style={{
                              backgroundColor: badgeBg,
                              color: accentColor,
                              fontSize: '11px',
                              fontWeight: '700',
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              padding: '4px 10px',
                              borderRadius: '999px'
                            }}
                          >
                            {card.riskLevel} RISK
                          </span>
                        </div>

                        {/* Body content */}
                        <div className="markdown-body" style={{ width: '100%', minWidth: 0 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {card.body}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : parsed?.cards.length > 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: '32px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    fontSize: '14.5px'
                  }}
                >
                  No risks match the selected filters.
                </div>
              ) : (
                /* Fallback if cards could not be split cleanly */
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--color-border)',
                    padding: '32px',
                    width: '100%',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  <div className="markdown-body" style={{ width: '100%', minWidth: 0 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {parsed?.fallback || resultData.response}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Risk Summary Table (if present in markdown) */}
              {parsed?.summary && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--color-border)',
                    padding: '24px',
                    marginTop: '8px'
                  }}
                >
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {parsed.summary}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Disclaimer (if present) */}
              {parsed?.disclaimer && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-sunken)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    padding: '16px 20px',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.5'
                  }}
                >
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {parsed.disclaimer}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* 6d. Closing Action */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 28px',
                    fontSize: '14.5px',
                    fontWeight: '600',
                    color: 'var(--color-teal-700)',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all var(--duration-fast) ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-teal-100)';
                    e.currentTarget.style.borderColor = 'var(--color-teal-600)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                  }}
                >
                  <RefreshCw size={16} />
                  <span>Analyze Another Contract</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
