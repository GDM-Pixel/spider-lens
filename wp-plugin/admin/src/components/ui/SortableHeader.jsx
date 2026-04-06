import { Icon } from '@iconify/react'

export default function SortableHeader({ col, sort, onSort, align = 'right', className = '', children }) {
  const isActive = sort.by === col
  const textAlign = align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'

  return (
    <th
      className={`${textAlign} text-xs font-semibold text-errorgrey px-3 py-3 cursor-pointer select-none hover:text-white ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          <Icon icon={sort.dir === 'desc' ? 'ph:arrow-down' : 'ph:arrow-up'} className="text-moonstone-400 text-xs" />
        ) : (
          <Icon icon="ph:arrows-down-up" className="text-prussian-300 text-xs" />
        )}
      </span>
    </th>
  )
}
