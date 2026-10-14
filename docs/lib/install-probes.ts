/**
 * The installed-software values that need a real browser: text measured in
 * candidate fonts, the speech voices (which some browsers load late), and the
 * storage estimate. install-info.ts turns the results into rows.
 */

import { attempt } from './hardware-probes'
import {
  FONT_CANDIDATES,
  detectFonts,
  type FontCandidate,
  type InstallProbes,
  type StorageInfo,
  type VoiceInfo
} from './install-info'

/** Wide and narrow Latin plus some kana, so a Japanese font measures apart too. */
const SAMPLE = 'mmmmmmmmmmlli1WwQ@あいうアイウ漢字'

export function probeFonts(): FontCandidate[] | null {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  return detectFonts(FONT_CANDIDATES, (family) => {
    ctx.font = `72px ${family}`
    const m = ctx.measureText(SAMPLE)
    return `${m.width}|${m.actualBoundingBoxAscent}|${m.actualBoundingBoxDescent}`
  })
}

const VOICES_WAIT_MS = 1500

/**
 * Chrome fills the list asynchronously and announces it with `voiceschanged`,
 * so an empty first answer is waited out for a moment before being believed.
 */
export async function probeVoices(): Promise<VoiceInfo[] | null> {
  if (typeof speechSynthesis === 'undefined') return null
  let voices = speechSynthesis.getVoices()
  if (voices.length === 0) {
    voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        speechSynthesis.removeEventListener('voiceschanged', done)
        resolve(speechSynthesis.getVoices())
      }
      const timer = setTimeout(done, VOICES_WAIT_MS)
      speechSynthesis.addEventListener('voiceschanged', done)
    })
  }
  return voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    default: voice.default
  }))
}

export async function probeStorage(nav: Navigator): Promise<StorageInfo | null> {
  if (!nav.storage?.estimate) return null
  const estimate = await nav.storage.estimate()
  const persisted = nav.storage.persisted ? await nav.storage.persisted() : null
  return { quota: estimate.quota ?? null, usage: estimate.usage ?? null, persisted }
}

/** All probes at once; each one that fails is null. */
export async function runInstallProbes(nav: Navigator): Promise<InstallProbes> {
  const [fonts, voices, storage] = await Promise.all([
    attempt(probeFonts),
    attempt(probeVoices),
    attempt(() => probeStorage(nav))
  ])
  return { fonts, voices, storage }
}
