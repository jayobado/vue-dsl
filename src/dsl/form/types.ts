import type { Ref, VNode } from 'vue'
import type { StandardSchemaV1 } from '@standard-schema/spec'

// ─── Common types ────────────────────────────────────────────────────────

export type ClassValue = string | readonly string[] | null | undefined

export interface SelectOption {
	value: string | number
	label: string
	disabled?: boolean
}

// ─── Validation rules ────────────────────────────────────────────────────

export interface ValidationRule {
	test: (value: unknown) => boolean
	message: string
}

// ─── Field base ──────────────────────────────────────────────────────────

interface FieldBase<TState extends Record<string, unknown>> {
	name: keyof TState & string
	label?: string
	class?: ClassValue
	inputClass?: ClassValue
	errorClass?: ClassValue
	required?: boolean
	rules?: readonly ValidationRule[]
	showErrorsEager?: boolean
	show?: (state: TState) => boolean
	disabled?: (state: TState) => boolean
}

// ─── Field node types ────────────────────────────────────────────────────

export interface InputNode<TState extends Record<string, unknown> = Record<string, unknown>>
	extends FieldBase<TState> {
	node: 'input'
	type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local' | 'month' | 'week' | 'color' | 'range'
	placeholder?: string
	autocomplete?: string
	min?: number | string
	max?: number | string
	step?: number | string
}

export interface SelectNode<TState extends Record<string, unknown> = Record<string, unknown>>
	extends FieldBase<TState> {
	node: 'select'
	options: readonly SelectOption[]
	placeholder?: string
}

export interface TextareaNode<TState extends Record<string, unknown> = Record<string, unknown>>
	extends FieldBase<TState> {
	node: 'textarea'
	rows?: number
	cols?: number
	placeholder?: string
}

export interface CheckboxNode<TState extends Record<string, unknown> = Record<string, unknown>>
	extends FieldBase<TState> {
	node: 'checkbox'
}

export interface RadioNode<TState extends Record<string, unknown> = Record<string, unknown>>
	extends FieldBase<TState> {
	node: 'radio'
	options: readonly SelectOption[]
}

export interface ButtonNode<TState extends Record<string, unknown> = Record<string, unknown>> {
	node: 'button'
	label: string
	action?: 'submit' | 'reset' | 'button'
	class?: ClassValue
	onClick?: (state: TState) => void | Promise<void>
	disabled?: (state: TState) => boolean
	show?: (state: TState) => boolean
}

// ─── Array node ──────────────────────────────────────────────────────────

export interface ArrayColumnDef<TRow extends Record<string, unknown>> {
	header: string
	field: FormChild<TRow>
	class?: ClassValue
	headerClass?: ClassValue
	cellClass?: ClassValue
}

export interface ArrayAddSlotContext {
	onAdd: () => void
}

export interface ArrayRemoveSlotContext<TRow> {
	onRemove: () => void
	row: TRow
	rowIndex: number
}

export type RowType<T, K extends keyof T> = T[K] extends readonly (infer R)[]
	? (R extends Record<string, unknown> ? R : never)
	: never

export interface ArrayNode<TState extends Record<string, unknown> = Record<string, unknown>,
	TName  extends keyof TState & string  = keyof TState & string> 
{
	node: 'array'
	name: TName
	rowKey: (row: RowType<TState, TName>, index: number) => string | number
	columns: readonly ArrayColumnDef<RowType< TState, TName >> []
	allowAdd ?: boolean
	allowRemove ?: boolean
	addLabel ?: string
	removeLabel ?: string
	newRow ?: () => RowType<TState, TName>
	class?: ClassValue
	rowClass ?: ClassValue
	emptyMessage ?: string
	addSlot ?: (ctx: ArrayAddSlotContext) => VNode
	removeSlot ?: (ctx: ArrayRemoveSlotContext<RowType<TState, TName>>) => VNode
	show ?: (state: TState) => boolean
}

// ─── Steps node ──────────────────────────────────────────────────────────

export interface StepDef<TState extends Record<string, unknown> = Record<string, unknown>> {
	label?: string
	fields: readonly FormChild<TState>[]
}

export interface StepsContext<TState extends Record<string, unknown> = Record<string, unknown>> {
	currentStep: () => number
	totalSteps: number
	steps: readonly StepDef<TState>[]

	isFirst: () => boolean
	isLast: () => boolean

	isStepCurrent: (step: number) => boolean
	isStepCompleted: (step: number) => boolean
	isStepReachable: (step: number) => boolean

	labels: {
		next: string
		prev: string
		submit: string
	}

	next: () => Promise<void>
	prev: () => void
	goTo: (step: number) => Promise<void>
	submit: () => Promise<void>
}

export interface StepsNode<TState extends Record<string, unknown> = Record<string, unknown>> {
	node: 'steps'
	steps: readonly StepDef<TState>[]
	currentStepRef?: Ref<number>
	class?: ClassValue
	stepClass?: ClassValue
	nextLabel?: string
	prevLabel?: string
	submitLabel?: string
	indicatorSlot?: (ctx: StepsContext<TState>) => unknown
	navSlot?: (ctx: StepsContext<TState>) => unknown
	show?: (state: TState) => boolean
}

// ─── FormChild union ─────────────────────────────────────────────────────

export type FormChild<TState extends Record<string, unknown> = Record<string, unknown>> =
	| InputNode<TState>
	| SelectNode<TState>
	| TextareaNode<TState>
	| CheckboxNode<TState>
	| RadioNode<TState>
	| ArrayNode<TState>
	| StepsNode<TState>
	| ButtonNode<TState>

// ─── Form node ───────────────────────────────────────────────────────────

export interface FormController {
	submit: () => Promise<void>
	reset: () => void
}

export interface FormNode<TState extends Record<string, unknown> = Record<string, unknown>> {
	node: 'form'
	initial: TState
	children: readonly FormChild<TState>[]
	onSubmit: (state: TState) => void | Promise<void>
	schema?: StandardSchemaV1<unknown, TState>
	stateRef?: Ref<TState>
	errorsRef?: Ref<Record<string, string>>
	class?: ClassValue
}

// ─── useForm return ──────────────────────────────────────────────────────

export interface UseFormReturn<TState extends Record<string, unknown>> {
	state: Ref<TState>
	errors: Ref<Record<string, string>>
	touched: Ref<Set<string>>
	loading: Ref<boolean>
	controller: FormController
	render: () => unknown
}