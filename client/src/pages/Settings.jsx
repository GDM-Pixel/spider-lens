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
  const [editingSiteId, setEditingSiteId] = useState(null)
  const [siteForm, setSiteForm] = useState(EMPTY_SITE_FORM)
  const [addingNewSite, setAddingNewSite] = useState(false)
  const [siteMsg, setSiteMsg] = useState(null)
  const [savingSite, setSavingSite] = useState(false)

  // Crawler / sitemaps
  const [sitemapsBySite, setSitemapsBySite] = useState({})
  const [crawlStatusBySite, setCrawlStatusBySite] = useState({})
  const [newSitemapUrl, setNewSitemapUrl] = useState({})
  const [addingSitemap, setAddingSitemap] = useState({})
  const [crawlPollers, setCrawlPollers] = useState({})

  useEffect(() => {
    api.get('/alerts/config').then(r => setConfig(r.data)).finally(() => setLoading(false))
    loadDbStats()
  }, [])

  useEffect(() => {
    if (!sites.length) return
    sites.forEach(site => {
      loadSitemaps(site.id)
      loadCrawlStatus(site.id).then(status => {
        if (status?.status === 'running' || status?.status === 'cancelling') {
          startCrawlPolling(site.id)
        }
      })
    })
  }, [sites.length])

  // ── DB ────────────────────────────────────────────────

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
    } catch (e) { console.error('db-stats error', e) }
    finally { setDbStatsLoading(false) }
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
    } finally { setRetentionSaving(false) }
  }

  async function handlePurge() {
    setPurging(true)
    setPurgeResult(null)
    try {
      const r = await api.post('/admin/purge')
      setPurgeResult(r.data)
      await loadDbStats()
    } catch (e) { setPurgeResult({ error: e.message }) }
    finally { setPurging(false) }
  }

  // ── Alertes ───────────────────────────────────────────

  async function handleSaveAlerts(e) {
    e?.preventDefault()
    setSaving(true)
    try {
      await api.post('/alerts/config', config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
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
    } finally { setSendingReport(false) }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true)
    setWebhookTestResult(null)
    try {
      const { data } = await api.post('/alerts/test-webhook', { url: config?.webhook_url })
      setWebhookTestResult(data)
    } catch { setWebhookTestResult({ success: false, error: 'Erreur réseau' }) }
    finally { setTestingWebhook(false) }
  }

  async function handleTestSmtp() {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/alerts/test-smtp')
      setTestResult(data)
    } catch { setTestResult({ success: false, error: 'Erreur réseau' }) }
    finally { setTesting(false) }
  }

  // ── Sites ─────────────────────────────────────────────

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
      setAddingNewSite(false)
      await reloadSites()
      setSiteMsg({ success: true, msg: editingSiteId ? t('settings.updateSuccess') : t('settings.addSuccess') })
      setTimeout(() => setSiteMsg(null), 3000)
    } catch (err) {
      setSiteMsg({ success: false, msg: err.response?.data?.error || 'Erreur' })
    } finally { setSavingSite(false) }
  }

  function startEditSite(site) {
    setEditingSiteId(site.id)
    setAddingNewSite(false)
    setSiteForm({ name: site.name, log_file_path: site.log_file_path })
    setSiteMsg(null)
  }

  function startAddSite() {
    setEditingSiteId(null)
    setAddingNewSite(true)
    setSiteForm(EMPTY_SITE_FORM)
    setSiteMsg(null)
  }

  function cancelSiteForm() {
    setEditingSiteId(null)
    setAddingNewSite(false)
    setSiteForm(EMPTY_SITE_FORM)
    setSiteMsg(null)
  }

  async function handleDeleteSite(id) {
    if (!confirm(t('settings.confirmDeleteSite'))) return
    await api.delete(`/sites/${id}`)
    stopCrawlPolling(id)
    await reloadSites()
  }

  async function handleToggleSite(site) {
    await api.put(`/sites/${site.id}`, { active: site.active === 1 ? 0 : 1 })
    await reloadSites()
  }

  // ── Crawler ───────────────────────────────────────────

  async function loadSitemaps(siteId) {
    try {
      const r = await api.get(`/crawler/${siteId}/sitemaps`)
      setSitemapsBySite(prev => ({ ...prev, [siteId]: r.data }))
    } catch { /* ignore */ }
  }

  async function loadCrawlStatus(siteId) {
    try {
      const r = await api.get(`/crawler/${siteId}/status`)
      setCrawlStatusBySite(prev => ({ ...prev, [siteId]: r.data }))
      return r.data
    } catch { return null }
  }

  function startCrawlPolling(siteId) {
    if (crawlPollers[siteId]) return
    const id = setInterval(async () => {
      const status = await loadCrawlStatus(siteId)
      if (status && status.status !== 'running' && status.status !== 'cancelling') {
        stopCrawlPolling(siteId)
      }
    }, 3000)
    setCrawlPollers(prev => ({ ...prev, [siteId]: id }))
  }

  function stopCrawlPolling(siteId) {
    setCrawlPollers(prev => {
      if (prev[siteId]) clearInterval(prev[siteId])
      const next = { ...prev }
      delete next[siteId]
      return next
    })
  }

  async function handleAddSitemap(siteId) {
    const url = (newSitemapUrl[siteId] || '').trim()
    if (!url) return
    setAddingSitemap(prev => ({ ...prev, [siteId]: true }))
    try {
      await api.post(`/crawler/${siteId}/sitemaps`, { url })
      setNewSitemapUrl(prev => ({ ...prev, [siteId]: '' }))
      await loadSitemaps(siteId)
    } catch { /* ignore */ }
    finally { setAddingSitemap(prev => ({ ...prev, [siteId]: false })) }
  }

  async function handleDeleteSitemap(siteId, sitemapId) {
    await api.delete(`/crawler/${siteId}/sitemaps/${sitemapId}`)
    await loadSitemaps(siteId)
  }

  async function handleStartCrawl(siteId) {
    try {
      await api.post(`/crawler/${siteId}/start`)
      await loadCrawlStatus(siteId)
      startCrawlPolling(siteId)
    } catch { /* ignore */ }
  }

  async function handleCancelCrawl(siteId) {
    try {
      await api.post(`/crawler/${siteId}/cancel`)
      await loadCrawlStatus(siteId)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-white font-bold text-xl">{t('settings.title')}</h2>
        <p className="text-errorgrey text-sm">{t('settings.subtitle')}</p>
      </div>

      {/* ════════════════════════════════════════════════
          POLE 1 — SITES
      ════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="ph:globe" className="text-moonstone-400 text-lg" />
            <h3 className="text-white font-bold text-base">{t('settings.sectionSites')}</h3>
          </div>
          <button
            onClick={startAddSite}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs text-white font-semibold transition-colors"
          >
            <Icon icon="ph:plus" className="text-sm" />
            {t('settings.addSite')}
          </button>
        </div>

        {/* Formulaire ajout / édition */}
        {(addingNewSite || editingSiteId) && (
          <div className="bg-prussian-500 rounded-xl border border-moonstone-400/40 p-5 flex flex-col gap-4">
            <p className="text-moonstone-400 text-xs font-semibold uppercase tracking-wider">
              {editingSiteId ? t('settings.editSite') : t('settings.addSite')}
            </p>
            <form onSubmit={handleSaveSite} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {siteMsg.msg}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={savingSite || !siteForm.name.trim() || !siteForm.log_file_path.trim()} className="btn-blue px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60">
                  <Icon icon={editingSiteId ? 'ph:floppy-disk' : 'ph:plus'} className="text-base" />
                  {editingSiteId ? t('settings.buttonUpdate') : t('settings.buttonAdd')}
                </button>
                <button type="button" onClick={cancelSiteForm} className="text-errorgrey text-sm hover:text-white hover:bg-prussian-500/50 rounded-lg px-2 py-1 transition-colors">
                  {t('settings.buttonCancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cards de sites */}
        {sites.length === 0 ? (
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-8 text-center text-errorgrey text-sm">
            {t('settings.noSitesForCrawler')}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sites.map(site => {
              const crawlStatus = crawlStatusBySite[site.id]
              const isRunning = crawlStatus?.status === 'running' || crawlStatus?.status === 'cancelling'
              const sitemaps = sitemapsBySite[site.id] || []
              const isEditing = editingSiteId === site.id

              return (
                <div key={site.id} className={`bg-prussian-500 rounded-xl border p-5 flex flex-col gap-4 transition-colors ${isEditing ? 'border-moonstone-400/40' : 'border-prussian-400'}`}>

                  {/* Ligne nom + actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${site.active ? 'bg-emerald-400' : 'bg-errorgrey'}`} />
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{site.name}</p>
                        <p className="text-errorgrey text-xs mt-0.5 truncate font-mono">{site.log_file_path}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleSite(site)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${site.active ? 'border-emerald-700 text-emerald-400 hover:bg-emerald-400/10' : 'border-prussian-300 text-errorgrey hover:text-white'}`}
                      >
                        {site.active ? t('settings.statusActive') : t('settings.statusInactive')}
                      </button>
                      <button onClick={() => startEditSite(site)} className="w-7 h-7 rounded-lg flex items-center justify-center text-errorgrey hover:text-moonstone-400 hover:bg-prussian-400 transition-colors">
                        <Icon icon="ph:pencil-simple" className="text-base" />
                      </button>
                      <button onClick={() => handleDeleteSite(site.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-errorgrey hover:text-dustyred-400 hover:bg-dustyred-400/10 transition-colors">
                        <Icon icon="ph:trash" className="text-base" />
                      </button>
                    </div>
                  </div>

                  {/* Séparateur + section Sitemaps */}
                  <div className="border-t border-prussian-400 pt-4 flex flex-col gap-3">
                    <p className="text-lightgrey text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Icon icon="ph:map-trifold" className="text-moonstone-400 text-sm" />
                      {t('settings.sitemaps')}
                    </p>

                    {/* Liste sitemaps */}
                    {sitemaps.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {sitemaps.map(sm => (
                          <div key={sm.id} className="flex items-center justify-between gap-2 bg-prussian-600 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon icon="ph:link" className="text-errorgrey text-sm shrink-0" />
                              <span className="text-lightgrey text-xs truncate">{sm.url}</span>
                            </div>
                            <button onClick={() => handleDeleteSitemap(site.id, sm.id)} className="w-5 h-5 rounded flex items-center justify-center text-errorgrey hover:text-dustyred-400 transition-colors shrink-0">
                              <Icon icon="ph:x" className="text-xs" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input ajouter sitemap */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={newSitemapUrl[site.id] || ''}
                        onChange={e => setNewSitemapUrl(prev => ({ ...prev, [site.id]: e.target.value }))}
                        placeholder={t('settings.sitemapPlaceholder')}
                        className="flex-1 bg-prussian-600 border border-prussian-400 rounded-lg px-3 py-2 text-white text-xs placeholder-errorgrey focus:outline-none focus:border-moonstone-400 transition-colors"
                        onKeyDown={e => e.key === 'Enter' && handleAddSitemap(site.id)}
                      />
                      <button
                        onClick={() => handleAddSitemap(site.id)}
                        disabled={addingSitemap[site.id] || !(newSitemapUrl[site.id] || '').trim()}
                        className="flex items-center gap-1.5 px-3 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs text-white font-semibold transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Icon icon="ph:plus" className="text-sm" />
                        {t('settings.addSitemap')}
                      </button>
                    </div>

                    {/* Contrôles crawl */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-errorgrey">
                        {isRunning ? (
                          <span className="text-moonstone-400 flex items-center gap-1.5">
                            <Icon icon="ph:spinner" className="animate-spin text-sm" />
                            {t('settings.crawlRunning')} — {crawlStatus.pagesCrawled ?? 0} / {crawlStatus.pagesFound ?? '?'} {t('settings.crawlPages')}
                          </span>
                        ) : crawlStatus?.finishedAt ? (
                          <span className="flex items-center gap-1">
                            <Icon icon="ph:check-circle" className="text-emerald-400 text-sm" />
                            {t('settings.lastCrawl')} : {new Date(crawlStatus.finishedAt).toLocaleDateString()} — {crawlStatus.pagesCrawled ?? 0} {t('settings.crawlPages')}
                          </span>
                        ) : (
                          <span>{t('settings.noCrawlYet')}</span>
                        )}
                      </div>
                      {isRunning ? (
                        <button onClick={() => handleCancelCrawl(site.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-dustyred-400 hover:bg-dustyred-400/10 border border-dustyred-400/40 rounded-lg transition-colors shrink-0">
                          <Icon icon="ph:stop-circle" className="text-sm" />
                          {t('settings.cancelCrawl')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartCrawl(site.id)}
                          disabled={sitemaps.length === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-moonstone-600 hover:bg-moonstone-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          <Icon icon="ph:magnifying-glass" className="text-sm" />
                          {t('settings.launchCrawl')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════
          POLE 2 — ALERTES
      ════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon icon="ph:bell-ringing" className="text-dustyred-400 text-lg" />
          <h3 className="text-white font-bold text-base">{t('settings.sectionAlerts')}</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* SMTP */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-prussian-400 pb-3">
              <Icon icon="ph:envelope" className="text-moonstone-400 text-base" />
              <h4 className="text-white font-bold text-sm">{t('settings.sectionSmtp')}</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.smtpHost')} value={config?.smtp_host || ''} onChange={v => setConfig(c => ({ ...c, smtp_host: v }))} placeholder={t('settings.smtpHostPlaceholder')} />
              <Field label={t('settings.smtpPort')} type="number" value={config?.smtp_port || 587} onChange={v => setConfig(c => ({ ...c, smtp_port: parseInt(v) }))} placeholder={t('settings.smtpPortPlaceholder')} />
              <Field label={t('settings.smtpUser')} value={config?.smtp_user || ''} onChange={v => setConfig(c => ({ ...c, smtp_user: v }))} placeholder={t('settings.smtpUserPlaceholder')} />
              <Field label={t('settings.smtpPass')} type="password" value="" onChange={v => setConfig(c => ({ ...c, smtp_pass: v }))} placeholder={t('settings.smtpPassPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.alertEmail')} value={config?.alert_email || ''} onChange={v => setConfig(c => ({ ...c, alert_email: v }))} placeholder={t('settings.alertEmailPlaceholder')} />
              <Field label={t('settings.siteName')} value={config?.site_name || ''} onChange={v => setConfig(c => ({ ...c, site_name: v }))} placeholder={t('settings.siteNamePlaceholder')} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="smtp_secure" checked={config?.smtp_secure === 1} onChange={e => setConfig(c => ({ ...c, smtp_secure: e.target.checked ? 1 : 0 }))} className="accent-moonstone-400" />
              <label htmlFor="smtp_secure" className="text-lightgrey text-sm">{t('settings.smtpSecure')}</label>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleTestSmtp} disabled={testing} className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60">
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
          </div>

          {/* Seuils + Rapport hebdo + Webhook */}
          <div className="flex flex-col gap-4">

            {/* Seuils d'alerte */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-prussian-400 pb-3">
                <Icon icon="ph:warning-diamond" className="text-amber-400 text-base" />
                <h4 className="text-white font-bold text-sm">{t('settings.alertThresholds')}</h4>
              </div>
              <AlertToggle
                label={t('settings.alert404Spike')}
                enabled={config?.alert_404_enabled === 1}
                threshold={config?.alert_404_threshold || 10}
                unit={t('settings.alert404Threshold')}
                onToggle={v => setConfig(c => ({ ...c, alert_404_enabled: v ? 1 : 0 }))}
                onThreshold={v => setConfig(c => ({ ...c, alert_404_threshold: parseInt(v) }))}
              />
              <AlertToggle
                label={t('settings.alert5xx')}
                enabled={config?.alert_5xx_enabled === 1}
                threshold={config?.alert_5xx_threshold || 5}
                unit={t('settings.alert5xxThreshold')}
                onToggle={v => setConfig(c => ({ ...c, alert_5xx_enabled: v ? 1 : 0 }))}
                onThreshold={v => setConfig(c => ({ ...c, alert_5xx_threshold: parseInt(v) }))}
              />
              <div className="flex items-start justify-between gap-4 pt-3">
                <div>
                  <p className="text-white text-sm font-semibold">{t('settings.alertGooglebotAbsent')}</p>
                  <p className="text-errorgrey text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                    {t('settings.alertGooglebotDays')}
                    <input type="number" min="1" max="30" value={config?.alert_googlebot_days || 7} onChange={e => setConfig(c => ({ ...c, alert_googlebot_days: parseInt(e.target.value) }))} className="w-12 bg-prussian-400 border border-prussian-300 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none mx-1" />
                    jours
                  </p>
                </div>
                <Toggle enabled={config?.alert_googlebot_enabled === 1} onChange={v => setConfig(c => ({ ...c, alert_googlebot_enabled: v ? 1 : 0 }))} />
              </div>
            </div>

            {/* Rapport hebdomadaire */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-prussian-400 pb-3">
                <Icon icon="ph:calendar-check" className="text-moonstone-400 text-base" />
                <h4 className="text-white font-bold text-sm">{t('settings.sectionWeekly')}</h4>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">{t('settings.weeklyEnable')}</p>
                  <p className="text-errorgrey text-xs mt-0.5">{t('settings.weeklyContent')}</p>
                </div>
                <Toggle enabled={config?.weekly_report_enabled === 1} onChange={v => setConfig(c => ({ ...c, weekly_report_enabled: v ? 1 : 0 }))} />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleSendWeeklyReport} disabled={sendingReport} className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60">
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
              <p className="text-errorgrey text-xs bg-prussian-700 rounded-lg px-3 py-2">{t('settings.reportHelpText')}</p>
            </div>

            {/* Webhook */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-prussian-400 pb-3">
                <Icon icon="ph:webhooks-logo" className="text-moonstone-400 text-base" />
                <h4 className="text-white font-bold text-sm">{t('settings.sectionWebhook')}</h4>
              </div>
              <Field label={t('settings.webhookUrl')} value={config?.webhook_url || ''} onChange={v => setConfig(c => ({ ...c, webhook_url: v }))} placeholder={t('settings.webhookUrlPlaceholder')} />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{t('settings.webhookEnable')}</p>
                    <p className="text-errorgrey text-xs">{t('settings.webhookEnableDesc')}</p>
                  </div>
                  <Toggle enabled={config?.webhook_enabled === 1} onChange={v => setConfig(c => ({ ...c, webhook_enabled: v ? 1 : 0 }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{t('settings.webhookWarnings')}</p>
                    <p className="text-errorgrey text-xs">{t('settings.webhookWarningsDesc')}</p>
                  </div>
                  <Toggle enabled={config?.webhook_on_warning === 1} onChange={v => setConfig(c => ({ ...c, webhook_on_warning: v ? 1 : 0 }))} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleTestWebhook} disabled={testingWebhook || !config?.webhook_url} className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60">
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
          </div>
        </div>

        {/* Bouton sauvegarder alertes */}
        <div className="flex justify-start">
          <button onClick={handleSaveAlerts} disabled={saving} className="btn-red px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon icon="ph:floppy-disk" className="text-base" />}
            {saved ? t('settings.buttonSaved') : t('settings.buttonSave')}
          </button>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          POLE 3 — GESTION DB
      ════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon icon="ph:database" className="text-moonstone-400 text-lg" />
          <h3 className="text-white font-bold text-base">{t('dbAdmin.sectionTitle')}</h3>
        </div>

        <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-6">
          {/* Header refresh */}
          <div className="flex items-center justify-end">
            <button type="button" onClick={loadDbStats} disabled={dbStatsLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs text-lightgrey transition-colors disabled:opacity-60">
              <Icon icon={dbStatsLoading ? 'ph:circle-notch' : 'ph:arrow-clockwise'} className={`text-sm ${dbStatsLoading ? 'animate-spin' : ''}`} />
              {t('dbAdmin.refresh')}
            </button>
          </div>

          {/* Stats */}
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

          {/* Rétention */}
          <div className="flex flex-col gap-3 pt-4 border-t border-prussian-400">
            <p className="text-xs font-semibold text-errorgrey uppercase tracking-wide">{t('dbAdmin.retentionTitle')}</p>
            {(retention.logs_days === '' || retention.anomalies_days === '' || retention.alerts_days === '') && (
              <div className="flex items-start gap-2.5 bg-amber-900/30 border border-amber-500/40 rounded-lg p-3">
                <Icon icon="ph:warning" className="text-amber-400 text-base mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">{t('dbAdmin.unlimitedWarning')}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <RetentionSelect label={t('dbAdmin.retentionLogs')} icon="ph:rows" value={retention.logs_days} onChange={v => setRetention(r => ({ ...r, logs_days: v }))} t={t} />
              <RetentionSelect label={t('dbAdmin.retentionAnomalies')} icon="ph:warning-diamond" value={retention.anomalies_days} onChange={v => setRetention(r => ({ ...r, anomalies_days: v }))} t={t} />
              <RetentionSelect label={t('dbAdmin.retentionAlerts')} icon="ph:bell-ringing" value={retention.alerts_days} onChange={v => setRetention(r => ({ ...r, alerts_days: v }))} t={t} />
            </div>
            <button type="button" onClick={handleSaveRetention} disabled={retentionSaving} className="btn-blue px-5 py-2 text-sm w-fit flex items-center gap-2 disabled:opacity-60">
              {retentionSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon icon="ph:floppy-disk" className="text-base" />}
              {retentionSaved ? t('dbAdmin.retentionSaved') : t('dbAdmin.retentionSave')}
            </button>
          </div>

          {/* Purge manuelle */}
          <div className="flex flex-col gap-3 pt-4 border-t border-prussian-400">
            <p className="text-xs font-semibold text-errorgrey uppercase tracking-wide">{t('dbAdmin.actionsTitle')}</p>
            <p className="text-xs text-errorgrey">{t('dbAdmin.purgeDescription')}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={handlePurge} disabled={purging} className="flex items-center gap-2 px-4 py-2 bg-dustyred-700 hover:bg-dustyred-600 border border-dustyred-500 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60">
                {purging ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon icon="ph:trash" className="text-base" />}
                {purging ? t('dbAdmin.purging') : t('dbAdmin.purgeNow')}
              </button>
              {purgeResult && !purgeResult.error && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Icon icon="ph:check-circle" className="text-sm" />
                  <span>{t('dbAdmin.purgeResult', { logs: purgeResult.deleted.logs, anomalies: purgeResult.deleted.anomalies, alerts: purgeResult.deleted.alerts, size: formatBytes(purgeResult.file_size) })}</span>
                </div>
              )}
              {purgeResult?.error && (
                <span className="text-xs text-dustyred-400 flex items-center gap-1.5">
                  <Icon icon="ph:x-circle" className="text-sm" />{purgeResult.error}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Composants helpers ────────────────────────────────────

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
      <select value={value === null ? '' : value} onChange={e => onChange(e.target.value)} className="w-full bg-prussian-600 border border-prussian-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-500 hover:border-prussian-300 cursor-pointer transition-colors">
        {RETENTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
      </select>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="text-lightgrey text-xs font-semibold block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-prussian-600 border border-prussian-400 rounded-lg px-3 py-2 text-white text-sm placeholder:text-errorgrey focus:outline-none focus:border-moonstone-500 transition-colors" />
    </div>
  )
}

function Toggle({ enabled, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!enabled)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-all hover:opacity-80 ${enabled ? 'bg-moonstone-500 border-moonstone-400' : 'bg-prussian-400 border-prussian-300'}`}>
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
          <input type="number" min="1" value={threshold} onChange={e => onThreshold(e.target.value)} className="w-14 bg-prussian-400 border border-prussian-300 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none mx-1" />
          {unit}
        </p>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  )
}
