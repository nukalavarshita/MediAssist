import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EMERGENCY_NUMBERS = [
  { label: 'National Emergency', number: '112', icon: '🚨', color: '#ef4444', desc: 'Police · Fire · Ambulance (All-in-one)' },
  { label: 'Ambulance (Free)', number: '108', icon: '🚑', color: '#e85d3f', desc: 'Free emergency ambulance — pan India' },
  { label: 'Police', number: '100', icon: '👮', color: '#14334a', desc: 'Police emergency helpline' },
  { label: 'Fire Brigade', number: '101', icon: '🔥', color: '#f59e0b', desc: 'Fire & rescue services' },
  { label: 'iCall Mental Health', number: '9152987821', icon: '💙', color: '#8b5cf6', desc: 'TISS mental health helpline' },
  { label: 'AIIMS Poison Control', number: '1800-11-6117', icon: '⚗️', color: '#2a7c89', desc: 'National Poison Information Centre' },
  { label: 'Women Helpline', number: '1091', icon: '🆘', color: '#e85d3f', desc: '24/7 women safety helpline' },
  { label: 'Senior Citizen Helpline', number: '14567', icon: '👴', color: '#22c55e', desc: 'Elder care & emergency support' },
]

const RED_FLAGS = [
  { icon: '❤️', symptom: 'Chest pain or pressure', action: 'Call 108 immediately — possible heart attack' },
  { icon: '🫁', symptom: 'Severe difficulty breathing', action: 'Call 108 — life-threatening emergency' },
  { icon: '🧠', symptom: 'Sudden confusion or unconsciousness', action: 'Call 112 — possible stroke or seizure' },
  { icon: '👁️', symptom: 'Sudden loss of vision', action: 'Call 112 — possible stroke' },
  { icon: '🤕', symptom: 'Worst headache of your life', action: 'Call 108 — possible brain bleed' },
  { icon: '💉', symptom: 'Severe allergic reaction (anaphylaxis)', action: 'Use EpiPen if available, call 108' },
  { icon: '🩸', symptom: 'Uncontrolled or severe bleeding', action: 'Apply firm pressure, call 112' },
  { icon: '🤢', symptom: 'Suspected poisoning or overdose', action: 'Call AIIMS Poison Control: 1800-11-6117' },
]

const FIRST_AID = [
  {
    title: 'Heart Attack (Dil ka Daura)',
    icon: '❤️',
    color: '#ef4444',
    warning: 'Call 108 immediately before starting first aid',
    steps: [
      'Call 108 immediately — do not drive the person yourself',
      'Have the person sit or lie down in a comfortable position',
      'Loosen any tight clothing around the neck and chest',
      'If not allergic and conscious, give 300–325mg aspirin (Disprin) to chew',
      'Stay calm and reassure the person until the ambulance arrives',
      'Begin CPR if the person becomes unresponsive and stops breathing normally',
    ],
  },
  {
    title: 'Stroke (Brain Attack) — Act FAST',
    icon: '🧠',
    color: '#8b5cf6',
    warning: 'Every minute counts — call 108 immediately',
    steps: [
      'F — Face (Chehra): Ask them to smile. Is one side drooping?',
      'A — Arms (Baazoo): Ask them to raise both arms. Does one drift down?',
      'S — Speech (Boli): Ask them to repeat a phrase. Is it slurred or strange?',
      'T — Time (Samay): If any sign is present, call 108 immediately',
      'Note the exact time symptoms started — tell the paramedics',
      'Do not give food, water, or any medication',
    ],
  },
  {
    title: 'Severe Allergic Reaction',
    icon: '⚠️',
    color: '#f59e0b',
    warning: 'Use EpiPen first if available, then call 108',
    steps: [
      'Administer EpiPen (epinephrine auto-injector) into outer thigh immediately if available',
      'Call 108 even if symptoms improve after EpiPen',
      'Have the person lie flat with legs elevated (unless breathing is difficult)',
      'A second EpiPen may be used after 5–15 minutes if no improvement',
      'Do not give antihistamines (like Avil or Benadryl) as the primary treatment',
      'Be prepared to perform CPR if the person loses consciousness',
    ],
  },
  {
    title: 'Choking (Gala Rukna)',
    icon: '🫁',
    color: '#2a7c89',
    warning: 'If person can cough forcefully, encourage coughing',
    steps: [
      'Ask "Kya aapka gala ruka hai?" — if they can speak or cough, do not intervene',
      'If unable to speak: stand behind them and lean them slightly forward',
      'Give 5 firm back blows between the shoulder blades with the heel of your hand',
      'Give 5 abdominal thrusts (Heimlich manoeuvre) — fist above navel, sharp upward thrust',
      'Alternate 5 back blows and 5 abdominal thrusts until object is dislodged',
      'Call 112 if the person loses consciousness',
    ],
  },
  {
    title: 'Uncontrolled Bleeding',
    icon: '🩸',
    color: '#ef4444',
    warning: 'Call 108 for severe or arterial bleeding',
    steps: [
      'Protect yourself — wear gloves or use a plastic bag if available',
      'Apply firm, direct pressure with a clean cloth or dupatta/saree',
      'Do not remove the cloth — add more material on top if soaked through',
      'Elevate the injured limb above heart level if possible',
      'Apply a tourniquet 5–7cm above the wound for life-threatening limb bleeding',
      'Keep the person warm, calm, and still until help arrives',
    ],
  },
  {
    title: 'Unconscious Person',
    icon: '😵',
    color: '#5f7489',
    warning: 'Check for danger before approaching',
    steps: [
      'Ensure the scene is safe before approaching',
      'Tap shoulders firmly and shout — "Kya aap theek hain?" / "Are you OK?"',
      'Call 112 immediately if there is no response',
      'Open the airway: tilt head back, lift chin',
      'Check for breathing for no more than 10 seconds',
      'If not breathing normally: begin CPR — 30 chest compressions, 2 rescue breaths',
    ],
  },
]

