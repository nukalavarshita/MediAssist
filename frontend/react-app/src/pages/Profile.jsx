import { useEffect, useState } from 'react'
import { patientApi } from '../api'

function Profile() {
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '',
    blood_group: '',
    allergies: '',
    chronic_conditions: '',
    medications: '',
    emergency_contact: '',
    preferred_doctors: '',
  })
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    patientApi.profile().then(({ data }) => {
      setForm({
        name: data.name || '',
        age: data.age || '',
        gender: data.gender || '',
        blood_group: data.blood_group || '',
        allergies: (data.allergies || []).join(', '),
        chronic_conditions: (data.chronic_conditions || []).join(', '),
        medications: (data.medications || []).join(', '),
        emergency_contact: data.emergency_contact || '',
        preferred_doctors: (data.preferred_doctors || []).join(', '),
      })
    })
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
      allergies: form.allergies.split(',').map((item) => item.trim()).filter(Boolean),
      chronic_conditions: form.chronic_conditions.split(',').map((item) => item.trim()).filter(Boolean),
      medications: form.medications.split(',').map((item) => item.trim()).filter(Boolean),
      preferred_doctors: form.preferred_doctors.split(',').map((item) => item.trim()).filter(Boolean),
    }
    await patientApi.updateProfile(payload)
    setSavedMessage('Profile saved.')
  }

  return (
    <div className="page-stack">
      <section className="glass-card">
        <p className="eyebrow">Patient Profile</p>
        <h3>Personalization and medical context</h3>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="split-grid">
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              Age
              <input value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
            </label>
          </div>
          <div className="split-grid">
            <label>
              Gender
              <input value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} />
            </label>
            <label>
              Blood group
              <input value={form.blood_group} onChange={(event) => setForm({ ...form, blood_group: event.target.value })} />
            </label>
          </div>
          <label>
            Allergies
            <input value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} />
          </label>
          <label>
            Chronic conditions
            <input value={form.chronic_conditions} onChange={(event) => setForm({ ...form, chronic_conditions: event.target.value })} />
          </label>
          <label>
            Medications
            <input value={form.medications} onChange={(event) => setForm({ ...form, medications: event.target.value })} />
          </label>
          <label>
            Emergency contact
            <input value={form.emergency_contact} onChange={(event) => setForm({ ...form, emergency_contact: event.target.value })} />
          </label>
          <label>
            Preferred doctors
            <input value={form.preferred_doctors} onChange={(event) => setForm({ ...form, preferred_doctors: event.target.value })} />
          </label>
          {savedMessage ? <p className="muted">{savedMessage}</p> : null}
          <button type="submit" className="primary-button">Save profile</button>
        </form>
      </section>
    </div>
  )
}

export default Profile
