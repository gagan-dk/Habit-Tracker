import './App.css'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

type User = {
  id: number
  email: string
  name?: string | null
}

type Habit = {
  id: number
  title: string
  description?: string | null
  frequency: 'daily' | 'weekly' | string
  startDate: string
  category?: string | null
}

type HabitAnalytics = {
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  completionRate: number
}

type AuthResponse = {
  user: User
  token: string
}

const API_URL = 'http://localhost:4001'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [message, setMessage] = useState('')

  const [habits, setHabits] = useState<Habit[]>([])
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [habitForm, setHabitForm] = useState({
    title: '',
    description: '',
    frequency: 'daily',
    startDate: new Date().toISOString().slice(0, 10),
    category: '',
  })
  const [loadingHabits, setLoadingHabits] = useState(false)
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null)
  const [analytics, setAnalytics] = useState<HabitAnalytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [analyticsLogs, setAnalyticsLogs] = useState<string[]>([])
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = window.localStorage.getItem('ht-theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  const authHeaders = token
    ? {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    : { 'Content-Type': 'application/json' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      const url = `${API_URL}/auth/${isLogin ? 'login' : 'register'}`
      const body: Record<string, string> = { email, password }
      if (!isLogin) body.name = name

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Request failed')
      }

      const data: AuthResponse = await res.json()
      setToken(data.token)
      setCurrentUser(data.user)
      setMessage(isLogin ? 'Logged in successfully' : 'Registered successfully')
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong')
    }
  }

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme')
    } else {
      document.body.classList.remove('light-theme')
    }
    window.localStorage.setItem('ht-theme', theme)
  }, [theme])

  const handleLogout = () => {
    setToken(null)
    setCurrentUser(null)
    setMessage('Logged out')
    setHabits([])
    setEditingHabit(null)
  }

  const loadHabits = async () => {
    if (!token) return
    setLoadingHabits(true)
    try {
      const res = await fetch(`${API_URL}/habits`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load habits')
      const data = await res.json()
      setHabits(data)
    } catch (err: any) {
      setMessage(err.message || 'Failed to load habits')
    } finally {
      setLoadingHabits(false)
    }
  }

  useEffect(() => {
    loadHabits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleHabitChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setHabitForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetHabitForm = () => {
    setEditingHabit(null)
    setHabitForm({
      title: '',
      description: '',
      frequency: 'daily',
      startDate: new Date().toISOString().slice(0, 10),
      category: '',
    })
  }

  const handleHabitSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const payload = {
      ...habitForm,
      startDate: habitForm.startDate,
    }

    try {
      const url = editingHabit
        ? `${API_URL}/habits/${editingHabit.id}`
        : `${API_URL}/habits`
      const method = editingHabit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to save habit')
      }

      await loadHabits()
      resetHabitForm()
      setMessage(editingHabit ? 'Habit updated' : 'Habit created')
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong')
    }
  }

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit)
    setHabitForm({
      title: habit.title,
      description: habit.description || '',
      frequency: habit.frequency,
      startDate: habit.startDate.slice(0, 10),
      category: habit.category || '',
    })
  }

  const handleDeleteHabit = async (habit: Habit) => {
    if (!window.confirm(`Delete habit "${habit.title}"?`)) return
    try {
      const res = await fetch(`${API_URL}/habits/${habit.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to delete habit')
      await loadHabits()
      if (editingHabit?.id === habit.id) resetHabitForm()
      setMessage('Habit deleted')
    } catch (err: any) {
      setMessage(err.message || 'Failed to delete habit')
    }
  }

  const markCompletedToday = async (habit: Habit) => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const res = await fetch(`${API_URL}/habits/${habit.id}/logs`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ date: today }),
      })
      if (!res.ok) throw new Error('Failed to mark completed')
      setMessage(`Marked "${habit.title}" as completed for today`)
    } catch (err: any) {
      setMessage(err.message || 'Failed to mark completed')
    }
  }

  const loadAnalytics = async (habit: Habit) => {
    setSelectedHabit(habit)
    setLoadingAnalytics(true)
    setAnalytics(null)
    setAnalyticsLogs([])
    try {
      const res = await fetch(`${API_URL}/habits/${habit.id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load analytics')
      const data = await res.json()
      setAnalytics(data.stats)
      setAnalyticsLogs(
        Array.isArray(data.logs)
          ? data.logs.map((log: any) => String(log.date))
          : [],
      )
    } catch (err: any) {
      setMessage(err.message || 'Failed to load analytics')
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const weeklyData =
    analytics && analyticsLogs.length
      ? (() => {
          const counts = [0, 0, 0, 0, 0, 0, 0]
          analyticsLogs.forEach((dateStr) => {
            const d = new Date(dateStr)
            if (Number.isNaN(d.getTime())) return
            const jsDay = d.getDay() // 0=Sun
            const idx = (jsDay + 6) % 7 // 0=Mon
            counts[idx] += 1
          })
          return weekdayLabels.map((day, i) => ({ day, value: counts[i] }))
        })()
      : []

  const monthlyData =
    analytics && analyticsLogs.length
      ? (() => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const completedSet = new Set(
            analyticsLogs
              .map((d) => {
                const date = new Date(d)
                if (Number.isNaN(date.getTime())) return null
                return date.toDateString()
              })
              .filter(Boolean) as string[],
          )
          const data = []
          for (let i = 29; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(today.getDate() - i)
            data.push({
              label: d.toLocaleDateString(undefined, {
                day: '2-digit',
                month: '2-digit',
              }),
              value: completedSet.has(d.toDateString()) ? 1 : 0,
            })
          }
          return data
        })()
      : []

  const pieData =
    analytics && selectedHabit
      ? (() => {
          const start = new Date(selectedHabit.startDate)
          const today = new Date()
          start.setHours(0, 0, 0, 0)
          today.setHours(0, 0, 0, 0)
          const diffMs = today.getTime() - start.getTime()
          const totalDays =
            diffMs >= 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1 : 0
          const completed = analytics.totalCompletions
          const missed = Math.max(totalDays - completed, 0)
          return [
            { name: 'Completed', value: completed },
            { name: 'Missed', value: missed },
          ]
        })()
      : []

  const calendarCells =
    analytics && selectedHabit
      ? (() => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const month = today.getMonth()
          const year = today.getFullYear()
          const firstOfMonth = new Date(year, month, 1)
          const startWeekday = firstOfMonth.getDay() // 0=Sun
          const daysInMonth = new Date(year, month + 1, 0).getDate()

          const completionSet = new Set(
            analyticsLogs.map((d) => {
              const dt = new Date(d)
              if (Number.isNaN(dt.getTime())) return ''
              return dt.toISOString().slice(0, 10)
            }),
          )
          const habitStart = new Date(selectedHabit.startDate)
          habitStart.setHours(0, 0, 0, 0)

          const cells: {
            label: string
            status: 'completed' | 'missed' | 'not-tracked' | 'empty'
          }[] = []

          const offset = (startWeekday + 6) % 7 // Monday first
          for (let i = 0; i < offset; i++) {
            cells.push({ label: '', status: 'empty' })
          }

          for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day)
            d.setHours(0, 0, 0, 0)
            const key = d.toISOString().slice(0, 10)

            let status: 'completed' | 'missed' | 'not-tracked'
            if (d < habitStart || d > today) {
              status = 'not-tracked'
            } else if (completionSet.has(key)) {
              status = 'completed'
            } else {
              status = 'missed'
            }

            cells.push({ label: String(day), status })
          }

          return cells
        })()
      : []

  return (
    <div className="app">
      <div className="auth-card">
        <h1>Habit Tracker</h1>
        <p className="subtitle">
          Track your daily habits, streaks, and progress.
        </p>

        {!token || !currentUser ? (
          <>
            <div className="toggle">
              <button
                className={isLogin ? 'toggle-btn active' : 'toggle-btn'}
                onClick={() => setIsLogin(true)}
              >
                Login
              </button>
              <button
                className={!isLogin ? 'toggle-btn active' : 'toggle-btn'}
                onClick={() => setIsLogin(false)}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              {!isLogin && (
                <div className="field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              )}
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button className="primary" type="submit">
                {isLogin ? 'Login' : 'Create account'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="welcome header-row">
              <div>
                <p>
                  Signed in as <strong>{currentUser.email}</strong>
                </p>
                <p className="hint">
                  Manage your habits: add, edit, delete, mark completed, and customize your experience.
                </p>
              </div>
              <div className="header-actions">
                <div className="theme-toggle">
                  <span className="hint">Theme</span>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    {theme === 'dark' ? '🌙 Dark' : '☀ Light'}
                  </button>
                </div>
                <button className="secondary" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>

            <div className="dashboard">
              <section className="panel">
                <h2>{editingHabit ? 'Edit habit' : 'Add new habit'}</h2>
                <form onSubmit={handleHabitSubmit} className="form">
                  <div className="field">
                    <label>Habit name</label>
                    <input
                      type="text"
                      name="title"
                      value={habitForm.title}
                      onChange={handleHabitChange}
                      placeholder="e.g. Morning workout"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <input
                      type="text"
                      name="description"
                      value={habitForm.description}
                      onChange={handleHabitChange}
                      placeholder="Optional details"
                    />
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Frequency</label>
                      <select
                        name="frequency"
                        value={habitForm.frequency}
                        onChange={handleHabitChange}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Start date</label>
                      <input
                        type="date"
                        name="startDate"
                        value={habitForm.startDate}
                        onChange={handleHabitChange}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <input
                      type="text"
                      name="category"
                      value={habitForm.category}
                      onChange={handleHabitChange}
                      placeholder="Health, Study, Work..."
                    />
                  </div>
                  <div className="buttons-row">
                    <button className="primary" type="submit">
                      {editingHabit ? 'Update habit' : 'Create habit'}
                    </button>
                    {editingHabit && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={resetHabitForm}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Your habits</h2>
                  {loadingHabits && (
                    <span className="pill pill-muted">Loading…</span>
                  )}
                  {!loadingHabits && habits.length === 0 && (
                    <span className="pill pill-muted">No habits yet</span>
                  )}
                </div>
                <div className="habit-list">
                  {habits.map((habit) => (
                    <div key={habit.id} className="habit-item">
                      <div className="habit-main">
                        <h3>{habit.title}</h3>
                        <p className="habit-meta">
                          {habit.frequency === 'daily' ? 'Daily' : 'Weekly'} ·{' '}
                          {habit.category || 'Uncategorized'} · since{' '}
                          {new Date(habit.startDate).toLocaleDateString()}
                        </p>
                        {habit.description && (
                          <p className="habit-description">
                            {habit.description}
                          </p>
                        )}
                      </div>
                      <div className="habit-actions">
                        <button
                          className="pill"
                          onClick={() => markCompletedToday(habit)}
                        >
                          ✔ Mark today
                        </button>
                        <button
                          className="pill"
                          onClick={() => loadAnalytics(habit)}
                        >
                          📊 Stats
                        </button>
                        <button
                          className="pill"
                          onClick={() => handleEditHabit(habit)}
                        >
                          ✏ Edit
                        </button>
                        <button
                          className="pill pill-danger"
                          onClick={() => handleDeleteHabit(habit)}
                        >
                          ❌ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {selectedHabit && (
                <section className="panel analytics-panel">
                  <div className="panel-header">
                    <h2>Streak & stats</h2>
                    <span className="pill pill-muted">
                      {selectedHabit.title}
                    </span>
                  </div>
                  {loadingAnalytics && (
                    <p className="hint">Loading analytics…</p>
                  )}
                  {analytics && (
                    <>
                      <div className="analytics-grid">
                        <div className="stat-card">
                          <span className="stat-label">Current streak</span>
                          <span className="stat-value">
                            {analytics.currentStreak} days
                          </span>
                        </div>
                        <div className="stat-card">
                          <span className="stat-label">Longest streak</span>
                          <span className="stat-value">
                            {analytics.longestStreak} days
                          </span>
                        </div>
                        <div className="stat-card">
                          <span className="stat-label">Total completions</span>
                          <span className="stat-value">
                            {analytics.totalCompletions}
                          </span>
                        </div>
                        <div className="stat-card">
                          <span className="stat-label">Completion rate</span>
                          <span className="stat-value">
                            {analytics.completionRate}%
                          </span>
                        </div>
                      </div>
                      <div className="analytics-charts">
                      <div className="chart-card">
                        <h3>Completion rate</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                            >
                              <Cell fill="#22c55e" />
                              <Cell fill="#4b5563" />
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-card">
                        <h3>Weekly progress</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="day" stroke="#9ca3af" />
                            <YAxis allowDecimals={false} stroke="#9ca3af" />
                            <RechartsTooltip />
                            <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-card">
                        <h3>Last 30 days</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10 }}
                              stroke="#9ca3af"
                            />
                            <YAxis
                              allowDecimals={false}
                              domain={[0, 1]}
                              stroke="#9ca3af"
                            />
                            <RechartsTooltip />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#22c55e"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="calendar-section">
                      <h3>
                        Monthly calendar{' '}
                        <span className="calendar-legend">
                          <span className="legend-dot completed" /> Completed
                          <span className="legend-dot missed" /> Missed
                          <span className="legend-dot not-tracked" /> Not tracked
                        </span>
                      </h3>
                      <div className="calendar-grid">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
                          <div key={d} className="calendar-header-cell">
                            {d}
                          </div>
                        ))}
                        {calendarCells.map((cell, idx) => (
                          <div
                            key={idx}
                            className={`calendar-cell ${
                              cell.status !== 'empty' ? cell.status : ''
                            }`}
                          >
                            {cell.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                  )}
                </section>
              )}
            </div>
          </>
        )}

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  )
}

export default App
