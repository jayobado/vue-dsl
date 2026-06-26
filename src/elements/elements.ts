import { createVNode, type VNode, type VNodeArrayChildren } from 'vue'

/**
 * Typed element factories for authoring Vue components as plain render functions
 * — `div({ class }, [...])` instead of `h('div', { class }, [...])`. The pitch is
 * a lighter toolchain (no template compiler, no `.vue` SFCs — run runtime-only
 * Vue), not raw speed; pair with `withMemo` for static-heavy subtrees.
 */

type Child = VNode | string | number | null | undefined | false
type Children = Child | Child[] | VNodeArrayChildren

/** Common attributes + event handlers shared by every element factory. */
export interface ElProps {
	[key: string]: unknown
	class?: string
	id?: string
	style?: string
	role?: string
	tabIndex?: number
	title?: string
	key?: string | number
	'aria-label'?: string
	'aria-hidden'?: boolean | 'true' | 'false'
	'aria-expanded'?: boolean
	'aria-live'?: string
	onClick?: (e: MouseEvent) => void
	onDblclick?: (e: MouseEvent) => void
	onMouseenter?: (e: MouseEvent) => void
	onMouseleave?: (e: MouseEvent) => void
	onFocus?: (e: FocusEvent) => void
	onBlur?: (e: FocusEvent) => void
	onKeydown?: (e: KeyboardEvent) => void
	onKeyup?: (e: KeyboardEvent) => void
	onInput?: (e: Event) => void
	onChange?: (e: Event) => void
	onSubmit?: (e: Event) => void
}

export interface InputElProps extends ElProps {
	type?: string
	value?: string
	placeholder?: string
	disabled?: boolean
	readonly?: boolean
	required?: boolean
	name?: string
	autocomplete?: string
	autofocus?: boolean
	min?: string
	max?: string
}

export interface ButtonElProps extends ElProps {
	type?: 'button' | 'submit' | 'reset'
	disabled?: boolean
}

export interface AnchorElProps extends ElProps {
	href?: string
	target?: string
	rel?: string
}

// ─── Factories ───────────────────────────────────────────────────────────────

type El = (props?: ElProps | null, children?: Children) => VNode

const el = (tag: string): El => (props, children) => createVNode(tag, props ?? null, children ?? null)

// Layout / sections
export const div: El = el('div')
export const section: El = el('section')
export const article: El = el('article')
export const aside: El = el('aside')
export const header: El = el('header')
export const footer: El = el('footer')
export const main: El = el('main')
export const nav: El = el('nav')

// Text
export const span: El = el('span')
export const p: El = el('p')
export const h1: El = el('h1')
export const h2: El = el('h2')
export const h3: El = el('h3')
export const h4: El = el('h4')
export const h5: El = el('h5')
export const h6: El = el('h6')
export const em: El = el('em')
export const strong: El = el('strong')
export const small: El = el('small')
export const code: El = el('code')
export const pre: El = el('pre')

// Lists
export const ul: El = el('ul')
export const ol: El = el('ol')
export const li: El = el('li')

// Form
export const form = (
	props?: (ElProps & { action?: string; method?: string; enctype?: string }) | null,
	children?: Children,
): VNode => createVNode('form', props ?? null, children ?? null)

export const fieldset: El = el('fieldset')

export const label = (
	props?: (ElProps & { for?: string }) | null,
	children?: Children,
): VNode => createVNode('label', props ?? null, children ?? null)

export const input = (props?: InputElProps | null): VNode => createVNode('input', props ?? null)

export const button = (props?: ButtonElProps | null, children?: Children): VNode =>
	createVNode('button', props ?? null, children ?? null)

export const select: El = el('select')

export const textarea = (props?: (ElProps & { rows?: number; placeholder?: string }) | null): VNode =>
	createVNode('textarea', props ?? null)

export const option = (
	props?: (ElProps & { value?: string; selected?: boolean }) | null,
	children?: Children,
): VNode => createVNode('option', props ?? null, children ?? null)

// Media / navigation
export const img = (props?: (ElProps & { src?: string; alt?: string; loading?: string }) | null): VNode =>
	createVNode('img', props ?? null)

export const a = (props?: AnchorElProps | null, children?: Children): VNode =>
	createVNode('a', props ?? null, children ?? null)

export const hr = (props?: ElProps | null): VNode => createVNode('hr', props ?? null)

export const br = (): VNode => createVNode('br', null)

// Table
export const table: El = el('table')
export const thead: El = el('thead')
export const tbody: El = el('tbody')
export const tr: El = el('tr')

export const th = (
	props?: (ElProps & { scope?: string; colSpan?: number }) | null,
	children?: Children,
): VNode => createVNode('th', props ?? null, children ?? null)

export const td = (
	props?: (ElProps & { colSpan?: number }) | null,
	children?: Children,
): VNode => createVNode('td', props ?? null, children ?? null)
