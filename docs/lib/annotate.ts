/**
 * The logic behind the screenshot annotator: the shapes it draws, where their
 * parts go, the undo history, and which key does what. No canvas here -- the
 * component turns these into strokes.
 */

import type { Size } from './image-resize'

export type Tool = 'ellipse' | 'rect' | 'arrow' | 'pen' | 'text'

export interface Point {
  x: number
  y: number
}

export interface PenShape {
  type: 'pen'
  points: Point[]
  color: string
  width: number
}

export interface DragShape {
  type: 'ellipse' | 'rect' | 'arrow'
  from: Point
  to: Point
  color: string
  width: number
  /** Ellipse only: drawn while Shift is held, so the ellipse becomes a circle. */
  circle?: boolean
}

export interface TextShape {
  type: 'text'
  /** Top left of the first line. */
  at: Point
  size: number
  color: string
  text: string
}

export type Shape = PenShape | DragShape | TextShape

/** Red first: it is what a screenshot is usually marked up in. */
export const COLORS = ['#e5322a', '#f5b700', '#1f7ae0', '#1a9b4b', '#111111', '#ffffff'] as const

/** Stroke width and text size per thickness, at a 1600px long edge. */
export const SIZES = [
  { label: '細', stroke: 3, text: 20 },
  { label: '中', stroke: 6, text: 32 },
  { label: '太', stroke: 10, text: 48 }
] as const

/**
 * Drawn into the image, so it cannot follow the site's font: a family that is
 * still loading when the text is drawn would be skipped for the fallback.
 */
export const TEXT_FONT = 'system-ui, "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic UI", sans-serif'

export const LINE_HEIGHT = 1.2

/** A drag shorter than this many screen pixels is a stray click, not a shape. */
const MIN_DRAG = 3

/**
 * How much to scale strokes and text by, so a mark looks the same on a 4K
 * screenshot as on a small one once both are fitted to the screen. Never below
 * 1: on a small image the base sizes are already the smallest that read well.
 */
export function scaleUnit(size: Size): number {
  return Math.max(1, Math.round((Math.max(size.width, size.height) / 1600) * 10) / 10)
}

/**
 * The outline drawn around text so it stays readable on any background: dark
 * around light text, light around dark text.
 */
export function outlineFor(color: string): string {
  const n = parseInt(color.slice(1), 16)
  const luma = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return luma > 150 ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.85)'
}

export interface Ellipse {
  cx: number
  cy: number
  rx: number
  ry: number
}

/**
 * The ellipse inside the box dragged out from `from` to `to`. As a circle it
 * keeps `from` as its corner and grows toward the pointer, so it does not jump
 * away from where the drag started.
 */
export function ellipseOf(from: Point, to: Point, circle = false): Ellipse {
  let rx = Math.abs(to.x - from.x) / 2
  let ry = Math.abs(to.y - from.y) / 2
  if (!circle) return { cx: (from.x + to.x) / 2, cy: (from.y + to.y) / 2, rx, ry }

  rx = ry = Math.max(rx, ry)
  return {
    cx: from.x + Math.sign(to.x - from.x) * rx,
    cy: from.y + Math.sign(to.y - from.y) * ry,
    rx,
    ry
  }
}

export interface Arrow {
  /** Where the line stops, short of the tip so its round cap does not poke through the head. */
  shaftEnd: Point
  /** Tip first, then the two back corners. */
  head: [Point, Point, Point]
}

const HEAD_ANGLE = 0.42

export function arrowOf(from: Point, to: Point, width: number): Arrow {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const head = width * 3.2 + 8
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const corner = (offset: number): Point => ({
    x: to.x - head * Math.cos(angle + offset),
    y: to.y - head * Math.sin(angle + offset)
  })

  return {
    // An arrow shorter than its head is all head.
    shaftEnd:
      length > head
        ? { x: to.x - Math.cos(angle) * head * 0.6, y: to.y - Math.sin(angle) * head * 0.6 }
        : { ...to },
    head: [{ ...to }, corner(-HEAD_ANGLE), corner(HEAD_ANGLE)]
  }
}

/**
 * A pen stroke is kept even as a single dot; a dragged shape needs some length.
 * The length is judged on screen, not in the image: a hand that wobbles by one
 * screen pixel moves several image pixels on a large screenshot shown small.
 *
 * @param imagePerScreen image pixels per screen pixel, as the image is shown
 */
export function isTooSmall(shape: Shape, imagePerScreen = 1): boolean {
  if (shape.type !== 'ellipse' && shape.type !== 'rect' && shape.type !== 'arrow') return false
  return Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) < MIN_DRAG * imagePerScreen
}

/** Where a point on screen falls in the image, which is usually shown smaller than it is. */
export function toImagePoint(
  client: Point,
  box: { left: number; top: number; width: number; height: number },
  image: Size
): Point {
  if (box.width === 0 || box.height === 0) return { x: 0, y: 0 }
  return {
    x: ((client.x - box.left) * image.width) / box.width,
    y: ((client.y - box.top) * image.height) / box.height
  }
}

/** Text as typed, minus the trailing blank lines and spaces an Enter leaves behind. */
export function cleanText(value: string): string {
  return value.replace(/\s+$/, '')
}

export function annotatedName(sourceName: string | null): string {
  const base = sourceName?.replace(/\.[^./\\]+$/, '') || 'screenshot'
  return `${base}-annotated.png`
}

/**
 * The marks drawn so far, with what undo and redo step through. Every step is
 * a whole list of shapes, so clearing everything is one step that one undo
 * brings back, like any other.
 */
export interface History {
  past: Shape[][]
  present: Shape[]
  future: Shape[][]
}

export const EMPTY_HISTORY: History = { past: [], present: [], future: [] }

function commit(history: History, next: Shape[]): History {
  return { past: [...history.past, history.present], present: next, future: [] }
}

export function addShape(history: History, shape: Shape): History {
  return commit(history, [...history.present, shape])
}

export function clearShapes(history: History): History {
  return history.present.length === 0 ? history : commit(history, [])
}

export function undo(history: History): History {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future]
  }
}

export function redo(history: History): History {
  if (history.future.length === 0) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1)
  }
}

export type Shortcut =
  | { action: 'undo' }
  | { action: 'redo' }
  | { action: 'copy' }
  | { action: 'tool'; tool: Tool }
  | { action: 'color'; index: number }

export interface KeyPress {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** The key for each tool, as the toolbar shows it. The only place the keys are defined. */
export const TOOL_KEYS: Readonly<Record<Tool, string>> = { ellipse: 'O', rect: 'R', arrow: 'A', pen: 'P', text: 'T' }

const TOOL_FOR_KEY = new Map(
  (Object.entries(TOOL_KEYS) as [Tool, string][]).map(([tool, key]) => [key.toLowerCase(), tool])
)

/** What a key press asks for, or null when it is not one of the tool's keys. */
export function shortcutFor(press: KeyPress): Shortcut | null {
  const key = press.key.toLowerCase()
  if (press.ctrlKey || press.metaKey) {
    if (press.altKey) return null
    if (key === 'z') return { action: press.shiftKey ? 'redo' : 'undo' }
    if (key === 'y') return { action: 'redo' }
    if (key === 'c' && !press.shiftKey) return { action: 'copy' }
    return null
  }
  if (press.altKey) return null

  const tool = TOOL_FOR_KEY.get(key)
  if (tool) return { action: 'tool', tool }
  const digit = Number(key)
  if (/^[1-9]$/.test(key) && digit <= COLORS.length) return { action: 'color', index: digit - 1 }
  return null
}
