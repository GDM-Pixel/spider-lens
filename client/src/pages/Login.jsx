import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import api from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('spider_token', data.token)
      localStorage.setItem('spider_username', data.username)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo placeholder */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-prussian-500 border border-prussian-400 flex items-center justify-center mb-4">
          <Icon icon="ph:spider" className="text-4xl text-moonstone-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Spider-Lens</h1>
        <p className="text-errorgrey text-sm mt-1">Analyseur de logs orienté SEO</p>
      </div>

      <div className="bg-prussian-600 border border-prussian-500 rounded-2xl p-8">
        <h2 className="text-white font-bold text-xl mb-6">Connexion</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-lightgrey text-sm font-semibold block mb-2">Identifiant</label>
            <div className="relative">
              <Icon icon="ph:user" className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-lg" />
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin"
                required
                autoFocus
                className="w-full bg-prussian-500 border border-prussian-400 rounded-lg px-4 pl-10 py-2.5 text-white text-sm placeholder:text-errorgrey focus:outline-none focus:border-moonstone-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-lightgrey text-sm font-semibold block mb-2">Mot de passe</label>
            <div className="relative">
              <Icon icon="ph:lock-key" className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-lg" />
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                className="w-full bg-prussian-500 border border-prussian-400 rounded-lg px-4 pl-10 pr-10 py-2.5 text-white text-sm placeholder:text-errorgrey focus:outline-none focus:border-moonstone-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-errorgrey hover:text-white transition-colors"
              >
                <Icon icon={showPass ? 'ph:eye-slash' : 'ph:eye'} className="text-lg" />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-dustyred-400/10 border border-dustyred-700 rounded-lg px-3 py-2.5">
              <Icon icon="ph:warning-circle" className="text-dustyred-400 text-base shrink-0" />
              <p className="text-dustyred-300 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-red w-full py-2.5 text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Icon icon="ph:sign-in" className="text-base" />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-errorgrey text-xs text-center mt-4">
        Spider-Lens — Données 100% locales · Aucun tracking
      </p>
    </div>
  )
}
