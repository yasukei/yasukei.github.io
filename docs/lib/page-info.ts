/**
 * What a page can read about its own window and how it was reached: the
 * window's size and place on the screen, whether the tab is being looked at,
 * where the visitor came from, and how long the page took to load.
 *
 * `readPageEnv` copies the values off a window into plain data; everything
 * after that is plain and runs in Node.
 */

import { bool, type Section } from './browser-info'
import { formatBytes } from './install-info'

export interface NavigationTiming {
  type: string
  nextHopProtocol: string
  domainLookupStart: number
  domainLookupEnd: number
  connectStart: number
  connectEnd: number
  responseStart: number
  domContentLoadedEventEnd: number
  loadEventEnd: number
  transferSize: number
}

export interface JsMemory {
  usedJSHeapSize: number
  jsHeapSizeLimit: number
}

export interface PageEnv {
  innerWidth: number
  innerHeight: number
  outerWidth: number
  outerHeight: number
  screenX: number
  screenY: number
  visibilityState: string
  hasFocus: boolean
  online: boolean | null
  referrer: string
  historyLength: number
  navigation: NavigationTiming | null
  memory: JsMemory | null
}

/** Reads everything off a window at once, so the rows describe one moment. */
export function readPageEnv(win: Window): PageEnv {
  const entry = win.performance?.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
  // performance.memory is Chromium's, non-standard, and not in the DOM types.
  const memory = (win.performance as Performance & { memory?: JsMemory }).memory
  return {
    innerWidth: win.innerWidth,
    innerHeight: win.innerHeight,
    outerWidth: win.outerWidth,
    outerHeight: win.outerHeight,
    screenX: win.screenX,
    screenY: win.screenY,
    visibilityState: win.document.visibilityState,
    hasFocus: win.document.hasFocus(),
    online: typeof win.navigator.onLine === 'boolean' ? win.navigator.onLine : null,
    referrer: win.document.referrer,
    historyLength: win.history.length,
    navigation: entry
      ? {
          type: entry.type,
          nextHopProtocol: entry.nextHopProtocol,
          domainLookupStart: entry.domainLookupStart,
          domainLookupEnd: entry.domainLookupEnd,
          connectStart: entry.connectStart,
          connectEnd: entry.connectEnd,
          responseStart: entry.responseStart,
          domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
          loadEventEnd: entry.loadEventEnd,
          transferSize: entry.transferSize
        }
      : null,
    memory: memory ? { usedJSHeapSize: memory.usedJSHeapSize, jsHeapSizeLimit: memory.jsHeapSizeLimit } : null
  }
}

