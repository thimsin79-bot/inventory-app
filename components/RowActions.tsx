'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui'

export type RowAction = { label: string; onSelect: () => void; tone?: 'danger' }

type Position = { left: number; top?: number; bottom?: number }

const ITEM_HEIGHT = 36
const MENU_WIDTH = 144
const EDGE_GAP = 8

/**
 * One "Actions" button per row that opens a small menu of the row's commands.
 * The menu is portalled to <body> and `fixed`-positioned from the button's rect,
 * so neither a table's overflow-x container nor the pinned actions column's
 * stacking context can clip or cover it. It lines up with the button's right
 * edge, is clamped to stay on screen (the button is at the left of a phone's
 * card), flips above the button near the bottom of the screen, and closes on
 * outside click, Escape, scroll or resize.
 */
export function RowActions({ actions, label = 'Actions' }: { actions: RowAction[]; label?: string }) {
  const [pos, setPos] = useState<Position | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !anchor.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos])

  function toggle() {
    if (pos) return setPos(null)
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(EDGE_GAP, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - EDGE_GAP))
    const needed = actions.length * ITEM_HEIGHT + 12
    setPos(window.innerHeight - r.bottom >= needed ? { left, top: r.bottom + 4 } : { left, bottom: window.innerHeight - r.top + 4 })
  }

  const popup = pos && (
    <div
      ref={menu}
      role="menu"
      style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: MENU_WIDTH }}
      className="z-50 rounded-md border border-zinc-200 bg-white p-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          role="menuitem"
          onClick={() => {
            setPos(null)
            a.onSelect()
          }}
          className={`flex h-9 w-full items-center rounded px-3 text-sm font-medium transition-colors ${
            a.tone === 'danger'
              ? 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  )

  return (
    <span ref={anchor} className="inline-block">
      <Button size="sm" aria-haspopup="menu" aria-expanded={pos !== null} onClick={toggle}>
        {label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Button>
      {popup && createPortal(popup, document.body)}
    </span>
  )
}
