import { useState } from 'react'
import Modal from './Modal.jsx'
import { money } from '../lib.js'

export default function VariantModal({ item, onClose, onAdd }) {
  const [variantId, setVariantId] = useState((item.variants.find((variant) => variant.isDefault) ?? item.variants[0]).id)

  return (
    <Modal title={item.name} onClose={onClose}>
      {item.description && <p className="hint">{item.description}</p>}
      <div className="choice-list" role="radiogroup" aria-label="Choose a size">
        {item.variants.map((variant) => (
          <label key={variant.id} className={`choice${variantId === variant.id ? ' active' : ''}`}>
            <input type="radio" name="variant" checked={variantId === variant.id} onChange={() => setVariantId(variant.id)} />
            <span className="radio" />
            <span className="name">{variant.name}</span>
            <span className="price">{money(variant.price)}</span>
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onAdd(item.variants.find((variant) => variant.id === variantId))}>Add to cart</button>
      </div>
    </Modal>
  )
}
