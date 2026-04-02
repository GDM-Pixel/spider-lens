import React from 'react'
import { Icon } from '@iconify/react'

export default function DateRangePicker({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-prussian-500 border border-prussian-400 rounded-lg px-3 py-2">
      <Icon icon="ph:calendar-blank" className="text-errorgrey text-base shrink-0" />
      <input
        type="date"
        value={from}
        onChange={e => onChange({ from: e.target.value, to })}
        className="bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
      />
      <span className="text-errorgrey text-sm">→</span>
      <input
        type="date"
        value={to}
        onChange={e => onChange({ from, to: e.target.value })}
        className="bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
      />
    </div>
  )
}
