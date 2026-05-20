# The declarative layer

vue-dsl's declarative layer captures patterns that benefit from being
described as data structures rather than nested Vue components. Right now
that's **forms**, **tables**, **multi-row sections**, and **multi-step
flows** — each as a node type you describe, with a composable that produces
the rendered VNodes.

Read [Concepts](concepts.md) first if you haven't — declarative node trees,
the composable return shape, reactive validation with touched gating,
controllers, optional refs, and slot contexts are all assumed.

## What the declarative layer is for

Some UI patterns have real complexity that's tedious to write as nested Vue
components and easy to get wrong:

- Forms: state per field, validation timing, error display, schema
  integration, submit lifecycle.
- Tables: data flow, sort state, pagination, loading/empty/error states,
  row interaction.
- Tabular forms (array nodes): all of the above plus deep state indexing —
  row N's `quantity` field lives at `state.lineItems[N].quantity`.
- Wizards (steps nodes): per-step validation, navigation, branching.

Without the declarative layer, each requires significant boilerplate per
use. Get one detail wrong (a watcher subscribes too eagerly, an error path
doesn't map to the right field, an array reactivity boundary leaks) and you
have a subtle bug.

The declarative layer absorbs that complexity. You describe the shape; the
composable handles the wiring.

## What it isn't

To keep expectations honest:

- **Not a Vue component model.** Node trees aren't reusable components. If
  you want a reusable widget, write a Vue component (`defineComponent(...)`)
  — that's the right idiom in this codebase.
- **Not the only way to build UI.** Forms and tables benefit from being
  declarative because they're complex. Most of your app's UI will be Vue
  components and template/render code. The declarative layer is for the
  patterns where it earns its place.
- **Not extensible by consumers.** You can't add your own node types. The
  set is what ships: form, input, select, textarea, checkbox, radio, button,
  array, steps, table. New nodes get added when there's a clear pattern that
  earns one.

## Forms

A form node has state (an object), children (field definitions), validation
configuration, and a submit handler.

### Minimal form

```typescript
import { defineComponent, h } from 'vue'
import { useForm } from '@/lib/vue-dsl/dsl'

interface SignupState {
	email:    string
	password: string
}

export const SignupView = defineComponent({
	setup() {
		const form = useForm<SignupState>({
			initial: { email: '', password: '' },
			onSubmit: async (state) => {
				await api.signup(state)
			},
			children: [
				{ type: 'input',  name: 'email',    label: 'Email',    inputType: 'email', required: true },
				{ type: 'input',  name: 'password', label: 'Password', inputType: 'password', required: true },
				{ type: 'button', label: 'Sign up', action: 'submit' },
			],
		})

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'Sign up'),
			form.render(),
		])
	},
})
```

`useForm` takes a node tree and returns a `{ state, errors, touched, loading,
controller, render }` object. Embed `render()` in your component's output.
The form manages its own internal state by default; pass `stateRef` /
`errorsRef` if you want to drive state from outside.

### Field types

The DSL ships seven field types, each with its own node shape:

- **`input`** — `<input>` for text, email, password, number, date, etc.
- **`select`** — `<select>` with options.
- **`textarea`** — `<textarea>`.
- **`checkbox`** — single `<input type="checkbox">`.
- **`radio`** — group of `<input type="radio">` with options.
- **`button`** — `<button>` (submit, reset, or arbitrary action).
- **`array`** — tabular section (see [Composition](#composition) below).
- **`steps`** — multi-step flow (see [Composition](#composition) below).

All field types share a common base: `name` (required, must be a key of
TState), `label` (optional), `class` / `inputClass` / `errorClass` (optional
class names), `required` (optional), `rules` (optional validation rules),
`showErrorsEager` (optional opt-out of touched gating), `show` / `disabled`
(optional conditional rendering and state).

#### Input

```typescript
{
	type:      'input',
	name:      'email',
	label:     'Email',
	inputType: 'email',           // text | email | password | number | tel | url | search
	                              //   | date | time | datetime-local | month | week
	                              //   | color | range
	placeholder:  'you@example.com',
	autocomplete: 'email',        // standard HTML AutoFill values
	required:     true,
	class:        'field',
	inputClass:   'field-input',
	errorClass:   'field-error',
}
```

Number and range inputs coerce values to `number` or `null` (when empty)
before writing to state. All other input types pass values through as
strings.

#### Select

```typescript
{
	type:    'select',
	name:    'role',
	label:   'Role',
	options: [
		{ value: 'admin',  label: 'Admin' },
		{ value: 'member', label: 'Member' },
	],
	placeholder: 'Choose a role',  // shows as a disabled, pre-selected option
}
```

#### Textarea, checkbox, radio, button

These follow predictable shapes — textarea adds `rows`, checkbox is just the
base field, radio adds `options` like select, button has `label`, `action`
(submit / reset / button), `onClick`, and an optional `disabled` callback.

Look at the source for full shapes; the types are descriptive.

### Validation: schema vs. rules

Forms support two validation systems. Use **schema** when you want
full-state validation matching the form's data shape. Use **rules** when you
want per-field checks that don't need a full schema.

#### Schema validation

Plug in any [Standard Schema](https://standardschema.dev)-compatible
validator — Zod, Valibot, ArkType all work:

```typescript
import { z } from 'zod'

const signupSchema = z.object({
	email:    z.string().email(),
	password: z.string().min(8, 'At least 8 characters'),
})

type SignupState = z.infer<typeof signupSchema>

useForm<SignupState>({
	initial:  { email: '', password: '' },
	schema:   signupSchema,
	onSubmit: async (state) => { /* state is fully validated */ },
	children: [
		{ type: 'input', name: 'email',    label: 'Email',    inputType: 'email' },
		{ type: 'input', name: 'password', label: 'Password', inputType: 'password' },
	],
})
```

Schema validation runs reactively whenever state changes. Errors are mapped
to fields by name (with deep dot-joined paths for array contents) and
displayed inline below each field — but only for fields in the `touched`
set. On submit, all fields are marked touched, so any remaining errors
become visible.

If schema validation fails, `onSubmit` doesn't fire.

#### Rule-based validation

For simpler cases, attach `rules` directly to a field:

```typescript
import { required, custom } from '@/lib/vue-dsl/dsl'

{
	type:  'input',
	name:  'username',
	label: 'Username',
	rules: [
		required('Username is required'),
		custom((v) => typeof v === 'string' && v.length >= 3, 'At least 3 characters'),
	],
}
```

`required(msg)` and `custom(test, msg)` are the built-in helpers. You can
also write your own rule objects:

```typescript
const noSpaces = {
	test:    (v: unknown) => typeof v === 'string' && !v.includes(' '),
	message: 'No spaces allowed',
}

// Then: rules: [noSpaces]
```

#### When to use which

- **Schema** when your validation is non-trivial (regex, cross-field rules,
  custom error messages, type narrowing). Define it once, get types +
  runtime validation + a single source of truth.
- **Rules** when you have a single field with a one-off check ("at least 3
  characters") and don't want to set up a schema for the whole form.

You can use both. Schema validation runs first if both are present — the
rules act as a backstop when no schema is set.

### State and error refs

The form owns its state internally by default. If you want to read or write
state from outside the form, pass in your own refs:

```typescript
import { ref } from 'vue'

const formState  = ref<SignupState>({ email: '', password: '' })
const formErrors = ref<Record<string, string>>({})

const form = useForm<SignupState>({
	stateRef:  formState,
	errorsRef: formErrors,
	initial:   formState.value,
	onSubmit:  async (state) => { /* ... */ },
	children:  [/* ... */],
})

// Now you can read formState anywhere reactively:
watchEffect(() => {
	console.log('Current state:', formState.value)
})
```

This is useful when the form's state needs to drive other UI — a preview
panel, a sidebar summary, dirty-tracking, etc. The state ref must be
deeply reactive — use `ref({...})`, not `shallowRef`.

### The form controller

The controller pattern gives you external submit/reset:

```typescript
const form = useForm<SignupState>({
	initial:  { email: '', password: '' },
	onSubmit: async (state) => { /* ... */ },
	children: [/* no submit button */],
})

// Trigger submission from anywhere:
form.controller.submit()
form.controller.reset()
```

You'd use this when the submit button lives outside the form's children —
say, in a sticky action bar at the bottom of the page, or in a parent
dialog. The controller is wired automatically by the composable — no need
to create or pass one in.

## Tables

A table node renders rows of data from a query, with columns, optional
sort, optional pagination, and slots for the loading/empty/error states.

### Minimal table

```typescript
import { useTable } from '@/lib/vue-dsl/dsl'
import { useQuery } from '@/lib/vue-dsl/query'

interface User {
	id:    string
	name:  string
	email: string
	role:  string
}

const usersQuery = useQuery(() => api.users.list())

const table = useTable<User>({
	query:   usersQuery,
	rows:    (data) => data,
	rowKey:  (u) => u.id,
	columns: [
		{ key: 'name',  header: 'Name' },
		{ key: 'email', header: 'Email' },
		{ key: 'role',  header: 'Role' },
	],
})

// In setup's return:
return () => h('div', null, [
	h('h1', null, 'Users'),
	table.render(),
])
```

The table reads `query.data`, `query.loading`, `query.error` reactively.
First-load shows a loading state; refetches keep the existing data and add a
`vue-dsl-table--refetching` class to the root for CSS-driven indicators.

### The `query` and `rows` extractor

The table consumes a query (what `useQuery` produces). The `rows` extractor
pulls the array of rows from `query.data`. For the simplest case (the query
returns the rows array directly), it's just `(data) => data`.

When the query returns paginated data, `rows` extracts the rows portion:

```typescript
const usersQuery = useQuery(() => api.users.list({
	page:     page.value,
	pageSize: 20,
}))
// usersQuery.data: Ref<{ rows: User[], totalRows: number } | undefined>

useTable<User, { rows: User[]; totalRows: number }>({
	query: usersQuery,
	rows:  (data) => data.rows,
	// ...
	pagination: {
		pageRef:   page,
		pageSize:  20,
		totalRows: (data) => data.totalRows,
	},
})
```

The generic `<TRow, TData>` separates "the row type" from "what the query
returns." `useTable<User, ...>(node)` lets TypeScript infer both.

### Columns

```typescript
{
	key:         'role',           // optional — for sorting and default cell content
	header:      'Role',           // required — column header text
	class:       'col-role',       // optional — applied to both header and cells
	headerClass: 'col-role-header', // optional — applied to header only
	cellClass:   'col-role-cell',   // optional — applied to cells only
	sortable:    true,             // optional — makes column click-to-sort (requires `key`)
	render:      (row) => h('span', { class: 'badge' }, row.role),
	                             // optional — custom cell content
}
```

A column without `key` is a virtual column — it has no data field, must
provide `render`, and can't be sorted. Useful for action columns:

```typescript
{
	header: 'Actions',
	render: (row) => h('button', {
		class: 'btn-link',
		onClick: () => editUser(row),
	}, 'Edit'),
}
```

### Sort

Sort lives outside the table as a ref you pass in via `sortRef`. The table
reads it to show which column is currently sorted, and writes to it when the
user clicks a sortable header:

```typescript
import { ref } from 'vue'
import type { SortState } from '@/lib/vue-dsl/dsl'

const sort = ref<SortState<User> | null>(null)

const usersQuery = useQuery(() => api.users.list({
	sortBy:    sort.value?.field,
	direction: sort.value?.direction,
}))

useTable<User>({
	query:   usersQuery,
	rows:    (data) => data,
	rowKey:  (u) => u.id,
	sortRef: sort,
	columns: [
		{ key: 'name',  header: 'Name',  sortable: true },
		{ key: 'email', header: 'Email', sortable: true },
		{ key: 'role',  header: 'Role',  sortable: true },
	],
})
```

The header gets `data-sort="asc"` or `data-sort="desc"` when active — style
indicators with CSS:

```css
th[data-sortable] { cursor: pointer; }
th[data-sort="asc"]::after  { content: " ↑"; }
th[data-sort="desc"]::after { content: " ↓"; }
```

Click cycles through asc → desc → null (no sort). Clicking a different
sortable column starts at asc on that column.

Because sort lives outside the table, the query refetches automatically when
the user changes it — `useQuery` re-runs `() => api.users.list({...})`
because `sort.value` was read inside the callback.

### Pagination

Same pattern as sort — pagination state lives outside, the table renders the
UI and writes to the `pageRef`:

```typescript
const page = ref(1)

const usersQuery = useQuery(() => api.users.list({
	page:     page.value,
	pageSize: 20,
}))

useTable({
	query: usersQuery,
	rows:  (data) => data.rows,
	pagination: {
		pageRef:   page,
		pageSize:  20,
		totalRows: (data) => data.totalRows,
	},
	// ...
})
```

The default pagination UI is a prev/next bar with the current page number.
Override via `paginationSlot` if you want page numbers, a page-size
selector, or a different layout:

```typescript
paginationSlot: (info) => {
	const buttons = []
	for (let i = 1; i <= info.totalPages; i++) {
		buttons.push(h('button', {
			type: 'button',
			class: i === info.page ? 'page-current' : 'page',
			onClick: () => info.goTo(i),
		}, String(i)))
	}
	return h('div', { class: 'pagination-fancy' }, buttons)
},
```

`info` includes `page`, `totalPages`, `totalRows`, `pageSize`, `canNext`,
`canPrev`, `goTo`, `next`, `prev`.

### State slots

Default loading/empty/error states are minimal. Override them:

```typescript
{
	// ...
	loadingSlot: () => h('div', { class: 'spinner' }),
	emptySlot:   () => h('div', { class: 'empty' }, 'No users yet'),
	errorSlot:   (err) => h('div', { class: 'error' }, `Failed: ${err.message}`),
}
```

The loading slot only shows on first load (when `loading.value === true`
and `data.value === undefined`). On refetch, the table keeps showing the
previous data and adds the `vue-dsl-table--refetching` class to its root
for CSS-driven indicators.

### Row clicks

```typescript
{
	onRowClick: (row) => router.push(`/users/${row.id}`),
	// ...
}
```

Clicks on `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`, or
`<label>` elements inside a row don't trigger the row click — the engine
checks the event target and ignores interactive elements. This is what you
want when rows have action columns.

## Composition

Two specialized nodes compose with the form DSL to handle common shapes:
**arrays** for tabular sections, **steps** for multi-step flows.

### Array nodes

An `array` child of a form renders a tabular section where rows correspond
to items in a state array. The classic example is a purchase order with line
items:

```typescript
interface LineItem {
	id:          string
	sku:         string
	description: string
	quantity:    number
	unitPrice:   number
}

interface PurchaseOrder {
	vendor:    string
	date:      string
	notes:     string
	lineItems: LineItem[]
}

useForm<PurchaseOrder>({
	initial: { vendor: '', date: '', notes: '', lineItems: [] },
	schema:  purchaseOrderSchema,
	onSubmit: async (po) => { await api.purchaseOrders.create(po) },
	children: [
		{ type: 'input',    name: 'vendor', label: 'Vendor' },
		{ type: 'input',    name: 'date',   label: 'Date', inputType: 'date' },
		{ type: 'textarea', name: 'notes',  label: 'Notes', rows: 3 },
		{
			type:        'array',
			name:        'lineItems',
			rowKey:      (item) => item.id,
			allowAdd:    true,
			allowRemove: true,
			newRow:      () => ({
				id:          crypto.randomUUID(),
				sku:         '',
				description: '',
				quantity:    1,
				unitPrice:   0,
			}),
			columns: [
				{ header: 'SKU',         field: { type: 'input', name: 'sku' } },
				{ header: 'Description', field: { type: 'input', name: 'description' } },
				{ header: 'Qty',         field: { type: 'input', name: 'quantity',  inputType: 'number' } },
				{ header: 'Unit Price',  field: { type: 'input', name: 'unitPrice', inputType: 'number' } },
			],
		},
		{ type: 'button', label: 'Submit order', action: 'submit' },
	],
})
```

The array node:

- Maps each item in `state.lineItems` to a row.
- Renders columns by repeating the field defs per row.
- Handles deep state indexing — typing in row 2's "Qty" cell writes to
  `state.value.lineItems[2].quantity`.
- Handles error paths — schema errors at `['lineItems', 2, 'quantity']` map
  to the right row's right cell, gated by touched state for that path.
- Renders add/remove UI when `allowAdd` / `allowRemove` are set, using
  `newRow` to generate fresh items.

Each row is wrapped in its own Vue component internally — adding or removing
a row only re-renders affected rows, not the whole array. This matters for
arrays with many items.

#### Slots for custom add/remove UI

The default add button is a plain `<button>` labeled "Add" below the table.
For a stylized button or a different position, use `addSlot`:

```typescript
{
	type:  'array',
	name:  'lineItems',
	// ...
	addSlot: ({ onAdd }) => {
		return h('button', {
			class: 'btn btn-secondary',
			type:  'button',
			onClick: onAdd,
		}, [
			h('span', { class: 'icon-plus' }),
			' Add line item',
		])
	},
}
```

Similarly for `removeSlot`:

```typescript
removeSlot: ({ onRemove, row, rowIndex }) => {
	return h('button', {
		class:   'btn-icon',
		type:    'button',
		onClick: onRemove,
		title:   `Remove row ${rowIndex + 1}`,
	}, h('span', { class: 'icon-trash' }))
}
```

#### Validation in array rows

Schema validation works as expected — the schema describes the array
(`z.array(lineItemSchema)`) and errors get mapped to the right cells, gated
by touched state for each row's fields.

Per-field `rules` arrays also work on array-row fields. The engine walks
the node tree at validation time, generating rule entries with deep-path
keys for each current row.

### Steps nodes

A `steps` child of a form splits the form into pages. The user sees one
step at a time, navigates with prev/next/submit buttons, and only triggers
`onSubmit` when they complete the last step.

```typescript
interface SignupState {
	email:           string
	password:        string
	confirmPassword: string
	name:            string
	role:            string
	newsletter:      boolean
}

useForm<SignupState>({
	initial:  {
		email: '', password: '', confirmPassword: '',
		name:  '', role:     'member', newsletter: false,
	},
	schema:   signupSchema,
	onSubmit: async (state) => { await api.signup(state) },
	children: [
		{
			type: 'steps',
			steps: [
				{
					label: 'Account',
					fields: [
						{ type: 'input', name: 'email',           label: 'Email',            inputType: 'email' },
						{ type: 'input', name: 'password',        label: 'Password',         inputType: 'password' },
						{ type: 'input', name: 'confirmPassword', label: 'Confirm password', inputType: 'password' },
					],
				},
				{
					label: 'Profile',
					fields: [
						{ type: 'input',  name: 'name', label: 'Name' },
						{ type: 'select', name: 'role', label: 'Role', options: [
							{ value: 'admin',  label: 'Admin' },
							{ value: 'member', label: 'Member' },
						]},
					],
				},
				{
					label: 'Preferences',
					fields: [
						{ type: 'checkbox', name: 'newsletter', label: 'Subscribe to newsletter' },
					],
				},
			],
			nextLabel:   'Continue',
			prevLabel:   'Back',
			submitLabel: 'Create account',
		},
	],
})
```

#### Navigation

The default UI is "Step N of M" indicator above, prev/next/submit buttons
below. The user clicks "Next" — the engine validates the current step's
fields and either advances or surfaces errors (marking those fields as
touched so errors become visible). Clicking "Previous" never validates;
backward navigation is always allowed.

#### Step state via `currentStepRef`

For an external step indicator (a custom progress bar elsewhere on the
page, analytics, deep-linking), pass in a `currentStepRef`:

```typescript
import { ref } from 'vue'

const currentStep = ref(0)

// Inside the form:
{
	type: 'steps',
	currentStepRef: currentStep,
	// ...
}

// Anywhere else:
watchEffect(() => {
	console.log('User is on step', currentStep.value)
})
```

#### Custom indicators (tabbed wizards, breadcrumbs)

`indicatorSlot` replaces the default "Step N of M" text. The slot receives
a context with reactive accessors and methods for navigation:

```typescript
{
	type: 'steps',
	// ...
	indicatorSlot: (ctx) => {
		return h('nav', { class: 'wizard-tabs' },
			ctx.steps.map((step, i) =>
				h('button', {
					type:    'button',
					class: [
						'wizard-tab',
						ctx.isStepCurrent(i)   && 'wizard-tab--current',
						ctx.isStepCompleted(i) && 'wizard-tab--completed',
					].filter(Boolean),
					disabled: !ctx.isStepReachable(i),
					onClick:  () => ctx.goTo(i),
				}, step.label ?? `Step ${i + 1}`)
			)
		)
	},
}
```

The slot is called on each render. Inside, you have access to:

- `ctx.currentStep` — the current step index
- `ctx.totalSteps` — the number of steps
- `ctx.steps` — the array of step definitions (for labels)
- `ctx.isStepCurrent(i)`, `ctx.isStepCompleted(i)`, `ctx.isStepReachable(i)`
- `ctx.isFirst`, `ctx.isLast`
- `ctx.labels` — the configured next/prev/submit labels
- `ctx.next()`, `ctx.prev()`, `ctx.goTo(n)`, `ctx.submit()`

Same pattern for `navSlot`.

#### Forward navigation and validation

When the user clicks "Next" on step 2, the engine validates step 2's fields.
If valid, advances. If not, the failing fields are marked touched and the
user stays put with errors visible.

When using `goTo(N)` to jump forward (typical for tabbed indicators), the
engine validates each intermediate step. If validation fails on step 3
while jumping from step 1 to step 4, the user lands on step 3 with errors
shown — they can see exactly what's blocking them.

Backward navigation is always allowed without validation; the user can
revisit completed steps freely.

#### Submission

The form's `onSubmit` only fires after the user clicks the submit button on
the last step. At that point the full form state is validated one more time
(against the form's schema if set), and `onSubmit` is called with the
validated state.

If you want to programmatically trigger submission from a custom nav slot,
use `ctx.submit()` — it works regardless of whether the consumer included
a `type='submit'` button.

## Where to go next

- **[Examples](examples.md)** — real shapes (signup, login, expense entry,
  search box).
- **[Patterns](patterns.md)** — app-level patterns built on top of vue-dsl
  (dialogs, dropdown menus, nav menus, route-aware links).