import { effectScope, h, onScopeDispose, ref, type Ref, type VNode } from 'vue'
import { classes, type ClassValue } from './classes.ts'

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error'

/** A declarative inline banner — message, severity, and optional dismissal. */
export interface AlertNode {
	node: 'alert'
	message: string | (() => string)
	severity?: AlertSeverity
	title?: string
	/** Show a dismiss button that hides the alert. Defaults to false. */
	dismissible?: boolean
	class?: ClassValue
	onDismiss?: () => void
}

export interface AlertEngine {
	dismissed: Ref<boolean>
	dismiss: () => void
	reset: () => void
	/** Renders the banner, or null once dismissed. */
	render: () => VNode | null
	dispose: () => void
}

const text = (v: string | (() => string)): string => (typeof v === 'function' ? v() : v)

/**
 * Build an alert engine — the setup-free core behind {@link useAlert}. Owns a
 * detached scope holding the dismissed state; `dispose()` stops it.
 */
export function createAlertEngine(node: AlertNode): AlertEngine {
	const scope = effectScope(true)
	const dismissed = scope.run(() => ref(false))!

	function dismiss(): void {
		dismissed.value = true
		node.onDismiss?.()
	}

	function reset(): void {
		dismissed.value = false
	}

	function render(): VNode | null {
		if (dismissed.value) return null

		const severity = node.severity ?? 'info'
		const children: (VNode | null)[] = [
			h('div', { class: 'vue-dsl-alert-content' }, [
				node.title ? h('strong', { class: 'vue-dsl-alert-title' }, node.title) : null,
				h('span', { class: 'vue-dsl-alert-message' }, text(node.message)),
			].filter((v): v is VNode => v !== null)),
			node.dismissible
				? h('button', {
					class: 'vue-dsl-alert-dismiss',
					type: 'button',
					'aria-label': 'Dismiss',
					onClick: () => dismiss(),
				}, '×')
				: null,
		]

		return h('div', {
			class: classes('vue-dsl-alert', `vue-dsl-alert--${severity}`, node.class),
			role: severity === 'error' || severity === 'warning' ? 'alert' : 'status',
		}, children.filter((v): v is VNode => v !== null))
	}

	return {
		dismissed,
		dismiss,
		reset,
		render,
		dispose: () => scope.stop(),
	}
}

/**
 * Wrap an alert node in a Vue composable. Thin wrapper over
 * {@link createAlertEngine} that binds `dispose` to the component scope.
 */
export function useAlert(node: AlertNode): AlertEngine {
	const engine = createAlertEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}