function EmergencyNumber({ item }) {
  return (
    <div className="emerg-num-card" style={{ borderLeftColor: item.color }}>
      <div className="emerg-num-icon" style={{ background: item.color + '18', color: item.color }}>
        {item.icon}
      </div>
      <div className="emerg-num-info">
        <p className="emerg-num-label">{item.label}</p>
        <p className="emerg-num-desc">{item.desc}</p>
      </div>
      <a href={`tel:${item.number.replace(/[^0-9]/g, '')}`} className="emerg-num-btn" style={{ background: item.color }}>
        📞 {item.number}
      </a>
    </div>
  )
}

function FirstAidModal({ guide, onClose }) {
  if (!guide) return null
  return (
    <div className="fa-overlay" onClick={onClose}>
      <div className="fa-modal" onClick={e => e.stopPropagation()}>
        <div className="fa-modal-header" style={{ borderBottom: `3px solid ${guide.color}` }}>
          <div className="fa-modal-title-row">
            <div className="fa-modal-icon" style={{ background: guide.color + '18', color: guide.color }}>
              {guide.icon}
            </div>
            <div>
              <h2 className="fa-modal-title">{guide.title}</h2>
              <div className="fa-modal-warning" style={{ background: guide.color + '14', color: guide.color }}>
                ⚠️ {guide.warning}
              </div>
            </div>
          </div>
          <button className="fa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="fa-modal-body">
          {guide.steps.map((step, i) => (
            <div key={i} className="fa-modal-step">
              <div className="fa-modal-step-num" style={{ background: guide.color }}>{i + 1}</div>
              <p className="fa-modal-step-text">{step}</p>
            </div>
          ))}
        </div>
        <div className="fa-modal-footer">
          <a href="tel:108" className="primary-button" style={{ textDecoration: 'none', background: '#e85d3f', flex: 1, textAlign: 'center' }}>🚑 Call 108</a>
          <a href="tel:112" className="primary-button" style={{ textDecoration: 'none', background: '#ef4444', flex: 1, textAlign: 'center' }}>🚨 Call 112</a>
          <button className="ghost-button" onClick={onClose} style={{ flex: 1 }}>Close</button>
        </div>
      </div>
    </div>
  )
}

