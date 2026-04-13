import { useEffect, useMemo, useState } from 'react'
import { patientApi } from '../api'

const SEVERITY_COLOR = { mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }
const SEVERITY_BG = { mild: 'rgba(34,197,94,0.1)', moderate: 'rgba(245,158,11,0.1)', severe: 'rgba(239,68,68,0.1)' }
const MOOD_EMOJI = { happy: '😊', good: '🙂', steady: '😐', tired: '😴', anxious: '😟', sad: '😢', pain: '😣' }
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function CalendarGrid({ year, month, grouped, onDayClick, selectedDate }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells = []
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="cal-grid">
      {DAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
      {cells.map((day, i) => {
        if (!day) return <div key={`empty-${i}`} className="cal-cell cal-cell-empty" />
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const logs = grouped[dateStr] || []
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
        const isSelected = selectedDate === dateStr
        const worstSeverity = logs.reduce((worst, log) => {
          const order = { severe: 3, moderate: 2, mild: 1 }
          return (order[log.severity] || 0) > (order[worst] || 0) ? log.severity : worst
        }, null)

        return (
          <div
            key={day}
            className={`cal-cell ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${logs.length ? 'cal-has-logs' : ''}`}
            onClick={() => onDayClick(dateStr, logs)}
            style={worstSeverity ? { background: SEVERITY_BG[worstSeverity] } : {}}
          >
            <span className="cal-day-num" style={isToday ? { color: '#e85d3f', fontWeight: 700 } : {}}>{day}</span>
            {logs.length > 0 && (
              <div className="cal-dots">
                {logs.slice(0, 3).map((log, li) => (
                  <span key={li} className="cal-dot" style={{ background: SEVERITY_COLOR[log.severity] || '#5f7489' }} />
                ))}
                {logs.length > 3 && <span className="cal-dot-more">+{logs.length - 3}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayDetail({ date, logs, onClose }) {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="cal-detail glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <p className="eyebrow">Health Log</p>
          <h3 style={{ margin: 0 }}>{label}</h3>
        </div>
        <button className="ghost-button" onClick={onClose}>✕</button>
      </div>
      {logs.length === 0 && <p className="muted">No health logs for this day.</p>}
      {logs.map(log => (
        <div key={log.id} className="cal-log-entry" style={{ borderLeftColor: SEVERITY_COLOR[log.severity] }}>
          <div className="cal-log-header">
            <span className="risk-badge" style={{ background: SEVERITY_COLOR[log.severity] }}>{log.severity}</span>
            {log.mood && <span className="cal-mood">{MOOD_EMOJI[log.mood] || '😐'} {log.mood}</span>}
          </div>
          <div className="tag-row" style={{ marginTop: 8 }}>
            {log.symptoms.map(s => <span key={s} className="tag">{s}</span>)}
          </div>
          {log.notes && <p className="muted" style={{ marginTop: 8, fontSize: '0.88rem' }}>{log.notes}</p>}
        </div>
      ))}
    </div>
  )
}

export default function HealthCalendar() {
  const today = new Date()
  const [logs, setLogs] = useState([])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedLogs, setSelectedLogs] = useState([])
  const [form, setForm] = useState({ symptoms: '', notes: '', severity: 'mild', mood: 'steady' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    patientApi.healthLogs().then(({ data }) => setLogs(data)).catch(() => setLogs([]))
  }, [])

  const grouped = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc[log.log_date] = acc[log.log_date] || []
      acc[log.log_date].push(log)
      return acc
    }, {})
  }, [logs])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const onDayClick = (dateStr, dayLogs) => {
    setSelectedDate(dateStr)
    setSelectedLogs(dayLogs)
    setForm(f => ({ ...f, symptoms: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.symptoms.trim()) return
    setSaving(true)
    try {
      const payload = {
        symptoms: form.symptoms.split(',').map(s => s.trim()).filter(Boolean),
        notes: form.notes,
        severity: form.severity,
        mood: form.mood,
        log_date: selectedDate || today.toISOString().slice(0, 10),
      }
      const { data } = await patientApi.addHealthLog(payload)
      if (data.log) {
        setLogs(prev => [data.log, ...prev])
        setSelectedLogs(prev => [data.log, ...prev])
      }
      setForm({ symptoms: '', notes: '', severity: 'mild', mood: 'steady' })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  // Stats for current month
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthLogs = logs.filter(l => l.log_date?.startsWith(monthStr))
  const severityCounts = monthLogs.reduce((acc, l) => { acc[l.severity] = (acc[l.severity] || 0) + 1; return acc }, {})
  const allSymptoms = monthLogs.flatMap(l => l.symptoms)
  const topSymptom = allSymptoms.length ? Object.entries(allSymptoms.reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] : null

  return (
    <div className="page-stack">
      {/* Header */}
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Health Calendar</p>
          <h2>Track your symptoms over time</h2>
          <p className="muted">Click any day to view or add health logs</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="hero-stat" style={{ minWidth: 120 }}>
            <span>{monthLogs.length}</span>
            <p>Logs this month</p>
          </div>
          {topSymptom && (
            <div className="hero-stat" style={{ minWidth: 140, background: 'linear-gradient(135deg,#e85d3f,#d97757)' }}>
              <span style={{ fontSize: '1.2rem' }}>{topSymptom}</span>
              <p>Top symptom</p>
            </div>
          )}
        </div>
      </section>

      {/* Month stats */}
      <section className="card-grid three-up">
        {['mild', 'moderate', 'severe'].map(sev => (
          <article key={sev} className="glass-card" style={{ borderTop: `3px solid ${SEVERITY_COLOR[sev]}` }}>
            <p className="eyebrow" style={{ color: SEVERITY_COLOR[sev] }}>{sev}</p>
            <h3 style={{ margin: '8px 0 4px', fontSize: '2rem', color: SEVERITY_COLOR[sev] }}>{severityCounts[sev] || 0}</h3>
            <p className="muted">days logged</p>
          </article>
        ))}
      </section>

      <div className="cal-layout">
        {/* Calendar */}
        <div className="cal-main">
          <article className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Nav */}
            <div className="cal-nav">
              <button className="ghost-button cal-nav-btn" onClick={prevMonth}>‹</button>
              <h3 style={{ margin: 0 }}>{MONTHS[month]} {year}</h3>
              <button className="ghost-button cal-nav-btn" onClick={nextMonth}>›</button>
              <button className="primary-button" style={{ marginLeft: 'auto', padding: '8px 16px', fontSize: '0.82rem' }}
                onClick={() => { setSelectedDate(today.toISOString().slice(0, 10)); setShowForm(true) }}>
                + Log Today
              </button>
            </div>

            {/* Legend */}
            <div className="cal-legend">
              {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
                <span key={sev} className="cal-legend-item">
                  <span className="cal-dot" style={{ background: color }} />{sev}
                </span>
              ))}
            </div>

            <div style={{ padding: '0 16px 16px' }}>
              <CalendarGrid year={year} month={month} grouped={grouped} onDayClick={onDayClick} selectedDate={selectedDate} />
            </div>
          </article>
        </div>

        {/* Side panel */}
        <div className="cal-side">
          {/* Day detail */}
          {selectedDate && !showForm && (
            <DayDetail
              date={selectedDate}
              logs={selectedLogs}
              onClose={() => setSelectedDate(null)}
            />
          )}

          {/* Add log form */}
          {(showForm || (!selectedDate)) && (
            <article className="glass-card">
              <p className="eyebrow">Add Health Log</p>
              <h3>{showForm && selectedDate ? `Log for ${selectedDate}` : 'Log for today'}</h3>
              <form className="auth-form" onSubmit={handleSubmit} style={{ gap: 12 }}>
                <label>
                  Symptoms <span className="muted" style={{ fontWeight: 400 }}>(comma separated)</span>
                  <input
                    value={form.symptoms}
                    onChange={e => setForm({ ...form, symptoms: e.target.value })}
                    placeholder="e.g. headache, fatigue, fever"
                    required
                  />
                </label>
                <label>
                  Notes
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Any additional details…" />
                </label>
                <div className="split-grid">
                  <label>
                    Severity
                    <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                      <option value="mild">🟢 Mild</option>
                      <option value="moderate">🟡 Moderate</option>
                      <option value="severe">🔴 Severe</option>
                    </select>
                  </label>
                  <label>
                    Mood
                    <select value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}>
                      {Object.entries(MOOD_EMOJI).map(([m, e]) => (
                        <option key={m} value={m}>{e} {m}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="primary-button" disabled={saving} style={{ flex: 1 }}>
                    {saving ? 'Saving…' : '+ Add Log'}
                  </button>
                  {showForm && <button type="button" className="ghost-button" onClick={() => setShowForm(false)}>Cancel</button>}
                </div>
              </form>
            </article>
          )}

          {/* Add log button when day is selected */}
          {selectedDate && !showForm && (
            <button className="primary-button" style={{ width: '100%' }} onClick={() => setShowForm(true)}>
              + Add log for {selectedDate}
            </button>
          )}

          {/* Recent logs list */}
          <article className="glass-card">
            <p className="eyebrow">Recent Logs</p>
            <h3>Last 7 entries</h3>
            <div className="stack-list" style={{ marginTop: 12 }}>
              {logs.slice(0, 7).map(log => (
                <div key={log.id} className="timeline-group" style={{ cursor: 'pointer' }}
                  onClick={() => { setSelectedDate(log.log_date); setSelectedLogs(grouped[log.log_date] || [log]); setShowForm(false) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{log.log_date}</strong>
                    <span className="cal-dot" style={{ background: SEVERITY_COLOR[log.severity], width: 10, height: 10 }} />
                  </div>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                    {log.symptoms.join(', ')} {log.mood ? `• ${MOOD_EMOJI[log.mood] || ''} ${log.mood}` : ''}
                  </p>
                </div>
              ))}
              {!logs.length && <p className="muted">No logs yet. Click a day to add your first log.</p>}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
