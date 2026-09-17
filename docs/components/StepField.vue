<script setup lang="ts">
/**
 * A slider for the broad move and a number box for the exact one.
 *
 * A slider alone cannot be nudged by one: the thumb jumps by whatever a pixel
 * of travel happens to be worth, and the value it lands on is whatever the
 * pointer decided. The box beside it takes a typed number, and the arrows step
 * by exactly one unit, so a value can be closed in on rather than aimed at.
 *
 * Whole units only, which is what every setting here is measured in --
 * percentages and pixels. Values that are really fractions (a 0.2 to 0.8
 * share, a 0.4 to 1 quality) are passed in as percentages and divided by the
 * caller, so nothing here has to round in a way it cannot do exactly.
 */
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min: number
    max: number
    /** How far the slider moves per notch. */
    step?: number
    label: string
    unit?: string
  }>(),
  { step: 1, unit: '' }
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

/** What the box shows while it is being typed in, which may not yet be a number. */
const draft = ref(String(props.modelValue))
watch(
  () => props.modelValue,
  (value) => {
    draft.value = String(value)
  }
)

const atMin = computed(() => props.modelValue <= props.min)
const atMax = computed(() => props.modelValue >= props.max)

function clamp(value: number): number {
  return Math.min(props.max, Math.max(props.min, Math.round(value)))
}

function set(value: number) {
  if (!Number.isFinite(value)) return
  const settled = clamp(value)
  draft.value = String(settled)
  if (settled !== props.modelValue) emit('update:modelValue', settled)
}

function nudge(direction: number) {
  set(props.modelValue + direction)
}

function onSlide(event: Event) {
  set(Number((event.target as HTMLInputElement).value))
}

/**
 * Typing is only acted on once the box is left or Enter is pressed. Clamping
 * every keystroke would fight the typist: on a field that starts at 20, the
 * first digit of "50" is a 5, which is below the minimum and would be pushed
 * straight back up to 20.
 */
function commit() {
  const typed = draft.value.trim()
  const value = Number(typed)
  if (typed !== '' && Number.isFinite(value)) set(value)
  else draft.value = String(props.modelValue)
}
</script>

<template>
  <div class="sf-root">
    <span class="sf-label">{{ label }}</span>
    <div class="sf-controls">
      <input
        class="sf-range"
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="label"
        @input="onSlide"
      />
      <span class="sf-box">
        <input
          class="sf-text"
          type="text"
          inputmode="numeric"
          spellcheck="false"
          :value="draft"
          :aria-label="`${label} value`"
          @input="draft = ($event.target as HTMLInputElement).value"
          @change="commit"
          @keyup.enter="commit"
          @blur="commit"
        />
        <span v-if="unit" class="sf-unit">{{ unit }}</span>
        <span class="sf-arrows">
          <button
            class="sf-arrow"
            type="button"
            :disabled="atMax"
            :aria-label="`Increase ${label}`"
            @click="nudge(1)"
          >
            ▲
          </button>
          <button
            class="sf-arrow"
            type="button"
            :disabled="atMin"
            :aria-label="`Decrease ${label}`"
            @click="nudge(-1)"
          >
            ▼
          </button>
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.sf-root {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.sf-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sf-range {
  width: 110px;
}

.sf-box {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 2px 2px 6px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
}

.sf-text {
  width: 3.2em;
  border: none;
  outline: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.sf-unit {
  font-size: 11px;
  color: var(--vp-c-text-2);
}

.sf-arrows {
  display: flex;
  flex-direction: column;
  margin-left: 2px;
}

.sf-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 13px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 8px;
  line-height: 1;
}

.sf-arrow:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

.sf-arrow:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