/** Milliseconds, rounded: the timings carry microsecond fractions that mean nothing here. */
export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`
}

export function windowSection(env: PageEnv): Section {
  return {
    id: 'window',
    title: 'ウィンドウ',
    rows: [
      {
        label: 'ページが表示されている範囲',
        api: 'innerWidth × innerHeight',
        value: `${env.innerWidth} × ${env.innerHeight}`
      },
      {
        label: 'ウィンドウ全体',
        api: 'outerWidth × outerHeight',
        value: `${env.outerWidth} × ${env.outerHeight}`
      },
      {
        label: 'ブラウザの枠の大きさ',
        api: 'outerHeight - innerHeight',
        value: `縦 ${env.outerHeight - env.innerHeight}px / 横 ${env.outerWidth - env.innerWidth}px`,
        note: 'タブやアドレスバー、ブックマークバーの有無で変わる。横や縦に大きな差があると、開発者ツールを開いていると判定するサイトもある。'
      },
      {
        label: '画面上の位置',
        api: 'screenX, screenY',
        value: `${env.screenX}, ${env.screenY}`,
        note: 'ウィンドウを動かすと1秒以内に変わる。マルチモニタではマイナスや画面幅より大きな値になり、モニタの並びが推測できる。'
      }
    ]
  }
}

export function focusSection(env: PageEnv): Section {
  return {
    id: 'focus',
    title: 'タブ・フォーカス',
    rows: [
      {
        label: 'タブが表示されているか',
        api: 'document.visibilityState',
        value: env.visibilityState,
        note: '他のタブに切り替えたり最小化したりすると "hidden" になる。オンライン試験や動画広告が「よそ見」を検出するのに使う。'
      },
      {
        label: 'ウィンドウにフォーカスがあるか',
        api: 'document.hasFocus()',
        value: String(env.hasFocus),
        note: '別のアプリをクリックすると false になる。タブが見えていても、操作しているのは別のウィンドウだと分かる。'
      },
      {
        label: 'オンラインか',
        api: 'navigator.onLine',
        value: bool(env.online)
      }
    ]
  }
}

export function originSection(env: PageEnv): Section {
  return {
    id: 'origin',
    title: '来た経路',
    rows: [
      {
        label: 'リファラー',
        api: 'document.referrer',
        value: env.referrer,
        note: '直前のページのURL。他のサイトから来た場合は、既定ではドメインまでしか教えてもらえない。ブックマークやURL直打ちなら空。'
      },
      {
        label: 'このタブの履歴の件数',
        api: 'history.length',
        value: String(env.historyLength),
        note: '中身(どのURLか)は読めないが、このタブでどれだけページを移動してきたかは分かる。'
      }
    ]
  }
}

const NAVIGATION_TYPES: Record<string, string> = {
  navigate: 'navigate (リンクやURL入力で来た)',
  reload: 'reload (リロードした)',
  back_forward: 'back_forward (戻る・進むで来た)',
  prerender: 'prerender (先読みされていた)'
}

export function loadSection(env: PageEnv): Section {
  const nav = env.navigation
  const timing = (pick: (n: NavigationTiming) => number) => (nav ? formatMs(pick(nav)) : null)
  const api = (field: string) => `performance.getEntriesByType('navigation')[0].${field}`
  return {
    id: 'load',
    title: 'ページの読み込み',
    rows: [
      {
        label: '来かた',
        api: api('type'),
        value: nav ? (NAVIGATION_TYPES[nav.type] ?? nav.type) : null,
        note: 'このサイトはページ移動をJavaScriptで行うので、ここから下の値は最初に開いたページの読み込みのもの。'
      },
      {
        label: '通信プロトコル',
        api: api('nextHopProtocol'),
        value: nav ? nav.nextHopProtocol : null,
        note: 'h3 なら HTTP/3、h2 なら HTTP/2。'
      },
      {
        label: 'DNSの名前解決',
        api: 'domainLookupEnd - domainLookupStart',
        value: timing((n) => n.domainLookupEnd - n.domainLookupStart)
      },
      {
        label: '接続 (TCP + TLS)',
        api: 'connectEnd - connectStart',
        value: timing((n) => n.connectEnd - n.connectStart),
        note: '0 なら前の接続を使い回した。'
      },
      {
        label: '最初の1バイトが届くまで',
        api: api('responseStart'),
        value: timing((n) => n.responseStart),
        note: '回線の速さや、サーバーとの距離の目安になる。'
      },
      {
        label: 'DOMContentLoaded まで',
        api: api('domContentLoadedEventEnd'),
        value: timing((n) => n.domContentLoadedEventEnd)
      },
      {
        label: 'load まで',
        api: api('loadEventEnd'),
        value: nav && nav.loadEventEnd > 0 ? formatMs(nav.loadEventEnd) : nav ? 'まだ' : null
      },
      {
        label: '転送サイズ',
        api: api('transferSize'),
        value: nav ? formatBytes(nav.transferSize) : null,
        note: '0 ならキャッシュから読んだ。つまり以前にもこのサイトに来たことがある手がかりになる。'
      },
      {
        label: 'JavaScriptのメモリ使用量',
        api: 'performance.memory.usedJSHeapSize',
        value: env.memory
          ? `${formatBytes(env.memory.usedJSHeapSize)} / 上限 ${formatBytes(env.memory.jsHeapSizeLimit)}`
          : null,
        note: 'Chrome系のみの非標準API。'
      }
    ]
  }
}

/** Every section of the window-and-page category, in the order shown. */
export function collectPage(env: PageEnv): Section[] {
  return [windowSection(env), focusSection(env), originSection(env), loadSection(env)]
}
