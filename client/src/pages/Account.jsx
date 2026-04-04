import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'

const API = '/api'

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('spider_token')
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function Account() {
  const { t } = useTranslation()

  // Username
  const [newUsername, setNewUsername]   = useState('')
  const [usernamePass, setUsernamePass] = useState('')
  const [usernameMsg, setUsernameMsg]   = useState(null)
  const [savingUser, setSavingUser]     = useState(false)

  // Password
  const [currentPass, setCurrentPass]   = useState('')
  const [newPass, setNewPass]           = useState('')
  const [confirmPass, setConfirmPass]   = useState('')
  const [passwordMsg, setPasswordMsg]   = useState(null)
  const [savingPass, setSavingPass]     = useState(false)

  async function handleUsernameSubmit(e) {
    e.preventDefault()
    setSavingUser(true)
    setUsernameMsg(null)
    try {
      await apiFetch('/auth/change-username', {
        method: 'POST',
        body: JSON.stringify({ newUsername, currentPassword: usernamePass }),
      })
      localStorage.setItem('spider_username', newUsername)
      setUsernameMsg({ type: 'success', text: t('account.usernameSuccess') })
      setNewUsername('')
      setUsernamePass('')
    } catch (err) {
      setUsernameMsg({ type: 'error', text: err.message })
    } finally {
      setSavingUser(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    if (newPass !== confirmPass) {
      setPasswordMsg({ type: 'error', text: t('account.passwordMismatch') })
      return
    }
    setSavingPass(true)
    setPasswordMsg(null)
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      })
      setPasswordMsg({ type: 'success', text: t('account.passwordSuccess') })
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message })
    } finally {
      setSavingPass(false)
    }
  }

  const username = localStorage.getItem('spider_username') || 'admin'

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-prussian-500 flex items-center justify-center shrink-0">
          <Icon icon="ph:user" className="text-moonstone-400 text-2xl" />
        </div>
        <div>
          <h1 className="text-white text-xl font-bold">{t('account.title')}</h1>
          <p className="text-errorgrey text-sm">{username}</p>
        </div>
      </div>

      {/* Username */}
      <div className="bg-prussian-600 border border-prussian-500 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Icon icon="ph:identification-card" className="text-moonstone-400 text-lg" />
          {t('account.sectionUsername')}
        </h2>
        <form onSubmit={handleUsernameSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-errorgrey mb-1">{t('account.newUsername')}</label>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder={t('account.newUsernamePlaceholder')}
              required
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div>
            <label className="block text-sm text-errorgrey mb-1">{t('account.currentPasswordConfirm')}</label>
            <input
              type="password"
              value={usernamePass}
              onChange={e => setUsernamePass(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          {usernameMsg && (
            <p className={`text-sm ${usernameMsg.type === 'success' ? 'text-green-400' : 'text-dustyred-400'}`}>
              {usernameMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={savingUser}
            className="bg-moonstone-500 hover:bg-moonstone-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {savingUser ? t('common.saving') : t('account.buttonChangeUsername')}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="bg-prussian-600 border border-prussian-500 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Icon icon="ph:lock-key" className="text-moonstone-400 text-lg" />
          {t('account.sectionPassword')}
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-errorgrey mb-1">{t('account.currentPassword')}</label>
            <input
              type="password"
              value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div>
            <label className="block text-sm text-errorgrey mb-1">{t('account.newPassword')}</label>
            <input
              type="password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder={t('account.newPasswordPlaceholder')}
              required
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div>
            <label className="block text-sm text-errorgrey mb-1">{t('account.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-400' : 'text-dustyred-400'}`}>
              {passwordMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={savingPass}
            className="bg-moonstone-500 hover:bg-moonstone-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {savingPass ? t('common.saving') : t('account.buttonChangePassword')}
          </button>
        </form>
      </div>

    </div>
  )
}
