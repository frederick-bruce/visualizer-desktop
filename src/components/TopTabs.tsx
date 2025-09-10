import { useLocation } from 'react-router-dom'

const tabs = [
  { key: 'now-playing', label: 'Now Playing' },
  { key: 'library', label: 'Library' },
]

export default function TopTabs() {
  const { pathname } = useLocation()
  const active = pathname === '/' ? 'now-playing' : 'library'

  return (
    <div className="wmp-topbar">
      <div className="wmp-topbar-inner">
        {tabs.map(t => (
          <button
            key={t.key}
            className={['wmp-tab', active === t.key ? 'active' : ''].join(' ')}
            type="button"
            aria-pressed={active === t.key}
            aria-label={t.label}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
 