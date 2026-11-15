import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Icon from '../components/Icon.jsx'
import { toast, copyText, scanUrl } from '../lib.js'

// The branch's printable sticker: name, QR code and a short instruction. The same code goes on every table.
// Drawn on a canvas so "Download" and "Print" produce exactly the same sticker.
async function renderSticker(url, workspace) {
  const width = 600
  const height = 820
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#29453a'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, width - 36, height - 36)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#1f362d'
  ctx.font = '700 40px "DM Sans", sans-serif'
  ctx.fillText(workspace.groupName.slice(0, 26), width / 2, 92)
  ctx.fillStyle = '#6f7a70'
  ctx.font = '600 20px "DM Sans", sans-serif'
  ctx.fillText(workspace.branch.branchName.toUpperCase().slice(0, 40), width / 2, 128)

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { width: 420, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1f362d', light: '#ffffff' } })
  ctx.drawImage(qr, (width - 420) / 2, 158)

  ctx.fillStyle = '#26372e'
  ctx.font = '700 34px "DM Sans", sans-serif'
  ctx.fillText('Scan to order', width / 2, 666)
  ctx.fillStyle = '#6f7a70'
  ctx.font = '400 22px "DM Sans", sans-serif'
  ctx.fillText('Pick your dishes, add your table number', width / 2, 712)
  ctx.fillText('and we’ll bring it over', width / 2, 744)
  return canvas.toDataURL('image/png')
}

const fileName = (workspace) => `${`${workspace.groupName}-${workspace.branch.branchName}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'menu'}-qr.png`

export default function QrPage({ workspace }) {
  const url = scanUrl(workspace.branch)
  const [sticker, setSticker] = useState(null) // { url, image }

  useEffect(() => {
    let cancelled = false
    renderSticker(url, workspace)
      .then((image) => { if (!cancelled) setSticker({ url, image }) })
      .catch(() => toast('Couldn’t draw the QR code', 'error'))
    return () => { cancelled = true }
  }, [url, workspace])

  const image = sticker?.url === url ? sticker.image : null

  return (
    <>
      <div className="qr-head">
        <h2>Scan-to-order QR code</h2>
        <p>Print this code and put a copy on every table. Guests scan it, order from the menu and type their table number at checkout. Orders arrive on the board marked with the table.</p>
      </div>
      <div className="qr-layout card">
        <div className="qr-sticker">{image ? <img src={image} alt={`QR code for ${workspace.branch.branchName}`} /> : <div className="skeleton" />}</div>
        <div className="qr-info">
          <div className="qr-actions">
            <a className={`btn btn-primary${image ? '' : ' disabled'}`} href={image ?? undefined} download={fileName(workspace)}><Icon name="download" size={15} />Download PNG</a>
            <button className="btn btn-ghost" onClick={() => window.print()} disabled={!image}><Icon name="print" size={15} />Print</button>
            <button className="btn btn-ghost" onClick={() => copyText(url)}><Icon name="copy" size={15} />Copy link</button>
          </div>
          <label className="field">Link inside the code<input readOnly value={url} onFocus={(event) => event.target.select()} /></label>
          <ul className="qr-tips">
            <li>One code works for the whole branch, so every table can use the same sticker.</li>
            <li>Opening it shows this branch’s menu. Table orders are for right now and paid at the counter.</li>
            <li>The kitchen must be open for guests to order at their table.</li>
          </ul>
        </div>
      </div>
      {image && <div className="qr-print-sheet" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <img key={index} src={image} alt="" />)}</div>}
    </>
  )
}
