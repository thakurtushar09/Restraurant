import { useEffect } from 'react'

// Adds `is-in` to [data-reveal] elements inside `rootRef` as they scroll into view.
// Pass a `key` that changes when new content renders (e.g. a list length) to pick it up.
export default function useReveal(rootRef, key) {
  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll('[data-reveal]:not(.is-in)') ?? []
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-in'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [rootRef, key])
}
