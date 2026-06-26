import { h, type VNode } from 'vue'
import { classes, type ClassValue } from './classes.ts'

/** Read-only content items — richer alternatives to bare strings inside containers. */

export interface Text {
	type: 'text'
	content: string | (() => string)
	variant?: string
	class?: ClassValue
}

export interface Badge {
	type: 'badge'
	label: string | (() => string)
	variant?: string
	class?: ClassValue
}

export interface Image {
	type: 'image'
	src: string | (() => string)
	alt: string
	width?: number
	height?: number
	class?: ClassValue
}

export type Display = Text | Badge | Image

const val = (v: string | (() => string)): string => (typeof v === 'function' ? v() : v)

/** Render a display item (text, badge, or image) to a VNode. */
export function renderDisplay(item: Display): VNode {
	switch (item.type) {
		case 'text':
			return h('span', {
				class: classes('vue-dsl-text', item.variant ? `vue-dsl-text--${item.variant}` : null, item.class),
			}, val(item.content))
		case 'badge':
			return h('span', {
				class: classes('vue-dsl-badge', item.variant ? `vue-dsl-badge--${item.variant}` : null, item.class),
			}, val(item.label))
		case 'image':
			return h('img', {
				class: classes('vue-dsl-image', item.class),
				src: val(item.src),
				alt: item.alt,
				width: item.width,
				height: item.height,
			})
	}
}
