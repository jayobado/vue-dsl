import { effectScope, h, onScopeDispose, ref, watch, type Ref, type VNode } from 'vue'
import type {
	FormNode,
	FormChild,
	FormController,
	FormEngine,
	UseFormReturn,
	ArrayNode,
	StepsNode,
	InputNode,
	SelectNode,
	TextareaNode,
	CheckboxNode,
	RadioNode,
	ButtonNode,
} from './types.ts'
import type { FieldContext, FieldRuleSet } from './context.ts'
import { validateWithRules, validateWithSchema } from './validate.ts'
import { buildArray } from './array.ts'
import { buildSteps } from './steps.ts'

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Coerce a raw input value based on the input type. Number and range
 * inputs produce numbers (or null for empty/invalid); all others pass
 * through as strings.
 */
function coerceInputValue(
	raw: string,
	inputType: string | undefined,
): unknown {
	if (inputType !== 'number' && inputType !== 'range') return raw
	if (raw === '') return null
	const n = Number(raw)
	return Number.isNaN(n) ? null : n
}

/**
 * Get a value from state at a dotted key path.
 *
 * Examples:
 *   getValueAtKey({ email: 'a' }, 'email')                  → 'a'
 *   getValueAtKey({ items: [{ qty: 1 }] }, 'items.0.qty')  → 1
 */
function getValueAtKey(state: Record<string, unknown>, key: string): unknown {
	if (key === '') return undefined
	const segments = key.split('.')
	let current: unknown = state
	for (const segment of segments) {
		if (current === null || current === undefined) return undefined
		if (typeof current !== 'object') return undefined
		current = (current as Record<string, unknown>)[segment]
	}
	return current
}

/**
 * Apply a class value (string or array of strings) to props' class field.
 */
function classProp(...values: Array<string | readonly string[] | null | undefined>): string {
	const parts: string[] = []
	for (const v of values) {
		if (!v) continue
		if (typeof v === 'string') {
			parts.push(v)
		} else {
			for (const item of v) {
				if (item) parts.push(item)
			}
		}
	}
	return parts.join(' ')
}

// ─── Rule-set extraction ─────────────────────────────────────────────────

/**
 * Walk the node tree to collect all field rule sets for rule-based
 * validation. Handles top-level fields, fields inside array rows (with
 * dynamic keys based on current array length), and fields inside steps.
 */
function collectRuleSets(
	children: readonly FormChild[],
	state: Record<string, unknown>,
	prefix: string = '',
): FieldRuleSet[] {
	const sets: FieldRuleSet[] = []

	for (const child of children) {
		if (child.node === 'button') continue

		if (child.node === 'array') {
			collectArrayRuleSets(child, state, prefix, sets)
			continue
		}

		if (child.node === 'steps') {
			for (const step of child.steps) {
				sets.push(...collectRuleSets(step.fields, state, prefix))
			}
			continue
		}

		const fullKey = prefix + child.name
		const required = child.required === true
		const rules = child.rules ?? []

		if (rules.length === 0 && !required) continue

		sets.push({
			name: fullKey,
			rules,
			isRequired: required,
			getValue: (s) => getValueAtKey(s, fullKey),
		})
	}

	return sets
}

function collectArrayRuleSets(
	node: ArrayNode,
	state: Record<string, unknown>,
	prefix: string,
	sets: FieldRuleSet[],
): void {
	const arrayKey = prefix + node.name
	const arrayValue = getValueAtKey(state, arrayKey)
	if (!Array.isArray(arrayValue)) return

	for (let i = 0; i < arrayValue.length; i++) {
		const rowPrefix = `${arrayKey}.${i}.`
		for (const column of node.columns) {
			const rowFields = [column.field as FormChild]
			sets.push(...collectRuleSets(rowFields, state, rowPrefix))
		}
	}
}

/**
 * Collect all field keys for "touch all on submit" — every field, regardless
 * of whether it has rules or is required. Used to make all errors visible
 * after a submit attempt.
 */
function collectAllFieldKeys(
	children: readonly FormChild[],
	state: Record<string, unknown>,
	prefix: string = '',
): string[] {
	const keys: string[] = []

	for (const child of children) {
		if (child.node === 'button') continue

		if (child.node === 'array') {
			const arrayKey = prefix + child.name
			const array = getValueAtKey(state, arrayKey)
			if (Array.isArray(array)) {
				for (let i = 0; i < array.length; i++) {
					const rowPrefix = `${arrayKey}.${i}.`
					for (const column of child.columns) {
						keys.push(...collectAllFieldKeys([column.field as FormChild], state, rowPrefix))
					}
				}
			}
			continue
		}

		if (child.node === 'steps') {
			for (const step of child.steps) {
				keys.push(...collectAllFieldKeys(step.fields, state, prefix))
			}
			continue
		}

		keys.push(prefix + child.name)
	}

	return keys
}

