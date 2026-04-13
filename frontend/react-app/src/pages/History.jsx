import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { chatApi } from '../api'

const RISK_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }
const RISK_RGB = { HIGH: [239, 68, 68], MEDIUM: [245, 158, 11], LOW: [34, 197, 94] }

function downloadReport(item) {
  const report = item.ai_response?.report
  if (!report) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const margin = 18
  let y = 0

  // ── Header bar
  doc.setFillColor(20, 51, 74)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('HealthPilot AI', margin, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('AI Health Assessment Report', margin, 20)
  doc.text(`Generated: ${report.generated_at || new Date().toUTCString()}`, W - margin, 20, { align: 'right' })
  y = 36

  // ── Risk banner
  const riskLevel = report.risk_summary?.level || 'LOW'
  const [r, g, b] = RISK_RGB[riskLevel] || RISK_RGB.LOW
  doc.setFillColor(r, g, b)
  doc.roundedRect(margin, y, W - margin * 2, 14, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`${riskLevel} RISK  —  Score: ${report.risk_summary?.score ?? 0}/100`, margin + 6, y + 9)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(report.risk_summary?.urgency || '', W - margin - 4, y + 9, { align: 'right' })
  y += 22

  // ── Patient info table
  doc.setTextColor(20, 51, 74)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Patient Information', margin, y)
  y += 4
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [237, 244, 246], textColor: [20, 51, 74], fontStyle: 'bold' },
    body: [
      ['Age', report.patient_summary?.age ?? '—', 'Gender', report.patient_summary?.gender ?? '—'],
      ['Chronic Conditions', (report.patient_summary?.chronic_conditions || []).join(', ') || 'None', 'Allergies', (report.patient_summary?.allergies || []).join(', ') || 'None'],
      ['Medications', (report.patient_summary?.medications || []).join(', ') || 'None', 'Chief Complaint', report.chief_complaint || '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 2: { fontStyle: 'bold', cellWidth: 38 } },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Assessment
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('AI Assessment', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 80, 100)
  const assessLines = doc.splitTextToSize(report.clinical_assessment || 'No assessment available.', W - margin * 2)
  doc.text(assessLines, margin, y)
  y += assessLines.length * 5 + 6

  // ── Possible conditions
  if (report.possible_conditions?.length) {
    doc.setTextColor(20, 51, 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Possible Conditions', margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 51, 74], textColor: 255 },
      head: [['#', 'Condition']],
      body: report.possible_conditions.map((c, i) => [i + 1, typeof c === 'object' ? c.name : c]),
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Tests + Specialists side by side
  const testsBody = (report.recommended_tests || []).map((t, i) => [i + 1, t])
  const specsBody = (report.recommended_specialists || []).map((s, i) => [i + 1, s])
  const halfW = (W - margin * 2 - 6) / 2

  if (testsBody.length || specsBody.length) {
    doc.setTextColor(20, 51, 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Recommended Tests', margin, y)
    doc.text('Recommended Specialists', margin + halfW + 6, y)
    y += 4
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin + halfW + 6 },
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [42, 124, 137], textColor: 255 },
      head: [['#', 'Test']],
      body: testsBody.length ? testsBody : [['—', 'Basic assessment']],
    })
    const leftEnd = doc.lastAutoTable.finalY
    autoTable(doc, {
      startY: y,
      margin: { left: margin + halfW + 6, right: margin },
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [42, 124, 137], textColor: 255 },
      head: [['#', 'Specialist']],
      body: specsBody.length ? specsBody : [['—', 'General Physician']],
    })
    y = Math.max(leftEnd, doc.lastAutoTable.finalY) + 8
  }

  // ── Precautions
  if (report.precautions?.length) {
    doc.setTextColor(20, 51, 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Precautions & Next Steps', margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      body: report.precautions.map((p) => [`• ${p}`]),
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(237, 244, 246)
    doc.rect(0, doc.internal.pageSize.getHeight() - 14, W, 14, 'F')
    doc.setTextColor(95, 116, 137)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'This report is generated by an AI decision support system and is NOT a medical diagnosis. Always consult a qualified healthcare professional.',
      margin, doc.internal.pageSize.getHeight() - 5
    )
    doc.text(`Page ${i} of ${pageCount}`, W - margin, doc.internal.pageSize.getHeight() - 5, { align: 'right' })
  }

  doc.save(`health-report-${item.id}.pdf`)
}

