import { effectScope, h, onScopeDispose, ref, type Ref, Teleport, type VNode } from 'vue'
import { type ActionItem, renderActionItems } from './action.ts'
import { classes, type ClassValue } from './classes.ts'
import { createContentEngine, type PanelContent } from './content.ts'

/** A dialog as data — title, body content, and footer actions, with reactive open state. */
export interface ModalNode {
	node: 'modal'
	title?: string
	size?: string
	/** Whether a backdrop click / close button dismisses the modal. Defaults to true. */
	closable?: boolean
	/** Initial open state. Defaults to false. */
	open?: boolean
	content: PanelContent | PanelContent[]
	footer?: readonly ActionItem[]
	class?: ClassValue
	onAction?: (action: string) => void
	onClose?: () => void
}

export interface ModalEngine {
	open: Ref<boolean>
	show: () => void
	hide: () => void
	toggle: () => void
	/** Renders a `<Teleport to="body">` with backdrop + dialog when open, else null. */
	render: () => VNode | null
	dispose: () => void
}

/**
 * Build a modal engine — the setup-free core behind {@link useModal}. Owns a
 * detached effect scope and the content engine for its body; `dispose()` stops
 * the scope and tears down nested content.
 */
export function createModalEngine(node: ModalNode): ModalEngine {
	const scope = effectScope(true)
	const open = scope.run(() => ref(node.open ?? false))!
	const content = createContentEngine(node.content)
	const closable = node.closable ?? true

	function show(): void {
		open.value = true
	}

	function hide(): void {
		open.value = false
		node.onClose?.()
	}

	function toggle(): void {
		if (open.value) hide()
		else show()
	}

	function render(): VNode | null {
		if (!open.value) return null

		const actionCtx = { state: { open: open.value }, onAction: node.onAction }

		const dialogChildren: (VNode | null)[] = [
			node.title || closable
				? h('div', { class: 'vue-dsl-modal-header' }, [
					node.title ? h('h2', { class: 'vue-dsl-modal-title' }, node.title) : null,
					closable
						? h('button', {
							class: 'vue-dsl-modal-close',
							type: 'button',
							'aria-label': 'Close',
							onClick: () => hide(),
						}, '×')
						: null,
				])
				: null,
			h('div', { class: 'vue-dsl-modal-body' }, content.render()),
			node.footer && node.footer.length > 0
				? h('div', { class: 'vue-dsl-modal-footer' }, renderActionItems(node.footer, actionCtx))
				: null,
		]

		const dialog = h('div', {
			class: classes('vue-dsl-modal', node.size ? `vue-dsl-modal--${node.size}` : null, node.class),
			role: 'dialog',
			'aria-modal': 'true',
		}, dialogChildren.filter((v): v is VNode => v !== null))

		const backdrop = h('div', {
			class: 'vue-dsl-modal-backdrop',
			onClick: () => {
				if (closable) hide()
			},
		}, [dialog])

		return h(Teleport, { to: 'body' }, [backdrop])
	}

	return {
		open,
		show,
		hide,
		toggle,
		render,
		dispose: () => {
			content.dispose()
			scope.stop()
		},
	}
}

/**
 * Wrap a modal node in a Vue composable. Thin wrapper over
 * {@link createModalEngine} that binds `dispose` to the component scope.
 */
export function useModal(node: ModalNode): ModalEngine {
	const engine = createModalEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}
