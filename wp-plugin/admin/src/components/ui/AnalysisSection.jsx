import React from 'react'
import { motion } from 'framer-motion'
import ScoreGauge from './ScoreGauge'
import ProblemCard from './ProblemCard'
import RecommendationCard from './RecommendationCard'
import HighlightBadge from './HighlightBadge'
import { useTranslation } from 'react-i18next'

export default function AnalysisSection({ data }) {
  const { t } = useTranslation()
  if (!data) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Score + Summary + Highlights */}
      <div className="bg-prussian-600 border border-prussian-500 rounded-xl p-5 flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex flex-col items-center gap-3 shrink-0">
          <ScoreGauge score={data.score} label={data.scoreLabel} color={data.scoreColor} />
          <p className="text-errorgrey text-xs uppercase font-semibold tracking-wide">
            {t('assistant.seoHealthScore')}
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <p className="text-white text-sm leading-relaxed">{data.summary}</p>
          {data.highlights?.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {data.highlights.map((h, i) => (
                <HighlightBadge key={h.key || i} highlight={h} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problèmes */}
        {data.problems?.length > 0 && (
          <div className="flex flex-col gap-3">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white font-bold text-sm flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded-full bg-dustyred-400/20 text-dustyred-400 text-xs flex items-center justify-center font-bold">
                {data.problems.length}
              </span>
              {t('assistant.detectedProblems')}
            </motion.h3>
            {data.problems.map((p, i) => (
              <ProblemCard key={p.id || i} problem={p} index={i} />
            ))}
          </div>
        )}

        {/* Recommandations */}
        {data.recommendations?.length > 0 && (
          <div className="flex flex-col gap-3">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white font-bold text-sm flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded-full bg-moonstone-400/20 text-moonstone-400 text-xs flex items-center justify-center font-bold">
                {data.recommendations.length}
              </span>
              {t('assistant.priorityRecommendations')}
            </motion.h3>
            {data.recommendations.map((r, i) => (
              <RecommendationCard key={r.id || i} recommendation={r} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
