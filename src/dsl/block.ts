import { effectScope, h, onScopeDispose, ref, type Ref, type VNode } from 'vue'
import { type ActionItem, renderActionItems } from './action.ts'
import { classes, type ClassValue } from './classes.ts'
import { createContentEngine, type PanelContent } from './content.ts'

/** A titled container — header (title/subtitle/icon/actions) over body content. */
export interface BlockNode {
	node: 'block'
	title?: string
	subtitle?: string
	icon?: string
	actions?: readonly ActionItem[]
	content: PanelContent | PanelContent[]
	/** Show a collapse toggle in the header. Defaults to false. */
	collapsible?: boolean
	/** Initial collapsed state (only meaningful with `collapsible`). */
	collapsed?: boolean
	/** Render a loading affordance over the body. */
	loading?: boolean
	class?: ClassValue
	onAction?: (action: string) => void
}

export interface BlockEngine {
	collapsed: Ref<boolean>
	toggle: () => void
	expand: () => void
	collapse: () => void
	render: () => VNode
	dispose: () => void
}

/**
 * Build a block engine — the setup-free core behind {@link useBlock}. Owns a
 * detached scope and the body content engine; `dispose()` stops the scope and
 * tears down nested content.
 */
export function createBlockEngine(node: BlockNode): BlockEngine {
	const scope = effectScope(true)
	const collapsed = scope.run(() => ref(node.collapsed ?? false))!
	const content = createContentEngine(node.content)

	const expand = (): void => {
		collapsed.value = false
	}
	const collapse = (): void => {
		collapsed.value = true
	}
	const toggle = (): void => {
		collapsed.value = !collapsed.value
	}

	function render(): VNode {
		const actionCtx = { state: { collapsed: collapsed.value }, onAction: node.onAction }

		const hasHeader = node.title || node.subtitle || node.icon ||
			(node.actions && node.actions.length > 0) || node.collapsible

		const header = hasHeader
			? h('div', { class: 'vue-dsl-block-header' }, [
				h('div', { class: 'vue-dsl-block-heading' }, [
					node.icon ? h('span', { class: 'vue-dsl-block-icon' }, node.icon) : null,
					node.title ? h('h3', { class: 'vue-dsl-block-title' }, node.title) : null,
					node.subtitle ? h('p', { class: 'vue-dsl-block-subtitle' }, node.subtitle) : null,
				].filter((v): v is VNode => v !== null)),
				h('div', { class: 'vue-dsl-block-actions' }, [
					...(node.actions ? renderActionItems(node.actions, actionCtx) : []),
					node.collapsible
						? h('button', {
							class: 'vue-dsl-block-collapse',
							type: 'button',
							'aria-expanded': !collapsed.value,
							onClick: () => toggle(),
						}, collapsed.value ? '▸' : '▾')
						: null,
				].filter((v): v is VNode => v !== null)),
			])
			: null

		const body = collapsed.value
			? null
			: h('div', {
				class: classes('vue-dsl-block-body', node.loading ? 'vue-dsl-block-body--loading' : null),
				'aria-busy': node.loading || undefined,
			}, content.render())

		return h('div', {
			class: classes('vue-dsl-block', node.loading ? 'vue-dsl-block--loading' : null, node.class),
		}, [header, body].filter((v): v is VNode => v !== null))
	}

	return {
		collapsed,
		toggle,
		expand,
		collapse,
		render,
		dispose: () => {
			content.dispose()
			scope.stop()
		},
	}
}

/**
 * Wrap a block node in a Vue composable. Thin wrapper over
 * {@link createBlockEngine} that binds `dispose` to the component scope.
 */
export function useBlock(node: BlockNode): BlockEngine {
	const engine = createBlockEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}
