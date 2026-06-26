import { effectScope, h, onScopeDispose, ref, type Ref, type VNode } from 'vue'
import { type Toggle } from './action.ts'
import { classes, type ClassValue } from './classes.ts'
import { type ContentEngine, createContentEngine, type PanelContent } from './content.ts'

export interface TabDef {
	key: string
	label: string
	content: PanelContent | PanelContent[]
	/** Hide or disable the tab based on the engine's reactive state (`{ activeKey }`). */
	toggle?: Toggle
}

/** Free-switching panels — one visible at a time, selected by key. */
export interface TabsNode {
	node: 'tabs'
	tabs: readonly TabDef[]
	/** Initially active key. Defaults to the first tab. */
	activeKey?: string
	class?: ClassValue
}

export interface TabsEngine {
	activeKey: Ref<string>
	setActive: (key: string) => void
	render: () => VNode
	dispose: () => void
}

/**
 * Build a tabs engine — the setup-free core behind {@link useTabs}. Each tab's
 * content engine is created once; only the active tab's content is rendered.
 * `dispose()` stops the scope and tears down every tab's content.
 */
export function createTabsEngine(node: TabsNode): TabsEngine {
	const scope = effectScope(true)
	const firstKey = node.tabs[0]?.key ?? ''
	const activeKey = scope.run(() => ref(node.activeKey ?? firstKey))!

	const contents = new Map<string, ContentEngine>()
	for (const tab of node.tabs) contents.set(tab.key, createContentEngine(tab.content))

	function setActive(key: string): void {
		activeKey.value = key
	}

	function render(): VNode {
		const state = { activeKey: activeKey.value }

		const tabList = node.tabs
			.map((tab) => {
				const toggled = tab.toggle?.(state)
				if (toggled === 'hide') return null
				const isActive = tab.key === activeKey.value
				return h('button', {
					key: tab.key,
					class: classes('vue-dsl-tab', isActive ? 'vue-dsl-tab--active' : null),
					type: 'button',
					role: 'tab',
					'aria-selected': isActive,
					disabled: toggled === 'disable',
					onClick: () => setActive(tab.key),
				}, tab.label)
			})
			.filter((v): v is VNode => v !== null)

		const active = contents.get(activeKey.value)
		const panel = h('div', { class: 'vue-dsl-tab-panel', role: 'tabpanel' }, active ? active.render() : [])

		return h('div', { class: classes('vue-dsl-tabs', node.class) }, [
			h('div', { class: 'vue-dsl-tab-list', role: 'tablist' }, tabList),
			panel,
		])
	}

	return {
		activeKey,
		setActive,
		render,
		dispose: () => {
			for (const content of contents.values()) content.dispose()
			scope.stop()
		},
	}
}

/**
 * Wrap a tabs node in a Vue composable. Thin wrapper over
 * {@link createTabsEngine} that binds `dispose` to the component scope.
 */
export function useTabs(node: TabsNode): TabsEngine {
	const engine = createTabsEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}