function HistoryCard({ item, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const ai = item.ai_response || {}
  const risk = ai.risk_assessment || {}
  const llm = ai.llm_analysis || {}
  const recs = ai.recommendations || {}
  const explain = ai.advanced_features?.explainability || {}
  const doctors = ai.doctor_recommendations || []

  return (
    <div className="history-card">
      <div className="history-card-header" onClick={() => setExpanded((v) => !v)}>
        <div className="history-card-left">
          <span className="risk-badge" style={{ background: RISK_COLOR[item.risk_level] || '#22c55e' }}>
            {item.risk_level}
          </span>
          <div>
            <p className="history-title">{item.user_message?.slice(0, 100)}{item.user_message?.length > 100 ? '…' : ''}</p>
            <p className="muted">{item.created_at?.slice(0, 16).replace('T', ' ')} UTC • Confidence: {Math.round((item.confidence_score || 0) * 100)}%</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost-button" onClick={(e) => { e.stopPropagation(); downloadReport(item) }}>⬇ PDF</button>
          <button className="ghost-button" onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}>Delete</button>
          <span className="expand-arrow">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="history-card-body">
          {/* Assessment */}
          {llm.assessment && (
            <div className="history-section">
              <p className="ai-section-label">Clinical Assessment</p>
              <p>{llm.assessment}</p>
            </div>
          )}

          {/* Conditions + Risk */}
          <div className="history-two-col">
            {llm.possible_conditions?.length > 0 && (
              <div className="history-section">
                <p className="ai-section-label">Possible Conditions</p>
                <div className="tag-row">
                  {llm.possible_conditions.map((c, i) => {
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
            <div className="history-section">
              <p className="ai-section-label">Risk Factors</p>
              <div className="stack-list compact-list">
                <div className="inline-stat"><span>Score</span><strong style={{ color: RISK_COLOR[item.risk_level] }}>{risk.risk_score ?? '—'}/100</strong></div>
                <div className="inline-stat"><span>Confidence</span><strong>{Math.round((risk.confidence || 0) * 100)}%</strong></div>
                <div className="inline-stat"><span>Symptoms</span><strong>{risk.factors?.symptom_count ?? '—'}</strong></div>
              </div>
            </div>
          </div>

          {/* Tests + Doctors */}
          <div className="history-two-col">
            {recs.tests?.length > 0 && (
              <div className="history-section">
                <p className="ai-section-label">Suggested Tests</p>
                <div className="tag-row">
                  {recs.tests.map((t) => <span key={t} className="tag tag-green">{t}</span>)}
                </div>
              </div>
            )}
            {doctors.length > 0 && (
              <div className="history-section">
                <p className="ai-section-label">Recommended Doctors</p>
                {doctors.slice(0, 2).map((d) => (
                  <div key={d.id} className="doctor-mini-card">
                    <div><strong>{d.name}</strong><p className="muted">{d.specialty}</p></div>
                    <span className="rating-badge">★ {d.rating}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Explainability */}
          {explain.key_factors?.length > 0 && (
            <div className="history-section explainability-box">
              <p className="ai-section-label">🧠 Explainable AI</p>
              <p className="muted">{explain.reasoning_note}</p>
              <div style={{ marginTop: 8 }}>
                <p className="ai-section-label">Key factors</p>
                <div className="tag-row">
                  {explain.key_factors.map((f) => <span key={f} className="tag tag-blue">{f}</span>)}
                </div>
              </div>
              {explain.evidence_categories?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p className="ai-section-label">RAG evidence categories</p>
                  <div className="tag-row">
                    {explain.evidence_categories.map((c) => <span key={c} className="tag">{c}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Follow-up questions */}
          {llm.follow_up_questions?.length > 0 && (
            <div className="history-section">
              <p className="ai-section-label">Follow-up Questions</p>
              {llm.follow_up_questions.map((q) => <p key={q} className="follow-up-q">• {q}</p>)}
            </div>
          )}

          {/* Urgency */}
          {risk.urgency && (
            <div className="urgency-note" style={{ borderLeftColor: RISK_COLOR[item.risk_level] }}>
              {risk.urgency}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function History() {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    chatApi.history().then(({ data }) => setItems(data)).catch(() => setItems([]))
  }, [])

  const handleDelete = async (chatId) => {
    await chatApi.deleteChat(chatId)
    setItems((current) => current.filter((item) => item.id !== chatId))
  }

  const filtered = filter === 'ALL' ? items : items.filter((i) => i.risk_level === filter)

  return (
    <div className="page-stack">
      <section className="glass-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Consultation History</p>
            <h3>All AI-assisted assessments</h3>
          </div>
          <div className="filter-row">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
              <button
                key={level}
                className={`filter-btn ${filter === level ? 'filter-btn-active' : ''}`}
                onClick={() => setFilter(level)}
                style={filter === level && level !== 'ALL' ? { background: RISK_COLOR[level], color: '#fff' } : {}}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="stack-list" style={{ marginTop: 16 }}>
          {filtered.map((item) => (
            <HistoryCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
          {!filtered.length && <p className="muted">No consultations found.</p>}
        </div>
      </section>
    </div>
  )
}
