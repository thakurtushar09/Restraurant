import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Drawer, Modal } from '../components/Overlay.jsx'
import { api, toast, money, initials } from '../lib.js'

const EMPTY_ITEM = { categoryId: '', name: '', description: '', imageUrl: '', basePrice: '', preparationTimeMinutes: '15', isVegetarian: false, isVegan: false, isGlutenFree: false }

function Switch({ checked, onChange, label }) {
  return (
    <label className="switch" onClick={(event) => event.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" />{label}
    </label>
  )
}

function CategoryModal({ branchId, category, onClose, onSaved }) {
  const [form, setForm] = useState({ name: category?.name ?? '', description: category?.description ?? '', isActive: category?.isActive ?? true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || (category ? null : undefined) }
      if (category) await api(`/branches/${branchId}/categories/${category.id}`, { method: 'PATCH', body: { ...body, isActive: form.isActive } })
      else await api(`/branches/${branchId}/categories`, { method: 'POST', body })
      toast(category ? 'Category updated' : 'Category added')
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <label className="field">Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Small plates" required autoFocus /></label>
        <label className="field">Description <small>optional</small><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        {category && <Switch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="Visible to customers" />}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ItemDrawer({ branchId, item, categories, defaultCategoryId, onClose, onSaved }) {
  const [form, setForm] = useState(() => item
    ? { ...EMPTY_ITEM, ...item, description: item.description ?? '', imageUrl: item.imageUrl ?? '', basePrice: String(Number(item.basePrice)), preparationTimeMinutes: String(item.preparationTimeMinutes) }
    : { ...EMPTY_ITEM, categoryId: defaultCategoryId || categories.find((category) => category.isActive)?.id || '' })
  const [variants, setVariants] = useState(item?.variants ?? [])
  const [variant, setVariant] = useState({ name: '', price: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function save(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const body = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim() || (item ? null : undefined),
      imageUrl: form.imageUrl.trim() || (item ? null : undefined),
      basePrice: Number(form.basePrice),
      preparationTimeMinutes: Number.parseInt(form.preparationTimeMinutes, 10) || 0,
      isVegetarian: form.isVegetarian,
      isVegan: form.isVegan,
      isGlutenFree: form.isGlutenFree,
    }
    try {
      if (item) await api(`/branches/${branchId}/menu-items/${item.id}`, { method: 'PATCH', body })
      else await api(`/branches/${branchId}/menu-items`, { method: 'POST', body })
      toast(item ? 'Dish updated' : 'Dish added to the menu')
      onSaved(true)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function addVariant(event) {
    event.preventDefault()
    try {
      const result = await api(`/branches/${branchId}/menu-items/${item.id}/variants`, {
        method: 'POST',
        body: { name: variant.name.trim(), price: Number(variant.price), isDefault: variants.length === 0 },
      })
      setVariants((current) => [...current, result.data])
      setVariant({ name: '', price: '' })
      toast('Variant added')
      onSaved(false)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function archive() {
    try {
      await api(`/branches/${branchId}/menu-items/${item.id}`, { method: 'DELETE' })
      toast(`${item.name} archived`)
      onSaved(true)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Drawer
      eyebrow={item ? 'Edit dish' : 'New dish'}
      title={item ? item.name : 'Add to the menu'}
      onClose={onClose}
      footer={<>
        {item && <button type="button" className="btn btn-danger" onClick={() => setConfirmArchive(true)}><Icon name="trash" size={15} /> Archive</button>}
        <button className="btn btn-primary" form="item-form" disabled={saving}>{saving ? 'Saving…' : item ? 'Save changes' : 'Add dish'}</button>
      </>}
    >
      <form id="item-form" onSubmit={save} style={{ display: 'grid', gap: 14 }}>
        {form.imageUrl && <div className="item-photo" style={{ borderRadius: 12, backgroundImage: `url(${form.imageUrl})` }} />}
        <label className="field">Name<input value={form.name} onChange={set('name')} required autoFocus={!item} /></label>
        <label className="field">Category
          <select value={form.categoryId} onChange={set('categoryId')} required>
            <option value="" disabled>Choose a category</option>
            {categories.filter((category) => category.isActive || category.id === form.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="field">Description <small>optional</small><textarea value={form.description} onChange={set('description')} placeholder="What makes it good?" /></label>
        <div className="form-grid">
          <label className="field">Price (₹)<input type="number" min="0" step="0.01" inputMode="decimal" value={form.basePrice} onChange={set('basePrice')} required /></label>
          <label className="field">Prep time (min)<input type="number" min="0" step="1" value={form.preparationTimeMinutes} onChange={set('preparationTimeMinutes')} /></label>
        </div>
        <label className="field">Image URL <small>optional</small><input type="url" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://" /></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Switch checked={form.isVegetarian} onChange={(value) => setForm({ ...form, isVegetarian: value })} label="Vegetarian" />
          <Switch checked={form.isVegan} onChange={(value) => setForm({ ...form, isVegan: value })} label="Vegan" />
          <Switch checked={form.isGlutenFree} onChange={(value) => setForm({ ...form, isGlutenFree: value })} label="Gluten free" />
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>

      {item && (
        <div style={{ display: 'grid', gap: 10 }}>
          <span className="eyebrow">Variants · sizes or portions</span>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>When a dish has variants, customers must pick one and its price replaces the base price.</p>
          <div className="variant-list">
            {variants.map((entry) => (
              <div className="variant-row" key={entry.id}>
                {entry.name}{entry.isDefault && <span className="chip">Default</span>}{!entry.isAvailable && <span className="chip chip-muted">Off</span>}
                <span className="price">{money(entry.price)}</span>
              </div>
            ))}
          </div>
          <form className="inline-form" onSubmit={addVariant}>
            <label className="field">Name<input value={variant.name} onChange={(event) => setVariant({ ...variant, name: event.target.value })} placeholder="Large" required /></label>
            <label className="field">Price<input type="number" min="0" step="0.01" value={variant.price} onChange={(event) => setVariant({ ...variant, price: event.target.value })} required /></label>
            <button className="btn btn-ghost"><Icon name="plus" size={15} /> Add</button>
          </form>
        </div>
      )}

      {confirmArchive && (
        <Modal title={`Archive ${item.name}?`} onClose={() => setConfirmArchive(false)}>
          <p style={{ color: 'var(--muted)' }}>It disappears from the menu. Past orders keep their record of it.</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmArchive(false)}>Keep it</button>
            <button className="btn btn-danger" onClick={archive}>Archive dish</button>
          </div>
        </Modal>
      )}
    </Drawer>
  )
}

export default function MenuPage({ workspace }) {
  const branchId = workspace.branchId
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)

  const load = useCallback(async () => {
    try {
      const [categoryResult, itemResult] = await Promise.all([
        api(`/branches/${branchId}/categories`),
        api(`/branches/${branchId}/menu-items`),
      ])
      setCategories(categoryResult.data)
      setItems(itemResult.data)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  async function toggleAvailability(item, isAvailable) {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isAvailable } : entry))
    try {
      await api(`/branches/${branchId}/menu-items/${item.id}`, { method: 'PATCH', body: { isAvailable } })
      toast(`${item.name} is ${isAvailable ? 'back on' : 'off'} the menu`)
    } catch (err) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isAvailable: !isAvailable } : entry))
      toast(err.message, 'error')
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) =>
      (activeCategory === 'all' || item.categoryId === activeCategory) &&
      (!q || `${item.name} ${item.description ?? ''}`.toLowerCase().includes(q)))
  }, [items, activeCategory, query])

  const current = categories.find((category) => category.id === activeCategory)

  if (error && !items.length) {
    return <div className="card empty"><span className="empty-icon"><Icon name="alert" /></span><h3>Couldn’t load the menu</h3><p>{error}</p><button className="btn btn-primary" onClick={load}>Try again</button></div>
  }

  return (
    <div className="menu-layout">
      <aside className="card category-list" aria-label="Categories">
        <div className="category-list-head"><h3>Categories</h3><button className="icon-btn" onClick={() => setEditingCategory('new')} aria-label="Add category"><Icon name="plus" /></button></div>
        <button className={`category-btn${activeCategory === 'all' ? ' active' : ''}`} onClick={() => setActiveCategory('all')}>All dishes<span className="n">{items.length}</span></button>
        {loading && [0, 1, 2].map((key) => <div className="skeleton" key={key} style={{ height: 36 }} />)}
        {categories.map((category) => (
          <button key={category.id} className={`category-btn${activeCategory === category.id ? ' active' : ''}${category.isActive ? '' : ' inactive'}`} onClick={() => setActiveCategory(category.id)}>
            {category.name}{!category.isActive && <span className="chip chip-muted" style={{ padding: '1px 7px' }}>Hidden</span>}
            <span className="n">{items.filter((item) => item.categoryId === category.id).length}</span>
          </button>
        ))}
        <button className="category-btn add" onClick={() => setEditingCategory('new')}><Icon name="plus" size={15} /> New category</button>
      </aside>

      <section>
        <div className="toolbar">
          <label className="search"><Icon name="search" size={16} /><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes" aria-label="Search dishes" /></label>
          {current && <button className="btn btn-ghost btn-sm" onClick={() => setEditingCategory(current)}><Icon name="edit" size={14} /> Edit {current.name}</button>}
          <span className="spacer" />
          <button className="btn btn-accent" onClick={() => setEditingItem('new')} disabled={!categories.some((category) => category.isActive)} title={categories.length ? undefined : 'Add a category first'}>
            <Icon name="plus" size={16} /> Add dish
          </button>
        </div>

        {loading ? (
          <div className="item-grid">{[0, 1, 2, 3].map((key) => <div className="skeleton" key={key} style={{ height: 290, borderRadius: 14 }} />)}</div>
        ) : categories.length === 0 ? (
          <div className="card empty"><span className="empty-icon"><Icon name="book" /></span><h3>Start with a category</h3><p>Group dishes into sections like “Starters” or “Desserts”.</p><button className="btn btn-primary" onClick={() => setEditingCategory('new')}><Icon name="plus" size={15} /> New category</button></div>
        ) : visible.length === 0 ? (
          <div className="card empty"><span className="empty-icon"><Icon name="book" /></span><h3>{query ? 'No dishes match' : 'No dishes here yet'}</h3><p>{query ? 'Try a different search.' : 'Add your first dish to this category.'}</p></div>
        ) : (
          <div className="item-grid">
            {visible.map((item) => (
              <article className={`card item-card${item.isAvailable ? '' : ' unavailable'}`} key={item.id} onClick={() => setEditingItem(item)} style={{ cursor: 'pointer' }}>
                <div className="item-photo" style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}>
                  {!item.imageUrl && initials(item.name)}
                  {!item.isAvailable && <span className="chip chip-forest">Sold out</span>}
                </div>
                <div className="item-body">
                  <span className="eyebrow">{item.category?.name}</span>
                  <h3>{item.name}</h3>
                  {item.description && <p>{item.description}</p>}
                  <div className="item-tags">
                    {item.isVegetarian && <span className="chip">Veg</span>}
                    {item.isVegan && <span className="chip">Vegan</span>}
                    {item.isGlutenFree && <span className="chip">GF</span>}
                    {item.variants.length > 0 && <span className="chip chip-accent">{item.variants.length} variants</span>}
                    <span className="chip chip-muted"><Icon name="clock" size={11} />{item.preparationTimeMinutes}m</span>
                  </div>
                  <div className="item-foot">
                    <span className="price">{item.variants.length ? `from ${money(Math.min(...item.variants.map((entry) => Number(entry.price))))}` : money(item.basePrice)}</span>
                    <Switch checked={item.isAvailable} onChange={(value) => toggleAvailability(item, value)} label={item.isAvailable ? 'Available' : 'Off'} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editingItem && (
        <ItemDrawer
          branchId={branchId}
          item={editingItem === 'new' ? null : editingItem}
          categories={categories}
          defaultCategoryId={activeCategory === 'all' ? '' : activeCategory}
          onClose={() => setEditingItem(null)}
          onSaved={(close) => { load(); if (close) setEditingItem(null) }}
        />
      )}
      {editingCategory && (
        <CategoryModal
          branchId={branchId}
          category={editingCategory === 'new' ? null : editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => { setEditingCategory(null); load() }}
        />
      )}
    </div>
  )
}
