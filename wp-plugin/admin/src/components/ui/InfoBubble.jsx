import React, { useState } from 'react'
import { Icon } from '@iconify/react'

export default function InfoBubble({ title, content, impact, action }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-[18px] h-[18px] rounded-full bg-prussian-400 border border-prussian-300 flex items-center justify-center text-moonstone-500 hover:border-moonstone-500 hover:text-moonstone-300 transition-all shrink-0"
        aria-label="Plus d'informations"
      >
        <Icon icon="ph:info" className="text-[10px]" />
      </button>

      {visible && (
        <div className="absolute right-0 top-6 z-50 w-72 bg-prussian-600 border border-prussian-300 rounded-xl shadow-xl p-4">
          {title && (
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="ph:info-fill" className="text-moonstone-400 text-base shrink-0" />
              <p className="text-white font-bold text-sm">{title}</p>
            </div>
          )}
          <p className="text-lightgrey text-xs leading-relaxed">{content}</p>
          {impact && (
            <div className="mt-2 pt-2 border-t border-prussian-400">
              <p className="text-moonstone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Impact SEO</p>
              <p className="text-lightgrey text-xs leading-relaxed">{impact}</p>
            </div>
          )}
          {action && (
            <div className="mt-2 pt-2 border-t border-prussian-400">
              <p className="text-dustyred-300 text-[10px] font-bold uppercase tracking-wider mb-1">À faire</p>
              <p className="text-lightgrey text-xs leading-relaxed">{action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
