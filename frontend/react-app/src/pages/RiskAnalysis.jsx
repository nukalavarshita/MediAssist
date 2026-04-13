import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { aiApi, chatApi, patientApi } from '../api'

const RISK_COL = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }
const NODE_COLORS = {
  input: { bg: '#14334a', text: '#fff' },
  symptom: { bg: '#e85d3f', text: '#fff' },
  process: { bg: '#2a7c89', text: '#fff' },
  risk_high: { bg: '#ef4444', text: '#fff' },
  risk_medium: { bg: '#f59e0b', text: '#fff' },
  risk_low: { bg: '#22c55e', text: '#fff' },
  condition: { bg: '#8b5cf6', text: '#fff' },
}

/* ── SVG Decision Graph ── */
function DecisionGraph({ symptoms, risk, conditions }) {
  if (!symptoms?.length) return null

  const riskNodeColor = risk?.level === 'HIGH' ? NODE_COLORS.risk_high
    : risk?.level === 'MEDIUM' ? NODE_COLORS.risk_medium
    : NODE_COLORS.risk_low

  // Layout constants
  const W = 700, H = 420
  const col1X = 80, col2X = 280, col3X = 420, col4X = 580
  const inputY = H / 2

  // Symptom nodes (left column)
  const symptomNodes = symptoms.slice(0, 5).map((s, i) => ({
    id: `s${i}`, label: s, x: col1X,
    y: (H / (symptoms.slice(0, 5).length + 1)) * (i + 1),
    ...NODE_COLORS.symptom,
  }))

  // Process nodes
  const ragNode = { id: 'rag', label: 'RAG\nRetrieval', x: col2X, y: H * 0.35, ...NODE_COLORS.process }
  const llmNode = { id: 'llm', label: 'LLM\nAnalysis', x: col2X, y: H * 0.65, ...NODE_COLORS.process }
  const riskNode = { id: 'risk', label: `Risk\n${risk?.level || '—'}`, x: col3X, y: H / 2, ...riskNodeColor }

  // Condition nodes (right column)
  const condNodes = (conditions || []).slice(0, 3).map((c, i) => ({
    id: `c${i}`,
    label: typeof c === 'object' ? c.name?.slice(0, 18) : c?.slice(0, 18),
    x: col4X,
    y: (H / 4) * (i + 1),
    ...NODE_COLORS.condition,
  }))

  const allNodes = [...symptomNodes, ragNode, llmNode, riskNode, ...condNodes]

  // Edges
  const edges = [
    ...symptomNodes.map(n => ({ from: n, to: ragNode })),
    ...symptomNodes.map(n => ({ from: n, to: llmNode })),
    { from: ragNode, to: riskNode },
    { from: llmNode, to: riskNode },
    ...condNodes.map(n => ({ from: riskNode, to: n })),
  ]

  const nodeW = 90, nodeH = 40, r = 10

  return (
    <div className="dg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="dg-svg">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#cbd5e1" />
          </marker>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const x1 = e.from.x + nodeW / 2, y1 = e.from.y
          const x2 = e.to.x - nodeW / 2, y2 = e.to.y
          const mx = (x1 + x2) / 2
          return (
            <path key={i}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none" stroke="#cbd5e1" strokeWidth="1.5"
              strokeDasharray="4 3" markerEnd="url(#arrow)"
              opacity="0.7"
            />
          )
        })}

        {/* Nodes */}
        {allNodes.map(node => (
          <g key={node.id} filter="url(#shadow)">
            <rect
              x={node.x - nodeW / 2} y={node.y - nodeH / 2}
              width={nodeW} height={nodeH}
              rx={r} ry={r}
              fill={node.bg}
            />
            {node.label.split('\n').map((line, li) => (
              <text key={li}
                x={node.x}
                y={node.y + (li - (node.label.split('\n').length - 1) / 2) * 14}
                textAnchor="middle" dominantBaseline="middle"
                fill={node.text} fontSize="11" fontWeight="600"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        {/* Column labels */}
        {[
          { x: col1X, label: 'Symptoms' },
          { x: col2X, label: 'AI Pipeline' },
          { x: col3X, label: 'Risk Level' },
          { x: col4X, label: 'Conditions' },
        ].map(({ x, label }) => (
          <text key={label} x={x} y={18} textAnchor="middle"
            fill="#94a3b8" fontSize="10" fontWeight="700"
            textTransform="uppercase" letterSpacing="1">
            {label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="dg-legend">
        {[
          { color: '#e85d3f', label: 'Symptom' },
          { color: '#2a7c89', label: 'AI Process' },
          { color: risk?.color || '#22c55e', label: `${risk?.level || 'LOW'} Risk` },
          { color: '#8b5cf6', label: 'Condition' },
        ].map(({ color, label }) => (
          <div key={label} className="dg-legend-item">
            <span className="dg-legend-dot" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Risk Gauge ── */
function RiskGauge({ score, level, color }) {
  const circ = 251
  const dash = (score / 100) * circ
  return (
    <div className="rg-gauge-wrap">
      <svg viewBox="0 0 200 120" className="rg-gauge-svg">
        <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
        <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke={color} strokeWidth="16"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="100" y="88" textAnchor="middle" fontSize="34" fontWeight="900" fill={color}>{score}</text>
        <text x="100" y="108" textAnchor="middle" fontSize="11" fill="#5f7489" fontWeight="600">{level} RISK</text>
      </svg>
    </div>
  )
}

export default function RiskAnalysis() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [historyScores, setHistoryScores] = useState([])
  const [activeTab, setActiveTab] = useState('graph')

  useEffect(() => {
    patientApi.profile().then(({ data }) => setProfile(data)).catch(() => {})
    chatApi.history().then(({ data }) => {
      if (data[0]?.user_message) setText(data[0].user_message)
      const scores = data.slice(0, 10).map(h => h.ai_response?.risk_assessment?.risk_score || 0).filter(s => s > 0)
      setHistoryScores(scores)
    }).catch(() => {})
  }, [])

  const run = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const analyzeRes = await aiApi.analyze(text, profile)
      const symptoms = analyzeRes.data?.extracted_symptoms?.symptoms || [text]
      const { data } = await aiApi.riskAnalysis(symptoms, profile, historyScores)
      setResult({ ...data, symptoms, llm: analyzeRes.data?.llm_analysis })
      setActiveTab('graph')
    } finally {
      setLoading(false)
    }
  }

  const risk = result?.risk
  const riskColor = risk ? (RISK_COL[risk.level] || '#22c55e') : '#22c55e'

  const trendData = historyScores.slice().reverse().map((s, i) => ({ i: i + 1, score: s }))

  const TABS = [
    { id: 'graph', label: '🔗 Decision Graph' },
    { id: 'breakdown', label: '📊 Score Breakdown' },
    { id: 'prediction', label: '🔮 Prediction' },
    { id: 'whatif', label: '🧪 What-If' },
    { id: 'trend', label: '📈 Trend' },
  ]

  return (
    <div className="page-stack">
      {/* Header */}
      <section className="rg-hero">
        <div>
          <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Risk Analysis</p>
          <h2 style={{ color: '#fff', margin: '6px 0 8px' }}>📊 AI Decision Graph</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '0.9rem' }}>
            Visualise how the AI analyses your symptoms and reaches a risk assessment
          </p>
        </div>
      </section>

      {/* Input */}
      <div className="glass-card rg-input-card">
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            rows={2} value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), run())}
            placeholder="Describe your symptoms to generate a risk decision graph…"
            style={{ flex: 1, resize: 'none' }}
          />
          <button className="primary-button" onClick={run} disabled={loading || !text.trim()}
            style={{ alignSelf: 'flex-end', padding: '12px 24px', whiteSpace: 'nowrap' }}>
            {loading ? '⟳ Analysing…' : '🔍 Analyse'}
          </button>
        </div>
        {!result && !loading && (
          <p className="muted" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>
            💡 Your last consultation has been pre-filled. Click Analyse to generate the graph.
          </p>
        )}
      </div>

      {loading && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⟳</div>
          <p style={{ fontWeight: 600 }}>Running multi-agent analysis…</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Extracting symptoms → RAG retrieval → LLM synthesis → Risk scoring</p>
        </div>
      )}

      {result && (
        <>
          {/* Risk summary row */}
          <div className="rg-summary-row">
            <div className="glass-card rg-gauge-card">
              <RiskGauge score={risk.risk_score} level={risk.level} color={riskColor} />
              <p className="muted" style={{ textAlign: 'center', fontSize: '0.78rem', marginTop: 4 }}>Risk Score</p>
            </div>

            <div className="glass-card rg-meta-card">
              <div className="rg-level-badge" style={{ background: riskColor }}>
                {risk.level === 'HIGH' ? '🚨' : risk.level === 'MEDIUM' ? '⚠️' : '✅'} {risk.level} RISK
              </div>
              <p style={{ fontWeight: 600, margin: '10px 0 4px', fontSize: '0.95rem' }}>{risk.urgency}</p>
              <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 12px' }}>
                Confidence: {Math.round(risk.confidence * 100)}%
              </p>
              {result.trend !== 'stable' && (
                <div className="rg-trend-badge" style={{ color: result.trend === 'worsening' ? '#ef4444' : '#22c55e', background: result.trend === 'worsening' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }}>
                  {result.trend === 'worsening' ? '📈 Trend: Worsening' : '📉 Trend: Improving'}
                </div>
              )}
              {risk.red_flags?.length > 0 && (
                <div className="rg-red-flags">
                  <p className="ai-section-label" style={{ color: '#ef4444', marginBottom: 6 }}>🚨 Red Flags</p>
                  <div className="tag-row">
                    {risk.red_flags.map(f => <span key={f} className="tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}>{f}</span>)}
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card rg-symptoms-card">
              <p className="eyebrow">Detected Symptoms</p>
              <div className="rg-symptoms-list">
                {result.symptoms.map((s, i) => (
                  <div key={i} className="rg-symptom-item">
                    <span className="rg-symptom-dot" style={{ background: riskColor }} />
                    <span style={{ textTransform: 'capitalize', fontSize: '0.88rem' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'tab-btn-active' : ''}`}
                onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {/* Decision Graph */}
          {activeTab === 'graph' && (
            <div className="glass-card rg-graph-card">
              <p className="eyebrow">AI Decision Flow</p>
              <h3>How the AI reached this assessment</h3>
              <DecisionGraph
                symptoms={result.symptoms}
                risk={risk}
                conditions={result.llm?.possible_conditions}
              />
              <div className="rg-pipeline">
                {['Symptom Extraction', 'RAG Retrieval', 'LLM Synthesis', 'Risk Scoring', 'Recommendations'].map((step, i, arr) => (
                  <div key={step} className="rg-pipeline-step-wrap">
                    <div className="rg-pipeline-step" style={{ background: i === 3 ? riskColor : undefined }}>
                      <span className="rg-pipeline-num">{i + 1}</span>
                      <span>{step}</span>
                    </div>
                    {i < arr.length - 1 && <span className="rg-pipeline-arrow">→</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="glass-card">
              <p className="eyebrow">Score Breakdown</p>
              <h3>How the risk score of {risk.risk_score}/100 was calculated</h3>
              <div className="rg-breakdown-list">
                {Object.entries(risk.score_breakdown).filter(([, v]) => v > 0).map(([key, val]) => (
                  <div key={key} className="rg-breakdown-row">
                    <span className="rg-breakdown-label">{key.replace(/_/g, ' ')}</span>
                    <div className="rg-breakdown-bar-wrap">
                      <div className="rg-breakdown-bar" style={{ width: `${Math.min((val / 40) * 100, 100)}%`, background: riskColor }} />
                    </div>
                    <span className="rg-breakdown-val" style={{ color: riskColor }}>+{val}</span>
                  </div>
                ))}
              </div>

              {result.risk_factors_ranked?.filter(f => f.present).length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <p className="eyebrow" style={{ marginBottom: 12 }}>Risk Factors — Ranked by Impact</p>
                  {result.risk_factors_ranked.filter(f => f.present).map((f, i) => (
                    <div key={i} className="rg-factor-row">
                      <span className="rg-factor-rank" style={{ background: riskColor }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '0.88rem' }}>{f.factor}</span>
                      <div className="rg-factor-bar-wrap">
                        <div className="rg-factor-bar" style={{ width: `${Math.min((f.weight / 35) * 100, 100)}%`, background: riskColor }} />
                      </div>
                      <strong style={{ color: riskColor, fontSize: '0.82rem', minWidth: 32, textAlign: 'right' }}>+{f.weight}</strong>
                    </div>
                  ))}
                </div>
              )}

              {risk.factors?.dangerous_combinations?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>⚠️ Dangerous Symptom Combinations</p>
                  {risk.factors.dangerous_combinations.map((c, i) => (
                    <div key={i} className="rg-combo-item">
                      <span className="rg-combo-boost">+{c.boost}</span>
                      <span style={{ fontSize: '0.88rem' }}>{c.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prediction */}
          {activeTab === 'prediction' && risk.prediction && (
            <div className="glass-card">
              <p className="eyebrow">Risk Prediction</p>
              <h3>What happens next if untreated</h3>
              <div className="rg-prediction-grid">
                {[
                  { label: 'Short Term', value: risk.prediction.short_term, icon: '⏱️', color: '#2a7c89' },
                  { label: 'If Untreated', value: risk.prediction.if_untreated, icon: '⚠️', color: '#ef4444' },
                  { label: 'Recommended Action', value: risk.prediction.recommended_action, icon: '✅', color: '#22c55e' },
                  { label: 'Timeframe', value: risk.prediction.timeframe, icon: '📅', color: riskColor },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="rg-prediction-card" style={{ borderLeftColor: color }}>
                    <div className="rg-prediction-icon" style={{ background: color + '14', color }}>{icon}</div>
                    <div>
                      <p className="ai-section-label">{label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.9rem', lineHeight: 1.6 }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {risk.worsening_signs?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>⚠️ Watch for These Worsening Signs</p>
                  {risk.worsening_signs.map((s, i) => (
                    <div key={i} className="rg-warning-item">
                      <span style={{ color: '#f59e0b' }}>•</span>
                      <span style={{ fontSize: '0.88rem' }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* What-If */}
          {activeTab === 'whatif' && (
            <div className="glass-card">
              <p className="eyebrow">What-If Simulations</p>
              <h3>How different factors change your risk score</h3>
              <div className="rg-whatif-list">
                {result.what_if_simulations?.map((sim, i) => (
                  <div key={i} className="rg-whatif-row">
                    <div className="rg-whatif-scenario">{sim.scenario}</div>
                    <div className="rg-whatif-right">
                      <span className="risk-badge" style={{ background: RISK_COL[sim.level] || '#22c55e', fontSize: '0.7rem' }}>{sim.level}</span>
                      <div className="rg-whatif-score">{sim.risk_score}</div>
                      <div className={`rg-whatif-delta ${sim.delta < 0 ? 'delta-better' : 'delta-worse'}`}>
                        {sim.delta > 0 ? '+' : ''}{sim.delta}
                      </div>
                    </div>
                  </div>
                ))}
                {!result.what_if_simulations?.length && (
                  <p className="muted">No what-if simulations available. Add age and chronic conditions to your profile for richer simulations.</p>
                )}
              </div>
              <p className="muted" style={{ fontSize: '0.78rem', marginTop: 16 }}>
                💡 What-if simulations show how your risk score would change under different patient profiles. Update your profile for more personalised results.
              </p>
            </div>
          )}

          {/* Trend */}
          {activeTab === 'trend' && (
            <div className="glass-card">
              <p className="eyebrow">Risk Trend</p>
              <h3>Your risk score over recent consultations</h3>
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={riskColor} stopOpacity={0.7} />
                        <stop offset="95%" stopColor={riskColor} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,39,58,0.07)" />
                    <XAxis dataKey="i" stroke="#35516c" tick={{ fontSize: 11 }} label={{ value: 'Consultation', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="#35516c" tick={{ fontSize: 11 }} label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      formatter={v => [`${v}/100`, 'Risk Score']} />
                    <Area type="monotone" dataKey="score" stroke={riskColor} fill="url(#riskGrad)" strokeWidth={2.5} dot={{ fill: riskColor, r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#5f7489' }}>
                  <p style={{ fontSize: '1.5rem' }}>📈</p>
                  <p>Complete more consultations to see your risk trend over time.</p>
                  <button className="primary-button" style={{ marginTop: 12 }} onClick={() => navigate('/chat')}>
                    Start a Consultation
                  </button>
                </div>
              )}
              <div className="rg-trend-legend">
                <div className="rg-trend-zone" style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #ef4444' }}>
                  <strong style={{ color: '#ef4444' }}>75–100</strong> High Risk
                </div>
                <div className="rg-trend-zone" style={{ background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #f59e0b' }}>
                  <strong style={{ color: '#f59e0b' }}>45–74</strong> Medium Risk
                </div>
                <div className="rg-trend-zone" style={{ background: 'rgba(34,197,94,0.08)', borderLeft: '3px solid #22c55e' }}>
                  <strong style={{ color: '#22c55e' }}>0–44</strong> Low Risk
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
