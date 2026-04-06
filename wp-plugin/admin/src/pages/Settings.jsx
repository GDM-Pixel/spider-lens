import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import api from '../api/client'
import BeginnerBanner from '../components/ui/BeginnerBanner'

export default function Settings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState({
    retention_days: 30,
    exclude_logged_in: false,
    exclude_admin: false,
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

  // Crawler state
  const [sitemaps, setSitemaps]         = useState([])
  const [newSitemap, setNewSitemap]     = useState('')
  const [addingSitemap, setAddingSitemap] = useState(false)
  const [crawlStatus, setCrawlStatus]   = useState(null)
  const [startingCrawl, setStartingCrawl] = useState(false)
  const [cancellingCrawl, setCancellingCrawl] = useState(false)
  const crawlPollRef = useRef(null)
  const isRunning = crawlStatus?.status === 'running'

  useEffect(() => {
    api
      .get('/settings')
      .then(res => {
        setSettings(res.data || settings)
      })
      .catch(err => console.error('Erreur chargement settings:', err))
      .finally(() => setLoading(false))
  }, [])

  // Charger sitemaps + statut crawl
  useEffect(() => {
    api.get('/crawler/sitemaps').then(r => setSitemaps(r.data || [])).catch(() => {})
    api.get('/crawler/status').then(r => setCrawlStatus(r.data)).catch(() => {})
  }, [])

  // Polling si crawl en cours
  useEffect(() => {
    if (isRunning) {
      crawlPollRef.current = setInterval(() => {
        api.get('/crawler/status').then(r => {
          setCrawlStatus(r.data)
          if (r.data.status !== 'running') clearInterval(crawlPollRef.current)
        }).catch(() => {})
      }, 3000)
    } else {
      clearInterval(crawlPollRef.current)
    }
    return () => clearInterval(crawlPollRef.current)
  }, [isRunning])

  const handleAddSitemap = async () => {
    if (!newSitemap.trim()) return
    setAddingSitemap(true)
    try {
      const r = await api.post('/crawler/sitemaps', { url: newSitemap.trim() })
      setSitemaps(prev => [...prev, r.data])
      setNewSitemap('')
    } catch (err) {
      console.error('Erreur ajout sitemap:', err)
    } finally {
      setAddingSitemap(false)
    }
  }

  const handleDeleteSitemap = async (id) => {
    try {
      await api.delete(`/crawler/sitemaps/${id}`)
      setSitemaps(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Erreur suppression sitemap:', err)
    }
  }

  const handleStartCrawl = async () => {
    setStartingCrawl(true)
    try {
      await api.post('/crawler/start')
      setCrawlStatus({ status: 'running', pagesFound: 0, pagesCrawled: 0 })
    } catch (err) {
      console.error('Erreur démarrage crawl:', err)
    } finally {
      setStartingCrawl(false)
    }
  }

  const handleCancelCrawl = async () => {
    setCancellingCrawl(true)
    try {
      await api.post('/crawler/cancel')
      setCrawlStatus(prev => ({ ...prev, status: 'cancelled' }))
    } catch (err) {
      console.error('Erreur annulation crawl:', err)
    } finally {
      setCancellingCrawl(false)
    }
  }

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
      <BeginnerBanner
        icon="ph:gear-six"
        title={t('settings.title')}
        tips={[
          t('settings.tip1'),
          t('settings.tip2'),
          t('settings.tip3'),
        ]}
      />
      <div>
        <h2 className="text-white font-bold text-xl">{t('settings.title')}</h2>
        <p className="text-errorgrey text-sm">{t('settings.subtitle')}</p>
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
          {t('settings.alertThreshold')}
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
              {t('settings.alertThreshold')}
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
          <div className="flex flex-col gap-3 pt-2 border-t border-prussian-400">
            <p className="text-errorgrey text-xs uppercase font-semibold tracking-wide">Exclusions</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.exclude_logged_in === '1' || settings.exclude_logged_in === true}
                onChange={e => handleChange('exclude_logged_in', e.target.checked ? '1' : '0')}
                className="w-4 h-4 rounded accent-moonstone-400"
              />
              <span className="text-white font-semibold text-sm">Exclure les utilisateurs connectés</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.exclude_admin === '1' || settings.exclude_admin === true}
                onChange={e => handleChange('exclude_admin', e.target.checked ? '1' : '0')}
                className="w-4 h-4 rounded accent-moonstone-400"
              />
              <span className="text-white font-semibold text-sm">Exclure les administrateurs</span>
            </label>
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

      {/* Section Crawler SEO */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Icon icon="ph:magnifying-glass-plus" className="text-lg" />
          {t('settings.sectionCrawler')}
        </h3>
        <p className="text-errorgrey text-xs mb-4">{t('settings.sectionCrawlerDesc')}</p>

        {/* Sitemaps */}
        <div className="flex flex-col gap-3 mb-4">
          <p className="text-errorgrey text-xs uppercase font-semibold tracking-wide">{t('settings.sitemaps')}</p>
          {sitemaps.length === 0 ? (
            <p className="text-lightgrey text-xs italic">{t('settings.noSitemapsYet')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sitemaps.map(s => (
                <li key={s.id} className="flex items-center gap-2 bg-prussian-700 rounded-lg px-3 py-2">
                  <Icon icon="ph:link" className="text-moonstone-400 text-sm shrink-0" />
                  <span className="text-white text-xs font-mono flex-1 truncate" title={s.url}>{s.url}</span>
                  <button
                    onClick={() => handleDeleteSitemap(s.id)}
                    className="text-errorgrey hover:text-dustyred-400 transition-colors"
                    title="Supprimer"
                  >
                    <Icon icon="ph:trash" className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-1">
            <input
              type="url"
              value={newSitemap}
              onChange={e => setNewSitemap(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSitemap()}
              placeholder={t('settings.sitemapPlaceholder')}
              className="flex-1 bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
            <button
              onClick={handleAddSitemap}
              disabled={addingSitemap || !newSitemap.trim()}
              className="px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm disabled:opacity-50"
            >
              {t('settings.addSitemap')}
            </button>
          </div>
        </div>

        {/* Contrôles crawl */}
        <div className="pt-3 border-t border-prussian-400 flex flex-wrap items-center gap-3">
          {isRunning ? (
            <>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-2.5 h-2.5 rounded-full bg-moonstone-400 animate-pulse" />
                <span className="text-white font-semibold text-sm">{t('settings.crawlRunning')}</span>
                <span className="text-errorgrey text-xs">
                  {crawlStatus?.pagesCrawled ?? 0} / {crawlStatus?.pagesFound ?? 0} {t('settings.crawlPages')}
                </span>
              </div>
              <button
                onClick={handleCancelCrawl}
                disabled={cancellingCrawl}
                className="flex items-center gap-2 px-4 py-2 bg-dustyred-400 text-white font-bold rounded-lg hover:bg-dustyred-300 transition-colors text-sm disabled:opacity-50"
              >
                <Icon icon="ph:x" className="text-sm" />
                {t('settings.cancelCrawl')}
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 text-errorgrey text-xs">
                {crawlStatus?.status === 'completed' && crawlStatus?.finishedAt
                  ? `${t('settings.lastCrawl')} : ${dayjs(crawlStatus.finishedAt).format('DD/MM/YYYY HH:mm')} — ${crawlStatus.pagesCrawled} pages`
                  : t('settings.noCrawlYet')
                }
              </div>
              <button
                onClick={handleStartCrawl}
                disabled={startingCrawl || sitemaps.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm disabled:opacity-50"
              >
                <Icon icon="ph:play" className="text-sm" />
                {startingCrawl ? '...' : t('settings.launchCrawl')}
              </button>
            </>
          )}
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
          {saving ? t('common.saving') : t('common.save')}
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
