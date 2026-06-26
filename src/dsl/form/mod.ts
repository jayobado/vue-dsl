// Composable + setup-free engine
export { createFormEngine, useForm } from './use-form.ts'

// Validation helpers
export {
	required,
	custom,
	minLength,
	maxLength,
	pattern,
	min,
	max,
	match,
	validateWithRules,
	validateWithSchema,
} from './validate.ts'

// Public types — node types
export type {
	FormNode,
	FormChild,
	FormController,
	FormEngine,
	UseFormReturn,
	InputNode,
	SelectNode,
	TextareaNode,
	CheckboxNode,
	RadioNode,
	ButtonNode,
	ArrayNode,
	ArrayColumnDef,
	ArrayAddSlotContext,
	ArrayRemoveSlotContext,
	StepsNode,
	StepDef,
	StepsContext,
	SelectOption,
	ValidationRule,
	ClassValue,
	RowType,
} from './types.ts'