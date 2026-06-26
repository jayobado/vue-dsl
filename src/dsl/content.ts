import type { VNode } from 'vue'
import { type Display, renderDisplay } from './display.ts'
import { createFormEngine, type FormNode } from './form/mod.ts'
import { createTableEngine, type TableNode } from './table/mod.ts'
import { type AccordionNode, createAccordionEngine } from './accordion.ts'
import { type BlockNode, createBlockEngine } from './block.ts'
import { createStepperEngine, type StepperNode } from './stepper.ts'
import { createTabsEngine, type TabsNode } from './tabs.ts'

/**
 * Leaf content — items that render purely from data, with no reactive engine to
 * instantiate or tear down. {@link renderContent} handles exactly this subset.
 */
export type LeafContent = string | Display

/**
 * Everything a container node (modal, tabs, accordion, block, …) can hold:
 * leaf items, the setup-bound `form`/`table` engines, and the inline containers
 * themselves (so screens nest as pure data). None of these can be rendered by a
 * pure function — they own effect scopes — so the full union is driven through
 * {@link createContentEngine}, which instantiates a child engine per item and
 * disposes them together. (`modal` is deliberately excluded: it's a triggered
 * overlay, not inline content; `alert` joins the union as that node lands.)
 */
export type PanelContent =
	| LeafContent
	| FormNode<Record<string, unknown>>
	| TableNode
	| TabsNode
	| StepperNode
	| AccordionNode
	| BlockNode

/** Normalize one-or-many content into an array. */
export function toContentList<T>(content: T | T[]): T[] {
	return Array.isArray(content) ? content : [content]
}

/**
 * Render a single {@link LeafContent} item. Strings pass through; display items
 * render. For the full {@link PanelContent} union (which may include setup-bound
 * nodes) use {@link createContentEngine} instead.
 */
export function renderContent(content: LeafContent): VNode | string {
	if (typeof content === 'string') return content
	return renderDisplay(content)
}

// ─── Content engine ──────────────────────────────────────────────────────

/** A rendered content tree that can be torn down (disposing any child engines). */
export interface ContentEngine {
	render: () => (VNode | string)[]
	dispose: () => void
}

interface ItemEngine {
	render: () => VNode | string
	dispose: () => void
}

const noop = (): void => {}

function createItemEngine(item: PanelContent): ItemEngine {
	if (typeof item === 'string') {
		return { render: () => item, dispose: noop }
	}
	// Display items carry a `type` discriminant; setup-bound nodes don't.
	if ('type' in item) {
		return { render: () => renderDisplay(item), dispose: noop }
	}
	if ('node' in item) {
		switch (item.node) {
			case 'form': {
				const engine = createFormEngine(item)
				return { render: () => engine.render() as VNode, dispose: engine.dispose }
			}
			case 'tabs': {
				const engine = createTabsEngine(item)
				return { render: engine.render, dispose: engine.dispose }
			}
			case 'stepper': {
				const engine = createStepperEngine(item)
				return { render: engine.render, dispose: engine.dispose }
			}
			case 'accordion': {
				const engine = createAccordionEngine(item)
				return { render: engine.render, dispose: engine.dispose }
			}
			case 'block': {
				const engine = createBlockEngine(item)
				return { render: engine.render, dispose: engine.dispose }
			}
		}
	}
	if ('query' in item) {
		const engine = createTableEngine(item)
		return { render: engine.render, dispose: engine.dispose }
	}
	// Exhaustive over the current union; future kinds add cases above.
	return { render: () => '', dispose: noop }
}

/**
 * Instantiate an engine for container content. Each item's child engine (form,
 * table, …) is created once here — never inside `render()` — so its effect scope
 * is stable across re-renders; `dispose()` tears them all down. A container
 * builds this in its own setup-free engine and chains `dispose` from its own.
 */
export function createContentEngine(content: PanelContent | PanelContent[]): ContentEngine {
	const items = toContentList(content).map(createItemEngine)
	return {
		render: () => items.map((item) => item.render()),
		dispose: () => {
			for (const item of items) item.dispose()
		},
	}
}
