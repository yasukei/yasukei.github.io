import { describe, it, expect } from 'vitest'
import {
  COLORS,
  EMPTY_HISTORY,
  addShape,
  annotatedName,
  arrowOf,
  cleanText,
  clearShapes,
  ellipseOf,
  isTooSmall,
  outlineFor,
  redo,
  scaleUnit,
  shortcutFor,
  toImagePoint,
  undo,
  type KeyPress,
  type Shape
} from './annotate'

function rect(n: number): Shape {
  return { type: 'rect', from: { x: n, y: n }, to: { x: n + 10, y: n + 10 }, color: COLORS[0], width: 6 }
}

function press(key: string, modifiers: Partial<KeyPress> = {}): KeyPress {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers }
}

describe('scaleUnit', () => {
  it('leaves screenshots up to 1600px at the base sizes', () => {
    expect(scaleUnit({ width: 800, height: 600 })).toBe(1)
    expect(scaleUnit({ width: 1600, height: 900 })).toBe(1)
  })

  it('grows with the long edge beyond that', () => {
    expect(scaleUnit({ width: 3200, height: 1800 })).toBe(2)
    expect(scaleUnit({ width: 1440, height: 2560 })).toBe(1.6)
  })
})

describe('outlineFor', () => {
  it('outlines light text in dark and dark text in light', () => {
    expect(outlineFor('#ffffff')).toMatch(/^rgba\(0, 0, 0/)
    expect(outlineFor('#f5b700')).toMatch(/^rgba\(0, 0, 0/)
    expect(outlineFor('#111111')).toMatch(/^rgba\(255, 255, 255/)
    expect(outlineFor('#e5322a')).toMatch(/^rgba\(255, 255, 255/)
  })
})

describe('ellipseOf', () => {
  it('fits the dragged box, whichever way it was dragged', () => {
    const expected = { cx: 50, cy: 30, rx: 50, ry: 30 }
    expect(ellipseOf({ x: 0, y: 0 }, { x: 100, y: 60 })).toEqual(expected)
    expect(ellipseOf({ x: 100, y: 60 }, { x: 0, y: 0 })).toEqual(expected)
  })

  it('as a circle, takes the longer side and keeps the corner the drag started from', () => {
    expect(ellipseOf({ x: 0, y: 0 }, { x: 100, y: 60 }, true)).toEqual({ cx: 50, cy: 50, rx: 50, ry: 50 })
    expect(ellipseOf({ x: 100, y: 100 }, { x: 40, y: 0 }, true)).toEqual({ cx: 50, cy: 50, rx: 50, ry: 50 })
  })
})

describe('arrowOf', () => {
  it('puts the tip of the head at the end of the drag', () => {
    const arrow = arrowOf({ x: 0, y: 0 }, { x: 200, y: 0 }, 6)
    expect(arrow.head[0]).toEqual({ x: 200, y: 0 })
  })

  it('stops the line inside the head, so its cap does not show past the tip', () => {
    const arrow = arrowOf({ x: 0, y: 0 }, { x: 200, y: 0 }, 6)
    const head = 6 * 3.2 + 8
    expect(arrow.shaftEnd.x).toBeCloseTo(200 - head * 0.6)
    expect(arrow.shaftEnd.y).toBeCloseTo(0)
  })

  it('spreads the back corners evenly either side of the line', () => {
    const [, left, right] = arrowOf({ x: 0, y: 0 }, { x: 200, y: 0 }, 6).head
    expect(left.x).toBeCloseTo(right.x)
    expect(left.y).toBeCloseTo(-right.y)
    expect(left.x).toBeLessThan(200)
  })

  it('is all head when shorter than one', () => {
    const arrow = arrowOf({ x: 0, y: 0 }, { x: 10, y: 0 }, 6)
    expect(arrow.shaftEnd).toEqual({ x: 10, y: 0 })
  })
})

describe('isTooSmall', () => {
  it('drops a click that did not drag', () => {
    expect(isTooSmall({ type: 'rect', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: COLORS[0], width: 6 })).toBe(true)
    expect(isTooSmall(rect(0))).toBe(false)
  })

  it('keeps a pen dot and any text', () => {
    expect(isTooSmall({ type: 'pen', points: [{ x: 5, y: 5 }], color: COLORS[0], width: 6 })).toBe(false)
    expect(isTooSmall({ type: 'text', at: { x: 0, y: 0 }, size: 32, color: COLORS[0], text: 'a' })).toBe(false)
  })
})

describe('toImagePoint', () => {
  it('maps from the scaled-down canvas on screen to image pixels', () => {
    const box = { left: 100, top: 50, width: 800, height: 450 }
    expect(toImagePoint({ x: 500, y: 275 }, box, { width: 1600, height: 900 })).toEqual({ x: 800, y: 450 })
  })

  it('does not divide by zero for a canvas not laid out yet', () => {
    expect(toImagePoint({ x: 5, y: 5 }, { left: 0, top: 0, width: 0, height: 0 }, { width: 10, height: 10 })).toEqual({
      x: 0,
      y: 0
    })
  })
})

describe('cleanText', () => {
  it('drops trailing blank lines and spaces but keeps the lines inside', () => {
    expect(cleanText('ここ\nを開く \n\n')).toBe('ここ\nを開く')
    expect(cleanText('  \n')).toBe('')
  })
})

describe('annotatedName', () => {
  it('names the result after the file it came from', () => {
    expect(annotatedName('Screenshot 2026-10-14.jpg')).toBe('Screenshot 2026-10-14-annotated.png')
  })

  it('falls back for a pasted image', () => {
    expect(annotatedName(null)).toBe('screenshot-annotated.png')
  })
})

describe('history', () => {
  it('undoes and redoes one shape at a time', () => {
    let history = addShape(addShape(EMPTY_HISTORY, rect(1)), rect(2))
    history = undo(history)
    expect(history.present).toEqual([rect(1)])
    history = redo(history)
    expect(history.present).toEqual([rect(1), rect(2)])
  })

  it('brings back everything cleared with a single undo', () => {
    const drawn = addShape(addShape(EMPTY_HISTORY, rect(1)), rect(2))
    const cleared = clearShapes(drawn)
    expect(cleared.present).toEqual([])
    expect(undo(cleared).present).toEqual([rect(1), rect(2)])
  })

  it('forgets what was undone once something new is drawn', () => {
    const history = addShape(undo(addShape(EMPTY_HISTORY, rect(1))), rect(2))
    expect(history.future).toEqual([])
    expect(redo(history)).toBe(history)
  })

  it('does nothing past either end', () => {
    expect(undo(EMPTY_HISTORY)).toBe(EMPTY_HISTORY)
    expect(redo(EMPTY_HISTORY)).toBe(EMPTY_HISTORY)
    expect(clearShapes(EMPTY_HISTORY)).toBe(EMPTY_HISTORY)
  })
})

describe('shortcutFor', () => {
  it('picks tools by letter, either case', () => {
    expect(shortcutFor(press('o'))).toEqual({ action: 'tool', tool: 'ellipse' })
    expect(shortcutFor(press('R', { shiftKey: true }))).toEqual({ action: 'tool', tool: 'rect' })
    expect(shortcutFor(press('a'))).toEqual({ action: 'tool', tool: 'arrow' })
    expect(shortcutFor(press('p'))).toEqual({ action: 'tool', tool: 'pen' })
    expect(shortcutFor(press('t'))).toEqual({ action: 'tool', tool: 'text' })
  })

  it('picks colours by number, as far as there are colours', () => {
    expect(shortcutFor(press('1'))).toEqual({ action: 'color', index: 0 })
    expect(shortcutFor(press(String(COLORS.length)))).toEqual({ action: 'color', index: COLORS.length - 1 })
    expect(shortcutFor(press(String(COLORS.length + 1)))).toBeNull()
    expect(shortcutFor(press('0'))).toBeNull()
  })

  it('undoes, redoes and copies with Ctrl or Cmd', () => {
    expect(shortcutFor(press('z', { ctrlKey: true }))).toEqual({ action: 'undo' })
    expect(shortcutFor(press('z', { metaKey: true }))).toEqual({ action: 'undo' })
    expect(shortcutFor(press('Z', { ctrlKey: true, shiftKey: true }))).toEqual({ action: 'redo' })
    expect(shortcutFor(press('y', { ctrlKey: true }))).toEqual({ action: 'redo' })
    expect(shortcutFor(press('c', { metaKey: true }))).toEqual({ action: 'copy' })
  })

  it('leaves the browser its own shortcuts', () => {
    expect(shortcutFor(press('r', { ctrlKey: true }))).toBeNull()
    expect(shortcutFor(press('t', { metaKey: true }))).toBeNull()
    expect(shortcutFor(press('C', { ctrlKey: true, shiftKey: true }))).toBeNull()
    expect(shortcutFor(press('o', { altKey: true }))).toBeNull()
    expect(shortcutFor(press('Enter'))).toBeNull()
  })
})
