import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import api from '../api/client'

export default function Settings() {
  const [settings, setSettings] = useState({
    retention_days: 30,
    webhook_url: '',
    webhook_enabled: false,
    alert_email: '',
    weekly_report_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [flushing, setFlushing] = useState(false)

  useEffect(() => {
    api
      .get('/settings')
      .then(res => {
        setSettings(res.data || settings)
      })
      .catch(err => console.error('Erreur chargement settings:', err))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.post('/settings', settings)
      setMessage({ type: 'success', text: 'Paramètres sauvegardés avec succès' })
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestWebhook = async () => {
    if (!settings.webhook_url) {
      setMessage({ type: 'error', text: 'Veuillez entrer une URL webhook' })
      return
    }
    setTestingWebhook(true)
    setMessage('')
    try {
      await api.post('/settings/test-webhook', {
        webhook_url: settings.webhook_url,
      })
      setMessage({ type: 'success', text: 'Webhook testé avec succès' })
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors du test du webhook' })
    } finally {
      setTestingWebhook(false)
    }
  }

  const handleFlush = async () => {
    if (!confirm('Êtes-vous sûr de vouloir vider le buffer maintenant ?')) return
    setFlushing(true)
    setMessage('')
    try {
      await api.post('/flush')
      setMessage({ type: 'success', text: 'Buffer vidé avec succès' })
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors du vidage du buffer' })
    } finally {
      setFlushing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white font-bold text-xl">Paramètres</h2>
        <p className="text-errorgrey text-sm">Configuration générale et notifications</p>
      </div>

      {/* Message de statut */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-400/10 border-green-400/30 text-green-300'
              : 'bg-dustyred-400/10 border-dustyred-400/30 text-dustyred-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon icon={message.type === 'success' ? 'ph:check-circle' : 'ph:warning-circle'} className="text-lg" />
            <span className="text-sm font-semibold">{message.text}</span>
          </div>
        </div>
      )}

      {/* Section Rétention */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Icon icon="ph:calendar" className="text-lg" />
          Rétention des données
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              Durée de conservation (jours)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="30"
                max="365"
                step="1"
                value={settings.retention_days}
                onChange={e => handleChange('retention_days', parseInt(e.target.value))}
                className="flex-1 h-2 bg-prussian-700 rounded-lg appearance-none cursor-pointer accent-moonstone-400"
              />
              <span className="text-white font-bold text-lg min-w-[60px]">
                {settings.retention_days}j
              </span>
            </div>
            <p className="text-lightgrey text-xs mt-2">Les données seront automatiquement supprimées après cette durée</p>
          </div>
        </div>
      </div>

      {/* Section SMTP */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Icon icon="ph:envelope" className="text-lg" />
          Configuration Email (SMTP)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              Serveur SMTP
            </label>
            <input
              type="text"
              value={settings.smtp_host}
              onChange={e => handleChange('smtp_host', e.target.value)}
              placeholder="mail.example.com"
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              Port
            </label>
            <input
              type="number"
              value={settings.smtp_port}
              onChange={e => handleChange('smtp_port', parseInt(e.target.value))}
              placeholder="587"
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              Utilisateur
            </label>
            <input
              type="text"
              value={settings.smtp_user}
              onChange={e => handleChange('smtp_user', e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={settings.smtp_pass}
              onChange={e => handleChange('smtp_pass', e.target.value)}
              placeholder="••••••••"
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.smtp_secure}
                onChange={e => handleChange('smtp_secure', e.target.checked)}
                className="w-4 h-4 rounded accent-moonstone-400"
              />
              <span className="text-white font-semibold text-sm">Connexion sécurisée (TLS/SSL)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Section Notifications Email */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Icon icon="ph:bell" className="text-lg" />
          Alertes Email
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              Email d'alerte
            </label>
            <input
              type="email"
              value={settings.alert_email}
              onChange={e => handleChange('alert_email', e.target.value)}
              placeholder="admin@example.com"
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weekly_report_enabled}
              onChange={e => handleChange('weekly_report_enabled', e.target.checked)}
              className="w-4 h-4 rounded accent-moonstone-400"
            />
            <span className="text-white font-semibold text-sm">Activer le rapport hebdomadaire</span>
          </label>
        </div>
      </div>

      {/* Section Webhook */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Icon icon="ph:webhook-logo" className="text-lg" />
          Webhook (Discord/Slack)
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              URL du Webhook
            </label>
            <input
              type="url"
              value={settings.webhook_url}
              onChange={e => handleChange('webhook_url', e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
            <p className="text-lightgrey text-xs mt-2">
              Collez l'URL complète du webhook Discord ou Slack pour les notifications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={settings.webhook_enabled}
                onChange={e => handleChange('webhook_enabled', e.target.checked)}
                className="w-4 h-4 rounded accent-moonstone-400"
              />
              <span className="text-white font-semibold text-sm">Activer les notifications</span>
            </label>
            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook || !settings.webhook_url}
              className="px-3 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm disabled:opacity-50"
            >
              {testingWebhook ? 'Test...' : 'Tester'}
            </button>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors disabled:opacity-50"
        >
          <Icon icon="ph:floppy-disk" className="text-lg" />
          {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
        <button
          onClick={handleFlush}
          disabled={flushing}
          className="flex items-center gap-2 px-6 py-2 bg-orange-400 text-prussian-700 font-bold rounded-lg hover:bg-orange-300 transition-colors disabled:opacity-50"
        >
          <Icon icon="ph:trash" className="text-lg" />
          {flushing ? 'Vidage...' : 'Vider le buffer'}
        </button>
      </div>
    </div>
  )
}
