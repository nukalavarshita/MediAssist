import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { aiApi, chatApi, gatewayApi, patientApi } from '../api'

const RISK_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }
const SEV_SCORE = { mild: 1, moderate: 2, severe: 3 }
const PIE_COLORS = ['#e85d3f', '#f59e0b', '#2a7c89', '#22c55e', '#8b5cf6']

/* ── Health Score Ring ── */
function HealthScoreRing({ score, label, color }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="hs-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 70 70)" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="70" y="66" textAnchor="middle" fontSize="26" fontWeight="800" fill={color}>{score}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="10" fill="#5f7489">{label}</text>
      </svg>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ icon, label, value, sub, color, onClick }) {
  return (
    <div className="dash-stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="dash-stat-icon" style={{ background: color + '18', color }}>{icon}</div>
      <div>
        <p className="dash-stat-value" style={{ color }}>{value}</p>
        <p className="dash-stat-label">{label}</p>
        {sub && <p className="muted" style={{ fontSize: '0.72rem', margin: 0 }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Alert Banner ── */
function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(false)
  if (!alerts.length || dismissed) return null
  const top = alerts[0]
  const color = RISK_COLOR[top.risk_level] || '#f59e0b'
  return (
    <div className="dash-alert" style={{ borderLeftColor: color, background: color + '12' }}>
      <span style={{ fontSize: '1.3rem' }}>{top.risk_level === 'HIGH' ? '🚨' : '⚠️'}</span>
      <div style={{ flex: 1 }}>
        <strong style={{ color }}>{top.risk_level === 'HIGH' ? 'Emergency Alert' : 'Health Advisory'}</strong>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>{top.urgency}</p>
      </div>
      <button className="ghost-button" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => setDismissed(true)}>Dismiss</button>
    </div>
  )
}

/* ── AI Insight Card ── */
function AiInsightCard({ history }) {
  if (!history.length) return null
  const latest = history[0]
  const llm = latest.ai_response?.llm_analysis
  const conditions = llm?.possible_conditions?.slice(0, 2) || []
  const riskColor = RISK_COLOR[latest.risk_level] || '#22c55e'

  return (
    <article className="glass-card dash-insight-card">
      <div className="dash-insight-header">
        <div>
          <p className="eyebrow">🧠 Latest AI Insight</p>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>{latest.created_at?.slice(0, 10)}</p>
        </div>
        <span className="risk-badge" style={{ background: riskColor }}>{latest.risk_level}</span>
      </div>
      {llm?.assessment && (
        <p style={{ fontSize: '0.88rem', lineHeight: 1.6, margin: '10px 0 8px' }}>{llm.assessment.slice(0, 180)}{llm.assessment.length > 180 ? '…' : ''}</p>
      )}
      {conditions.length > 0 && (
        <div className="tag-row">
          {conditions.map((c, i) => (
            <span key={i} className="tag">{typeof c === 'object' ? c.name : c}</span>
          ))}
        </div>
      )}
      {latest.ai_response?.risk_assessment?.urgency && (
        <p className="urgency-note" style={{ borderLeftColor: riskColor, marginTop: 10 }}>
          {latest.ai_response.risk_assessment.urgency}
        </p>
      )}
    </article>
  )
}

/* ── Weekly Summary ── */
function WeeklySummary({ events }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const weekData = days.map((day, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (today.getDay() - 1 - i + 7) % 7)
    const dateStr = d.toISOString().slice(0, 10)
    const dayLogs = events.filter(e => e.log_date === dateStr)
    const maxSev = dayLogs.reduce((m, l) => Math.max(m, SEV_SCORE[l.severity] || 0), 0)
    return { day, count: dayLogs.length, severity: maxSev }
  })

  return (
    <article className="glass-card">
      <p className="eyebrow">This Week</p>
      <h3>Daily symptom activity</h3>
      <div className="week-grid">
        {weekData.map(({ day, count, severity }) => (
          <div key={day} className="week-day">
            <div className="week-bar-wrap">
              <div className="week-bar" style={{
                height: `${Math.max(count * 20, count > 0 ? 8 : 0)}px`,
                background: severity === 3 ? '#ef4444' : severity === 2 ? '#f59e0b' : severity === 1 ? '#22c55e' : '#e5e7eb',
              }} />
            </div>
            <span className="week-day-label">{day}</span>
            {count > 0 && <span className="week-count">{count}</span>}
          </div>
        ))}
      </div>
    </article>
  )
}

/* ── Medication Reminder ── */
function MedicationCard({ profile }) {
  const meds = profile?.medications || []
  if (!meds.length) return (
    <article className="glass-card">
      <p className="eyebrow">💊 Medications</p>
      <h3>No medications listed</h3>
      <p className="muted">Add your medications in your profile to see reminders here.</p>
    </article>
  )
  return (
    <article className="glass-card">
      <p className="eyebrow">💊 Medications</p>
      <h3>Daily reminders</h3>
      <div className="stack-list compact-list" style={{ marginTop: 12 }}>
        {meds.map((med, i) => (
          <div key={i} className="med-item">
            <div className="med-dot" />
            <span>{med}</span>
            <span className="muted" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>Daily</span>
          </div>
        ))}
      </div>
    </article>
  )
}

/* ── Health Tips ── */
const TIPS = [
  { icon: '💧', tip: 'Drink at least 8 glasses of water today.' },
  { icon: '🚶', tip: 'A 30-minute walk can reduce stress and improve heart health.' },
  { icon: '😴', tip: 'Aim for 7–9 hours of sleep for optimal recovery.' },
  { icon: '🥗', tip: 'Include leafy greens in your meals for essential vitamins.' },
  { icon: '🧘', tip: 'Try 5 minutes of deep breathing to reduce anxiety.' },
  { icon: '📱', tip: 'Take a screen break every hour to reduce eye strain.' },
]

function HealthTip() {
  const tip = TIPS[new Date().getDate() % TIPS.length]
  return (
    <article className="glass-card dash-tip-card">
      <p className="eyebrow">💡 Daily Health Tip</p>
      <div className="dash-tip">
        <span className="dash-tip-icon">{tip.icon}</span>
        <p>{tip.tip}</p>
      </div>
    </article>
  )
}

/* ── Main Dashboard ── */
export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState({ events: [], symptom_frequency: {} })
  const [history, setHistory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    gatewayApi.summary().then(({ data }) => setSummary(data)).catch(() => {})
    patientApi.timeline().then(({ data }) => setTimeline(data)).catch(() => {})
    patientApi.profile().then(({ data }) => setProfile(data)).catch(() => {})
    chatApi.history().then(({ data }) => {
      setHistory(data.slice(0, 10))
      const highRisk = data.filter(i => i.risk_level === 'HIGH' || i.risk_level === 'MEDIUM')
      setAlerts(highRisk.slice(0, 2).map(i => ({
        risk_level: i.risk_level,
        urgency: i.ai_response?.risk_assessment?.urgency || '',
      })))
    }).catch(() => {})
  }, [])

  // Compute health score (0–100) from recent data
  const highCount = history.filter(h => h.risk_level === 'HIGH').length
  const medCount = history.filter(h => h.risk_level === 'MEDIUM').length
  const totalConsults = history.length
  const recentSevere = timeline.events.filter(e => e.severity === 'severe').length
  const rawScore = Math.max(0, 100 - highCount * 15 - medCount * 7 - recentSevere * 5)
  const healthScore = totalConsults === 0 ? 72 : Math.min(rawScore, 100)
  const healthLabel = healthScore >= 80 ? 'Good' : healthScore >= 60 ? 'Fair' : 'Needs Attention'
  const healthColor = healthScore >= 80 ? '#22c55e' : healthScore >= 60 ? '#f59e0b' : '#ef4444'

  const latestRisk = history[0]?.ai_response?.risk_assessment
  const riskScore = latestRisk?.risk_score ?? 0
  const riskLevel = latestRisk?.level ?? 'LOW'
  const riskColor = RISK_COLOR[riskLevel] || '#22c55e'

  const chartData = timeline.events.slice(0, 14).reverse().map(e => ({
    date: e.log_date?.slice(5) || '',
    symptoms: e.symptoms.length,
    severity: SEV_SCORE[e.severity] || 1,
  }))

  const pieData = Object.entries(timeline.symptom_frequency).slice(0, 5).map(([name, value]) => ({ name, value }))

  const latestRecommendations = history[0]?.ai_response?.recommendations
  const latestDoctors = history[0]?.ai_response?.doctor_recommendations || []

  const totalSymptoms = timeline.events.reduce((a, e) => a + e.symptoms.length, 0)
  const avgConfidence = history.length
    ? Math.round(history.reduce((a, h) => a + (h.confidence_score || 0), 0) / history.length * 100)
    : 0

  return (
    <div className="page-stack">
      {/* Alert */}
      <AlertBanner alerts={alerts} />

      {/* Hero */}
      <section className="dash-hero">
        <div className="dash-hero-left">
          <p className="eyebrow">My Health Dashboard</p>
          <h2 style={{ margin: '6px 0 8px' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}! 👋
          </h2>
          <p className="muted">
            {profile?.chronic_conditions?.length
              ? `Managing: ${profile.chronic_conditions.join(', ')}`
              : "Here's your health overview for today."}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="primary-button" style={{ padding: '10px 18px', fontSize: '0.85rem' }} onClick={() => navigate('/chat')}>
              💬 Start Consultation
            </button>
            <button className="ghost-button" style={{ padding: '10px 18px', fontSize: '0.85rem' }} onClick={() => navigate('/calendar')}>
              📅 Log Symptoms
            </button>
          </div>
        </div>
        <div className="dash-hero-right">
          <HealthScoreRing score={healthScore} label={healthLabel} color={healthColor} />
          <p className="muted" style={{ textAlign: 'center', fontSize: '0.78rem', marginTop: 4 }}>Health Score</p>
        </div>
      </section>

      {/* Stat cards */}
      <section className="dash-stats-grid">
        <StatCard icon="🩺" label="Consultations" value={totalConsults} sub="AI assessments" color="#2a7c89" onClick={() => navigate('/history')} />
        <StatCard icon="📊" label="Symptoms Logged" value={totalSymptoms} sub="across all logs" color="#e85d3f" onClick={() => navigate('/calendar')} />
        <StatCard icon="⚠️" label="High Risk Events" value={highCount} sub="require attention" color="#ef4444" />
        <StatCard icon="🎯" label="Avg Confidence" value={`${avgConfidence}%`} sub="AI accuracy" color="#22c55e" />
        <StatCard icon="🩸" label="Blood Group" value={profile?.blood_group || '—'} sub="on file" color="#8b5cf6" onClick={() => navigate('/profile')} />
        <StatCard icon="💊" label="Medications" value={profile?.medications?.length || 0} sub="tracked" color="#f59e0b" onClick={() => navigate('/profile')} />
      </section>

      {/* AI Insight + Weekly Summary */}
      <section className="content-grid">
        <AiInsightCard history={history} />
        <WeeklySummary events={timeline.events} />
      </section>

      {/* Charts */}
      <section className="content-grid">
        <article className="glass-card tall-card">
          <p className="eyebrow">Health Trend</p>
          <h3>Symptom activity over time</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e85d3f" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#e85d3f" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="sevg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2a7c89" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#2a7c89" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,39,58,0.06)" />
                <XAxis dataKey="date" stroke="#35516c" tick={{ fontSize: 10 }} />
                <YAxis stroke="#35516c" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="symptoms" stroke="#e85d3f" fill="url(#sg)" name="Symptoms" strokeWidth={2} />
                <Area type="monotone" dataKey="severity" stroke="#2a7c89" fill="url(#sevg)" name="Severity" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-empty-chart">
              <p>📈</p>
              <p className="muted">Log symptoms to see your health trend over time.</p>
              <button className="ghost-button" onClick={() => navigate('/calendar')}>Log now</button>
            </div>
          )}
        </article>

        <div style={{ display: 'grid', gap: 20 }}>
          {/* Symptom distribution */}
          <article className="glass-card">
            <p className="eyebrow">Symptom Distribution</p>
            <h3>Most frequent</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="muted" style={{ padding: '20px 0' }}>No data yet.</p>}
            <div className="stack-list compact-list">
              {Object.entries(timeline.symptom_frequency).slice(0, 4).map(([symptom, count]) => (
                <div key={symptom} className="inline-stat">
                  <span style={{ textTransform: 'capitalize' }}>{symptom}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((count / Math.max(...Object.values(timeline.symptom_frequency))) * 100, 100)}%`, height: '100%', background: '#e85d3f', borderRadius: 3 }} />
                    </div>
                    <strong>{count}×</strong>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Risk history bar */}
          <article className="glass-card">
            <p className="eyebrow">Risk History</p>
            <h3>Last {Math.min(history.length, 7)} assessments</h3>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={history.slice(0, 7).reverse().map((h, i) => ({
                i: i + 1,
                score: h.ai_response?.risk_assessment?.risk_score || 0,
                fill: RISK_COLOR[h.risk_level] || '#22c55e',
              }))}>
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {history.slice(0, 7).reverse().map((h, i) => (
                    <Cell key={i} fill={RISK_COLOR[h.risk_level] || '#22c55e'} />
                  ))}
                </Bar>
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} formatter={(v) => [`${v}/100`, 'Risk Score']} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        </div>
      </section>

      {/* Recommendations + Doctors + Medications */}
      <section className="dash-three-col">
        {latestRecommendations && (
          <article className="glass-card">
            <p className="eyebrow">✅ Recommendations</p>
            <h3>From last consultation</h3>
            <div className="stack-list" style={{ marginTop: 12 }}>
              {latestRecommendations.precautions?.slice(0, 3).map((p, i) => (
                <div key={i} className="rec-item">✓ {p}</div>
              ))}
              {latestRecommendations.tests?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p className="ai-section-label" style={{ marginBottom: 6 }}>Suggested tests</p>
                  <div className="tag-row">
                    {latestRecommendations.tests.slice(0, 3).map(t => <span key={t} className="tag tag-green">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          </article>
        )}

        {latestDoctors.length > 0 && (
          <article className="glass-card">
            <p className="eyebrow">👨‍⚕️ Recommended Doctors</p>
            <h3>Based on your symptoms</h3>
            <div className="stack-list" style={{ marginTop: 12 }}>
              {latestDoctors.slice(0, 3).map(doc => (
                <div key={doc.id} className="doctor-mini-card">
                  <div className="doctor-avatar" style={{ width: 36, height: 36, fontSize: '0.9rem', borderRadius: 10 }}>
                    {doc.name.split(' ').slice(-1)[0][0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.88rem' }}>{doc.name}</strong>
                    <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>{doc.specialty}</p>
                  </div>
                  <div className="rating-badge">★ {doc.rating}</div>
                </div>
              ))}
            </div>
            <button className="ghost-button" style={{ width: '100%', marginTop: 10, fontSize: '0.82rem' }} onClick={() => navigate('/doctors')}>
              View all doctors →
            </button>
          </article>
        )}

        <MedicationCard profile={profile} />
      </section>

      {/* Health tip + Recent consultations */}
      <section className="content-grid">
        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent Consultations</p>
              <h3>Last {Math.min(history.length, 5)} AI assessments</h3>
            </div>
            <button className="ghost-button" style={{ fontSize: '0.82rem' }} onClick={() => navigate('/history')}>View all</button>
          </div>
          <div className="stack-list" style={{ marginTop: 12 }}>
            {history.slice(0, 5).map(item => (
              <div key={item.id} className="history-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="history-title" style={{ fontSize: '0.88rem' }}>
                    {item.user_message?.slice(0, 70)}{item.user_message?.length > 70 ? '…' : ''}
                  </p>
                  <p className="muted" style={{ fontSize: '0.75rem' }}>
                    {item.created_at?.slice(0, 10)} · Confidence: {Math.round((item.confidence_score || 0) * 100)}%
                  </p>
                </div>
                <span className="risk-badge" style={{ background: RISK_COLOR[item.risk_level] || '#22c55e', flexShrink: 0 }}>
                  {item.risk_level}
                </span>
              </div>
            ))}
            {!history.length && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p className="muted">No consultations yet.</p>
                <button className="primary-button" style={{ marginTop: 10, fontSize: '0.85rem' }} onClick={() => navigate('/chat')}>
                  Start your first consultation
                </button>
              </div>
            )}
          </div>
        </article>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <HealthTip />

          {/* Profile summary */}
          <article className="glass-card">
            <p className="eyebrow">👤 Health Profile</p>
            <div className="stack-list compact-list" style={{ marginTop: 12 }}>
              <div className="inline-stat"><span>Age</span><strong>{profile?.age || '—'}</strong></div>
              <div className="inline-stat"><span>Gender</span><strong>{profile?.gender || '—'}</strong></div>
              <div className="inline-stat"><span>Blood group</span><strong>{profile?.blood_group || '—'}</strong></div>
              <div className="inline-stat">
                <span>Allergies</span>
                <strong>{profile?.allergies?.length ? profile.allergies.join(', ') : 'None'}</strong>
              </div>
              <div className="inline-stat">
                <span>Conditions</span>
                <strong>{profile?.chronic_conditions?.length ? profile.chronic_conditions.join(', ') : 'None'}</strong>
              </div>
            </div>
            <button className="ghost-button" style={{ width: '100%', marginTop: 10, fontSize: '0.82rem' }} onClick={() => navigate('/profile')}>
              Edit profile →
            </button>
          </article>
        </div>
      </section>
    </div>
  )
}
