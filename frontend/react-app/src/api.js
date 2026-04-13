import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  demoUser: () => api.get('/auth/demo-user'),
}

export const patientApi = {
  profile: () => api.get('/patient/profile'),
  updateProfile: (payload) => api.put('/patient/profile', payload),
  healthLogs: () => api.get('/patient/health-logs'),
  timeline: () => api.get('/patient/timeline'),
  addHealthLog: (payload) => api.post('/patient/health-log', payload),
}

export const chatApi = {
  sendMessage: (payload) => api.post('/chat/message', payload),
  history: () => api.get('/chat/history'),
  session: (sessionId) => api.get(`/chat/sessions/${sessionId}`),
  deleteChat: (chatId) => api.delete(`/chat/history/${chatId}`),
}

export const aiApi = {
  analyze: (text, patientInfo) => api.post('/ai/analyze', { text, patient_info: patientInfo }),
  research: (query) => api.post('/ai/research', { query }),
  consultationPrep: (text, patientInfo) => api.post('/ai/consultation-prep', { text, patient_info: patientInfo }),
  doctors: (symptoms, riskLevel, patientInfo) => api.post('/ai/doctors', { symptoms, risk_level: riskLevel, patient_info: patientInfo }),
  report: (payload) => api.post('/ai/report', payload),
  riskGraph: (text, patientInfo) => api.post('/ai/risk-graph', { text, patient_info: patientInfo }),
  alerts: () => api.get('/ai/alerts'),
  chat: (message, history, patientInfo) => api.post('/ai/chat', { message, history, patient_info: patientInfo }),
  riskAnalysis: (symptoms, patientInfo, historyScores) => api.post('/ai/risk-analysis', { symptoms, patient_info: patientInfo, history_scores: historyScores }),
}

export const vectorApi = {
  query: (query, topK = 5) => api.post('/vector/query', { query, top_k: topK }),
  stats: () => api.get('/vector/stats'),
  knowledge: () => api.get('/vector/knowledge'),
}

export const gatewayApi = {
  summary: () => api.get('/dashboard/summary'),
}

export default api
