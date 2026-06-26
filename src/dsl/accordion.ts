import { effectScope, h, onScopeDispose, ref, type Ref, type VNode } from 'vue'
import { type Toggle } from './action.ts'
import { classes, type ClassValue } from './classes.ts'
import { type ContentEngine, createContentEngine, type PanelContent } from './content.ts'

export interface AccordionPanel {
	key: string
	label: string
	content: PanelContent | PanelContent[]
	/** Hide or disable the panel based on reactive state (`{ openKeys }`). */
	toggle?: Toggle
}

/** Expandable panels — multiple open at once, or single-open when `multiple` is false. */
export interface AccordionNode {
	node: 'accordion'
	panels: readonly AccordionPanel[]
	/** Allow more than one panel open at a time. Defaults to true. */
	multiple?: boolean
	/** Keys open initially. */
	openKeys?: readonly string[]
	class?: ClassValue
}

export interface AccordionEngine {
	openKeys: Ref<Set<string>>
	isOpen: (key: string) => boolean
	open: (key: string) => void
	close: (key: string) => void
	toggle: (key: string) => void
	render: () => VNode
	dispose: () => void
}

/**
 * Build an accordion engine — the setup-free core behind {@link useAccordion}.
 * Each panel's content engine is created once and rendered only while open;
 * `dispose()` stops the scope and tears down every panel's content.
 */
export function createAccordionEngine(node: AccordionNode): AccordionEngine {
	const scope = effectScope(true)
	const multiple = node.multiple ?? true
	const openKeys = scope.run(() => ref<Set<string>>(new Set(node.openKeys ?? [])))!

	const contents = new Map<string, ContentEngine>()
	for (const panel of node.panels) contents.set(panel.key, createContentEngine(panel.content))

	const isOpen = (key: string): boolean => openKeys.value.has(key)

	function open(key: string): void {
		const next = multiple ? new Set(openKeys.value) : new Set<string>()
		next.add(key)
		openKeys.value = next
	}

	function close(key: string): void {
		const next = new Set(openKeys.value)
		next.delete(key)
		openKeys.value = next
	}

	function toggle(key: string): void {
		if (isOpen(key)) close(key)
		else open(key)
	}

	function render(): VNode {
		const state = { openKeys: [...openKeys.value] }

		const items = node.panels
			.map((panel) => {
				const toggled = panel.toggle?.(state)
				if (toggled === 'hide') return null
				const expanded = isOpen(panel.key)
				const content = contents.get(panel.key)
				return h('div', {
					key: panel.key,
					class: classes('vue-dsl-accordion-item', expanded ? 'vue-dsl-accordion-item--open' : null),
				}, [
					h('button', {
						class: 'vue-dsl-accordion-trigger',
						type: 'button',
						'aria-expanded': expanded,
						disabled: toggled === 'disable',
						onClick: () => toggle(panel.key),
					}, panel.label),
					expanded
						? h('div', { class: 'vue-dsl-accordion-panel' }, content ? content.render() : [])
						: null,
				].filter((v): v is VNode => v !== null))
			})
			.filter((v): v is VNode => v !== null)

		return h('div', { class: classes('vue-dsl-accordion', node.class) }, items)
	}

	return {
		openKeys,
		isOpen,
		open,
		close,
		toggle,
		render,
		dispose: () => {
			for (const content of contents.values()) content.dispose()
			scope.stop()
		},
	}
}

/**
 * Wrap an accordion node in a Vue composable. Thin wrapper over
 * {@link createAccordionEngine} that binds `dispose` to the component scope.
 */
export function useAccordion(node: AccordionNode): AccordionEngine {
	const engine = createAccordionEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}