// ─── Error display helper ────────────────────────────────────────────────

function shouldShowError(
	ctx: FieldContext,
	key: string,
	showErrorsEager: boolean | undefined,
): boolean {
	if (showErrorsEager === true) return true
	return ctx.touched.value.has(key)
}

// ─── Field render functions ──────────────────────────────────────────────

function renderInput(node: InputNode, ctx: FieldContext): VNode {
	const fullKey = ctx.keyPrefix + node.name
	const value = ctx.state.value[node.name]
	const error = ctx.errors.value[fullKey]
	const showErr = shouldShowError(ctx, fullKey, node.showErrorsEager)

	const isDisabled = node.disabled
		? node.disabled(ctx.state.value as Record<string, unknown>)
		: false

	const inputProps: Record<string, unknown> = {
		type: node.type ?? 'text',
		name: fullKey,
		value: value ?? '',
		disabled: isDisabled,
		required: node.required ?? false,
		class: classProp(node.inputClass),
		placeholder: node.placeholder,
		autocomplete: node.autocomplete,
		min: node.min,
		max: node.max,
		step: node.step,
		onInput: (e: Event) => {
			const target = e.target as HTMLInputElement
			const coerced = coerceInputValue(target.value, node.type)
			ctx.state.value[node.name] = coerced
		},
		onBlur: () => ctx.onBlur(fullKey),
	}

	return h('label', { class: classProp('vue-dsl-field', node.class) }, [
		node.label ? h('span', { class: 'vue-dsl-field-label' }, node.label) : null,
		h('input', inputProps),
		showErr && error
			? h('span', { class: classProp('vue-dsl-field-error', node.errorClass) }, error)
			: null,
	])
}

function renderSelect(node: SelectNode, ctx: FieldContext): VNode {
	const fullKey = ctx.keyPrefix + node.name
	const value = ctx.state.value[node.name]
	const error = ctx.errors.value[fullKey]
	const showErr = shouldShowError(ctx, fullKey, node.showErrorsEager)

	const isDisabled = node.disabled
		? node.disabled(ctx.state.value as Record<string, unknown>)
		: false

	const optionVNodes: VNode[] = []

	if (node.placeholder) {
		optionVNodes.push(h('option', {
			value: '',
			disabled: true,
		}, node.placeholder))
	}

	for (const option of node.options) {
		optionVNodes.push(h('option', {
			value: option.value,
			disabled: option.disabled ?? false,
		}, option.label))
	}

	const selectProps: Record<string, unknown> = {
		name: fullKey,
		value: value ?? '',
		disabled: isDisabled,
		required: node.required ?? false,
		class: classProp(node.inputClass),
		onChange: (e: Event) => {
			const target = e.target as HTMLSelectElement
			ctx.state.value[node.name] = target.value
		},
		onBlur: () => ctx.onBlur(fullKey),
	}

	return h('label', { class: classProp('vue-dsl-field', node.class) }, [
		node.label ? h('span', { class: 'vue-dsl-field-label' }, node.label) : null,
		h('select', selectProps, optionVNodes),
		showErr && error
			? h('span', { class: classProp('vue-dsl-field-error', node.errorClass) }, error)
			: null,
	])
}

function renderTextarea(node: TextareaNode, ctx: FieldContext): VNode {
	const fullKey = ctx.keyPrefix + node.name
	const value = ctx.state.value[node.name]
	const error = ctx.errors.value[fullKey]
	const showErr = shouldShowError(ctx, fullKey, node.showErrorsEager)

	const isDisabled = node.disabled
		? node.disabled(ctx.state.value as Record<string, unknown>)
		: false

	const textareaProps: Record<string, unknown> = {
		name: fullKey,
		value: value ?? '',
		disabled: isDisabled,
		required: node.required ?? false,
		rows: node.rows,
		cols: node.cols,
		placeholder: node.placeholder,
		class: classProp(node.inputClass),
		onInput: (e: Event) => {
			const target = e.target as HTMLTextAreaElement
			ctx.state.value[node.name] = target.value
		},
		onBlur: () => ctx.onBlur(fullKey),
	}

	return h('label', { class: classProp('vue-dsl-field', node.class) }, [
		node.label ? h('span', { class: 'vue-dsl-field-label' }, node.label) : null,
		h('textarea', textareaProps),
		showErr && error
			? h('span', { class: classProp('vue-dsl-field-error', node.errorClass) }, error)
			: null,
	])
}

