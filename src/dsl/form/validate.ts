import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { FieldRuleSet } from './context.ts'
import type { ValidationRule } from "./types.ts";

// ─── Built-in rule helpers ───────────────────────────────────────────────

/**
 * A rule that fails when the value is empty.
 *
 * Empty values: null, undefined, empty string, empty array, empty object.
 * Whitespace-only strings count as empty.
 */
export function required(message = 'This field is required'): ValidationRule {
	return {
		test: (value) => !isEmpty(value),
		message,
	}
}

/**
 * Wrap an arbitrary predicate as a rule.
 */
export function custom(
	test: (value: unknown) => boolean,
	message: string,
): ValidationRule {
	return { test, message }
}

// ─── Declarative rule helpers ──────────────────────────────────────────────
//
// Each returns a {@link ValidationRule} to drop into a field's `rules` array.
// Like all non-required rules, they're skipped for empty optional fields (see
// `validateWithRules`), so pair them with `required()` for mandatory fields.

const len = (value: unknown): number | null =>
	typeof value === 'string' || Array.isArray(value) ? value.length : null

/** Fails when a string/array is shorter than `n`. */
export function minLength(n: number, message = `Must be at least ${n} characters`): ValidationRule {
	return { test: (value) => { const l = len(value); return l === null || l >= n }, message }
}

/** Fails when a string/array is longer than `n`. */
export function maxLength(n: number, message = `Must be at most ${n} characters`): ValidationRule {
	return { test: (value) => { const l = len(value); return l === null || l <= n }, message }
}

/** Fails when a string doesn't match `regex`. */
export function pattern(regex: RegExp, message = 'Invalid format'): ValidationRule {
	return { test: (value) => typeof value !== 'string' || regex.test(value), message }
}

/** Fails when a number is below `n`. */
export function min(n: number, message = `Must be at least ${n}`): ValidationRule {
	return { test: (value) => typeof value !== 'number' || value >= n, message }
}

/** Fails when a number is above `n`. */
export function max(n: number, message = `Must be at most ${n}`): ValidationRule {
	return { test: (value) => typeof value !== 'number' || value <= n, message }
}

/**
 * Fails when the value doesn't equal an expected value. Pass a getter so it
 * reads the latest value at validation time — e.g. cross-field confirmation:
 * `match(() => state.value.password, 'Passwords must match')`.
 */
export function match(getExpected: () => unknown, message = 'Values do not match'): ValidationRule {
	return { test: (value) => value === getExpected(), message }
}

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true
	if (typeof value === 'string') return value.trim() === ''
	if (Array.isArray(value)) return value.length === 0
	if (value instanceof Set || value instanceof Map) return value.size === 0
	if (typeof value === 'object') return Object.keys(value).length === 0
	return false
}

// ─── Rule-based validation ───────────────────────────────────────────────

/**
 * Validate state against a list of field rule sets. Returns a map of field
 * names to error messages (only fields with errors are included).
 *
 * For each rule set:
 *   - If the field is required and the value is empty, emit a "required" error.
 *   - Otherwise, run each rule's test against the value. First failing rule
 *     wins (rules are checked in order, validation stops on first failure).
 */
export function validateWithRules(
	state: Record<string, unknown>,
	ruleSets: readonly FieldRuleSet[],
): Record<string, string> {
	const errors: Record<string, string> = {}

	for (const ruleSet of ruleSets) {
		const value = ruleSet.getValue(state)

		// Required check (separate from rules — required is a built-in concept)
		if (ruleSet.isRequired && isEmpty(value)) {
			errors[ruleSet.name] = findRequiredMessage(ruleSet.rules) ?? 'This field is required'
			continue
		}

		// If field is empty and not required, skip rules — rules don't apply
		// to empty optional fields
		if (isEmpty(value) && !ruleSet.isRequired) {
			continue
		}

		// Run rules in order, stop at first failure
		for (const rule of ruleSet.rules) {
			if (!rule.test(value)) {
				errors[ruleSet.name] = rule.message
				break
			}
		}
	}

	return errors
}

function findRequiredMessage(rules: readonly ValidationRule[]): string | undefined {
	// If a `required(msg)` rule is in the list, use its custom message.
	// We detect it heuristically — there's no marker on the rule object.
	// We look for any rule whose message matches the default OR is explicit.
	// In practice, the consumer's first rule is usually `required(msg)`, so
	// we return the first rule's message as a best-effort.
	const first = rules[0]
	return first?.message
}

// ─── Schema-based validation ─────────────────────────────────────────────

/**
 * Validate state against a Standard Schema. Returns a map of error paths
 * to error messages.
 *
 * Schema-reported error paths use dot-joined notation matching the field
 * key conventions:
 *   - Top-level field:  'email'
 *   - Array row field:  'lineItems.2.quantity'
 *
 * If schema validation passes, returns an empty object.
 */
export async function validateWithSchema(
	state: Record<string, unknown>,
	schema: StandardSchemaV1<unknown, unknown>,
): Promise<Record<string, string>> {
	const result = await schema['~standard'].validate(state)

	if (!result.issues) {
		return {}
	}

	const errors: Record<string, string> = {}
	for (const issue of result.issues) {
		const key = issueToKey(issue.path)
		// Don't overwrite: keep the first error per path
		if (!(key in errors)) {
			errors[key] = issue.message
		}
	}
	return errors
}

/**
 * Convert a Standard Schema path (array of strings/numbers, or path segments)
 * to our dot-joined key format.
 *
 * Examples:
 *   ['email']                            → 'email'
 *   ['lineItems', 2, 'quantity']         → 'lineItems.2.quantity'
 *   [{ key: 'lineItems' }, { key: 2 }]   → 'lineItems.2'
 */
function issueToKey(
	path: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined,
): string {
	if (!path || path.length === 0) return ''

	return path
		.map((segment) => {
			if (typeof segment === 'object' && segment !== null && 'key' in segment) {
				return String(segment.key)
			}
			return String(segment)
		})
		.join('.')
}