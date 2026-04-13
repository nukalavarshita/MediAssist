import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'

function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', age: '', gender: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const { data } = await authApi.register({
        ...form,
        age: form.age ? Number(form.age) : null,
      })
      login(data.token, data.user)
      navigate('/dashboard')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to create account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel hero-panel accent-panel">
        <p className="eyebrow">Patient Onboarding</p>
        <h1>Start a personalized care record with secure local access.</h1>
        <p className="hero-copy">
          Profiles, symptom logs, and chat history are connected so the assistant can adapt over time.
        </p>
      </section>

      <section className="auth-panel form-panel">
        <h2>Create account</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
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
          <div className="split-grid">
            <label>
              Age
              <input value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
            </label>
            <label>
              Gender
              <input value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="muted compact">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </div>
  )
}

export default Register
