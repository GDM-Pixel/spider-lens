import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import ScoreGauge from './ScoreGauge'
import ProblemCard, { problemVariants } from './ProblemCard'
import RecommendationCard, { recoVariants } from './RecommendationCard'
import HighlightBadge, { highlightVariants } from './HighlightBadge'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
}

export default function AnalysisSection({ data }) {
  const { t } = useTranslation()
  if (!data) return null

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      {/* Score + Summary */}
      <motion.div
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
        className="flex flex-col sm:flex-row items-center gap-6 bg-prussian-600 rounded-xl border border-prussian-400 p-5"
      >
        <ScoreGauge
          score={data.score ?? 0}
          label={data.scoreLabel ?? ''}
          color={data.scoreColor ?? 'moonstone'}
        />
        <div className="flex-1">
          <p className="text-white text-base font-semibold mb-1">{t('assistant.seoHealthScore')}</p>
          <p className="text-lightgrey text-sm leading-relaxed">{data.summary}</p>
          {/* Highlights */}
          {data.highlights?.length > 0 && (
            <motion.div
              className="grid grid-cols-2 gap-2 mt-4"
              variants={stagger}
            >
              {data.highlights.map((h, i) => (
                <HighlightBadge key={i} highlight={h} />
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Problèmes + Recommandations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problèmes */}
        {data.problems?.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-dustyred-400/20 flex items-center justify-center text-dustyred-400 text-xs font-bold">{data.problems.length}</span>
              <h3 className="text-white font-semibold text-sm">{t('assistant.detectedProblems')}</h3>
            </div>
            <motion.div className="flex flex-col gap-3" variants={stagger}>
              {data.problems.map((p) => (
                <ProblemCard key={p.id} problem={p} />
              ))}
            </motion.div>
          </div>
        )}

        {/* Recommandations */}
        {data.recommendations?.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-moonstone-400/20 flex items-center justify-center text-moonstone-400 text-xs font-bold">{data.recommendations.length}</span>
              <h3 className="text-white font-semibold text-sm">{t('assistant.priorityRecommendations')}</h3>
            </div>
            <motion.div className="flex flex-col gap-3" variants={stagger}>
              {data.recommendations.map((r, i) => (
                <RecommendationCard key={r.id} reco={r} index={i} />
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
