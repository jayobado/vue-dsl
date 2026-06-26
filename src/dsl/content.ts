import type { VNode } from 'vue'
import { type Display, renderDisplay } from './display.ts'
import { createFormEngine, type FormNode } from './form/mod.ts'
import { createTableEngine, type TableNode } from './table/mod.ts'

/**
 * Leaf content — items that render purely from data, with no reactive engine to
 * instantiate or tear down. {@link renderContent} handles exactly this subset.
 */
export type LeafContent = string | Display

/**
 * Everything a container node (modal, tabs, accordion, block, …) can hold:
 * leaf items plus the setup-bound nodes (`form`, `table`). The setup-bound
 * nodes can't be rendered by a pure function — they own effect scopes — so the
 * full union is driven through {@link createContentEngine}, which instantiates a
 * child engine per item and disposes them together. (`alert` and nested
 * containers join the union as those nodes land.)
 */
export type PanelContent =
	| LeafContent
	| FormNode<Record<string, unknown>>
	| TableNode

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
	if ('node' in item && item.node === 'form') {
		const engine = createFormEngine(item)
		return { render: () => engine.render() as VNode, dispose: engine.dispose }
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
