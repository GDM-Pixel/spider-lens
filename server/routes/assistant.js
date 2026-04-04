import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { streamAnalysis, streamChat } from '../services/aiAnalyzer.js'

const router = Router()
router.use(requireAuth)

// POST /api/assistant/analyze — analyse automatique streamée
router.post('/analyze', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY non configurée. Ajoutez-la dans le fichier .env du serveur.' })
  }
  const siteId = req.body.siteId != null ? parseInt(req.body.siteId, 10) : null
  await streamAnalysis(siteId, res)
})

// POST /api/assistant/chat — chat libre avec historique
router.post('/chat', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY non configurée. Ajoutez-la dans le fichier .env du serveur.' })
  }

  const { siteId, messages } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requis' })
  }

  // Validation : max 10 messages, max 2000 chars chacun
  const trimmed = messages.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content || '').slice(0, 2000),
  }))

  const parsedSiteId = siteId != null ? parseInt(siteId, 10) : null
  await streamChat(parsedSiteId, trimmed, res)
})

export default router
