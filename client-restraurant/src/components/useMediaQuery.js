import { useSyncExternalStore } from 'react'

// True while the CSS media query matches; re-renders when it flips (e.g. rotating a phone).
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
