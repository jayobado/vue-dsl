import type { VNode } from 'vue'
import { type Display, renderDisplay } from './display.ts'

/**
 * Content a container node (modal, tabs, accordion, block, …) can hold.
 *
 * A leaf set for now — `string` and `Display`. The container phase extends this
 * union with the setup-bound nodes (`form`, `table`, `alert`, nested `block`)
 * once their renderers and the composable-instantiation strategy land, so
 * `renderContent` stays the single place nesting is dispatched.
 */
export type PanelContent = string | Display

/** Render a single `PanelContent` item. Strings pass through; display items render. */
export function renderContent(content: PanelContent): VNode | string {
	if (typeof content === 'string') return content
	return renderDisplay(content)
}

/** Normalize one-or-many content into an array. */
export function toContentList(content: PanelContent | PanelContent[]): PanelContent[] {
	return Array.isArray(content) ? content : [content]
}
