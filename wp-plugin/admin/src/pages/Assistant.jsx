import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import NovaAnalysisLoader from '../components/ui/NovaAnalysisLoader'
import AnalysisSection from '../components/ui/AnalysisSection'

export default function Assistant() {
  const { t, i18n } = useTranslation()
  const [analysisData, setAnalysisData]     = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError]                   = useState(null)
  const [apiKeyMissing, setApiKeyMissing]   = useState(false)

  const runAnalysis = async () => {
    setAnalysisLoading(true)
    setError(null)
    setApiKeyMissing(false)
    try {
      const r = await api.post('/assistant/analyze', { language: i18n.language?.slice(0, 2) || 'fr' })
      setAnalysisData(r.data)
    } catch (err) {
      const msg = err.response?.data?.message || err.message || ''
      if (msg.includes('GEMINI_API_KEY') || err.response?.status === 422) {
        setApiKeyMissing(true)
      } else {
        setError(msg || t('assistant.errorGeneric'))
      }
    } finally {
      setAnalysisLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:sparkle"
        title={t('assistant.welcomeTitle')}
        tips={[t('assistant.tip1'), t('assistant.tip2'), t('assistant.tip3')]}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-xl">{t('assistant.autoTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('header.pages.assistant.subtitle')}</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analysisLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors disabled:opacity-50 text-sm"
        >
          <Icon icon={analysisLoading ? 'ph:spinner' : 'ph:sparkle'} className={analysisLoading ? 'animate-spin text-lg' : 'text-lg'} />
          {analysisLoading ? t('assistant.analyzing') : (analysisData ? 'Relancer l\'analyse' : t('assistant.analyzeBtn'))}
        </button>
      </div>

      {/* Avertissement clé API manquante */}
      {apiKeyMissing && (
        <div className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl p-4">
          <Icon icon="ph:warning" className="text-amber-400 text-xl shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold text-sm">{t('assistant.noApiKey')}</p>
            <p className="text-amber-400/70 text-xs mt-1">
              Rendez-vous dans <strong>Paramètres → Analyse IA</strong> pour configurer votre clé Gemini.
            </p>
          </div>
        </div>
      )}

      {/* Loader */}
      {analysisLoading && <NovaAnalysisLoader />}

      {/* Erreur */}
      {error && !analysisLoading && (
        <div className="flex items-center gap-3 bg-dustyred-400/10 border border-dustyred-400/30 rounded-xl p-4">
          <Icon icon="ph:warning-circle" className="text-dustyred-400 text-xl shrink-0" />
          <p className="text-dustyred-300 text-sm">{error}</p>
        </div>
      )}

      {/* État vide */}
      {!analysisData && !analysisLoading && !error && !apiKeyMissing && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-prussian-600 border border-prussian-500 rounded-xl">
          <Icon icon="ph:sparkle" className="text-4xl text-prussian-400" />
          <p className="text-errorgrey text-sm">{t('assistant.analyzeBtn')}</p>
          <button
            onClick={runAnalysis}
            className="flex items-center gap-2 px-5 py-2.5 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm"
          >
            <Icon icon="ph:sparkle" className="text-lg" />
            {t('assistant.analyzeBtn')}
          </button>
        </div>
      )}

      {/* Résultat de l'analyse */}
      {analysisData && !analysisLoading && (
        <AnalysisSection data={analysisData} />
      )}

      {/* Info powered by */}
      {analysisData && (
        <p className="text-errorgrey/50 text-xs text-center">
          {t('assistant.poweredBy')} Google Gemini
        </p>
      )}
    </div>
  )
}
