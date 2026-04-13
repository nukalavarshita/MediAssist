import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: 'demo@healthcare.ai', password: 'DemoPass123!' })
  const [error, setError] = useState('')
  const [demoHint, setDemoHint] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    authApi
      .demoUser()
      .then(({ data }) => setDemoHint(`${data.email} / ${data.password_hint}`))
      .catch(() => setDemoHint('demo@healthcare.ai / DemoPass123!'))
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const { data } = await authApi.login(form)
      login(data.token, data.user)
      navigate('/dashboard')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel hero-panel">
        <p className="eyebrow">Clinical Decision Support</p>
        <h1>AI-assisted triage, history, and care planning in one workspace.</h1>
        <p className="hero-copy">
          Symptom intake, RAG retrieval, explainable AI output, doctor suggestions, and patient history are all
          wired through the same local microservice stack.
        </p>
        <div className="hero-pill">Demo access: {demoHint}</div>
      </section>

      <section className="auth-panel form-panel">
        <h2>Welcome back</h2>
        <p className="muted">Use the seeded demo account or your registered credentials.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="muted compact">
          Need an account? <Link to="/register">Create one</Link>
        </p>
      </section>
    </div>
  )
}

export default Login