function FirstAidCard({ guide, onClick }) {
  return (
    <article
      className="emerg-guide-card glass-card fa-card"
      style={{ borderTop: `3px solid ${guide.color}`, cursor: 'pointer' }}
      onClick={() => onClick(guide)}
    >
      <div className="fa-card-icon" style={{ background: guide.color + '14', color: guide.color }}>
        {guide.icon}
      </div>
      <div className="fa-card-body">
        <strong className="fa-card-title">{guide.title}</strong>
        <p className="fa-card-warning">{guide.warning}</p>
        <div className="fa-card-preview">
          {guide.steps.slice(0, 2).map((s, i) => (
            <p key={i} className="fa-card-step-preview">• {s.slice(0, 60)}{s.length > 60 ? '…' : ''}</p>
          ))}
        </div>
        <div className="fa-card-cta" style={{ color: guide.color }}>
          Tap to view full guide →
        </div>
      </div>
    </article>
  )
}

export default function Emergency() {
  const navigate = useNavigate()
  const [sosActive, setSosActive] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [selectedGuide, setSelectedGuide] = useState(null)
  const timerRef = { current: null }

  const startSOS = () => {
    setSosActive(true)
    let c = 3
    setCountdown(c)
    timerRef.current = setInterval(() => {
      c--
      setCountdown(c)
      if (c === 0) {
        clearInterval(timerRef.current)
        window.location.href = 'tel:112'
        setSosActive(false)
        setCountdown(null)
      }
    }, 1000)
  }

  const cancelSOS = () => {
    clearInterval(timerRef.current)
    setSosActive(false)
    setCountdown(null)
  }

  return (
    <div className="page-stack">
      <FirstAidModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />

      {/* Hero */}
      <section className="emerg-hero">
        <div className="emerg-hero-left">
          <div className="emerg-hero-badge">🚨 EMERGENCY CENTRE</div>
          <h2 className="emerg-hero-title">Emergency Medical Help</h2>
          <p className="emerg-hero-sub">
            If you or someone nearby is in immediate danger — call 112 or 108 now.
            Do not wait for an AI assessment in a life-threatening situation.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <a href="tel:112" className="primary-button" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
              📞 Call 112
            </a>
            <a href="tel:108" className="primary-button" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', fontSize: '0.88rem' }}>
              🚑 Call 108
            </a>
          </div>
        </div>
        <div className="emerg-hero-right">
          {!sosActive ? (
            <button className="sos-button" onClick={startSOS}>
              <span className="sos-icon">🆘</span>
              <span className="sos-text">SOS</span>
              <span className="sos-sub">Tap to call 112</span>
            </button>
          ) : (
            <div className="sos-active">
              <div className="sos-countdown-ring">
                <span className="sos-countdown-num">{countdown}</span>
              </div>
              <p style={{ color: '#fff', margin: '10px 0 6px', fontWeight: 700 }}>Calling 112…</p>
              <button className="sos-cancel" onClick={cancelSOS}>Cancel</button>
            </div>
          )}
        </div>
      </section>

      {/* Emergency numbers */}
      <section className="glass-card emerg-section">
        <div className="emerg-section-header">
          <span className="emerg-section-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>📞</span>
          <div>
            <p className="eyebrow">Indian Emergency Helplines</p>
            <h3 style={{ margin: 0 }}>Tap to call — all numbers are free</h3>
          </div>
        </div>
        <div className="emerg-numbers-list">
          {EMERGENCY_NUMBERS.map(n => <EmergencyNumber key={n.label} item={n} />)}
        </div>
      </section>

      {/* Red flags */}
      <section className="glass-card emerg-section" style={{ borderLeft: '4px solid #ef4444' }}>
        <div className="emerg-section-header">
          <span className="emerg-section-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>🚩</span>
          <div>
            <p className="eyebrow" style={{ color: '#ef4444' }}>Call 112 or 108 Immediately</p>
            <h3 style={{ margin: 0 }}>Emergency warning signs — do not wait</h3>
          </div>
        </div>
        <div className="emerg-flags-grid">
          {RED_FLAGS.map((f, i) => (
            <div key={i} className="emerg-flag-card">
              <span className="emerg-flag-icon">{f.icon}</span>
              <div>
                <p className="emerg-flag-symptom">{f.symptom}</p>
                <p className="emerg-flag-action">{f.action}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAST stroke */}
      <section className="glass-card emerg-section" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))' }}>
        <div className="emerg-section-header">
          <span className="emerg-section-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>🧠</span>
          <div>
            <p className="eyebrow" style={{ color: '#8b5cf6' }}>Stroke Pehchano — FAST Method</p>
            <h3 style={{ margin: 0 }}>Recognise a stroke — every minute counts</h3>
          </div>
        </div>
        <div className="emerg-fast-row">
          {[
            { letter: 'F', word: 'Face / Chehra', desc: 'Ask them to smile. Is one side drooping?' },
            { letter: 'A', word: 'Arms / Baazoo', desc: 'Ask them to raise both arms. Does one drift down?' },
            { letter: 'S', word: 'Speech / Boli', desc: 'Ask them to repeat a phrase. Is it slurred?' },
            { letter: 'T', word: 'Time / Samay', desc: 'Call 108 immediately if any sign is present.' },
          ].map(({ letter, word, desc }) => (
            <div key={letter} className="emerg-fast-card">
              <span className="emerg-fast-letter" style={{ color: '#8b5cf6' }}>{letter}</span>
              <strong className="emerg-fast-word">{word}</strong>
              <p className="emerg-fast-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* First aid guides */}
      <section>
        <div className="emerg-section-header" style={{ marginBottom: 14 }}>
          <span className="emerg-section-icon" style={{ background: 'rgba(42,124,137,0.1)', color: '#2a7c89' }}>🩺</span>
          <div>
            <p className="eyebrow">Prathamik Upchar — First Aid Guides</p>
            <h3 style={{ margin: 0 }}>Step-by-step emergency procedures</h3>
          </div>
        </div>
        <div className="emerg-guides-grid">
          {FIRST_AID.map(g => <FirstAidCard key={g.title} guide={g} onClick={setSelectedGuide} />)}
        </div>
      </section>

      {/* CPR */}
      <section className="glass-card emerg-section" style={{ background: 'linear-gradient(135deg, rgba(20,51,74,0.06), rgba(42,124,137,0.04))' }}>
        <div className="emerg-section-header">
          <span className="emerg-section-icon" style={{ background: 'rgba(20,51,74,0.1)', color: '#14334a' }}>💪</span>
          <div>
            <p className="eyebrow">CPR — Quick Reference</p>
            <h3 style={{ margin: 0 }}>For unresponsive adults not breathing normally</h3>
          </div>
        </div>
        <div className="emerg-cpr-steps">
          {[
            { num: '1', text: 'Call 108 or ask someone else to call while you begin CPR' },
            { num: '2', text: 'Place heel of hand on centre of chest (lower half of breastbone / seena)' },
            { num: '3', text: 'Push down hard and fast — at least 5cm deep, 100–120 compressions per minute' },
            { num: '4', text: 'After 30 compressions: tilt head back, lift chin, give 2 rescue breaths (1 second each)' },
            { num: '5', text: 'Continue 30:2 ratio until 108 ambulance arrives or AED is available' },
          ].map(s => (
            <div key={s.num} className="emerg-cpr-step">
              <span className="emerg-cpr-num">{s.num}</span>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}>{s.text}</p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 12 }}>
          💡 If untrained in CPR, provide hands-only CPR (only compressions, no rescue breaths) until the ambulance arrives.
        </p>
      </section>

      {/* Disclaimer */}
      <div style={{ padding: '14px 18px', borderRadius: 16, background: 'rgba(16,36,58,0.04)', border: '1px solid rgba(16,36,58,0.1)' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#5f7489', lineHeight: 1.7 }}>
          <strong>⚠️ Disclaimer:</strong> This page provides general emergency guidance for informational purposes only.
          It is not a substitute for professional emergency medical services or clinical training.
          In any life-threatening situation, call 112 or 108 immediately.
          HealthPilot AI is a decision support tool and cannot replace emergency medical care or professional first aid training.
          Emergency numbers are valid across India as per Government of India guidelines.
        </p>
      </div>

      <button className="ghost-button" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </button>
    </div>
  )
}
