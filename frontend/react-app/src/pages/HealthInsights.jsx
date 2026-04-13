import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { vectorApi } from '../api'

const QUICK_TOPICS = [
  { label: 'Diabetes', query: 'diabetes symptoms treatment', icon: '🩸' },
  { label: 'Heart Disease', query: 'chest pain heart attack symptoms', icon: '❤️' },
  { label: 'Asthma', query: 'asthma breathing difficulty', icon: '🫁' },
  { label: 'Migraine', query: 'migraine headache treatment', icon: '🧠' },
  { label: 'Anxiety', query: 'anxiety mental health symptoms', icon: '💙' },
  { label: 'Hypertension', query: 'high blood pressure hypertension', icon: '💊' },
  { label: 'Arthritis', query: 'joint pain arthritis rheumatoid', icon: '🦴' },
  { label: 'Thyroid', query: 'thyroid hypothyroidism fatigue', icon: '⚗️' },
]

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(16,36,58,0.1)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '3px 0 0', fontSize: '0.8rem', color: p.color }}>
          {p.name}: {p.value}{p.name === 'Relevance' ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

function InsightCard({ icon, title, color, children }) {
  return (
    <div className="insight-card glass-card">
      <div className="insight-card-header">
        <span className="insight-card-icon" style={{ background: color + '14', color }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
      </div>
      <div className="insight-card-body">{children}</div>
    </div>
  )
}

function KnowledgeDoc({ doc, index }) {
  const [expanded, setExpanded] = useState(false)
  const catColors = {
    infectious: '#ef4444', cardiology: '#e85d3f', respiratory: '#2a7c89',
    neurology: '#8b5cf6', gastroenterology: '#f59e0b', 'mental-health': '#06b6d4',
    chronic: '#f97316', endocrinology: '#84cc16', rheumatology: '#ec4899',
    dermatology: '#a78bfa', hematology: '#dc2626', urology: '#0ea5e9',
    allergy: '#65a30d', emergency: '#ef4444', general: '#6b7280',
  }
  const color = catColors[doc.category] || '#6b7280'
  const relevancePct = Math.round(doc.score * 100)

  return (
    <div className="insight-doc-card" style={{ borderLeftColor: color }}>
      <div className="insight-doc-header" onClick={() => setExpanded(v => !v)}>
        <div className="insight-doc-rank" style={{ background: color }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="tag" style={{ background: color + '14', color, fontSize: '0.68rem', padding: '2px 8px' }}>
              {doc.category}
            </span>
            <div className="insight-relevance-bar-wrap">
              <div className="insight-relevance-bar" style={{ width: `${relevancePct}%`, background: color }} />
            </div>
            <span style={{ fontSize: '0.72rem', color, fontWeight: 700, flexShrink: 0 }}>{relevancePct}% match</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#5f7489', lineHeight: 1.4 }}>
            {expanded ? doc.text : doc.text.slice(0, 100) + (doc.text.length > 100 ? '…' : '')}
          </p>
        </div>
        <span style={{ color: '#94a3b8', fontSize: '0.75rem', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
    </div>
  )
}

export default function HealthInsights() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeChart, setActiveChart] = useState('category')

  const search = async (q) => {
    const topic = (q || query).trim()
    if (!topic) return
    setQuery(topic)
    setLoading(true)
    setResult(null)
    try {
      const { data } = await vectorApi.insights(topic, 8)
      setResult(data)
      setActiveChart('category')
    } finally {
      setLoading(false)
    }
  }

  const CHART_TABS = [
    { id: 'category', label: '🏥 By Category' },
    { id: 'relevance', label: '📊 Relevance' },
    { id: 'terms', label: '🔤 Key Terms' },
    { id: 'radar', label: '🕸️ Coverage' },
  ]

  return (
    <div className="page-stack">
      {/* Hero */}
      <section className="insight-hero">
        <div>
          <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Health Insights</p>
          <h2 style={{ color: '#fff', margin: '6px 0 8px' }}>📚 Understand Your Health</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '0.9rem' }}>
            Search any health topic and see visual insights from our medical knowledge base — powered by RAG retrieval.
          </p>
        </div>
      </section>

      {/* Search */}
      <div className="glass-card insight-search-card">
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search any health topic e.g. diabetes, chest pain, anxiety…"
            style={{ flex: 1 }}
          />
          <button className="primary-button" onClick={() => search()} disabled={loading || !query.trim()}
            style={{ whiteSpace: 'nowrap', padding: '12px 22px' }}>
            {loading ? '⟳ Searching…' : '🔍 Search'}
          </button>
        </div>
        <div className="insight-quick-topics">
          {QUICK_TOPICS.map(t => (
            <button key={t.query} className="insight-topic-chip" onClick={() => search(t.query)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</p>
          <p style={{ fontWeight: 600 }}>Searching medical knowledge base…</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Retrieving relevant documents · Analysing patterns · Building visualisations</p>
        </div>
      )}

      {result && (
        <>
          {/* Summary stats */}
          <div className="insight-stats-row">
            <div className="insight-stat-card">
              <span style={{ fontSize: '1.8rem' }}>📄</span>
              <div>
                <p className="insight-stat-val">{result.total_matched}</p>
                <p className="insight-stat-label">Documents matched</p>
              </div>
            </div>
            <div className="insight-stat-card">
              <span style={{ fontSize: '1.8rem' }}>🏥</span>
              <div>
                <p className="insight-stat-val">{result.category_distribution.length}</p>
                <p className="insight-stat-label">Medical categories</p>
              </div>
            </div>
            <div className="insight-stat-card">
              <span style={{ fontSize: '1.8rem' }}>🎯</span>
              <div>
                <p className="insight-stat-val">
                  {result.relevance_scores[0] ? `${result.relevance_scores[0].score}%` : '—'}
                </p>
                <p className="insight-stat-label">Top match relevance</p>
              </div>
            </div>
            <div className="insight-stat-card">
              <span style={{ fontSize: '1.8rem' }}>📚</span>
              <div>
                <p className="insight-stat-val">{result.knowledge_base_size}</p>
                <p className="insight-stat-label">Total knowledge docs</p>
              </div>
            </div>
          </div>

          {/* Chart tabs */}
          <div className="tab-bar">
            {CHART_TABS.map(t => (
              <button key={t.id} className={`tab-btn ${activeChart === t.id ? 'tab-btn-active' : ''}`}
                onClick={() => setActiveChart(t.id)}>{t.label}</button>
            ))}
          </div>

          {/* Category distribution */}
          {activeChart === 'category' && (
            <InsightCard icon="🏥" title="Medical Category Distribution" color="#2a7c89">
              <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                How many matched documents fall into each medical category — helps you understand which areas of medicine are most relevant to your query.
              </p>
              <div className="insight-chart-layout">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={result.category_distribution} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,39,58,0.07)" />
                    <XAxis dataKey="label" stroke="#35516c" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis stroke="#35516c" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Bar dataKey="count" name="Documents" radius={[6, 6, 0, 0]}>
                      {result.category_distribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="insight-cat-legend">
                  {result.category_distribution.map((cat, i) => (
                    <div key={i} className="insight-cat-item">
                      <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{cat.label}</p>
                        <div className="insight-cat-bar-wrap">
                          <div className="insight-cat-bar" style={{
                            width: `${(cat.count / result.total_matched) * 100}%`,
                            background: cat.color
                          }} />
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: cat.color, fontSize: '0.88rem', flexShrink: 0 }}>
                        {cat.count} doc{cat.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </InsightCard>
          )}

          {/* Relevance scores */}
          {activeChart === 'relevance' && (
            <InsightCard icon="📊" title="Document Relevance Scores" color="#e85d3f">
              <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                How closely each retrieved document matches your query. Higher scores mean the document is more relevant to your health concern.
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={result.relevance_scores} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,39,58,0.07)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#35516c"
                    tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} stroke="#35516c" width={90} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} formatter={v => [`${v}%`, 'Relevance']} />
                  <Bar dataKey="score" name="Relevance" radius={[0, 6, 6, 0]}>
                    {result.relevance_scores.map((entry, i) => (
                      <Cell key={i} fill={`hsl(${200 - i * 15}, 70%, 50%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="insight-relevance-legend">
                <div className="insight-relevance-zone" style={{ background: 'rgba(34,197,94,0.08)', borderLeft: '3px solid #22c55e' }}>
                  <strong style={{ color: '#22c55e' }}>70–100%</strong> Highly relevant
                </div>
                <div className="insight-relevance-zone" style={{ background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #f59e0b' }}>
                  <strong style={{ color: '#f59e0b' }}>40–69%</strong> Moderately relevant
                </div>
                <div className="insight-relevance-zone" style={{ background: 'rgba(107,114,128,0.08)', borderLeft: '3px solid #6b7280' }}>
                  <strong style={{ color: '#6b7280' }}>0–39%</strong> Loosely related
                </div>
              </div>
            </InsightCard>
          )}

          {/* Key terms */}
          {activeChart === 'terms' && (
            <InsightCard icon="🔤" title="Key Medical Terms" color="#8b5cf6">
              <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                The most frequently occurring medical terms across all matched documents — these are the core concepts related to your query.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={result.top_terms.slice(0, 12)} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,39,58,0.07)" />
                  <XAxis dataKey="term" stroke="#35516c" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis stroke="#35516c" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Bar dataKey="count" name="Frequency" radius={[6, 6, 0, 0]}>
                    {result.top_terms.slice(0, 12).map((_, i) => (
                      <Cell key={i} fill={`hsl(${260 + i * 8}, 65%, 55%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="insight-terms-cloud">
                {result.top_terms.map((t, i) => (
                  <span key={i} className="insight-term-chip"
                    style={{
                      fontSize: `${0.7 + (t.count / result.top_terms[0].count) * 0.5}rem`,
                      opacity: 0.5 + (t.count / result.top_terms[0].count) * 0.5,
                      background: `hsl(${260 + i * 8}, 65%, 95%)`,
                      color: `hsl(${260 + i * 8}, 65%, 35%)`,
                    }}>
                    {t.term}
                  </span>
                ))}
              </div>
            </InsightCard>
          )}

          {/* Radar coverage */}
          {activeChart === 'radar' && (
            <InsightCard icon="🕸️" title="Knowledge Coverage Map" color="#06b6d4">
              <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                A radar view showing how broadly your query spans different medical specialties. A wider shape means more comprehensive coverage.
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={result.category_distribution.map(c => ({
                  subject: c.label.split(' ')[0],
                  value: c.count,
                  fullMark: result.total_matched,
                }))}>
                  <PolarGrid stroke="rgba(16,36,58,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#5f7489' }} />
                  <Radar name="Documents" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </RadarChart>
              </ResponsiveContainer>
            </InsightCard>
          )}

          {/* Retrieved documents */}
          <InsightCard icon="📄" title={`Retrieved Documents (${result.total_matched})`} color="#14334a">
            <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 14px' }}>
              These are the actual medical knowledge documents retrieved from our RAG database. Click any document to read the full text.
            </p>
            <div className="insight-docs-list">
              {result.matches.map((doc, i) => (
                <KnowledgeDoc key={doc.id} doc={doc} index={i} />
              ))}
            </div>
          </InsightCard>

          {/* RAG explanation */}
          <div className="insight-rag-explainer glass-card">
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>🤖</span>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 700 }}>How does this work?</p>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7 }}>
                  This page uses <strong>Retrieval-Augmented Generation (RAG)</strong> — a technique where your query is matched against a curated medical knowledge base using vector similarity search.
                  The AI finds the most relevant documents, analyses patterns across them, and presents the insights visually so you can understand your health concern better.
                  The knowledge base contains <strong>{result.knowledge_base_size} medical documents</strong> across 14 clinical categories.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📚</p>
          <h3>Explore your health visually</h3>
          <p className="muted">Search any health topic above or tap a quick topic to see visual insights from our medical knowledge base.</p>
          <div className="insight-quick-topics" style={{ justifyContent: 'center', marginTop: 16 }}>
            {QUICK_TOPICS.slice(0, 4).map(t => (
              <button key={t.query} className="insight-topic-chip" onClick={() => search(t.query)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