function renderCheckbox(node: CheckboxNode, ctx: FieldContext): VNode {
	const fullKey = ctx.keyPrefix + node.name
	const value = ctx.state.value[node.name]
	const error = ctx.errors.value[fullKey]
	const showErr = shouldShowError(ctx, fullKey, node.showErrorsEager)

	const isDisabled = node.disabled
		? node.disabled(ctx.state.value as Record<string, unknown>)
		: false

	const inputProps: Record<string, unknown> = {
		type: 'checkbox',
		name: fullKey,
		checked: Boolean(value),
		disabled: isDisabled,
		required: node.required ?? false,
		class: classProp(node.inputClass),
		onChange: (e: Event) => {
			const target = e.target as HTMLInputElement
			ctx.state.value[node.name] = target.checked
		},
		onBlur: () => ctx.onBlur(fullKey),
	}

	return h('label', { class: classProp('vue-dsl-field', 'vue-dsl-field--checkbox', node.class) }, [
		h('input', inputProps),
		node.label ? h('span', { class: 'vue-dsl-field-label' }, node.label) : null,
		showErr && error
			? h('span', { class: classProp('vue-dsl-field-error', node.errorClass) }, error)
			: null,
	])
}

function renderRadio(node: RadioNode, ctx: FieldContext): VNode {
	const fullKey = ctx.keyPrefix + node.name
	const value = ctx.state.value[node.name]
	const error = ctx.errors.value[fullKey]
	const showErr = shouldShowError(ctx, fullKey, node.showErrorsEager)

	const isDisabled = node.disabled
		? node.disabled(ctx.state.value as Record<string, unknown>)
		: false

	const optionVNodes: VNode[] = node.options.map((option) => {
		const optionProps: Record<string, unknown> = {
			type: 'radio',
			name: fullKey,
			value: option.value,
			checked: value === option.value,
			disabled: isDisabled || (option.disabled ?? false),
			class: classProp(node.inputClass),
			onChange: () => {
				ctx.state.value[node.name] = option.value
			},
			onBlur: () => ctx.onBlur(fullKey),
		}
		return h('label', { class: 'vue-dsl-radio-option' }, [
			h('input', optionProps),
			h('span', null, option.label),
		])
	})

	return h('fieldset', { class: classProp('vue-dsl-field', 'vue-dsl-field--radio', node.class) }, [
		node.label ? h('legend', { class: 'vue-dsl-field-label' }, node.label) : null,
		h('div', { class: 'vue-dsl-radio-options' }, optionVNodes),
		showErr && error
			? h('span', { class: classProp('vue-dsl-field-error', node.errorClass) }, error)
			: null,
	])
}

function renderButton(node: ButtonNode, state: Ref<Record<string, unknown>>): VNode {
	const isDisabled = node.disabled
		? node.disabled(state.value)
		: false

	const action = node.action ?? 'button'

	const buttonProps: Record<string, unknown> = {
		type: action,
		disabled: isDisabled,
		class: classProp(node.class),
		onClick: node.onClick
			? (e: Event) => {
				if (action !== 'submit') e.preventDefault()
				node.onClick!(state.value)
			}
			: undefined,
	}

	return h('button', buttonProps, node.label)
}

// ─── Dispatch ────────────────────────────────────────────────────────────

/**
 * Dispatch a single FormChild to its appropriate render function. Returns
 * a VNode for the field's rendered output, or null if the field's `show()`
 * callback returns false.
 */
export function dispatchField(
	child: FormChild,
	ctx: FieldContext,
	state: Ref<Record<string, unknown>>,
): VNode | null {
	if ('show' in child && child.show) {
		const visible = child.show(state.value as Record<string, unknown>)
		if (!visible) return null
	}

	switch (child.node) {
		case 'input': return renderInput(child, ctx)
		case 'select': return renderSelect(child, ctx)
		case 'textarea': return renderTextarea(child, ctx)
		case 'checkbox': return renderCheckbox(child, ctx)
		case 'radio': return renderRadio(child, ctx)
		case 'button': return renderButton(child, state)
		case 'array': return buildArray(child as ArrayNode, ctx, dispatchField)
		case 'steps': return buildSteps(child as StepsNode, ctx, dispatchField)
	}
}

