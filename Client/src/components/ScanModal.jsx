import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { slugFromScan } from '../table.js'

// Camera QR scanner for a restaurant's scan-to-order code. Calls onSlug(slug) once one is read.
export default function ScanModal({ onSlug, onClose }) {
  const videoRef = useRef(null)
  const onSlugRef = useRef(onSlug)
  // Camera access needs HTTPS (or localhost) and a supporting browser.
  const [status, setStatus] = useState(() => navigator.mediaDevices?.getUserMedia ? 'starting' : 'unsupported') // | scanning | denied
  const [hint, setHint] = useState('')

  useEffect(() => { onSlugRef.current = onSlug })

  useEffect(() => {
    let stream = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function tick() {
      if (stopped) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && video.videoWidth) {
        // Downscale: plenty for a QR on a table, much cheaper per frame.
        const scale = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
        if (found?.data) {
          const slug = slugFromScan(found.data)
          if (slug) {
            stopped = true
            onSlugRef.current(slug)
            return
          }
          setHint('That QR code isn’t one of ours. Look for the restaurant’s code on your table.')
        }
      }
      frame = window.requestAnimationFrame(tick)
    }

    if (!navigator.mediaDevices?.getUserMedia) return undefined
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((media) => {
        if (stopped) { media.getTracks().forEach((track) => track.stop()); return }
        stream = media
        videoRef.current.srcObject = media
        videoRef.current.play().catch(() => {})
        setStatus('scanning')
        frame = window.requestAnimationFrame(tick)
      })
      .catch(() => setStatus('denied'))

    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <Modal title="Scan the QR on your table" onClose={onClose}>
      {status === 'denied' || status === 'unsupported' ? (
        <div className="scan-fallback">
          <span className="state-icon"><Icon name="scan" /></span>
          <p>{status === 'denied' ? 'We couldn’t use your camera. Allow camera access for this site, or' : 'This browser can’t open the camera here, so'} open your phone’s camera app and point it at the QR code on your table.</p>
        </div>
      ) : (
        <div className="scan-view">
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
          <span className="scan-frame" aria-hidden="true" />
          {status === 'starting' && <span className="scan-status">Starting camera…</span>}
        </div>
      )}
      <p className="hint">{hint || 'Point your camera at the restaurant’s QR code to open its menu.'}</p>
      <div className="row-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div>
    </Modal>
  )
}
