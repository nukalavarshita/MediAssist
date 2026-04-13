import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatApi, patientApi } from '../api'

const RISK_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }

function Section({ icon, title, children, color = '#2a7c89' }) {
  const [open, setOpen] = useState(true)
  return (
    <article className="glass-card rec-section">
      <div className="rec-section-header" onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="rec-section-icon" style={{ background: color + '18', color }}>{icon}</span>
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>
        <span style={{ color: '#5f7489', fontSize: '0.85rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className="rec-section-body">{children}</div>}
    </article>
  )
}

function EmptyState({ navigate }) {
  return (
    <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>🩺</p>
      <h3>No recommendations yet</h3>
      <p className="muted">Start an AI consultation to get personalized health recommendations.</p>
      <button className="primary-button" style={{ marginTop: 16 }} onClick={() => navigate('/chat')}>
        Start Consultation
      </button>
    </div>
  )
}

export default function Recommendations() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [profile, setProfile] = useState(null)
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      chatApi.history().then(({ data }) => setHistory(data.filter(h => h.ai_response))),
      patientApi.profile().then(({ data }) => setProfile(data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loader">Loading recommendations…</div>
  if (!history.length) return <div className="page-stack"><EmptyState navigate={navigate} /></div>

  const item = history[selected]
  const ai = item?.ai_response || {}
  const recs = ai.recommendations || {}
  const llm = ai.llm_analysis || {}
  const risk = ai.risk_assessment || {}
  const doctors = ai.doctor_recommendations || []
  const riskColor = RISK_COLOR[risk.level] || '#22c55e'

  const conditions = (llm.possible_conditions || []).map(c =>
    typeof c === 'object' ? c : { name: c, likelihood: 'medium', reasoning: '' }
  )

  return (
    <div className="page-stack">
      {/* Header */}
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Recommendations</p>
          <h2>Your personalised health guidance</h2>
          <p className="muted">Based on your AI consultations — updated after each assessment.</p>
        </div>
        <div className="hero-stat">
          <span style={{ color: riskColor }}>{risk.risk_score ?? 0}</span>
          <p>Risk score</p>
        </div>
      </section>

      {/* Consultation selector */}
      <div className="rec-selector">
        <p className="eyebrow" style={{ marginBottom: 8 }}>Select consultation</p>
        <div className="rec-selector-list">
          {history.slice(0, 8).map((h, i) => (
            <button
              key={h.id}
              className={`rec-selector-btn ${selected === i ? 'rec-selector-active' : ''}`}
              onClick={() => setSelected(i)}
              style={selected === i ? { borderColor: RISK_COLOR[h.risk_level], background: RISK_COLOR[h.risk_level] + '12' } : {}}
            >
              <span className="rec-sel-dot" style={{ background: RISK_COLOR[h.risk_level] || '#22c55e' }} />
              <span className="rec-sel-text">{h.user_message?.slice(0, 40)}{h.user_message?.length > 40 ? '…' : ''}</span>
              <span className="muted" style={{ fontSize: '0.7rem', flexShrink: 0 }}>{h.created_at?.slice(0, 10)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Risk summary bar */}
      <div className="rec-risk-bar" style={{ borderLeftColor: riskColor, background: riskColor + '0d' }}>
        <span className="risk-badge" style={{ background: riskColor }}>{risk.level} RISK</span>
        <p style={{ margin: 0, flex: 1 }}>{risk.urgency}</p>
        <span className="muted" style={{ fontSize: '0.78rem' }}>Confidence: {Math.round((risk.confidence || 0) * 100)}%</span>
      </div>

      {/* Assessment */}
      {llm.assessment && (
        <Section icon="🧠" title="AI Assessment" color="#2a7c89">
          <p style={{ lineHeight: 1.7 }}>{llm.assessment}</p>
          {llm.explanation && (
            <p className="muted" style={{ marginTop: 8, fontSize: '0.88rem', lineHeight: 1.6 }}>{llm.explanation}</p>
          )}
        </Section>
      )}

      {/* Possible conditions */}
      {conditions.length > 0 && (
        <Section icon="🔬" title="Possible Conditions" color="#8b5cf6">
          <div className="rec-conditions-grid">
            {conditions.map((c, i) => (
              <div key={i} className="rec-condition-card" style={{
                borderLeftColor: c.likelihood === 'high' ? '#ef4444' : c.likelihood === 'medium' ? '#f59e0b' : '#22c55e'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong>{c.name}</strong>
                  <span className="risk-badge" style={{
                    background: c.likelihood === 'high' ? '#ef4444' : c.likelihood === 'medium' ? '#f59e0b' : '#22c55e',
                    fontSize: '0.65rem'
                  }}>{c.likelihood}</span>
                </div>
                {c.reasoning && <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>{c.reasoning}</p>}
                {c.matching_symptoms?.length > 0 && (
                  <div className="tag-row" style={{ marginTop: 6 }}>
                    {c.matching_symptoms.map(s => <span key={s} className="tag" style={{ fontSize: '0.7rem' }}>{s}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Precautions */}
      {recs.precautions?.length > 0 && (
        <Section icon="⚠️" title="Precautions & Immediate Actions" color="#f59e0b">
          <div className="stack-list">
            {recs.precautions.map((p, i) => (
              <div key={i} className="rec-item" style={{ background: i === 0 && risk.level === 'HIGH' ? 'rgba(239,68,68,0.08)' : undefined }}>
                <span style={{ color: i === 0 && risk.level !== 'LOW' ? riskColor : '#22c55e', fontWeight: 700, marginRight: 8 }}>
                  {i === 0 && risk.level !== 'LOW' ? '⚡' : '✓'}
                </span>
                {p}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Suggested tests */}
      {recs.tests?.length > 0 && (
        <Section icon="🧪" title="Suggested Tests" color="#2a7c89">
          <div className="rec-tests-grid">
            {recs.tests.map((t, i) => (
              <div key={i} className="rec-test-card">
                <span className="rec-test-icon">🔬</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Care plan */}
      {llm.care_plan?.length > 0 && (
        <Section icon="📋" title="Care Plan" color="#14334a">
          <div className="rec-care-plan">
            {llm.care_plan.map((step, i) => (
              <div key={i} className="rec-care-step">
                <div className="rec-care-num">{i + 1}</div>
                <p style={{ margin: 0, flex: 1 }}>{step}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Lifestyle advice */}
      {(recs.lifestyle?.length > 0 || llm.lifestyle_advice?.length > 0) && (
        <Section icon="🌿" title="Lifestyle Advice" color="#22c55e">
          <div className="rec-lifestyle-grid">
            {(recs.lifestyle || llm.lifestyle_advice || []).map((a, i) => (
              <div key={i} className="rec-lifestyle-card">
                <span style={{ fontSize: '1.2rem' }}>
                  {['💧', '🚶', '😴', '🥗', '🧘', '🚭', '🏃', '🧠'][i % 8]}
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>{a}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Doctor recommendations */}
      {doctors.length > 0 && (
        <Section icon="👨‍⚕️" title="Recommended Specialists" color="#e85d3f">
          <div className="doctor-grid">
            {doctors.slice(0, 4).map(doc => (
              <div key={doc.id} className="glass-card doctor-card" style={{ boxShadow: 'none', border: '1px solid rgba(16,36,58,0.08)' }}>
                <div className="doctor-card-header">
                  <div className="doctor-avatar">{doc.name.split(' ').slice(-1)[0][0]}</div>
                  <div className="doctor-info">
                    <strong style={{ fontSize: '0.9rem' }}>{doc.name}</strong>
                    <p className="eyebrow" style={{ margin: '2px 0' }}>{doc.specialty}</p>
                    <div className="star-rating">
                      {[1,2,3,4,5].map(s => <span key={s} style={{ color: s <= Math.round(doc.rating) ? '#f59e0b' : '#d1d5db' }}>★</span>)}
                      <span className="rating-num">{doc.rating}</span>
                    </div>
                  </div>
                  <div className="exp-badge">{doc.experience_years}y</div>
                </div>
                <p className="muted" style={{ fontSize: '0.78rem', margin: '8px 0 4px' }}>🏥 {doc.hospital}</p>
                {doc.match_reasons?.length > 0 && (
                  <div className="tag-row">
                    {doc.match_reasons.slice(0, 2).map(r => <span key={r} className="tag" style={{ fontSize: '0.7rem' }}>{r}</span>)}
                  </div>
                )}
                <p className="urgency-note" style={{ borderLeftColor: riskColor, marginTop: 8, fontSize: '0.78rem' }}>
                  {doc.urgency_note}
                </p>
              </div>
            ))}
          </div>
          <button className="ghost-button" style={{ marginTop: 12, width: '100%' }} onClick={() => navigate('/doctors')}>
            View all doctors →
          </button>
        </Section>
      )}

      {/* Follow-up questions */}
      {llm.follow_up_questions?.length > 0 && (
        <Section icon="❓" title="Questions to Ask Your Doctor" color="#5f7489">
          <div className="stack-list">
            {llm.follow_up_questions.map((q, i) => (
              <div key={i} className="prep-question">❓ {q}</div>
            ))}
          </div>
        </Section>
      )}

      {/* Symptom breakdown */}
      {llm.symptom_breakdown && Object.keys(llm.symptom_breakdown).length > 0 && (
        <Section icon="📊" title="Symptom Breakdown" color="#2a7c89">
          <div className="stack-list">
            {Object.entries(llm.symptom_breakdown).map(([symptom, note]) => (
              <div key={symptom} className="rec-symptom-row">
                <span className="tag tag-blue" style={{ flexShrink: 0 }}>{symptom}</span>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem', flex: 1 }}>{note}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* CTA */}
      <div className="glass-card" style={{ padding: 24, textAlign: 'center', background: 'linear-gradient(135deg, rgba(20,51,74,0.05), rgba(42,124,137,0.05))' }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Want updated recommendations?</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="primary-button" onClick={() => navigate('/chat')}>💬 New Consultation</button>
          <button className="ghost-button" onClick={() => navigate('/calendar')}>📅 Log Symptoms</button>
        </div>
      </div>
    </div>
  )
}
