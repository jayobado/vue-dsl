import { h, type VNode } from 'vue'
import { classes, type ClassValue } from './classes.ts'

/** Hide or disable a node based on the current (reactive) state. */
export type Toggle = (state: Record<string, unknown>) => 'hide' | 'disable' | undefined

/**
 * A button/link as data. `action` fires `onAction(action)`; `href` navigates —
 * the two are mutually exclusive. Composes with forms (submit), tables (row
 * actions), and modal/block footers.
 */
export interface Action {
	type?: 'action'
	label: string
	action?: string
	href?: string
	icon?: string
	variant?: string
	class?: ClassValue
	toggle?: Toggle
	loading?: (state: Record<string, unknown>) => boolean
}

/** A set of actions. With a `label`, renders as a labelled menu; otherwise inline. */
export interface ActionGroup {
	type?: 'action-group'
	label?: string
	icon?: string
	class?: ClassValue
	toggle?: Toggle
	items: Action[]
}

export interface ActionContext {
	/** Reactive state threaded into `toggle` / `loading`. */
	state?: Record<string, unknown>
	onAction?: (action: string) => void
}

/** Render a single action as a `<button>` (action) or `<a>` (href). Null if hidden. */
export function renderAction(action: Action, ctx: ActionContext = {}): VNode | null {
	const state = ctx.state ?? {}
	const toggled = action.toggle?.(state)
	if (toggled === 'hide') return null

	const disabled = toggled === 'disable'
	const loading = action.loading?.(state) ?? false
	const cls = classes(
		'vue-dsl-action',
		action.variant ? `vue-dsl-action--${action.variant}` : null,
		action.class,
	)

	if (action.href) {
		return h('a', {
			class: cls,
			href: disabled ? undefined : action.href,
			'aria-disabled': disabled || undefined,
		}, action.label)
	}

	return h('button', {
		class: cls,
		type: 'button',
		disabled: disabled || loading,
		'data-loading': loading || undefined,
		onClick: () => {
			if (action.action) ctx.onAction?.(action.action)
		},
	}, action.label)
}

/** Either a single action or a group of them — the shape container headers/footers take. */
export type ActionItem = Action | ActionGroup

/** Render an {@link ActionItem}, dispatching to action vs. group by shape. Null if hidden. */
export function renderActionItem(item: ActionItem, ctx: ActionContext = {}): VNode | null {
	return 'items' in item ? renderActionGroup(item, ctx) : renderAction(item, ctx)
}

/** Render a list of action items, dropping any that are hidden. */
export function renderActionItems(items: readonly ActionItem[], ctx: ActionContext = {}): VNode[] {
	return items
		.map((item) => renderActionItem(item, ctx))
		.filter((v): v is VNode => v !== null)
}

/** Render a group of actions — a labelled menu, or inline if unlabelled. Null if hidden. */
export function renderActionGroup(group: ActionGroup, ctx: ActionContext = {}): VNode | null {
	const state = ctx.state ?? {}
	const toggled = group.toggle?.(state)
	if (toggled === 'hide') return null

	const items = group.items
		.map((item) => renderAction(item, ctx))
		.filter((v): v is VNode => v !== null)

	if (group.label) {
		return h('div', {
			class: classes('vue-dsl-action-group', group.class),
			'data-disabled': toggled === 'disable' || undefined,
		}, [
			h('button', {
				class: 'vue-dsl-action-group-trigger',
				type: 'button',
				disabled: toggled === 'disable',
			}, group.label),
			h('div', { class: 'vue-dsl-action-group-menu' }, items),
		])
	}

	return h('div', { class: classes('vue-dsl-action-group', group.class) }, items)
}
