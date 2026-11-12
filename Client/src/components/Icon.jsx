const paths = {
  bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  back: <path d="M19 12H5M11 6l-6 6 6 6"/>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  store: <><path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4h4v4"/></>,
  bike: <><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M10 9 8 5H5M14 5h2"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  alert: <><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  flame: <path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-1 3-3 4-4 4 0-2-1-3-2-4-1 3-4 6-4 10a7 7 0 0 0 7 7Z"/>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></>,
  plate: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
}

export default function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.info}
    </svg>
  )
}
