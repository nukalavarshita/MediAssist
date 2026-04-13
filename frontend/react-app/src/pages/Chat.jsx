import { useEffect, useRef, useState } from 'react'
import { aiApi, chatApi } from '../api'

const RISK_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }
const SESSION_ID = `session-${Date.now()}`

/* ── Typing indicator ── */
function TypingIndicator() {
  return (
    <div className="bubble-row bubble-ai">
      <div className="bubble bubble-ai-body typing-indicator"><span /><span /><span /></div>
    </div>
  )
}

/* ── AI response card ── */
function AiCard({ response }) {
  const { llm_analysis, risk_assessment, recommendations, advanced_features, doctor_recommendations } = response
  const riskColor = RISK_COLOR[risk_assessment.level] || '#22c55e'
  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <span className="risk-badge" style={{ background: riskColor }}>{risk_assessment.level} RISK</span>
        <span className="confidence-label">Confidence: {Math.round((llm_analysis.confidence_score || 0) * 100)}%</span>
        {advanced_features?.emergency_alert && <span className="emergency-pill">🚨 URGENT</span>}
      </div>
      <p className="ai-assessment">{llm_analysis.assessment}</p>
      {llm_analysis.possible_conditions?.length > 0 && (
        <div className="ai-section">
          <p className="ai-section-label">Possible conditions</p>
          <div className="tag-row">
            {llm_analysis.possible_conditions.map((c, i) => {
              const name = typeof c === 'object' ? c.name : c
              const likelihood = typeof c === 'object' ? c.likelihood : null
              return (
                <span key={i} className="tag" title={typeof c === 'object' ? c.reasoning : ''}>
                  {name}{likelihood ? ` · ${likelihood}` : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}
      {recommendations.tests?.length > 0 && (
        <div className="ai-section">
          <p className="ai-section-label">Suggested tests</p>
          <div className="tag-row">{recommendations.tests.map((t) => <span key={t} className="tag tag-green">{t}</span>)}</div>
        </div>
      )}
      {doctor_recommendations?.length > 0 && (
        <div className="ai-section">
          <p className="ai-section-label">Recommended doctors</p>
          {doctor_recommendations.slice(0, 2).map((d) => (
            <div key={d.id} className="doctor-mini-card">
              <div><strong>{d.name}</strong><p className="muted">{d.specialty} • ★ {d.rating} • {d.experience_years}y</p></div>
            </div>
          ))}
        </div>
      )}
      {advanced_features?.smart_follow_up_questions?.length > 0 && (
        <div className="ai-section">
          <p className="ai-section-label">Follow-up questions</p>
          {advanced_features.smart_follow_up_questions.map((q) => <p key={q} className="follow-up-q">• {q}</p>)}
        </div>
      )}
      {risk_assessment.urgency && (
        <p className="urgency-note" style={{ borderLeftColor: riskColor }}>{risk_assessment.urgency}</p>
      )}
      {/* Explainability */}
      {advanced_features?.explainability?.key_factors?.length > 0 && (
        <details className="explain-details">
          <summary className="ai-section-label" style={{ cursor: 'pointer' }}>🧠 Why this assessment?</summary>
          <p className="muted" style={{ marginTop: 6, fontSize: '0.82rem' }}>{advanced_features.explainability.reasoning_note}</p>

          {/* Agent trace */}
          {advanced_features.explainability.agent_reasoning_trace?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="ai-section-label">Agent Pipeline</p>
              {advanced_features.explainability.agent_reasoning_trace.map((step, i) => (
                <div key={i} className="explain-trace-step">
                  <span className="explain-step-num">{step.step}</span>
                  <div>
                    <strong style={{ fontSize: '0.78rem' }}>{step.agent}</strong>
                    <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.75rem' }}>{step.action}</p>
                  </div>
                  <span className="explain-confidence">{Math.round(step.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Key factors */}
          <div style={{ marginTop: 10 }}>
            <p className="ai-section-label">Key Clinical Factors</p>
            <div className="tag-row">
              {advanced_features.explainability.key_factors.map((f, i) => (
                <span key={i} className="tag tag-blue" style={{ fontSize: '0.72rem' }}>
                  {f} · {Math.round((advanced_features.explainability.factor_weights?.[f] || 0.5) * 100)}%
                </span>
              ))}
            </div>
          </div>

          {/* RAG evidence */}
          {advanced_features.explainability.rag_evidence?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="ai-section-label">RAG Evidence ({advanced_features.explainability.rag_documents_used} docs · quality: {Math.round((advanced_features.explainability.rag_quality_score || 0) * 100)}%)</p>
              {advanced_features.explainability.rag_evidence.slice(0, 2).map((e, i) => (
                <div key={i} className="explain-rag-item">
                  <span className="tag" style={{ fontSize: '0.68rem' }}>{e.category}</span>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: '0.73rem' }}>{e.snippet}</p>
                </div>
              ))}
            </div>
          )}

          {/* Limitations */}
          {advanced_features.explainability.limitations?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="ai-section-label">⚠ Limitations</p>
              {advanced_features.explainability.limitations.slice(0, 2).map((l, i) => (
                <p key={i} className="muted" style={{ fontSize: '0.73rem', margin: '2px 0' }}>• {l}</p>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: '0.68rem', marginTop: 8, borderTop: '1px solid rgba(16,36,58,0.08)', paddingTop: 6 }}>
            {advanced_features.explainability.pipeline_version}
          </p>
        </details>
      )}
    </div>
  )
}

/* ── Consultation tab ── */
function ConsultationTab() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    chatApi.history().then(({ data }) => {
      const restored = data.slice(0, 20).reverse().flatMap((item) => [
        { id: `u-${item.id}`, role: 'user', text: item.user_message },
        { id: `a-${item.id}`, role: 'ai', response: item.ai_response },
      ])
      setMessages(restored)
    }).catch(() => {})
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput(''); setError('')
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      const { data } = await chatApi.sendMessage({ message: text, session_id: SESSION_ID })
      setMessages((prev) => [...prev, { id: `a-${data.chat_id}`, role: 'ai', response: data.ai_response }])
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong.')
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-window-card glass-card">
      <div className="chat-header">
        <div><p className="eyebrow">AI Consultation</p><h3 style={{ margin: '4px 0 0' }}>Describe your symptoms</h3></div>
        <span className="online-dot" />
      </div>
      <div className="chat-window">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <p>👋 Describe your symptoms for an AI-powered health assessment.</p>
            <p className="muted">e.g. "I have a cough, mild fever, and fatigue for 2 days."</p>
          </div>
        )}
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="bubble-row bubble-user">
              <div className="bubble bubble-user-body">{msg.text}</div>
            </div>
          ) : (
            <div key={msg.id} className="bubble-row bubble-ai">
              <div className="bubble bubble-ai-body"><AiCard response={msg.response} /></div>
            </div>
          )
        )}
        {loading && <TypingIndicator />}
        {error && <p className="chat-error">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-composer">
        <textarea
          rows={2} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Describe symptoms… (Enter to send)"
          disabled={loading}
        />
        <button className="primary-button send-btn" onClick={send} disabled={loading || !input.trim()}>
          {loading ? '…' : '➤'}
        </button>
      </div>
    </div>
  )
}

/* ── Consultation Prep tab ── */
function PrepTab() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const { data } = await aiApi.consultationPrep(text)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card prep-card">
      <p className="eyebrow">Consultation Prep Mode</p>
      <h3>Generate questions to ask your doctor</h3>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Describe your symptoms or health concern…" />
      <button className="primary-button" onClick={run} disabled={loading || !text.trim()}>
        {loading ? 'Generating…' : 'Generate prep guide'}
      </button>

      {result && (
        <div className="prep-result">
          <div className="prep-section">
            <p className="ai-section-label">🩺 Symptom-specific questions to ask</p>
            {result.consultation_guide.symptom_specific_questions.map((q) => (
              <div key={q} className="prep-question">❓ {q}</div>
            ))}
          </div>
          <div className="prep-section">
            <p className="ai-section-label">📋 General questions</p>
            {result.consultation_guide.general_questions.map((q) => (
              <div key={q} className="prep-question">❓ {q}</div>
            ))}
          </div>
          <div className="prep-section">
            <p className="ai-section-label">🎒 What to bring</p>
            {result.consultation_guide.what_to_bring.map((item) => (
              <div key={item} className="prep-item">✓ {item}</div>
            ))}
          </div>
          <div className="prep-section">
            <p className="ai-section-label">💡 Preparation tips</p>
            {result.consultation_guide.preparation_tips.map((tip) => (
              <div key={tip} className="prep-item muted">• {tip}</div>
            ))}
          </div>
          {result.consultation_guide.red_flags_to_mention?.length > 0 && (
            <div className="prep-section" style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 12, padding: 12 }}>
              <p className="ai-section-label" style={{ color: '#ef4444' }}>🚨 Red flags to mention immediately</p>
              {result.consultation_guide.red_flags_to_mention.map((f) => (
                <div key={f} className="prep-question" style={{ color: '#b91c1c' }}>⚠ {f}</div>
              ))}
            </div>
          )}
          <div className="prep-section">
            <p className="ai-section-label">Suggested specialists</p>
            <div className="tag-row">
              {result.suggested_specialists.map((s) => <span key={s} className="tag tag-blue">{s}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Research tab ── */
const RESEARCH_TOPICS = [
  'Type 2 Diabetes management', 'Hypertension treatment', 'Asthma in adults',
  'Migraine prevention', 'Anxiety and depression', 'COVID-19 long symptoms',
  'Vitamin D deficiency', 'Irritable bowel syndrome', 'Sleep apnea',
  'Rheumatoid arthritis',
]

function ResearchTab() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [activeSection, setActiveSection] = useState('overview')
  const [copied, setCopied] = useState(false)

  const run = async (q) => {
    const topic = (q || query).trim()
    if (!topic) return
    setQuery(topic)
    setLoading(true)
    setResult(null)
    setActiveSection('overview')
    try {
      const { data } = await aiApi.research(topic)
      setResult(data)
      setHistory(prev => [{ query: topic, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 7)])
    } finally {
      setLoading(false)
    }
  }

  const copyResult = () => {
    if (!result) return
    const text = [
      `MEDICAL RESEARCH: ${result.topic || result.query}`,
      ``,
      `OVERVIEW`,
      result.overview || result.summary,
      ``,
      result.key_facts?.length ? `KEY FACTS\n${result.key_facts.map(f => `• ${f}`).join('\n')}` : '',
      result.treatment_options?.length ? `\nTREATMENT OPTIONS\n${result.treatment_options.map(t => `• ${t.type}: ${t.description}`).join('\n')}` : '',
      result.when_to_see_doctor?.length ? `\nWHEN TO SEE A DOCTOR\n${result.when_to_see_doctor.map(w => `• ${w}`).join('\n')}` : '',
      `\nDisclaimer: ${result.disclaimer || 'For educational purposes only.'}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const SECTIONS = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'facts', label: '💡 Key Facts' },
    { id: 'treatment', label: '💊 Treatment' },
    { id: 'lifestyle', label: '🌿 Lifestyle' },
    { id: 'sources', label: '📚 Sources' },
  ]

  return (
    <div className="research-layout">
      {/* Left: search + history */}
      <div className="research-sidebar">
        <div className="glass-card research-search-card">
          <p className="eyebrow">🔬 AI Research Assistant</p>
          <h3>Medical Knowledge Base</h3>
          <div className="research-input-row">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="Search any medical topic…"
            />
            <button className="primary-button" onClick={() => run()} disabled={loading || !query.trim()}
              style={{ padding: '12px 16px', flexShrink: 0 }}>
              {loading ? '⟳' : '🔍'}
            </button>
          </div>

          {/* Topic suggestions */}
          <div style={{ marginTop: 12 }}>
            <p className="ai-section-label" style={{ marginBottom: 8 }}>Popular topics</p>
            <div className="research-topics">
              {RESEARCH_TOPICS.map(t => (
                <button key={t} className="research-topic-chip" onClick={() => run(t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Search history */}
        {history.length > 0 && (
          <div className="glass-card" style={{ padding: 16 }}>
            <p className="ai-section-label" style={{ marginBottom: 8 }}>Recent searches</p>
            {history.map((h, i) => (
              <button key={i} className="research-history-item" onClick={() => run(h.query)}>
                <span style={{ flex: 1, textAlign: 'left', fontSize: '0.82rem' }}>{h.query}</span>
                <span className="muted" style={{ fontSize: '0.7rem' }}>{h.time}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: results */}
      <div className="research-results">
        {!result && !loading && (
          <div className="glass-card research-empty">
            <p style={{ fontSize: '2.5rem' }}>🔬</p>
            <h3>Search any medical topic</h3>
            <p className="muted">Get comprehensive, evidence-based summaries on conditions, treatments, medications, and more.</p>
            <div className="research-topics" style={{ marginTop: 16, justifyContent: 'center' }}>
              {RESEARCH_TOPICS.slice(0, 4).map(t => (
                <button key={t} className="research-topic-chip" onClick={() => run(t)}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="glass-card research-empty">
            <div className="research-loading">
              <div className="research-loading-step">🔍 Searching knowledge base…</div>
              <div className="research-loading-step" style={{ animationDelay: '0.5s' }}>📚 Retrieving clinical context…</div>
              <div className="research-loading-step" style={{ animationDelay: '1s' }}>🧠 Synthesising with AI…</div>
            </div>
          </div>
        )}

        {result && (
          <div className="glass-card research-result-card">
            {/* Header */}
            <div className="research-result-header">
              <div>
                <p className="eyebrow">Research Result</p>
                <h3 style={{ margin: '4px 0 0' }}>{result.topic || result.query}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  {result.sources_used} sources · {Math.round((result.confidence_score || 0) * 100)}% confidence
                </span>
                <button className="ghost-button" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={copyResult}>
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="research-section-tabs">
              {SECTIONS.map(s => (
                <button key={s.id}
                  className={`research-section-tab ${activeSection === s.id ? 'research-section-active' : ''}`}
                  onClick={() => setActiveSection(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeSection === 'overview' && (
              <div className="research-section-body">
                <p className="research-overview">{result.overview || result.summary}</p>

                {result.symptoms_or_features?.length > 0 && (
                  <div className="research-block">
                    <p className="ai-section-label">Signs & Features</p>
                    <div className="tag-row">
                      {result.symptoms_or_features.map((s, i) => <span key={i} className="tag">{s}</span>)}
                    </div>
                  </div>
                )}

                {result.causes_and_risk_factors?.length > 0 && (
                  <div className="research-block">
                    <p className="ai-section-label">Causes & Risk Factors</p>
                    {result.causes_and_risk_factors.map((c, i) => (
                      <div key={i} className="research-list-item">⚠ {c}</div>
                    ))}
                  </div>
                )}

                {result.diagnosis && (
                  <div className="research-block">
                    <p className="ai-section-label">Diagnosis</p>
                    <p style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{result.diagnosis}</p>
                  </div>
                )}

                {result.when_to_see_doctor?.length > 0 && (
                  <div className="research-block research-warning-block">
                    <p className="ai-section-label" style={{ color: '#ef4444' }}>🚨 When to See a Doctor</p>
                    {result.when_to_see_doctor.map((w, i) => (
                      <div key={i} className="research-list-item" style={{ color: '#b91c1c' }}>• {w}</div>
                    ))}
                  </div>
                )}

                {result.related_conditions?.length > 0 && (
                  <div className="research-block">
                    <p className="ai-section-label">Related Conditions</p>
                    <div className="tag-row">
                      {result.related_conditions.map((c, i) => (
                        <button key={i} className="tag tag-blue research-related-btn" onClick={() => run(c)}>{c} →</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key Facts */}
            {activeSection === 'facts' && (
              <div className="research-section-body">
                {result.key_facts?.length > 0 ? (
                  result.key_facts.map((fact, i) => (
                    <div key={i} className="research-fact-card">
                      <span className="research-fact-num">{i + 1}</span>
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>{fact}</p>
                    </div>
                  ))
                ) : <p className="muted">No key facts available for this topic.</p>}
              </div>
            )}

            {/* Treatment */}
            {activeSection === 'treatment' && (
              <div className="research-section-body">
                {result.treatment_options?.length > 0 ? (
                  result.treatment_options.map((t, i) => (
                    <div key={i} className="research-treatment-card">
                      <span className="research-treatment-type">{typeof t === 'object' ? t.type : 'Treatment'}</span>
                      <p style={{ margin: '6px 0 0', fontSize: '0.88rem', lineHeight: 1.6 }}>
                        {typeof t === 'object' ? t.description : t}
                      </p>
                    </div>
                  ))
                ) : <p className="muted">No treatment information available.</p>}

                {result.prevention?.length > 0 && (
                  <div className="research-block" style={{ marginTop: 16 }}>
                    <p className="ai-section-label">Prevention</p>
                    {result.prevention.map((p, i) => (
                      <div key={i} className="research-list-item">✓ {p}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lifestyle */}
            {activeSection === 'lifestyle' && (
              <div className="research-section-body">
                {result.lifestyle_advice?.length > 0 ? (
                  <div className="rec-lifestyle-grid">
                    {result.lifestyle_advice.map((a, i) => (
                      <div key={i} className="rec-lifestyle-card">
                        <span style={{ fontSize: '1.2rem' }}>{['💧','🚶','😴','🥗','🧘','🚭','🏃','🧠'][i % 8]}</span>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>{a}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">No lifestyle advice available.</p>}
              </div>
            )}

            {/* Sources */}
            {activeSection === 'sources' && (
              <div className="research-section-body">
                <p className="ai-section-label" style={{ marginBottom: 12 }}>RAG Knowledge Sources ({result.sources_used} documents retrieved)</p>
                {result.rag_documents?.length > 0 ? (
                  result.rag_documents.map((doc, i) => (
                    <div key={i} className="research-source-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="tag tag-blue" style={{ fontSize: '0.72rem' }}>{doc.category}</span>
                        <span className="muted" style={{ fontSize: '0.72rem' }}>Relevance: {Math.round((doc.score || 0) * 100)}%</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#5f7489' }}>{doc.text?.slice(0, 200)}…</p>
                    </div>
                  ))
                ) : <p className="muted">No source documents available.</p>}
                <p className="muted" style={{ fontSize: '0.72rem', marginTop: 12, padding: '10px', background: 'rgba(16,36,58,0.04)', borderRadius: 10 }}>
                  ⚠ {result.disclaimer || 'This information is for educational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Risk Analyser tab ── */
function RiskGraphTab() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    patientApi.profile().then(({ data }) => setProfile(data)).catch(() => {})
    chatApi.history().then(({ data }) => {
      // pre-fill with last message
      if (data[0]?.user_message) setText(data[0].user_message)
    }).catch(() => {})
  }, [])

  const run = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const analyzeRes = await aiApi.analyze(text, profile)
      const symptoms = analyzeRes.data?.extracted_symptoms?.symptoms || [text]
      const historyRes = await chatApi.history()
      const historyScores = historyRes.data
        .slice(0, 10)
        .map(h => h.ai_response?.risk_assessment?.risk_score || 0)
        .filter(s => s > 0)
      const { data } = await aiApi.riskAnalysis(symptoms, profile, historyScores)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const RISK_COL = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }
  const risk = result?.risk
  const riskColor = risk ? (RISK_COL[risk.level] || '#22c55e') : '#22c55e'

  return (
    <div className="glass-card prep-card">
      <p className="eyebrow">📊 Risk Analyser & Predictor</p>
      <h3>Deep multi-factor risk assessment</h3>
      <div style={{ display: 'flex', gap: 10 }}>
        <textarea rows={2} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), run())}
          placeholder="Describe your symptoms for deep risk analysis…"
          style={{ flex: 1, resize: 'none' }} />
        <button className="primary-button" onClick={run} disabled={loading || !text.trim()}
          style={{ alignSelf: 'flex-end', padding: '12px 20px' }}>
          {loading ? '⟳ Analysing…' : 'Analyse Risk'}
        </button>
      </div>

      {result && (
        <div className="prep-result">

          {/* Risk gauge + score */}
          <div className="risk-analysis-header">
            <div className="risk-gauge-large">
              <svg viewBox="0 0 200 120" width="200" height="120">
                <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
                <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke={riskColor} strokeWidth="16"
                  strokeLinecap="round" strokeDasharray={`${(risk.risk_score / 100) * 251} 251`} />
                <text x="100" y="90" textAnchor="middle" fontSize="32" fontWeight="800" fill={riskColor}>{risk.risk_score}</text>
                <text x="100" y="108" textAnchor="middle" fontSize="11" fill="#5f7489">{risk.level} RISK</text>
              </svg>
            </div>
            <div className="risk-analysis-meta">
              <div className="risk-badge-large" style={{ background: riskColor }}>
                {risk.level === 'HIGH' ? '🚨' : risk.level === 'MEDIUM' ? '⚠️' : '✅'} {risk.level} RISK
              </div>
              <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>{risk.urgency}</p>
              <p className="muted" style={{ fontSize: '0.82rem' }}>Confidence: {Math.round(risk.confidence * 100)}%</p>
              {result.trend !== 'stable' && (
                <p style={{ color: result.trend === 'worsening' ? '#ef4444' : '#22c55e', fontWeight: 600, fontSize: '0.85rem', marginTop: 6 }}>
                  {result.trend === 'worsening' ? '📈 Trend: Worsening' : '📉 Trend: Improving'}
                </p>
              )}
            </div>
          </div>

          {/* Emergency red flags */}
          {risk.red_flags?.length > 0 && (
            <div className="risk-emergency-box">
              <p className="ai-section-label" style={{ color: '#ef4444' }}>🚨 Emergency Red Flags Detected</p>
              <div className="tag-row">
                {risk.red_flags.map(f => <span key={f} className="tag" style={{ background: 'rgba(239,68,68,0.15)', color: '#b91c1c' }}>{f}</span>)}
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div className="prep-section">
            <p className="ai-section-label">Score Breakdown</p>
            <div className="risk-breakdown-grid">
              {Object.entries(risk.score_breakdown).filter(([, v]) => v > 0).map(([key, val]) => (
                <div key={key} className="risk-breakdown-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                    <strong style={{ fontSize: '0.78rem', color: riskColor }}>+{val}</strong>
                  </div>
                  <div className="risk-score-track">
                    <div className="risk-score-fill" style={{ width: `${Math.min((val / 40) * 100, 100)}%`, background: riskColor }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk factors ranked */}
          {result.risk_factors_ranked?.filter(f => f.present).length > 0 && (
            <div className="prep-section">
              <p className="ai-section-label">Risk Factors (ranked by impact)</p>
              {result.risk_factors_ranked.filter(f => f.present).map((f, i) => (
                <div key={i} className="risk-factor-row">
                  <span className="risk-factor-rank">#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{f.factor}</span>
                  <div style={{ width: 80, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min((f.weight / 35) * 100, 100)}%`, height: '100%', background: riskColor, borderRadius: 3 }} />
                  </div>
                  <strong style={{ fontSize: '0.78rem', color: riskColor, minWidth: 28, textAlign: 'right' }}>+{f.weight}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Dangerous combinations */}
          {risk.factors?.dangerous_combinations?.length > 0 && (
            <div className="prep-section">
              <p className="ai-section-label">⚠️ Dangerous Symptom Combinations</p>
              {risk.factors.dangerous_combinations.map((c, i) => (
                <div key={i} className="risk-combo-item">
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>+{c.boost}</span>
                  <span style={{ fontSize: '0.85rem' }}>{c.note}</span>
                </div>
              ))}
            </div>
          )}

          {/* Prediction */}
          {risk.prediction && (
            <div className="risk-prediction-box" style={{ borderLeftColor: riskColor }}>
              <p className="ai-section-label">🔮 Risk Prediction</p>
              <div className="stack-list compact-list" style={{ marginTop: 8 }}>
                <div className="inline-stat"><span>Short term</span><span style={{ fontSize: '0.82rem', color: '#5f7489', textAlign: 'right', maxWidth: '60%' }}>{risk.prediction.short_term}</span></div>
                <div className="inline-stat"><span>If untreated</span><span style={{ fontSize: '0.82rem', color: '#ef4444', textAlign: 'right', maxWidth: '60%' }}>{risk.prediction.if_untreated}</span></div>
                <div className="inline-stat"><span>Action needed</span><strong style={{ fontSize: '0.82rem', textAlign: 'right', maxWidth: '60%' }}>{risk.prediction.recommended_action}</strong></div>
                <div className="inline-stat"><span>Timeframe</span><strong style={{ color: riskColor }}>{risk.prediction.timeframe}</strong></div>
              </div>
            </div>
          )}

          {/* What-if simulations */}
          {result.what_if_simulations?.length > 0 && (
            <div className="prep-section">
              <p className="ai-section-label">🧪 What-If Simulations</p>
              {result.what_if_simulations.map((sim, i) => (
                <div key={i} className="whatif-item">
                  <span style={{ fontSize: '0.82rem', flex: 1 }}>{sim.scenario}</span>
                  <span className="risk-badge" style={{ background: RISK_COL[sim.level] || '#22c55e', fontSize: '0.68rem' }}>{sim.level}</span>
                  <span style={{ fontSize: '0.82rem', color: sim.delta < 0 ? '#22c55e' : '#ef4444', fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                    {sim.delta > 0 ? '+' : ''}{sim.delta}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Worsening signs */}
          <div className="prep-section">
            <p className="ai-section-label">⚠️ Watch for these worsening signs</p>
            {risk.worsening_signs?.map((s, i) => (
              <div key={i} className="prep-item">• {s}</div>
            ))}
          </div>

          {/* Recommendations */}
          {result.recommendations?.precautions?.length > 0 && (
            <div className="prep-section">
              <p className="ai-section-label">✅ Recommended Actions</p>
              {result.recommendations.precautions.slice(0, 4).map((p, i) => (
                <div key={i} className="rec-item">✓ {p}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main Chat page ── */
const TABS = [
  { id: 'chat', label: '💬 Consultation' },
  { id: 'prep', label: '📋 Prep Mode' },
  { id: 'research', label: '🔬 Research' },
  { id: 'graph', label: '📊 Risk Graph' },
]

export default function Chat() {
  const [tab, setTab] = useState('chat')

  return (
    <div className="page-stack">
      <div className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'tab-btn-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="chat-page">
          <div className="chat-main"><ConsultationTab /></div>
        </div>
      )}
      {tab === 'prep' && <PrepTab />}
      {tab === 'research' && <ResearchTab />}
      {tab === 'graph' && <RiskGraphTab />}
    </div>
  )
}
