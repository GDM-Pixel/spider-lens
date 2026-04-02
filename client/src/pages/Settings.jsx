import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import api from '../api/client'
import { useSite } from '../context/SiteContext'

const EMPTY_SITE_FORM = { name: '', log_file_path: '' }

export default function Settings() {
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

  // Sites management
  const { sites, reloadSites } = useSite()
  const [siteForm, setSiteForm] = useState(EMPTY_SITE_FORM)
  const [editingSiteId, setEditingSiteId] = useState(null)
  const [siteMsg, setSiteMsg] = useState(null)
  const [savingSite, setSavingSite] = useState(false)

  useEffect(() => {
    api.get('/alerts/config').then(r => setConfig(r.data)).finally(() => setLoading(false))
  }, [])

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
    if (!confirm('Supprimer ce site ? Les données de logs associées seront conservées.')) return
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
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-white font-bold text-xl">Paramètres</h2>
        <p className="text-errorgrey text-sm">Configuration de Spider-Lens</p>
      </div>

      {/* ── Sites à surveiller ─────────────────────────── */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:globe" className="text-moonstone-400 text-base" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Sites à surveiller</h3>
            <p className="text-errorgrey text-xs">Chaque site correspond à un fichier de log Apache ou Nginx</p>
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
                    title={site.active ? 'Désactiver le parsing' : 'Activer le parsing'}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${site.active ? 'border-emerald-700 text-emerald-400 hover:bg-emerald-400/10' : 'border-prussian-300 text-errorgrey hover:text-white'}`}
                  >
                    {site.active ? 'Actif' : 'Inactif'}
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
            {editingSiteId ? 'Modifier le site' : 'Ajouter un site'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Nom du site"
              value={siteForm.name}
              onChange={v => setSiteForm(f => ({ ...f, name: v }))}
              placeholder="gdm-pixel.com"
            />
            <Field
              label="Chemin du fichier de log"
              value={siteForm.log_file_path}
              onChange={v => setSiteForm(f => ({ ...f, log_file_path: v }))}
              placeholder="/var/log/nginx/access.log"
            />
          </div>
          {siteMsg && (
            <p className={`text-sm font-semibold flex items-center gap-1.5 ${siteMsg.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={siteMsg.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {siteMsg.msg}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingSite || !siteForm.name.trim() || !siteForm.log_file_path.trim()}
              className="btn-blue px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <Icon icon={editingSiteId ? 'ph:floppy-disk' : 'ph:plus'} className="text-base" />
              {editingSiteId ? 'Mettre à jour' : 'Ajouter le site'}
            </button>
            {editingSiteId && (
              <button type="button" onClick={cancelEditSite} className="text-errorgrey text-sm hover:text-white transition-colors">
                Annuler
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
          <h3 className="text-white font-bold text-sm">Configuration SMTP</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Serveur SMTP" value={config?.smtp_host || ''} onChange={v => setConfig(c => ({ ...c, smtp_host: v }))} placeholder="smtp.gmail.com" />
          <Field label="Port" type="number" value={config?.smtp_port || 587} onChange={v => setConfig(c => ({ ...c, smtp_port: parseInt(v) }))} placeholder="587" />
          <Field label="Utilisateur SMTP" value={config?.smtp_user || ''} onChange={v => setConfig(c => ({ ...c, smtp_user: v }))} placeholder="user@gmail.com" />
          <Field label="Mot de passe SMTP" type="password" value="" onChange={v => setConfig(c => ({ ...c, smtp_pass: v }))} placeholder="Laisser vide pour conserver" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email destinataire" value={config?.alert_email || ''} onChange={v => setConfig(c => ({ ...c, alert_email: v }))} placeholder="admin@monsite.com" />
          <Field label="Nom du site" value={config?.site_name || ''} onChange={v => setConfig(c => ({ ...c, site_name: v }))} placeholder="Mon Site" />
        </div>

        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            id="smtp_secure"
            checked={config?.smtp_secure === 1}
            onChange={e => setConfig(c => ({ ...c, smtp_secure: e.target.checked ? 1 : 0 }))}
            className="accent-moonstone-400"
          />
          <label htmlFor="smtp_secure" className="text-lightgrey text-sm ml-2">Connexion SSL/TLS (port 465)</label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestSmtp}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-60"
          >
            <Icon icon="ph:paper-plane-tilt" className="text-base" />
            {testing ? 'Test en cours...' : 'Tester SMTP'}
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
          <h3 className="text-white font-bold text-sm">Seuils d'alertes</h3>
        </div>

        <div className="flex flex-col gap-4">
          <AlertToggle
            label="Alerte 404 spike"
            description={`Envoyer une alerte si plus de `}
            enabled={config?.alert_404_enabled === 1}
            threshold={config?.alert_404_threshold || 10}
            unit="erreurs 404 / heure"
            onToggle={v => setConfig(c => ({ ...c, alert_404_enabled: v ? 1 : 0 }))}
            onThreshold={v => setConfig(c => ({ ...c, alert_404_threshold: parseInt(v) }))}
          />
          <AlertToggle
            label="Alerte erreurs serveur (5xx)"
            description={`Envoyer une alerte si plus de `}
            enabled={config?.alert_5xx_enabled === 1}
            threshold={config?.alert_5xx_threshold || 5}
            unit="erreurs 5xx / heure"
            onToggle={v => setConfig(c => ({ ...c, alert_5xx_enabled: v ? 1 : 0 }))}
            onThreshold={v => setConfig(c => ({ ...c, alert_5xx_threshold: parseInt(v) }))}
          />
          <div className="flex items-start justify-between gap-4 py-3 border-b border-prussian-400/50">
            <div>
              <p className="text-white text-sm font-semibold">Alerte Googlebot absent</p>
              <p className="text-errorgrey text-xs mt-0.5">
                Alerter si Googlebot absent depuis{' '}
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

      {/* ── Rapport hebdomadaire ──────────────────────────── */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:calendar-check" className="text-moonstone-400 text-base" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Rapport hebdomadaire</h3>
            <p className="text-errorgrey text-xs">Envoyé automatiquement chaque lundi à 8h par email et/ou webhook</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">Activer le rapport hebdomadaire</p>
            <p className="text-errorgrey text-xs mt-0.5">
              Résumé de la semaine : trafic, top pages, 404, bots, anomalies, TTFB
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
            {sendingReport ? 'Envoi en cours...' : 'Envoyer maintenant'}
          </button>
          {weeklyReportResult && (
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${weeklyReportResult.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={weeklyReportResult.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {weeklyReportResult.success ? 'Rapport envoyé !' : weeklyReportResult.error}
            </span>
          )}
        </div>

        <p className="text-errorgrey text-xs bg-prussian-700 rounded-lg px-3 py-2">
          Le rapport utilise la configuration SMTP et le webhook définis ci-dessous.
          Activez au moins l'un des deux avant d'activer le rapport.
        </p>
      </div>

      {/* ── Webhook ───────────────────────────────────────── */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center">
            <Icon icon="ph:webhooks-logo" className="text-moonstone-400 text-base" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Notifications Webhook</h3>
            <p className="text-errorgrey text-xs">Compatible Discord, Slack, et tout endpoint HTTP POST JSON</p>
          </div>
        </div>

        <Field
          label="URL du webhook"
          value={config?.webhook_url || ''}
          onChange={v => setConfig(c => ({ ...c, webhook_url: v }))}
          placeholder="https://discord.com/api/webhooks/xxx/yyy"
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">Activer les notifications webhook</p>
              <p className="text-errorgrey text-xs mt-0.5">Envoie une notification à chaque anomalie détectée</p>
            </div>
            <Toggle
              enabled={config?.webhook_enabled === 1}
              onChange={v => setConfig(c => ({ ...c, webhook_enabled: v ? 1 : 0 }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">Inclure les avertissements</p>
              <p className="text-errorgrey text-xs mt-0.5">Par défaut seules les anomalies critiques sont envoyées</p>
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
            {testingWebhook ? 'Test en cours...' : 'Tester le webhook'}
          </button>
          {webhookTestResult && (
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${webhookTestResult.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
              <Icon icon={webhookTestResult.success ? 'ph:check-circle' : 'ph:x-circle'} />
              {webhookTestResult.success ? 'Message envoyé !' : webhookTestResult.error}
            </span>
          )}
        </div>

        <div className="bg-prussian-700 rounded-lg p-3 text-xs text-errorgrey">
          <p className="font-semibold text-lightgrey mb-1">Comment créer un webhook Discord ?</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Ouvrez les paramètres du salon Discord cible</li>
            <li>Intégrations → Webhooks → Nouveau webhook</li>
            <li>Copiez l'URL et collez-la ci-dessus</li>
          </ol>
        </div>
      </div>

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
        {saved ? 'Sauvegardé !' : 'Enregistrer les paramètres'}
      </button>

      {/* Changement de mot de passe */}
      <form onSubmit={handleChangePassword} className="bg-prussian-500 rounded-xl border border-prussian-400 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-prussian-400 pb-4">
          <div className="w-8 h-8 rounded-lg bg-prussian-400 flex items-center justify-center">
            <Icon icon="ph:lock-key" className="text-errorgrey text-base" />
          </div>
          <h3 className="text-white font-bold text-sm">Changer le mot de passe</h3>
        </div>
        <Field label="Mot de passe actuel" type="password" value={pwdForm.currentPassword} onChange={v => setPwdForm(f => ({ ...f, currentPassword: v }))} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nouveau mot de passe" type="password" value={pwdForm.newPassword} onChange={v => setPwdForm(f => ({ ...f, newPassword: v }))} placeholder="Min. 8 caractères" />
          <Field label="Confirmer" type="password" value={pwdForm.confirm} onChange={v => setPwdForm(f => ({ ...f, confirm: v }))} />
        </div>
        {pwdMsg && (
          <p className={`text-sm font-semibold flex items-center gap-1.5 ${pwdMsg.success ? 'text-emerald-400' : 'text-dustyred-400'}`}>
            <Icon icon={pwdMsg.success ? 'ph:check-circle' : 'ph:x-circle'} />
            {pwdMsg.msg}
          </p>
        )}
        <button type="submit" className="btn-blue px-5 py-2 text-sm w-fit flex items-center gap-2">
          <Icon icon="ph:lock-key-open" className="text-base" />
          Changer le mot de passe
        </button>
      </form>
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
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-prussian-400/50">
      <div>
        <p className="text-white text-sm font-semibold">{label}</p>
        <p className="text-errorgrey text-xs mt-0.5">
          Seuil :{' '}
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
