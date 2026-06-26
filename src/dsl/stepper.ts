import { effectScope, h, onScopeDispose, ref, type Ref, type VNode } from 'vue'
import { classes, type ClassValue } from './classes.ts'
import { createContentEngine, type PanelContent } from './content.ts'

export interface StepperStep {
	key: string
	label: string
	content: PanelContent | PanelContent[]
}

/**
 * A standalone step wizard — sequential panels with visited tracking and
 * optional linear gating. Distinct from the form-embedded `steps` field node;
 * this is a container that holds arbitrary {@link PanelContent} per step.
 */
export interface StepperNode {
	node: 'stepper'
	steps: readonly StepperStep[]
	/** Initial step index. Defaults to 0. */
	index?: number
	/** When true, a step is only reachable once every prior step has been visited. */
	linear?: boolean
	class?: ClassValue
}

export interface StepperEngine {
	index: Ref<number>
	visited: Ref<Set<number>>
	canNext: () => boolean
	canBack: () => boolean
	/** Whether a step index is reachable (always true unless `linear`). */
	accessible: (target: number) => boolean
	next: () => void
	back: () => void
	goTo: (target: number) => void
	render: () => VNode
	dispose: () => void
}

/**
 * Build a stepper engine — the setup-free core behind {@link useStepper}. Each
 * step's content engine is created once; only the active step renders.
 * `dispose()` stops the scope and tears down every step's content.
 */
export function createStepperEngine(node: StepperNode): StepperEngine {
	const scope = effectScope(true)
	const start = node.index ?? 0
	const index = scope.run(() => ref(start))!
	const visited = scope.run(() => ref<Set<number>>(new Set([start])))!
	const last = node.steps.length - 1

	const contents = node.steps.map((step) => createContentEngine(step.content))

	function accessible(target: number): boolean {
		if (target < 0 || target > last) return false
		if (!node.linear) return true
		// Linear: every prior step must have been visited.
		for (let i = 0; i < target; i++) {
			if (!visited.value.has(i)) return false
		}
		return true
	}

	function goTo(target: number): void {
		if (!accessible(target)) return
		index.value = target
		if (!visited.value.has(target)) {
			const next = new Set(visited.value)
			next.add(target)
			visited.value = next
		}
	}

	const canNext = (): boolean => index.value < last && accessible(index.value + 1)
	const canBack = (): boolean => index.value > 0

	function next(): void {
		if (canNext()) goTo(index.value + 1)
	}

	function back(): void {
		if (canBack()) goTo(index.value - 1)
	}

	function render(): VNode {
		const stepList = node.steps.map((step, i) => {
			const isActive = i === index.value
			const isVisited = visited.value.has(i)
			return h('button', {
				key: step.key,
				class: classes(
					'vue-dsl-step',
					isActive ? 'vue-dsl-step--active' : null,
					isVisited ? 'vue-dsl-step--visited' : null,
				),
				type: 'button',
				disabled: !accessible(i),
				'aria-current': isActive ? 'step' : undefined,
				onClick: () => goTo(i),
			}, step.label)
		})

		const active = contents[index.value]
		const panel = h('div', { class: 'vue-dsl-step-panel' }, active ? active.render() : [])

		return h('div', { class: classes('vue-dsl-stepper', node.class) }, [
			h('div', { class: 'vue-dsl-step-list' }, stepList),
			panel,
		])
	}

	return {
		index,
		visited,
		canNext,
		canBack,
		accessible,
		next,
		back,
		goTo,
		render,
		dispose: () => {
			for (const content of contents) content.dispose()
			scope.stop()
		},
	}
}

/**
 * Wrap a stepper node in a Vue composable. Thin wrapper over
 * {@link createStepperEngine} that binds `dispose` to the component scope.
 */
export function useStepper(node: StepperNode): StepperEngine {
	const engine = createStepperEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}
