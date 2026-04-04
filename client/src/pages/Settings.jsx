import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import { useSite } from '../context/SiteContext'

const EMPTY_SITE_FORM = { name: '', log_file_path: '' }

export default function Settings() {
  const { t } = useTranslation()
  const [config, setConfig] = useState(null)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [webhookTestResult, setWebhookTestResult] = useState(null)
  const [weeklyReportResult, setWeeklyReportResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)

  // Password change
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)

  // DB management
  const [dbStats, setDbStats] = useState(null)
  const [dbStatsLoading, setDbStatsLoading] = useState(false)
  const [retention, setRetention] = useState({ logs_days: 90, anomalies_days: 90, alerts_days: 90 })
  const [retentionSaved, setRetentionSaved] = useState(false)
  const [retentionSaving, setRetentionSaving] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState(null)

  // Sites management
  const { sites, reloadSites } = useSite()
  const [siteForm, setSiteForm] = useState(EMPTY_SITE_FORM)
  const [editingSiteId, setEditingSiteId] = useState(null)
  const [siteMsg, setSiteMsg] = useState(null)
  const [savingSite, setSavingSite] = useState(false)

  useEffect(() => {
    api.get('/alerts/config').then(r => setConfig(r.data)).finally(() => setLoading(false))
    loadDbStats()
  }, [])

  async function loadDbStats() {
    setDbStatsLoading(true)
    try {
      const r = await api.get('/admin/db-stats')
      setDbStats(r.data)
      setRetention({
        logs_days:      r.data.retention.logs_days      ?? '',
        anomalies_days: r.data.retention.anomalies_days ?? '',
        alerts_days:    r.data.retention.alerts_days    ?? '',
      })
    } catch (e) {
      console.error('db-stats error', e)
    } finally {
      setDbStatsLoading(false)
    }
  }

  async function handleSaveRetention() {
    setRetentionSaving(true)
    try {
      const toVal = (v) => v === '' || v === 'null' ? null : parseInt(v, 10)
      await api.put('/admin/retention', {
        logs_days:      toVal(retention.logs_days),
        anomalies_days: toVal(retention.anomalies_days),
        alerts_days:    toVal(retention.alerts_days),
      })
      setRetentionSaved(true)
      setTimeout(() => setRetentionSaved(false), 3000)
    } finally {
      setRetentionSaving(false)
    }
  }

  async function handlePurge() {
    setPurging(true)
    setPurgeResult(null)
    try {
      const r = await api.post('/admin/purge')
      setPurgeResult(r.data)
      await loadDbStats()
    } catch (e) {
      setPurgeResult({ error: e.message })
    } finally {
      setPurging(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/alerts/config', config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSendWeeklyReport() {
    setSendingReport(true)
    setWeeklyReportResult(null)
    try {
      await api.post('/alerts/send-weekly-report')
      setWeeklyReportResult({ success: true })
      setTimeout(() => setWeeklyReportResult(null), 4000)
    } catch (err) {
      setWeeklyReportResult({ success: false, error: err.response?.data?.error || 'Erreur réseau' })
    } finally {
      setSendingReport(false)
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true)
    setWebhookTestResult(null)
    try {
      const { data } = await api.post('/alerts/test-webhook', { url: config?.webhook_url })
      setWebhookTestResult(data)
    } catch {
      setWebhookTestResult({ success: false, error: 'Erreur réseau' })
    } finally {
      setTestingWebhook(false)
    }
  }

  async function handleTestSmtp() {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/alerts/test-smtp')
      setTestResult(data)
    } catch {
      setTestResult({ success: false, error: 'Erreur réseau' })
    } finally {
      setTesting(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwdMsg(null)
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setPwdMsg({ success: false, msg: 'Les mots de passe ne correspondent pas' })
      return
    }
    try {
      const username = localStorage.getItem('spider_username')
      await api.post('/auth/change-password', { username, ...pwdForm })
      setPwdMsg({ success: true, msg: 'Mot de passe modifié avec succès' })
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      setPwdMsg({ success: false, msg: err.response?.data?.error || 'Erreur' })
    }
  }

  async function handleSaveSite(e) {
    e.preventDefault()
    if (!siteForm.name.trim() || !siteForm.log_file_path.trim()) return
    setSavingSite(true)
    setSiteMsg(null)
    try {
      if (editingSiteId) {
        await api.put(`/sites/${editingSiteId}`, siteForm)
      } else {
        await api.post('/sites', siteForm)
      }
      setSiteForm(EMPTY_SITE_FORM)
      setEditingSiteId(null)
      await reloadSites()
      setSiteMsg({ success: true, msg: editingSiteId ? 'Site mis à jour' : 'Site ajouté' })
      setTimeout(() => setSiteMsg(null), 3000)
    } catch (err) {
      setSiteMsg({ success: false, msg: err.response?.data?.error || 'Erreur' })
    } finally {
      setSavingSite(false)
    }
  }

  function startEditSite(site) {
    setEditingSiteId(site.id)
    setSiteForm({ name: site.name, log_file_path: site.log_file_path })
    setSiteMsg(null)
  }

  function cancelEditSite() {
    setEditingSiteId(null)
    setSiteForm(EMPTY_SITE_FORM)
    setSiteMsg(null)
  }

  async function handleDeleteSite(id) {
    if (!confirm(t('settings.confirmDeleteSite'))) return
    await api.delete(`/sites/${id}`)
    await reloadSites()
  }

  async function handleToggleSite(site) {
    await api.put(`/sites/${site.id}`, { active: site.active === 1 ? 0 : 1 })
    await reloadSites()
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
        <h2 className="text-white font-bold text-xl">{t('settings.title')}</h2>
        <p className="text-errorgrey text-sm">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Colonne gauche ── */}
        <div className="flex flex-col gap-6">

      {/* ── Sites à surveiller ─────────────────────────── */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:globe" className="text-moonstone-400 text-base" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">{t('settings.sectionSites')}</h3>
            <p className="text-errorgrey text-xs">{t('settings.sectionSitesDesc')}</p>
          </div>
        </div>

        {/* Liste des sites */}
        {sites.length > 0 && (
          <div className="flex flex-col gap-2">
            {sites.map(site => (
              <div key={site.id} className="flex items-center justify-between gap-3 bg-prussian-600 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${site.active ? 'bg-emerald-400' : 'bg-errorgrey'}`} />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{site.name}</p>
                    <p className="text-errorgrey text-xs truncate">{site.log_file_path}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleSite(site)}
                    title={site.active ? t('settings.toggleDisable') : t('settings.toggleEnable')}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${site.active ? 'border-emerald-700 text-emerald-400 hover:bg-emerald-400/10' : 'border-prussian-300 text-errorgrey hover:text-white'}`}
                  >
                    {site.active ? t('settings.statusActive') : t('settings.statusInactive')}
                  </button>
                  <button
                    onClick={() => startEditSite(site)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-errorgrey hover:text-moonstone-400 hover:bg-prussian-400 transition-colors"
                  >
                    <Icon icon="ph:pencil-simple" className="text-base" />
                  </button>
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-errorgrey hover:text-dustyred-400 hover:bg-dustyred-400/10 transition-colors"
                  >
                    <Icon icon="ph:trash" className="text-base" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulaire ajouter / éditer */}
        <form onSubmit={handleSaveSite} className="flex flex-col gap-4">
          <p className="text-lightgrey text-xs font-semibold uppercase tracking-wider">
            {editingSiteId ? t('settings.editSite') : t('settings.addSite')}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('settings.siteName')}
              value={siteForm.name}
              onChange={v => setSiteForm(f => ({ ...f, name: v }))}
              placeholder={t('settings.siteNamePlaceholder')}
            />
            <Field
              label={t('settings.logPath')}
              value={siteForm.log_file_path}
              onChange={v => setSiteForm(f => ({ ...f, log_file_path: v }))}
              placeholder={t('settings.logPathPlaceholder')}
            />
          </div>
          {siteMsg && (
            <p className={`text-sm font-semibold flex items-center gap-1.5 ${siteMsg.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={siteMsg.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {siteMsg.success ? (editingSiteId ? t('settings.updateSuccess') : t('settings.addSuccess')) : siteMsg.msg}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingSite || !siteForm.name.trim() || !siteForm.log_file_path.trim()}
              className="btn-blue px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <Icon icon={editingSiteId ? 'ph:floppy-disk' : 'ph:plus'} className="text-base" />
              {editingSiteId ? t('settings.buttonUpdate') : t('settings.buttonAdd')}
            </button>
            {editingSiteId && (
              <button type="button" onClick={cancelEditSite} className="text-errorgrey text-sm hover:text-white transition-colors">
                {t('settings.buttonCancel')}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Config email SMTP */}
      <form onSubmit={handleSave} className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:envelope" className="text-moonstone-400 text-base" />
          </div>
          <h3 className="text-white font-bold text-sm">{t('settings.sectionSmtp')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('settings.smtpHost')} value={config?.smtp_host || ''} onChange={v => setConfig(c => ({ ...c, smtp_host: v }))} placeholder={t('settings.smtpHostPlaceholder')} />
          <Field label={t('settings.smtpPort')} type="number" value={config?.smtp_port || 587} onChange={v => setConfig(c => ({ ...c, smtp_port: parseInt(v) }))} placeholder={t('settings.smtpPortPlaceholder')} />
          <Field label={t('settings.smtpUser')} value={config?.smtp_user || ''} onChange={v => setConfig(c => ({ ...c, smtp_user: v }))} placeholder={t('settings.smtpUserPlaceholder')} />
          <Field label={t('settings.smtpPass')} type="password" value="" onChange={v => setConfig(c => ({ ...c, smtp_pass: v }))} placeholder={t('settings.smtpPassPlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('settings.alertEmail')} value={config?.alert_email || ''} onChange={v => setConfig(c => ({ ...c, alert_email: v }))} placeholder={t('settings.alertEmailPlaceholder')} />
          <Field label={t('settings.siteName')} value={config?.site_name || ''} onChange={v => setConfig(c => ({ ...c, site_name: v }))} placeholder={t('settings.siteNamePlaceholder')} />
        </div>

        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            id="smtp_secure"
            checked={config?.smtp_secure === 1}
            onChange={e => setConfig(c => ({ ...c, smtp_secure: e.target.checked ? 1 : 0 }))}
            className="accent-moonstone-400"
          />
          <label htmlFor="smtp_secure" className="text-lightgrey text-sm ml-2">{t('settings.smtpSecure')}</label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestSmtp}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60"
          >
            <Icon icon="ph:paper-plane-tilt" className="text-base" />
            {testing ? t('settings.testSmtpTesting') : t('settings.testSmtp')}
          </button>
          {testResult && (
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${testResult.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={testResult.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {testResult.success ? 'Connexion réussie !' : testResult.error}
            </span>
          )}
        </div>
      </form>

      {/* Seuils alertes */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-dustyred-400/10 flex items-center justify-center">
            <Icon icon="ph:bell-ringing" className="text-dustyred-400 text-base" />
          </div>
          <h3 className="text-white font-bold text-sm">{t('settings.sectionAlerts')}</h3>
        </div>

        <div className="flex flex-col gap-4">
          <AlertToggle
            label={t('settings.alert404Spike')}
            description={`Envoyer une alerte si plus de `}
            enabled={config?.alert_404_enabled === 1}
            threshold={config?.alert_404_threshold || 10}
            unit={t('settings.alert404Threshold')}
            onToggle={v => setConfig(c => ({ ...c, alert_404_enabled: v ? 1 : 0 }))}
            onThreshold={v => setConfig(c => ({ ...c, alert_404_threshold: parseInt(v) }))}
          />
          <AlertToggle
            label={t('settings.alert5xx')}
            description={`Envoyer une alerte si plus de `}
            enabled={config?.alert_5xx_enabled === 1}
            threshold={config?.alert_5xx_threshold || 5}
            unit={t('settings.alert5xxThreshold')}
            onToggle={v => setConfig(c => ({ ...c, alert_5xx_enabled: v ? 1 : 0 }))}
            onThreshold={v => setConfig(c => ({ ...c, alert_5xx_threshold: parseInt(v) }))}
          />
          <div className="flex items-start justify-between gap-4 py-3 border-b border-prussian-400/50">
            <div>
              <p className="text-white text-sm font-semibold">{t('settings.alertGooglebotAbsent')}</p>
              <p className="text-errorgrey text-xs mt-0.5">
                {t('settings.alertGooglebotDays')} {' '}
                <input
                  type="number"
                  min="1" max="30"
                  value={config?.alert_googlebot_days || 7}
                  onChange={e => setConfig(c => ({ ...c, alert_googlebot_days: parseInt(e.target.value) }))}
                  className="w-12 bg-prussian-400 border border-prussian-300 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none mx-1"
                />
                jours
              </p>
            </div>
            <Toggle enabled={config?.alert_googlebot_enabled === 1} onChange={v => setConfig(c => ({ ...c, alert_googlebot_enabled: v ? 1 : 0 }))} />
          </div>
        </div>
      </div>

        </div>{/* fin colonne gauche */}

        {/* ── Colonne droite ── */}
        <div className="flex flex-col gap-6">

      {/* ── Rapport hebdomadaire ──────────────────────────── */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:calendar-check" className="text-moonstone-400 text-base" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">{t('settings.sectionWeekly')}</h3>
            <p className="text-errorgrey text-xs">{t('settings.weeklyDesc')}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">{t('settings.weeklyEnable')}</p>
            <p className="text-errorgrey text-xs mt-0.5">
              {t('settings.weeklyContent')}
            </p>
          </div>
          <Toggle
            enabled={config?.weekly_report_enabled === 1}
            onChange={v => setConfig(c => ({ ...c, weekly_report_enabled: v ? 1 : 0 }))}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSendWeeklyReport}
            disabled={sendingReport}
            className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60"
          >
            <Icon icon="ph:paper-plane-tilt" className="text-base" />
            {sendingReport ? t('settings.sendReportSending') : t('settings.sendReport')}
          </button>
          {weeklyReportResult && (
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${weeklyReportResult.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={weeklyReportResult.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {weeklyReportResult.success ? 'Rapport envoyé !' : weeklyReportResult.error}
            </span>
          )}
        </div>

        <p className="text-errorgrey text-xs bg-prussian-700 rounded-lg px-3 py-2">
          {t('settings.reportHelpText')}
        </p>
      </div>

      {/* ── Webhook ───────────────────────────────────────── */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:webhooks-logo" className="text-moonstone-400 text-base" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">{t('settings.sectionWebhook')}</h3>
            <p className="text-errorgrey text-xs">{t('settings.webhookDesc')}</p>
          </div>
        </div>

        <Field
          label={t('settings.webhookUrl')}
          value={config?.webhook_url || ''}
          onChange={v => setConfig(c => ({ ...c, webhook_url: v }))}
          placeholder={t('settings.webhookUrlPlaceholder')}
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">{t('settings.webhookEnable')}</p>
              <p className="text-errorgrey text-xs mt-0.5">{t('settings.webhookEnableDesc')}</p>
            </div>
            <Toggle
              enabled={config?.webhook_enabled === 1}
              onChange={v => setConfig(c => ({ ...c, webhook_enabled: v ? 1 : 0 }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">{t('settings.webhookWarnings')}</p>
              <p className="text-errorgrey text-xs mt-0.5">{t('settings.webhookWarningsDesc')}</p>
            </div>
            <Toggle
              enabled={config?.webhook_on_warning === 1}
              onChange={v => setConfig(c => ({ ...c, webhook_on_warning: v ? 1 : 0 }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestWebhook}
            disabled={testingWebhook || !config?.webhook_url}
            className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60"
          >
            <Icon icon="ph:paper-plane-tilt" className="text-base" />
            {testingWebhook ? t('settings.testWebhookTesting') : t('settings.testWebhook')}
          </button>
          {webhookTestResult && (
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${webhookTestResult.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={webhookTestResult.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {webhookTestResult.success ? 'Message envoyé !' : webhookTestResult.error}
            </span>
          )}
        </div>

        <div className="bg-prussian-700 rounded-lg p-3 text-xs text-errorgrey">
          <p className="font-semibold text-lightgrey mb-1">{t('settings.discordGuide')}</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>{t('settings.discordStep1')}</li>
            <li>{t('settings.discordStep2')}</li>
            <li>{t('settings.discordStep3')}</li>
          </ol>
        </div>
      </div>

        </div>{/* fin colonne droite */}
      </div>{/* fin grid */}

      {/* Bouton sauvegarde global */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-red px-6 py-2.5 text-sm flex items-center gap-2 w-fit disabled:opacity-60"
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon icon="ph:floppy-disk" className="text-base" />
        )}
        {saved ? t('settings.buttonSaved') : t('settings.buttonSave')}
      </button>

      {/* Gestion de la base de données */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-prussian-400 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-prussian-400 flex items-center justify-center">
              <Icon icon="ph:database" className="text-moonstone-400 text-base" />
            </div>
            <h3 className="text-white font-bold text-sm">{t('dbAdmin.sectionTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={loadDbStats}
            disabled={dbStatsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs text-lightgrey transition-colors disabled:opacity-60"
          >
            <Icon icon={dbStatsLoading ? 'ph:circle-notch' : 'ph:arrow-clockwise'} className={`text-sm ${dbStatsLoading ? 'animate-spin' : ''}`} />
            {t('dbAdmin.refresh')}
          </button>
        </div>

        {/* Bloc 1 — Stats */}
        {dbStats ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-errorgrey uppercase tracking-wide">{t('dbAdmin.statsTitle')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-prussian-700 rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs text-errorgrey flex items-center gap-1.5"><Icon icon="ph:hard-drives" className="text-sm" />{t('dbAdmin.fileSize')}</span>
                <span className="text-white font-bold text-sm">{formatBytes(dbStats.file_size)}</span>
              </div>
              <div className="bg-prussian-700 rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs text-errorgrey flex items-center gap-1.5"><Icon icon="ph:rows" className="text-sm" />{t('dbAdmin.logEntries')}</span>
                <span className="text-white font-bold text-sm">{dbStats.rows.log_entries.toLocaleString('fr-FR')}</span>
              </div>
              <div className="bg-prussian-700 rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs text-errorgrey flex items-center gap-1.5"><Icon icon="ph:warning-diamond" className="text-sm" />{t('dbAdmin.anomalies')}</span>
                <span className="text-white font-bold text-sm">{dbStats.rows.anomalies.toLocaleString('fr-FR')}</span>
              </div>
              <div className="bg-prussian-700 rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs text-errorgrey flex items-center gap-1.5"><Icon icon="ph:bell-ringing" className="text-sm" />{t('dbAdmin.alertHistory')}</span>
                <span className="text-white font-bold text-sm">{dbStats.rows.alert_history.toLocaleString('fr-FR')}</span>
              </div>
            </div>
            {dbStats.log_range.oldest && (
              <p className="text-xs text-errorgrey">
                {t('dbAdmin.logRange')} : <span className="text-lightgrey">{new Date(dbStats.log_range.oldest).toLocaleDateString('fr-FR')}</span>
                {' → '}
                <span className="text-lightgrey">{new Date(dbStats.log_range.newest).toLocaleDateString('fr-FR')}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Bloc 2 — Politique de rétention */}
        <div className="flex flex-col gap-3 pt-4 border-t border-prussian-400">
          <p className="text-xs font-semibold text-errorgrey uppercase tracking-wide">{t('dbAdmin.retentionTitle')}</p>

          {/* Avertissement illimité */}
          {(retention.logs_days === '' || retention.anomalies_days === '' || retention.alerts_days === '') && (
            <div className="flex items-start gap-2.5 bg-amber-900/30 border border-amber-500/40 rounded-lg p-3">
              <Icon icon="ph:warning" className="text-amber-400 text-base mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">{t('dbAdmin.unlimitedWarning')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <RetentionSelect
              label={t('dbAdmin.retentionLogs')}
              icon="ph:rows"
              value={retention.logs_days}
              onChange={v => setRetention(r => ({ ...r, logs_days: v }))}
              t={t}
            />
            <RetentionSelect
              label={t('dbAdmin.retentionAnomalies')}
              icon="ph:warning-diamond"
              value={retention.anomalies_days}
              onChange={v => setRetention(r => ({ ...r, anomalies_days: v }))}
              t={t}
            />
            <RetentionSelect
              label={t('dbAdmin.retentionAlerts')}
              icon="ph:bell-ringing"
              value={retention.alerts_days}
              onChange={v => setRetention(r => ({ ...r, alerts_days: v }))}
              t={t}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveRetention}
            disabled={retentionSaving}
            className="btn-blue px-5 py-2 text-sm w-fit flex items-center gap-2 disabled:opacity-60"
          >
            {retentionSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon icon="ph:floppy-disk" className="text-base" />
            )}
            {retentionSaved ? t('dbAdmin.retentionSaved') : t('dbAdmin.retentionSave')}
          </button>
        </div>

        {/* Bloc 3 — Actions manuelles */}
        <div className="flex flex-col gap-3 pt-4 border-t border-prussian-400">
          <p className="text-xs font-semibold text-errorgrey uppercase tracking-wide">{t('dbAdmin.actionsTitle')}</p>
          <p className="text-xs text-errorgrey">{t('dbAdmin.purgeDescription')}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handlePurge}
              disabled={purging}
              className="flex items-center gap-2 px-4 py-2 bg-dustyred-700 hover:bg-dustyred-600 border border-dustyred-500 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60"
            >
              {purging ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon icon="ph:trash" className="text-base" />
              )}
              {purging ? t('dbAdmin.purging') : t('dbAdmin.purgeNow')}
            </button>
            {purgeResult && !purgeResult.error && (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Icon icon="ph:check-circle" className="text-sm" />
                <span>
                  {t('dbAdmin.purgeResult', {
                    logs: purgeResult.deleted.logs,
                    anomalies: purgeResult.deleted.anomalies,
                    alerts: purgeResult.deleted.alerts,
                    size: formatBytes(purgeResult.file_size),
                  })}
                </span>
              </div>
            )}
            {purgeResult?.error && (
              <span className="text-xs text-dustyred-400 flex items-center gap-1.5">
                <Icon icon="ph:x-circle" className="text-sm" />
                {purgeResult.error}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Changement de mot de passe */}
      <form onSubmit={handleChangePassword} className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-prussian-400 flex items-center justify-center">
            <Icon icon="ph:lock-key" className="text-errorgrey text-base" />
          </div>
          <h3 className="text-white font-bold text-sm">{t('settings.sectionPassword')}</h3>
        </div>
        <Field label={t('settings.currentPassword')} type="password" value={pwdForm.currentPassword} onChange={v => setPwdForm(f => ({ ...f, currentPassword: v }))} />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('settings.newPassword')} type="password" value={pwdForm.newPassword} onChange={v => setPwdForm(f => ({ ...f, newPassword: v }))} placeholder={t('settings.newPasswordPlaceholder')} />
          <Field label={t('settings.confirmPassword')} type="password" value={pwdForm.confirm} onChange={v => setPwdForm(f => ({ ...f, confirm: v }))} />
        </div>
        {pwdMsg && (
          <p className={`text-sm font-semibold flex items-center gap-1.5 ${pwdMsg.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
            <Icon icon={pwdMsg.success ? 'ph:check-circle' : 'ph:x-circle'} />
            {pwdMsg.success ? t('settings.passwordSuccess') : t('settings.passwordMismatch')}
          </p>
        )}
        <button type="submit" className="btn-blue px-5 py-2 text-sm w-fit flex items-center gap-2">
          <Icon icon="ph:lock-key-open" className="text-base" />
          {t('settings.buttonChangePassword')}
        </button>
      </form>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const RETENTION_OPTIONS = [
  { value: '7',   labelKey: 'dbAdmin.days7' },
  { value: '30',  labelKey: 'dbAdmin.days30' },
  { value: '90',  labelKey: 'dbAdmin.days90' },
  { value: '180', labelKey: 'dbAdmin.days180' },
  { value: '365', labelKey: 'dbAdmin.days365' },
  { value: '',    labelKey: 'dbAdmin.unlimited' },
]

function RetentionSelect({ label, icon, value, onChange, t }) {
  return (
    <div>
      <label className="text-lightgrey text-xs font-semibold flex items-center gap-1.5 mb-1.5">
        <Icon icon={icon} className="text-sm" />{label}
      </label>
      <select
        value={value === null ? '' : value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-prussian-600 border border-prussian-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-500 transition-colors"
      >
        {RETENTION_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
        ))}
      </select>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="text-lightgrey text-xs font-semibold block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-prussian-600 border border-prussian-400 rounded-lg px-3 py-2 text-white text-sm placeholder:text-errorgrey focus:outline-none focus:border-moonstone-500 transition-colors"
      />
    </div>
  )
}

function Toggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-moonstone-500' : 'bg-prussian-400'}`}
    >
      <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function AlertToggle({ label, enabled, threshold, unit, onToggle, onThreshold }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-prussian-400/50">
      <div>
        <p className="text-white text-sm font-semibold">{label}</p>
        <p className="text-errorgrey text-xs mt-0.5">
          {t('settings.alertThreshold')}{' '}
          <input
            type="number"
            min="1"
            value={threshold}
            onChange={e => onThreshold(e.target.value)}
            className="w-14 bg-prussian-400 border border-prussian-300 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none mx-1"
          />
          {unit}
        </p>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  )
}
