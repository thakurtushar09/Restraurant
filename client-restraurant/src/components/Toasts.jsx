import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

export default function Toasts() {
  const [items, setItems] = useState([])

  useEffect(() => {
    let id = 0
    const onToast = (event) => {
      const item = { id: ++id, ...event.detail }
      setItems((current) => [...current.slice(-2), item])
      window.setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== item.id)), 3600)
    }
    window.addEventListener('app:toast', onToast)
    return () => window.removeEventListener('app:toast', onToast)
  }, [])

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div className={`toast ${item.type}`} key={item.id}>
          <Icon name={item.type === 'error' ? 'alert' : 'check'} />
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  )
}