// ─── Form engine ───────────────────────────────────────────────────────────

/**
 * Build a form engine — the setup-free core behind {@link useForm}. Owns its
 * own (detached) effect scope, so it can be created anywhere, including lazily
 * inside a container's content engine where there is no component `setup` to
 * bind the validation watcher to. Call `dispose()` to stop the scope when the
 * owner is done with it ({@link useForm} wires this to `onScopeDispose`; a
 * container engine calls it from its own `dispose`).
 */
export function createFormEngine<TState extends Record<string, unknown>>(
	node: FormNode<TState>,
): FormEngine<TState> {
	const scope = effectScope(true)
	const state = (node.stateRef ?? ref({ ...node.initial })) as Ref<TState>
	const errors = (node.errorsRef ?? ref<Record<string, string>>({})) as Ref<Record<string, string>>
	const touched = ref<Set<string>>(new Set())
	const loading = ref(false)

	async function runValidation(): Promise<Record<string, string>> {
		const stateValue = state.value as Record<string, unknown>

		if (node.schema) {
			const schemaErrors = await validateWithSchema(stateValue, node.schema)
			const ruleSets = collectRuleSets(
				node.children as readonly FormChild[],
				stateValue,
			)
			const ruleErrors = validateWithRules(stateValue, ruleSets)
			return { ...ruleErrors, ...schemaErrors }
		}

		const ruleSets = collectRuleSets(
			node.children as readonly FormChild[],
			stateValue,
		)
		return validateWithRules(stateValue, ruleSets)
	}

	let validationToken = 0
	scope.run(() => {
		watch(
			() => state.value,
			async () => {
				const token = ++validationToken
				const result = await runValidation()
				if (token !== validationToken) return
				errors.value = result
			},
			{ deep: true, immediate: true },
		)
	})

	async function triggerSubmit(): Promise<void> {
		if (loading.value) return

		const allKeys = collectAllFieldKeys(
			node.children as readonly FormChild[],
			state.value as Record<string, unknown>,
		)
		const next = new Set(touched.value)
		for (const k of allKeys) next.add(k)
		touched.value = next

		const finalErrors = await runValidation()
		errors.value = finalErrors

		if (Object.keys(finalErrors).length > 0) return

		loading.value = true
		try {
			await node.onSubmit(state.value)
		} finally {
			loading.value = false
		}
	}

	function reset(): void {
		state.value = { ...node.initial } as TState
		errors.value = {}
		touched.value = new Set()
		loading.value = false
	}

	const controller: FormController = {
		submit: triggerSubmit,
		reset,
	}

	const fieldCtx: FieldContext = {
		state: state as unknown as Ref<Record<string, unknown>>,
		errors,
		touched,
		keyPrefix: '',
		onBlur: (fieldName: string) => {
			if (touched.value.has(fieldName)) return
			const next = new Set(touched.value)
			next.add(fieldName)
			touched.value = next
		},
		validateFields: async (keys: readonly string[]) => {
			const result = await runValidation()
			errors.value = result
			return keys.every((k) => !result[k])
		},
		triggerSubmit,
	}

	function render(): VNode {
		const childVNodes: (VNode | null)[] = (node.children as readonly FormChild[]).map((child) =>
			dispatchField(child, fieldCtx, fieldCtx.state),
		)

		return h('form', {
			class: classProp('vue-dsl-form', node.class),
			onSubmit: (e: Event) => {
				e.preventDefault()
				triggerSubmit()
			},
		}, childVNodes.filter((v): v is VNode => v !== null))
	}

	return {
		state,
		errors,
		touched,
		loading,
		controller,
		render,
		dispose: () => scope.stop(),
	}
}

// ─── useForm composable ──────────────────────────────────────────────────

/**
 * Wrap a form node in a Vue composable. Returns reactive state, errors,
 * touched tracking, loading state, a controller for external submit/reset,
 * and a render function that produces the form's VNode tree.
 *
 * Thin wrapper over {@link createFormEngine}: it binds the engine's `dispose`
 * to the surrounding component scope, so the validation watcher is torn down on
 * unmount. Call it from `setup`. For nesting a form inside a container, the
 * container's content engine calls `createFormEngine` directly and manages
 * disposal itself.
 */
export function useForm<TState extends Record<string, unknown>>(
	node: FormNode<TState>,
): UseFormReturn<TState> {
	const engine = createFormEngine(node)
	onScopeDispose(engine.dispose)
	return engine
}