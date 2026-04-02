import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@iconify/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBeginnerMode } from '../../hooks/useBeginnerMode'

/**
 * InfoBubble — tooltip riche avec positionnement intelligent
 *
 * Props :
 *   title    — titre de la bulle (optionnel)
 *   content  — texte principal (requis)
 *   impact   — section "Impact SEO" (optionnel)
 *   action   — section "À faire" (optionnel)
 *   side     — côté préféré : 'top' | 'bottom' | 'right' | 'left' (défaut: 'top', auto-flip)
 */
export default function InfoBubble({ title, content, impact, action, side = 'top' }) {
  const { beginner } = useBeginnerMode()
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState({ top: 0, left: 0, placement: side })
  const triggerRef            = useRef(null)
  const tooltipRef            = useRef(null)
  const hideTimer             = useRef(null)

  const TOOLTIP_WIDTH  = 288
  const TOOLTIP_GAP    = 10
  const ARROW_SIZE     = 8

  const compute = useCallback(() => {
    if (!triggerRef.current) return

    const tr   = triggerRef.current.getBoundingClientRect()
    const vw   = window.innerWidth
    const vh   = window.innerHeight

    const tooltipHeight = tooltipRef.current?.offsetHeight || 140

    let placement = side
    let top, left

    if (placement === 'top' && tr.top < tooltipHeight + TOOLTIP_GAP + 16) placement = 'bottom'
    if (placement === 'bottom' && tr.bottom + tooltipHeight + TOOLTIP_GAP > vh - 16) placement = 'top'

    if (placement === 'top') {
      top  = tr.top + window.scrollY - tooltipHeight - TOOLTIP_GAP
      left = tr.left + window.scrollX + tr.width / 2 - TOOLTIP_WIDTH / 2
    } else if (placement === 'bottom') {
      top  = tr.bottom + window.scrollY + TOOLTIP_GAP
      left = tr.left + window.scrollX + tr.width / 2 - TOOLTIP_WIDTH / 2
    } else if (placement === 'right') {
      top  = tr.top  + window.scrollY + tr.height / 2 - tooltipHeight / 2
      left = tr.right + window.scrollX + TOOLTIP_GAP
    } else {
      top  = tr.top  + window.scrollY + tr.height / 2 - tooltipHeight / 2
      left = tr.left + window.scrollX - TOOLTIP_WIDTH - TOOLTIP_GAP
    }

    left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12))
    setPos({ top, left, placement })
  }, [side])

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(compute)
    }
  }, [visible, compute])

  // En mode expert, on n'affiche pas les bulles d'aide
  if (!beginner) return null

  function show() {
    clearTimeout(hideTimer.current)
    compute()
    setVisible(true)
  }

  function hide() {
    hideTimer.current = setTimeout(() => setVisible(false), 120)
  }

  // Flèche selon placement
  const arrowCls = {
    top:    'bottom-[-8px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-prussian-300',
    bottom: 'top-[-8px]  left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-prussian-300',
    right:  'left-[-8px] top-1/2  -translate-y-1/2  border-t-transparent border-b-transparent border-l-transparent border-r-prussian-300',
    left:   'right-[-8px] top-1/2 -translate-y-1/2  border-t-transparent border-b-transparent border-r-transparent border-l-prussian-300',
  }

  const motionVariants = {
    top:    { hidden: { opacity: 0, y: 6  }, visible: { opacity: 1, y: 0  } },
    bottom: { hidden: { opacity: 0, y: -6 }, visible: { opacity: 1, y: 0  } },
    right:  { hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0  } },
    left:   { hidden: { opacity: 0, x: 6  }, visible: { opacity: 1, x: 0  } },
  }
  const mv = motionVariants[pos.placement] || motionVariants.top

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-[18px] h-[18px] rounded-full bg-prussian-400 border border-prussian-300 flex items-center justify-center text-moonstone-500 hover:border-moonstone-500 hover:text-moonstone-300 hover:bg-prussian-300 transition-all duration-150 shrink-0 outline-none"
        aria-label="Plus d'informations"
      >
        <Icon icon="ph:info" className="text-[10px]" />
      </button>

      {/* Tooltip via portal */}
      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              ref={tooltipRef}
              role="tooltip"
              onMouseEnter={() => clearTimeout(hideTimer.current)}
              onMouseLeave={hide}
              initial={mv.hidden}
              animate={mv.visible}
              exit={mv.hidden}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top:  pos.top,
                left: pos.left,
                width: TOOLTIP_WIDTH,
                zIndex: 9999,
              }}
              className="rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] pointer-events-auto"
            >
              {/* Fond avec bordure dégradée subtile */}
              <div className="bg-prussian-600 border border-prussian-300 rounded-xl overflow-hidden">

                {/* Barre colorée top */}
                <div className="h-0.5 bg-gradient-to-r from-moonstone-700 via-moonstone-400 to-moonstone-700" />

                <div className="p-4">
                  {/* Titre */}
                  {title && (
                    <div className="flex items-center gap-2 mb-3">
                      <Icon icon="ph:info-fill" className="text-moonstone-400 text-base shrink-0" />
                      <p className="text-white font-bold text-sm leading-tight">{title}</p>
                    </div>
                  )}

                  {/* Contenu principal */}
                  <p className="text-lightgrey text-xs leading-[1.6]">{content}</p>

                  {/* Impact SEO */}
                  {impact && (
                    <div className="mt-3 pt-3 border-t border-prussian-400 flex gap-2">
                      <div className="w-4 h-4 rounded bg-moonstone-400/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon icon="ph:trend-up" className="text-moonstone-400 text-[10px]" />
                      </div>
                      <div>
                        <p className="text-moonstone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Impact SEO</p>
                        <p className="text-lightgrey text-xs leading-[1.6]">{impact}</p>
                      </div>
                    </div>
                  )}

                  {/* À faire */}
                  {action && (
                    <div className="mt-2.5 pt-2.5 border-t border-prussian-400 flex gap-2">
                      <div className="w-4 h-4 rounded bg-dustyred-400/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon icon="ph:arrow-right" className="text-dustyred-400 text-[10px]" />
                      </div>
                      <div>
                        <p className="text-dustyred-300 text-[10px] font-bold uppercase tracking-wider mb-1">À faire</p>
                        <p className="text-lightgrey text-xs leading-[1.6]">{action}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Flèche */}
              <span
                className={`absolute w-0 h-0 border-[8px] ${arrowCls[pos.placement]}`}
                style={{ borderWidth: ARROW_SIZE }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
