import { Activity, AlertTriangle, Bell, CalendarRange, ChevronDown, ChevronUp, ClipboardList, FileClock, GitBranch, LogOut, MessageSquareHeart, Send, ShieldPlus, Stethoscope, Syringe, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { aiApi, chatApi, patientApi } from '../api'
import { useAuth } from '../context/AuthContext'

const RISK_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e', NONE: '#5f7489' }

// ── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    buildNotifications()
    // Close on outside click
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buildNotifications = async () => {
    const notifs = []
    try {
      const { data: history } = await chatApi.history()
      history.slice(0, 10).forEach(item => {
        const risk = item.ai_response?.risk_assessment
        if (item.risk_level === 'HIGH') {
          notifs.push({
            id: `risk-${item.id}`, type: 'emergency', icon: '🚨',
            title: 'Emergency Risk Detected',
            body: item.ai_response?.risk_assessment?.urgency || 'Call 112 or 108 for immediate medical attention.',
            time: item.created_at?.slice(0, 16).replace('T', ' '),
            color: '#ef4444', link: '/history', read: false,
          })
        } else if (item.risk_level === 'MEDIUM') {
          notifs.push({
            id: `med-${item.id}`, type: 'warning', icon: '⚠️',
            title: 'Health Advisory',
            body: risk?.urgency || 'Clinical review recommended within 24 hours.',
            time: item.created_at?.slice(0, 16).replace('T', ' '),
            color: '#f59e0b', link: '/recommendations', read: false,
          })
        }
        // Tests recommended
        const tests = item.ai_response?.recommendations?.tests || []
        if (tests.length > 0 && item.risk_level !== 'LOW') {
          notifs.push({
            id: `test-${item.id}`, type: 'info', icon: '🧪',
            title: 'Tests Recommended',
            body: `${tests.slice(0, 3).join(', ')} suggested based on your symptoms.`,
            time: item.created_at?.slice(0, 16).replace('T', ' '),
            color: '#2a7c89', link: '/recommendations', read: false,
          })
        }
      })
    } catch {}

    // Static health reminders
    const hour = new Date().getHours()
    if (hour >= 8 && hour < 10) {
      notifs.push({ id: 'morning', type: 'reminder', icon: '💊', title: 'Morning Medication Reminder', body: 'Time to take your morning medications.', time: 'Today', color: '#22c55e', link: '/profile', read: false })
    }
    if (hour >= 20) {
      notifs.push({ id: 'log', type: 'reminder', icon: '📅', title: 'Daily Health Log', body: 'Log your symptoms for today to track your health trend.', time: 'Today', color: '#8b5cf6', link: '/calendar', read: false })
    }
    notifs.push({ id: 'tip', type: 'tip', icon: '💡', title: 'Health Tip', body: 'Stay hydrated — drink at least 8 glasses of water today.', time: 'Daily', color: '#22c55e', link: '/dashboard', read: false })

    // Deduplicate and limit
    const seen = new Set()
    const unique = notifs.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true }).slice(0, 10)
    setNotifications(unique)
    setUnread(unique.filter(n => !n.read).length)
  }

  const markAllRead = () => {
    setNotifications(n => n.map(x => ({ ...x, read: true })))
    setUnread(0)
  }

  const handleClick = (notif) => {
    setNotifications(n => n.map(x => x.id === notif.id ? { ...x, read: true } : x))
    setUnread(u => Math.max(0, u - (notif.read ? 0 : 1)))
    setOpen(false)
    navigate(notif.link)
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-bell" onClick={() => setOpen(v => !v)} aria-label="Notifications">
        <Bell size={20} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">🎉 You're all caught up!</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`notif-item ${n.read ? 'notif-read' : ''}`}
                onClick={() => handleClick(n)}
              >
                <div className="notif-icon" style={{ background: n.color + '18', color: n.color }}>{n.icon}</div>
                <div className="notif-content">
                  <p className="notif-title">{n.title}</p>
                  <p className="notif-body">{n.body}</p>
                  <p className="notif-time">{n.time}</p>
                </div>
                {!n.read && <div className="notif-dot" style={{ background: n.color }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const QUICK_STARTERS = [
  'I have a headache and fever',
  'My chest feels tight',
  'I feel very tired lately',
  'I have stomach pain',
]

function AgentSteps({ steps }) {
  return (
    <div className="agent-steps">
      {steps.map((step, i) => (
        <span key={i} className={`agent-step ${step.done ? 'agent-step-done' : 'agent-step-active'}`}>
          {step.done ? '✓' : '⟳'} {step.label}
        </span>
      ))}
    </div>
  )
}

function AiMessage({ msg }) {
  const [expanded, setExpanded] = useState(false)
  const r = msg.data
  const riskColor = RISK_COLOR[r.risk_level] || RISK_COLOR.NONE
  const hasDetails = r.conditions?.length > 0 || r.recommendations?.length > 0 || r.suggested_tests?.length > 0 || r.care_plan?.length > 0

  return (
    <div className="widget-bubble widget-bubble-ai widget-ai-card">
      {/* Emergency banner */}
      {r.emergency && (
        <div className="widget-emergency">
          🚨 <strong>EMERGENCY — Call 911 immediately</strong>
        </div>
      )}

      {/* Risk badge */}
      {r.risk_level && r.risk_level !== 'NONE' && (
        <div className="widget-risk-row">
          <span className="widget-risk-badge" style={{ background: riskColor }}>
            {r.risk_level} RISK
          </span>
          {r.risk_score > 0 && <span className="widget-risk-score">{r.risk_score}/100</span>}
        </div>
      )}

      {/* Main reply */}
      <p className="widget-reply">{r.reply}</p>

      {/* Conditions */}
      {r.conditions?.length > 0 && (
        <div className="widget-section">
          <p className="widget-section-label">Possible conditions</p>
          <div className="widget-tags">
            {r.conditions.slice(0, 3).map((c, i) => (
              <span key={i} className="widget-tag">
                {typeof c === 'object' ? c.name : c}
                {typeof c === 'object' && c.likelihood ? ` · ${c.likelihood}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expandable details */}
      {hasDetails && (
        <>
          <button className="widget-expand-btn" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Less detail' : 'More detail'}
          </button>

          {expanded && (
            <div className="widget-details">
              {r.recommendations?.length > 0 && (
                <div className="widget-section">
                  <p className="widget-section-label">Recommendations</p>
                  {r.recommendations.slice(0, 3).map((rec, i) => (
                    <p key={i} className="widget-detail-item">• {rec}</p>
                  ))}
                </div>
              )}
              {r.suggested_tests?.length > 0 && (
                <div className="widget-section">
                  <p className="widget-section-label">Suggested tests</p>
                  <div className="widget-tags">
                    {r.suggested_tests.map((t, i) => <span key={i} className="widget-tag widget-tag-green">{t}</span>)}
                  </div>
                </div>
              )}
              {r.specialist && (
                <div className="widget-section">
                  <p className="widget-section-label">See a specialist</p>
                  <span className="widget-tag widget-tag-blue">{r.specialist}</span>
                </div>
              )}
              {r.care_plan?.length > 0 && (
                <div className="widget-section">
                  <p className="widget-section-label">Care plan</p>
                  {r.care_plan.map((s, i) => (
                    <p key={i} className="widget-detail-item">→ {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentSteps, setAgentSteps] = useState([])
  const [patientInfo, setPatientInfo] = useState(null)
  const [emergencyAlert, setEmergencyAlert] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load patient profile for context
  useEffect(() => {
    patientApi.profile().then(({ data }) => setPatientInfo(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, minimized, messages])

  const historyForApi = messages
    .filter(m => m.role !== 'steps')
    .map(m => ({ role: m.role, content: m.role === 'user' ? m.text : m.data?.reply || '' }))

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { id: Date.now(), role: 'user', text: msg }
    setMessages(p => [...p, userMsg])
    setLoading(true)

    // Show agent steps
    const steps = [
      { label: 'Understanding intent', done: false },
      { label: 'Retrieving context', done: false },
      { label: 'Generating response', done: false },
    ]
    setAgentSteps(steps)

    try {
      // Simulate step progression
      setTimeout(() => setAgentSteps(s => s.map((st, i) => i === 0 ? { ...st, done: true } : st)), 600)
      setTimeout(() => setAgentSteps(s => s.map((st, i) => i <= 1 ? { ...st, done: true } : st)), 1200)

      const { data } = await aiApi.chat(msg, historyForApi, patientInfo)

      setAgentSteps([])
      setMessages(p => [...p, { id: Date.now() + 1, role: 'ai', data }])

      // Auto-trigger emergency modal on HIGH risk
      if (data.emergency || data.risk_level === 'HIGH') {
        setEmergencyAlert(true)
      }

      // Auto-suggest follow-up chips
      if (data.follow_up_questions?.length) {
        setMessages(p => [...p, {
          id: Date.now() + 2,
          role: 'chips',
          chips: data.quick_replies?.length ? data.quick_replies : data.follow_up_questions.slice(0, 3),
        }])
      }
    } catch {
      setAgentSteps([])
      setMessages(p => [...p, {
        id: Date.now() + 1, role: 'ai',
        data: { reply: "I'm having trouble right now. Please try again.", risk_level: 'NONE', emergency: false, conditions: [], recommendations: [], suggested_tests: [], specialist: null, care_plan: [], quick_replies: [] }
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => setMessages([])

  return (
    <>
      {/* Emergency Modal */}
      {emergencyAlert && (
        <div className="emerg-modal-overlay">
          <div className="emerg-modal">
            <div className="emerg-modal-icon">🚨</div>
            <h2 style={{ color: '#ef4444', margin: '12px 0 8px' }}>Emergency Alert</h2>
            <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>High-risk symptoms detected. If you are experiencing a medical emergency, call 911 immediately.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="tel:112" className="primary-button" style={{ textAlign: 'center', textDecoration: 'none', background: '#ef4444' }}>
                📞 Call 112 Now
              </a>
              <button className="ghost-button" onClick={() => { setEmergencyAlert(false); navigate('/emergency') }}>
                View Emergency Guide
              </button>
              <button className="ghost-button" style={{ fontSize: '0.78rem', color: '#5f7489' }} onClick={() => setEmergencyAlert(false)}>
                I'm safe — dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className="widget-fab" onClick={() => { setOpen(v => !v); setMinimized(false) }} aria-label="Open health assistant">
        {open ? <X size={22} /> : <MessageSquareHeart size={22} />}
        {!open && <span className="widget-fab-label">Ask AI</span>}
        {!open && messages.length > 0 && <span className="widget-fab-badge">{messages.filter(m => m.role === 'ai').length}</span>}
      </button>

      {open && (
        <div className={`widget-panel ${minimized ? 'widget-panel-minimized' : ''}`}>
          {/* Header */}
          <div className="widget-header">
            <div className="widget-header-left">
              <div className="widget-avatar"><ShieldPlus size={16} /></div>
              <div>
                <p className="widget-title">HealthPilot AI</p>
                <p className="widget-subtitle">
                  {loading ? '⟳ Thinking…' : '● Online · Multi-turn AI'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="widget-close" onClick={clearChat} title="Clear chat">🗑</button>
              <button className="widget-close" onClick={() => setMinimized(v => !v)} title="Minimize">
                {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button className="widget-close" onClick={() => setOpen(false)}><X size={14} /></button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="widget-messages">
                {messages.length === 0 && (
                  <div className="widget-empty">
                    <div className="widget-empty-icon">🏥</div>
                    <p><strong>Hi! I'm HealthPilot AI</strong></p>
                    <p className="muted" style={{ fontSize: '0.8rem' }}>Describe your symptoms and I'll give you a precise health assessment.</p>
                    <div className="widget-starters">
                      {QUICK_STARTERS.map(s => (
                        <button key={s} className="widget-starter-chip" onClick={() => send(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => {
                  if (msg.role === 'user') return (
                    <div key={msg.id} className="widget-bubble widget-bubble-user">{msg.text}</div>
                  )
                  if (msg.role === 'chips') return (
                    <div key={msg.id} className="widget-chips">
                      {msg.chips.map((c, i) => (
                        <button key={i} className="widget-chip" onClick={() => send(c)}>{c}</button>
                      ))}
                    </div>
                  )
                  return <AiMessage key={msg.id} msg={msg} />
                })}

                {loading && agentSteps.length > 0 && (
                  <div className="widget-bubble widget-bubble-ai">
                    <AgentSteps steps={agentSteps} />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="widget-composer">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Describe symptoms or ask a question…"
                  disabled={loading}
                />
                <button className="widget-send" onClick={() => send()} disabled={loading || !input.trim()}>
                  <Send size={15} />
                </button>
              </div>
              <p className="widget-disclaimer">Not a substitute for professional medical advice.</p>
            </>
          )}
        </div>
      )}
    </>
  )
}

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: Activity },
  { to: '/chat', label: 'Consultation', icon: MessageSquareHeart },
  { to: '/prep', label: 'Doctor Prep', icon: Syringe },
  { to: '/risk', label: 'Risk Analysis', icon: GitBranch },
  { to: '/recommendations', label: 'Recommendations', icon: ClipboardList },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/history', label: 'History', icon: FileClock },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/emergency', label: 'Emergency', icon: AlertTriangle },
]

function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-icon">
            <ShieldPlus size={22} />
          </div>
          <div>
            <p className="eyebrow">AI Care Ops</p>
            <h1>HealthPilot</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <p className="eyebrow">Signed in</p>
            <p className="user-name">{user?.name}</p>
            <p className="user-meta">{user?.email}</p>
          </div>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="app-content">
        <div className="app-topbar">
          <NotificationBell />
        </div>
        {children}
      </main>
      <ChatWidget />
    </div>
  )
}

export default Layout
 
