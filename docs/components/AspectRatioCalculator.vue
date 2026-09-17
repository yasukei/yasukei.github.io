<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  PRESETS,
  formatDimension,
  formatRatio,
  heightFor,
  parseDimension,
  parseRatio,
  simplifyRatio,
  widthFor,
  type Ratio
} from '../lib/aspect-ratio'

type Side = 'width' | 'height'

const ratioText = ref('16:9')
const widthText = ref('1920')
const heightText = ref('1080')
/** Which box the user typed in last, so a ratio change recomputes the other one. */
const lastEdited = ref<Side>('width')
const roundToWhole = ref(true)

const ratio = computed<Ratio | null>(() => parseRatio(ratioText.value))

const simplified = computed(() => {
  if (!ratio.value) return null
  const reduced = simplifyRatio(ratio.value)
  // Only worth showing when it says something the input does not, e.g. 1920:1080.
  if (reduced.width === ratio.value.width && reduced.height === ratio.value.height) return null
  return formatRatio(reduced)
})

const activePreset = computed(() => {
  const current = ratio.value
  if (!current) return null
  const match = PRESETS.find(
    (preset) => preset.ratio.width === current.width && preset.ratio.height === current.height
  )
  return match?.label ?? null
})

const decimals = computed(() => (roundToWhole.value ? 0 : 2))

/** Recomputes the side the user is not typing in. */
function recompute(from: Side = lastEdited.value) {
  const current = ratio.value
  const source = from === 'width' ? widthText.value : heightText.value
  const value = parseDimension(source)

  const target = from === 'width' ? heightText : widthText
  if (current === null || value === null) {
    // Half-typed input, or a ratio that is not a ratio yet: blank the other box
    // rather than leave a number that no longer belongs to anything.
    target.value = ''
    return
  }

  const result = from === 'width' ? heightFor(value, current) : widthFor(value, current)
  target.value = result === null ? '' : formatDimension(result, decimals.value)
}

function onInput(side: Side, event: Event) {
  const text = (event.target as HTMLInputElement).value
  if (side === 'width') widthText.value = text
  else heightText.value = text

  lastEdited.value = side
  recompute(side)
}

function usePreset(label: string) {
  ratioText.value = label
}

// A new ratio, or a change of rounding, keeps the side last typed in and moves
// the other one. Editing a box calls recompute itself, so this only fires for
// the two inputs it watches.
watch([ratio, decimals], () => recompute())

function swap() {
  const current = ratio.value
  if (current) ratioText.value = formatRatio({ width: current.height, height: current.width })

  const width = widthText.value
  widthText.value = heightText.value
  heightText.value = width
  lastEdited.value = lastEdited.value === 'width' ? 'height' : 'width'
}

const size = computed(() =>
  widthText.value !== '' && heightText.value !== '' ? `${widthText.value}x${heightText.value}` : ''
)

/**
 * The preview box, scaled to fit inside PREVIEW_BOX while keeping its shape.
 *
 * Both sides are computed here rather than left to the `aspect-ratio` property
 * under a max-width/max-height pair: those two clamp independently, so a
 * portrait ratio kept the full width and had only its height cut, which drew
 * every ratio as the same landscape rectangle.
 */
const PREVIEW_BOX = { width: 200, height: 120 }

const previewStyle = computed(() => {
  const current = ratio.value
  if (!current) return {}

  const scale = Math.min(PREVIEW_BOX.width / current.width, PREVIEW_BOX.height / current.height)
  return {
    width: `${formatDimension(current.width * scale, 1)}px`,
    height: `${formatDimension(current.height * scale, 1)}px`
  }
})

const copied = ref(false)

async function copySize() {
  if (size.value === '') return
  try {
    await navigator.clipboard.writeText(size.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch {
    // Clipboard access can be denied, and there is nothing useful to do about
    // it, so the button simply never confirms.
  }
}
</script>

<template>
  <div class="ar-root">
    <div class="ar-presets">
      <button
        v-for="preset in PRESETS"
        :key="preset.label"
        class="ar-preset"
        :class="{ 'ar-preset-active': activePreset === preset.label }"
        :title="preset.note"
        @click="usePreset(preset.label)"
      >
        {{ preset.label }}
      </button>
    </div>

    <div class="ar-row">
      <label class="ar-field ar-field-ratio">
        <span class="ar-label">Aspect ratio</span>
        <input
          class="ar-input"
          :class="{ 'ar-input-bad': ratioText.trim() !== '' && ratio === null }"
          v-model="ratioText"
          type="text"
          spellcheck="false"
          placeholder="16:9"
          aria-label="Aspect ratio"
        />
      </label>
      <button class="ar-btn ar-swap" title="Swap width and height" @click="swap">⇄ Swap</button>
    </div>

    <p v-if="ratioText.trim() !== '' && ratio === null" class="ar-error">
      Write the ratio as <code>16:9</code> — <code>16/9</code>, <code>16x9</code> and a bare
      <code>1.7778</code> work too.
    </p>
    <p v-else-if="simplified" class="ar-note">Same as <code>{{ simplified }}</code>.</p>

    <div class="ar-row ar-sizes">
      <label class="ar-field">
        <span class="ar-label">Width</span>
        <input
          class="ar-input"
          :value="widthText"
          @input="onInput('width', $event)"
          type="text"
          inputmode="decimal"
          spellcheck="false"
          placeholder="1920"
          aria-label="Width"
        />
      </label>
      <span class="ar-times">×</span>
      <label class="ar-field">
        <span class="ar-label">Height</span>
        <input
          class="ar-input"
          :value="heightText"
          @input="onInput('height', $event)"
          type="text"
          inputmode="decimal"
          spellcheck="false"
          placeholder="1080"
          aria-label="Height"
        />
      </label>
    </div>

    <div class="ar-toolbar">
      <label class="ar-check">
        <input type="checkbox" v-model="roundToWhole" />
        Round to whole numbers
      </label>
      <button class="ar-btn" :disabled="size === ''" @click="copySize">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>

    <div v-if="ratio" class="ar-preview">
      <div class="ar-shape-slot">
        <div class="ar-shape" :style="previewStyle" aria-hidden="true" />
      </div>
      <span class="ar-shape-label">{{ size || formatRatio(ratio) }}</span>
    </div>

    <p class="ar-hint">
      Type into either box and the other one follows the ratio. The preset buttons keep whichever
      side you touched last.
    </p>
  </div>
</template>

<style scoped>
.ar-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  max-width: 560px;
}

.ar-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ar-preset {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.ar-preset:hover {
  background: var(--vp-c-bg-mute);
}

.ar-preset-active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.ar-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.ar-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.ar-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ar-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.ar-input:focus {
  border-color: var(--vp-c-brand-1);
}

.ar-input-bad {
  border-color: var(--vp-c-danger-1, #d64545);
}

.ar-times {
  padding-bottom: 9px;
  color: var(--vp-c-text-2);
  font-size: 16px;
}

.ar-btn {
  padding: 8px 14px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.ar-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.ar-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ar-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ar-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.ar-error,
.ar-note,
.ar-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.ar-error {
  color: var(--vp-c-danger-1, #d64545);
}

.ar-preview {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Fixed slot, so the label beside it stays put as the shape changes. */
.ar-shape-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 200px;
  height: 120px;
}

.ar-shape {
  flex: none;
  border: 1px dashed var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

.ar-shape-label {
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 480px) {
  .ar-sizes {
    flex-wrap: wrap;
  }
}
</style>
