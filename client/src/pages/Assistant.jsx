import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import BeginnerBanner from "../components/ui/BeginnerBanner";
import AnalysisSection from "../components/ui/AnalysisSection";
import NovaAnalysisLoader from "../components/ui/NovaAnalysisLoader";
import { useSite } from "../context/SiteContext";
import { useChat } from "../context/ChatContext";

// ── Empty state ───────────────────────────────────────────
function EmptyState({ onStart, hasApiKey, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6 py-16"
    >
      <div className="w-20 h-20 rounded-2xl bg-moonstone-400/10 border border-moonstone-400/20 flex items-center justify-center">
        <Icon icon="ph:sparkle" className="text-moonstone-400 text-4xl" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-white font-semibold text-lg mb-2">{t("assistant.analyzeBtn")}</h2>
        <p className="text-errorgrey text-sm leading-relaxed">{t("assistant.tip3")}</p>
      </div>
      <button
        onClick={onStart}
        disabled={!hasApiKey}
        className={clsx(
          "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
          hasApiKey
            ? "bg-moonstone-400 text-prussian-700 hover:bg-moonstone-300"
            : "bg-prussian-500 text-errorgrey cursor-not-allowed border border-prussian-400",
        )}
      >
        <Icon icon="ph:sparkle" className="text-base" />
        {t("assistant.analyzeBtn")}
      </button>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function Assistant() {
  const { t, i18n } = useTranslation();
  const { activeSiteId } = useSite();
  const { setPageContext, clearPageContext } = useChat();

  const [analysisData, setAnalysisData]     = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [apiKeyMissing, setApiKeyMissing]   = useState(false);

  // Transmettre le contexte d'analyse au chatbot quand les données sont prêtes
  useEffect(() => {
    if (analysisData && !analysisData.error) {
      setPageContext({
        page: "analyzeAI",
        score: analysisData.score,
        scoreLabel: analysisData.scoreLabel,
        summary: analysisData.summary,
        problems: analysisData.problems?.slice(0, 3).map(p => ({ title: p.title, impact: p.impact })),
        recommendations: analysisData.recommendations?.slice(0, 3).map(r => r.title),
      });
    }
    return () => clearPageContext();
  }, [analysisData]);

  const runAnalysis = useCallback(() => {
    if (analysisLoading) return;
    setAnalysisData(null);
    setAnalysisLoading(true);
    setApiKeyMissing(false);

    const token = localStorage.getItem("spider_token");
    fetch("/api/assistant/analyze-structured", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ siteId: activeSiteId || null, language: i18n.language }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error && (data.error.includes("GEMINI_API_KEY") || String(data.error).includes("503"))) {
          setApiKeyMissing(true);
        } else {
          setAnalysisData(data);
        }
      })
      .catch((err) => setAnalysisData({ error: err.message }))
      .finally(() => setAnalysisLoading(false));
  }, [activeSiteId, analysisLoading]);

  const hasApiKey = !apiKeyMissing;

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:sparkle"
        title={t("assistant.welcomeTitle")}
        tips={[t("assistant.tip1"), t("assistant.tip2"), t("assistant.tip3")]}
      />

      {/* API key warning */}
      <AnimatePresence>
        {apiKeyMissing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3"
          >
            <Icon icon="ph:warning" className="text-amber-400 text-lg shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm">{t("assistant.noApiKey")}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="ph:sparkle" className="text-moonstone-400 text-lg" />
          <h2 className="text-white font-semibold">{t("assistant.autoTitle")}</h2>
        </div>
        {analysisData && !analysisData.error && !analysisLoading && (
          <button
            onClick={runAnalysis}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-errorgrey hover:text-moonstone-400 hover:bg-prussian-600 border border-prussian-500 transition-colors"
          >
            <Icon icon="ph:arrow-clockwise" className="text-sm" />
            Relancer l'analyse
          </button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {analysisLoading && <NovaAnalysisLoader t={t} />}
      </AnimatePresence>

      {!analysisLoading && !analysisData && (
        <EmptyState onStart={runAnalysis} hasApiKey={hasApiKey} t={t} />
      )}

      {!analysisLoading && analysisData && analysisData.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 py-12"
        >
          <Icon icon="ph:warning-circle" className="text-dustyred-400 text-4xl" />
          <p className="text-dustyred-300 text-sm text-center max-w-sm">{analysisData.error}</p>
          <button
            onClick={runAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-prussian-600 text-errorgrey hover:text-white border border-prussian-500 transition-colors"
          >
            <Icon icon="ph:arrow-clockwise" className="text-sm" />
            Réessayer
          </button>
        </motion.div>
      )}

      {!analysisLoading && analysisData && !analysisData.error && (
        <AnalysisSection data={analysisData} />
      )}
    </div>
  );
}
