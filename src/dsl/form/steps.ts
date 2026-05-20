import { ref, h, type Ref, type VNode } from 'vue'
import type {
	StepsNode,
	StepsContext,
	FormChild,
} from './types.ts'
import type { FieldContext } from './context.ts'

// ─── Field key extraction ────────────────────────────────────────────────

/**
 * Walk a step's fields and extract the keys that should be validated.
 * For top-level fields: the field name. For array fields: the array's name
 * (the schema covers the array contents). Buttons skipped. Nested steps
 * not supported (would need different flattening).
 */
function extractStepFieldKeys(fields: readonly FormChild[]): string[] {
	const keys: string[] = []
	for (const field of fields) {
		switch (field.node) {
			case 'input':
			case 'select':
			case 'textarea':
			case 'checkbox':
			case 'radio':
			case 'array':
				keys.push(field.name)
				break
			case 'steps':
				// Nested steps unsupported. Schema validation still covers them
				// if the consumer has a schema.
				break
			case 'button':
				break
		}
	}
	return keys
}

// ─── Navigation factory ──────────────────────────────────────────────────

interface NavigationResult {
	currentStep: Ref<number>
	navigate: (target: number) => Promise<void>
	prev: () => void
	totalSteps: number
	stepFieldKeys: string[][]
}

/**
 * Build the navigation logic for a steps node. Returns a currentStep ref
 * (either external or internal), plus navigate/prev functions wired to it.
 *
 * Navigate validates intermediate steps when going forward; lands on the
 * first failing step if validation fails. Backward navigation always
 * succeeds without validation.
 */
function createNavigation(
	node: StepsNode,
	ctx: FieldContext,
): NavigationResult {
	const totalSteps = node.steps.length

	// External or internal ref for the current step
	const currentStep = node.currentStepRef ?? ref(0)

	// Pre-compute field keys for each step (used for validation)
	const stepFieldKeys: string[][] = node.steps.map(
		(step) => extractStepFieldKeys(step.fields),
	)

	async function navigate(targetStep: number): Promise<void> {
		const target = Math.max(0, Math.min(totalSteps - 1, targetStep))
		const current = currentStep.value

		// Backward navigation: no validation
		if (target <= current) {
			currentStep.value = target
			return
		}

		// Forward navigation: validate each intermediate step
		for (let i = current; i < target; i++) {
			const stepKeys = stepFieldKeys[i]
			const prefixedKeys = stepKeys.map((k) => ctx.keyPrefix + k)
			const valid = await ctx.validateFields(prefixedKeys)
			if (!valid) {
				// Mark failing step's fields as touched so errors display
				for (const key of prefixedKeys) {
					ctx.touched.value.add(key)
				}
				ctx.touched.value = new Set(ctx.touched.value) // trigger reactivity
				currentStep.value = i
				return
			}
		}

		currentStep.value = target
	}

	function prev(): void {
		if (currentStep.value > 0) {
			currentStep.value -= 1
		}
	}

	return {
		currentStep,
		navigate,
		prev,
		totalSteps,
		stepFieldKeys,
	}
}

// ─── Steps context builder ───────────────────────────────────────────────

/**
 * Build the StepsContext passed to slot callbacks. The context exposes
 * reactive accessors (getter functions) that callers invoke inside their
 * own reactive contexts (computed, watchEffect, etc.) to establish
 * dependencies.
 */
function createStepsContext(
	node: StepsNode,
	currentStep: Ref<number>,
	totalSteps: number,
	navigate: (target: number) => Promise<void>,
	prevFn: () => void,             // ← renamed from `prev`
	triggerSubmit: () => Promise<void>,
): StepsContext {
	const labels = {
		next: node.nextLabel ?? 'Next',
		prev: node.prevLabel ?? 'Previous',
		submit: node.submitLabel ?? 'Submit',
	}

	return {
		currentStep: () => currentStep.value,
		totalSteps,
		steps: node.steps,

		isFirst: () => currentStep.value === 0,
		isLast: () => currentStep.value === totalSteps - 1,

		isStepCurrent: (n) => currentStep.value === n,
		isStepCompleted: (n) => n < currentStep.value,
		isStepReachable: (n) => n <= currentStep.value,

		labels,

		next: () => navigate(currentStep.value + 1),
		prev: prevFn,                     // ← clean assignment
		goTo: navigate,
		submit: triggerSubmit,
	}
}

export { createNavigation, createStepsContext, extractStepFieldKeys }

/**
 * Build the VNode tree for a steps node.
 *
 * The current step's fields are rendered between an indicator (default or
 * slot) above and nav buttons (default or slot) below.
 *
 * Native form submission flows through the type='submit' button on the
 * last step's default nav. For custom nav slots, ctx.submit() routes
 * through the form's triggerSubmit if available.
 */
export function buildSteps(
	node: StepsNode,
	ctx: FieldContext,
	dispatchField: (
		field: FormChild,
		ctx: FieldContext,
		state: FieldContext['state'],
	) => VNode | null,
): VNode {
	const nav = createNavigation(node, ctx)

	async function triggerSubmit(): Promise<void> {
		if (ctx.triggerSubmit) {
			await ctx.triggerSubmit()
		}
	}

	const stepsCtx = createStepsContext(
		node,
		nav.currentStep,
		nav.totalSteps,
		nav.navigate,
		nav.prev,
		triggerSubmit,
	)

	function renderDefaultIndicator(): VNode {
		const text = `Step ${nav.currentStep.value + 1} of ${nav.totalSteps}`
		return h('div', { class: 'vue-dsl-steps-indicator' }, text)
	}

	function renderDefaultNav(): VNode {
		const isFirst = nav.currentStep.value === 0
		const isLast = nav.currentStep.value === nav.totalSteps - 1

		const buttons: VNode[] = []

		buttons.push(h('button', {
			type: 'button',
			class: 'vue-dsl-steps-prev',
			disabled: isFirst,
			onClick: () => nav.prev(),
		}, stepsCtx.labels.prev))

		if (!isLast) {
			buttons.push(h('button', {
				type: 'button',
				class: 'vue-dsl-steps-next',
				onClick: () => nav.navigate(nav.currentStep.value + 1),
			}, stepsCtx.labels.next))
		} else {
			buttons.push(h('button', {
				type: 'submit',
				class: 'vue-dsl-steps-submit',
			}, stepsCtx.labels.submit))
		}

		return h('div', { class: 'vue-dsl-steps-nav' }, buttons)
	}

	const currentStepIndex = nav.currentStep.value
	const currentStep = node.steps[currentStepIndex]
	const currentFields = currentStep
		? currentStep.fields.map((field) =>
			dispatchField(field, ctx, ctx.state),
		).filter((v): v is VNode => v !== null)
		: []

	const indicator: VNode = node.indicatorSlot
		? (node.indicatorSlot(stepsCtx) as VNode)
		: renderDefaultIndicator()

	const navVNode: VNode = node.navSlot
		? (node.navSlot(stepsCtx) as VNode)
		: renderDefaultNav()

	return h('div', {
		class: ['vue-dsl-steps', node.class as string | undefined],
	}, [
		indicator,
		h('div', {
			class: ['vue-dsl-steps-content', node.stepClass as string | undefined],
		}, currentFields),
		navVNode,
	])
}