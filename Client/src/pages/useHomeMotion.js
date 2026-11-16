import { useEffect } from 'react'

// Scroll + pointer effects for the home page, all driven through CSS variables so React never re-renders:
//   .h-hero        --p        0→1 as the hero scrolls away (parallax, fade)
//   .h-hero        --tx --ty  -1→1 pointer position over the hero (plate tilt)
//   [data-spotlight], kitchen cards  --mx --my pointer position inside the card (glow)
//   [data-magnetic]  translate toward the pointer while hovered
// Pointer effects only run for a precise pointer (mouse/trackpad); nothing runs with reduced motion.
export default function useHomeMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const hero = root.querySelector('.h-hero')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    let frame = 0

    function onScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!hero) return
        const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, hero.offsetHeight)))
        hero.style.setProperty('--p', progress.toFixed(3))
      })
    }

    function onPointerMove(event) {
      const target = event.target instanceof Element ? event.target : null
      if (!target) return

      if (hero && hero.contains(target)) {
        const rect = hero.getBoundingClientRect()
        hero.style.setProperty('--tx', (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3))
        hero.style.setProperty('--ty', (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3))
      }

      const spot = target.closest('[data-spotlight], .h-kitchens .r-card')
      if (spot) {
        const rect = spot.getBoundingClientRect()
        spot.style.setProperty('--mx', `${event.clientX - rect.left}px`)
        spot.style.setProperty('--my', `${event.clientY - rect.top}px`)
      }

      const magnet = target.closest('[data-magnetic]')
      if (magnet) {
        const rect = magnet.getBoundingClientRect()
        const x = (event.clientX - rect.left - rect.width / 2) * 0.22
        const y = (event.clientY - rect.top - rect.height / 2) * 0.3
        magnet.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      }
    }

    function onPointerOut(event) {
      const magnet = event.target instanceof Element && event.target.closest('[data-magnetic]')
      if (magnet && !magnet.contains(event.relatedTarget)) magnet.style.transform = ''
      if (hero && !hero.contains(event.relatedTarget)) {
        hero.style.setProperty('--tx', '0')
        hero.style.setProperty('--ty', '0')
      }
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    if (finePointer) {
      root.addEventListener('pointermove', onPointerMove, { passive: true })
      root.addEventListener('pointerout', onPointerOut)
    }
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerout', onPointerOut)
    }
  }, [rootRef])
}
