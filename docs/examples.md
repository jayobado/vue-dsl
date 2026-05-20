# Examples

Real shapes drawn from real apps. Each example demonstrates a different
slice of vue-dsl — the signup form shows schema validation and async
mutation, the login form shows rule-based validation as an alternative, the
expense entry shows number coercion and array nodes, the search box shows
reactive filtering as a reusable Vue component.

These assume you've read [Concepts](concepts.md) and skimmed [The
declarative layer](declarative.md).

Examples reference `toast.success(...)` / `toast.error(...)` for user
feedback. vue-dsl doesn't ship a toast library — use whatever your project
uses (`vue-sonner`, `vue-toastification`, or similar).

## Signup form

A standard signup flow: validate input against a schema, post to an API,
handle errors. This is the most common form shape — full schema validation,
async submission, feedback on failure.

```typescript
import { defineComponent, h } from 'vue'
import { useForm } from '@/lib/vue-dsl/dsl'
import { useMutation } from '@/lib/vue-dsl/query'
import { toast } from '@/lib/toast'   // your project's toast lib
import { z } from 'zod'

// Your own API client — could be a generated Connect client, a tRPC client,
// or a hand-rolled fetch wrapper.
import { api } from '@/lib/api'

const signupSchema = z.object({
	email:           z.string().email('Must be a valid email'),
	password:        z.string().min(8, 'At least 8 characters'),
	confirmPassword: z.string(),
}).refine(
	(data) => data.password === data.confirmPassword,
	{ message: 'Passwords must match', path: ['confirmPassword'] },
)

type SignupState = z.infer<typeof signupSchema>

export const SignupView = defineComponent({
	setup() {
		const signup = useMutation((input: SignupState) => api.auth.signup(input))

		const form = useForm<SignupState>({
			initial: { email: '', password: '', confirmPassword: '' },
			schema:  signupSchema,
			onSubmit: async (state) => {
				try {
					await signup.mutate(state)
					toast.success('Welcome!')
					// Navigate to dashboard, etc.
				} catch (err) {
					toast.error(err instanceof Error ? err.message : 'Signup failed')
				}
			},
			children: [
				{
					type:         'input',
					name:         'email',
					label:        'Email',
					inputType:    'email',
					autocomplete: 'email',
					required:     true,
				},
				{
					type:         'input',
					name:         'password',
					label:        'Password',
					inputType:    'password',
					autocomplete: 'new-password',
					required:     true,
				},
				{
					type:         'input',
					name:         'confirmPassword',
					label:        'Confirm password',
					inputType:    'password',
					autocomplete: 'new-password',
					required:     true,
				},
				{
					type:   'button',
					label:  'Create account',
					action: 'submit',
					class:  'btn btn-primary',
				},
			],
		})

		return () => h('div', { class: 'auth-page' }, [
			h('h1', null, 'Create an account'),
			form.render(),
		])
	},
})
```

A few things worth noting:

- **Schema cross-field validation.** Zod's `.refine()` expresses "passwords
  must match." The error's `path: ['confirmPassword']` routes the failure
  to the confirm field's error display.
- **`autocomplete` values matter.** Setting `'new-password'` on both password
  fields tells the browser not to offer existing saved passwords. Setting
  `'email'` lets the browser autofill cleanly.
- **Try/catch around `mutate`.** `useMutation.mutate()` throws on failure.
  Wrap with try/catch where you want UI-level error handling.
- **Reactive validation with touched gating.** The user types — validation
  runs reactively, but errors only show for fields they've blurred. On
  submit, all fields become touched and any remaining errors appear.

## Login form

A simpler shape — just two fields, rule-based validation without a schema.
Use this pattern when the validation is one-off and a full schema would be
overkill.

```typescript
import { defineComponent, h } from 'vue'
import { useForm, required } from '@/lib/vue-dsl/dsl'
import { useMutation } from '@/lib/vue-dsl/query'
import { toast } from '@/lib/toast'

import { api } from '@/lib/api'

interface LoginState {
	email:    string
	password: string
}

export const LoginView = defineComponent({
	setup() {
		const login = useMutation((input: LoginState) => api.auth.login(input))

		const form = useForm<LoginState>({
			initial: { email: '', password: '' },
			onSubmit: async (state) => {
				try {
					await login.mutate(state)
					// Navigate to dashboard, etc.
				} catch {
					toast.error('Invalid email or password')
				}
			},
			children: [
				{
					type:         'input',
					name:         'email',
					label:        'Email',
					inputType:    'email',
					autocomplete: 'email',
					rules:        [required('Email is required')],
				},
				{
					type:         'input',
					name:         'password',
					label:        'Password',
					inputType:    'password',
					autocomplete: 'current-password',
					rules:        [required('Password is required')],
				},
				{
					type:   'button',
					label:  'Log in',
					action: 'submit',
					class:  'btn btn-primary',
				},
			],
		})

		return () => h('div', { class: 'auth-page' }, [
			h('h1', null, 'Log in'),
			form.render(),
		])
	},
})
```

Differences from signup:

- **No schema.** Field-level `rules` arrays handle validation. For a
  two-field form with one rule each, this reads cleaner than setting up
  a full schema.
- **`autocomplete: 'current-password'`.** Tells the browser to offer saved
  credentials, distinct from `'new-password'` on signup.
- **The error toast is generic.** Login failures are usually "invalid
  credentials" — don't surface the API's error message to avoid leaking
  whether an email exists.

## Expense entry

A multi-section form: a header with vendor and date, plus a tabular section
for line items (split across categories). Demonstrates the array node,
number coercion, and a small schema.

```typescript
import { defineComponent, h } from 'vue'
import { useForm } from '@/lib/vue-dsl/dsl'
import { useMutation } from '@/lib/vue-dsl/query'
import { toast } from '@/lib/toast'
import { z } from 'zod'

import { api } from '@/lib/api'

const expenseLineSchema = z.object({
	id:       z.string(),
	category: z.string().min(1, 'Category required'),
	amount:   z.number().positive('Must be positive'),
	note:     z.string(),
})

const expenseSchema = z.object({
	vendor: z.string().min(1, 'Vendor required'),
	date:   z.string().min(1, 'Date required'),
	lines:  z.array(expenseLineSchema).min(1, 'At least one line'),
})

type ExpenseState = z.infer<typeof expenseSchema>
type ExpenseLine  = z.infer<typeof expenseLineSchema>

const CATEGORIES = [
	{ value: 'travel',   label: 'Travel' },
	{ value: 'meals',    label: 'Meals' },
	{ value: 'supplies', label: 'Supplies' },
	{ value: 'software', label: 'Software' },
	{ value: 'other',    label: 'Other' },
]

export const NewExpenseView = defineComponent({
	setup() {
		const createExpense = useMutation(
			(input: ExpenseState) => api.expenses.create(input),
		)

		const form = useForm<ExpenseState>({
			initial: {
				vendor: '',
				date:   '',
				lines:  [],
			},
			schema:  expenseSchema,
			onSubmit: async (state) => {
				try {
					await createExpense.mutate(state)
					toast.success('Expense submitted')
				} catch (err) {
					toast.error(err instanceof Error ? err.message : 'Submission failed')
				}
			},
			children: [
				{
					type:     'input',
					name:     'vendor',
					label:    'Vendor',
					required: true,
				},
				{
					type:      'input',
					name:      'date',
					label:     'Date',
					inputType: 'date',
					required:  true,
				},
				{
					type:        'array',
					name:        'lines',
					rowKey:      (line: ExpenseLine) => line.id,
					allowAdd:    true,
					allowRemove: true,
					addLabel:    'Add line',
					newRow:      () => ({
						id:       crypto.randomUUID(),
						category: '',
						amount:   0,
						note:     '',
					}),
					columns: [
						{
							header: 'Category',
							field:  {
								type:    'select',
								name:    'category',
								options: CATEGORIES,
							},
						},
						{
							header: 'Amount',
							field:  {
								type:      'input',
								name:      'amount',
								inputType: 'number',
							},
						},
						{
							header: 'Note',
							field:  {
								type: 'input',
								name: 'note',
							},
						},
					],
				},
				{
					type:   'button',
					label:  'Submit',
					action: 'submit',
					class:  'btn btn-primary',
				},
			],
		})

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'New expense'),
			form.render(),
		])
	},
})
```

Worth knowing:

- **Number coercion in array rows.** The `amount` field has `inputType:
  'number'`. The engine coerces input values to `number` on write, so
  `state.value.lines[i].amount` is a real number that the schema validates
  with `z.number().positive()`. Empty input produces `null`.
- **Schema validates the array.** `lines: z.array(expenseLineSchema).min(1)`
  ensures at least one line, and each line is fully validated. Errors at
  paths like `['lines', 2, 'amount']` map to the right row's right cell.
- **`crypto.randomUUID()` for row IDs.** The `rowKey` extractor needs stable
  identity across renders. Generating an ID at row creation gives you that.
- **Per-row reactivity.** Each row is wrapped in its own component
  internally — adding or removing a row only re-renders affected rows, not
  the whole array.


## User list with sort and pagination

A read-only data view with server-side sort and pagination. Demonstrates
`useTable` consuming a paginated query, with sort and page state living
outside the table as refs.

```typescript
import { defineComponent, h, ref } from 'vue'
import { useTable } from '@/lib/vue-dsl/dsl'
import { useQuery } from '@/lib/vue-dsl/query'
import type { SortState } from '@/lib/vue-dsl/dsl'
import { useRouter } from 'vue-router'

import { api } from '@/lib/api'

interface User {
	id:        string
	name:      string
	email:     string
	role:      'admin' | 'member'
	createdAt: string
}

interface UserListResponse {
	rows:      User[]
	totalRows: number
}

export const UsersView = defineComponent({
	setup() {
		const router = useRouter()

		const page = ref(1)
		const sort = ref<SortState<User> | null>({
			field:     'createdAt',
			direction: 'desc',
		})

		const usersQuery = useQuery<UserListResponse>(() =>
			api.users.list({
				page:      page.value,
				pageSize:  20,
				sortBy:    sort.value?.field,
				direction: sort.value?.direction,
			})
		)

		const table = useTable<User, UserListResponse>({
			query:   usersQuery,
			rows:    (data) => data.rows,
			rowKey:  (user) => user.id,
			sortRef: sort,
			pagination: {
				pageRef:   page,
				pageSize:  20,
				totalRows: (data) => data.totalRows,
			},
			onRowClick: (user) => router.push(`/users/${user.id}`),
			columns: [
				{ key: 'name',  header: 'Name',  sortable: true },
				{ key: 'email', header: 'Email', sortable: true },
				{
					key:      'role',
					header:   'Role',
					sortable: true,
					render:   (user) => h('span', {
						class: ['badge', `badge--${user.role}`],
					}, user.role),
				},
				{
					key:    'createdAt',
					header: 'Created',
					sortable: true,
					render: (user) => new Date(user.createdAt).toLocaleDateString(),
				},
				{
					header: 'Actions',
					render: (user) => h('button', {
						class:   'btn-link',
						onClick: (e: Event) => {
							e.stopPropagation()
							editUser(user)
						},
					}, 'Edit'),
				},
			],
		})

		function editUser(user: User) {
			router.push(`/users/${user.id}/edit`)
		}

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'Users'),
			table.render(),
		])
	},
})
```

Worth knowing:

- **Sort and page live outside the table.** They're refs the consumer owns.
  The `useQuery` callback reads them, so the query re-runs reactively when
  the user changes sort or page.
- **The `<User, UserListResponse>` generics.** The first parameter is the
  row type; the second is what the query returns. The `rows` extractor
  pulls the array out of the response.
- **Custom cell rendering.** The `role` column renders a styled badge; the
  `createdAt` column formats the ISO string as a localized date; the
  `Actions` column shows an Edit button.
- **`e.stopPropagation()` on the Edit button.** Without it, clicking Edit
  would also fire `onRowClick` (because the click bubbles up to the row).
  The engine already skips row clicks when the target is a `<button>`, so
  in this case the stopPropagation is defensive — but explicit is clearer.
- **Sort headers are styled via the `data-sort` attribute.** When a column
  is sorted, its `<th>` gets `data-sort="asc"` or `data-sort="desc"`. Add
  CSS to show direction indicators:

```css
th[data-sortable]      { cursor: pointer; }
th[data-sort="asc"]::after  { content: " ↑"; }
th[data-sort="desc"]::after { content: " ↓"; }
```

## Signup wizard

A multi-step form using the steps node. Walks the user through account
creation in three pages — account credentials, profile info, preferences.
Demonstrates step-level validation, an external currentStep ref, and a
schema covering the full state.

```typescript
import { defineComponent, h, ref, watchEffect } from 'vue'
import { useForm } from '@/lib/vue-dsl/dsl'
import { useMutation } from '@/lib/vue-dsl/query'
import { toast } from '@/lib/vue-dsl/primitives'
import { z } from 'zod'

import { api } from '@/lib/api'

const signupSchema = z.object({
	email:           z.string().email('Must be a valid email'),
	password:        z.string().min(8, 'At least 8 characters'),
	confirmPassword: z.string(),
	name:            z.string().min(1, 'Name is required'),
	role:            z.enum(['admin', 'member']),
	newsletter:      z.boolean(),
}).refine(
	(data) => data.password === data.confirmPassword,
	{ message: 'Passwords must match', path: ['confirmPassword'] },
)

type SignupState = z.infer<typeof signupSchema>

export const SignupWizard = defineComponent({
	setup() {
		const currentStep = ref(0)
		const signup = useMutation((input: SignupState) => api.auth.signup(input))

		// Optional: log step changes for analytics
		watchEffect(() => {
			console.log('User on step', currentStep.value)
		})

		const form = useForm<SignupState>({
			initial: {
				email:           '',
				password:        '',
				confirmPassword: '',
				name:            '',
				role:            'member',
				newsletter:      false,
			},
			schema: signupSchema,
			onSubmit: async (state) => {
				try {
					await signup.mutate(state)
					toast.success('Account created — welcome!')
				} catch (err) {
					toast.error(err instanceof Error ? err.message : 'Signup failed')
				}
			},
			children: [
				{
					type:           'steps',
					currentStepRef: currentStep,
					nextLabel:      'Continue',
					prevLabel:      'Back',
					submitLabel:    'Create account',
					steps: [
						{
							label: 'Account',
							fields: [
								{
									type:         'input',
									name:         'email',
									label:        'Email',
									inputType:    'email',
									autocomplete: 'email',
									required:     true,
								},
								{
									type:         'input',
									name:         'password',
									label:        'Password',
									inputType:    'password',
									autocomplete: 'new-password',
									required:     true,
								},
								{
									type:         'input',
									name:         'confirmPassword',
									label:        'Confirm password',
									inputType:    'password',
									autocomplete: 'new-password',
									required:     true,
								},
							],
						},
						{
							label: 'Profile',
							fields: [
								{
									type:     'input',
									name:     'name',
									label:    'Full name',
									required: true,
								},
								{
									type:    'select',
									name:    'role',
									label:   'Role',
									options: [
										{ value: 'admin',  label: 'Admin' },
										{ value: 'member', label: 'Member' },
									],
								},
							],
						},
						{
							label: 'Preferences',
							fields: [
								{
									type:  'checkbox',
									name:  'newsletter',
									label: 'Subscribe to product updates',
								},
							],
						},
					],
				},
			],
		})

		return () => h('div', { class: 'wizard-page' }, [
			h('h1', null, 'Create an account'),
			form.render(),
		])
	},
})
```

A version with a tabbed indicator (using `indicatorSlot`):

```typescript
{
	type:           'steps',
	currentStepRef: currentStep,
	steps:          [/* same steps as above */],
	indicatorSlot: (ctx) => {
		return h('nav', { class: 'wizard-tabs' },
			ctx.steps.map((step, i) =>
				h('button', {
					type: 'button',
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
},
```

The slot uses `ctx.isStepCurrent(i)`, `ctx.isStepCompleted(i)`, and
`ctx.isStepReachable(i)` to apply state classes. The Vue render runs
reactively, so when `currentStep` changes, the tabs re-render with the
new active and completed states.

Worth knowing:

- **Schema validates the whole state.** The `.refine()` for password match
  applies on the final submit. Step-level validation only checks the
  current step's fields when advancing.
- **The `currentStepRef` is external.** Other components can read or write
  it. A custom progress bar elsewhere on the page, analytics watchers,
  deep-linked URL paths — all can hook into this ref.
- **Forward navigation marks failing fields as touched.** If the user
  clicks Next on step 1 with invalid fields, those fields are touched and
  their errors become visible. The user stays on step 1 to fix them.
- **Backward navigation is always allowed.** Clicking Back never validates.
  The user can revisit completed steps freely.
- **The submit button on the last step is `type="submit"`.** Native form
  submission flows through the form's `onSubmit` handler. No special
  wiring needed for the default nav.

## Modal usage

The patterns doc shows a reusable `Dialog` component built on vue-dsl
primitives. Here's how to use it in a real view.

```typescript
import { defineComponent, h, ref } from 'vue'
import { useMutation } from '@/lib/vue-dsl/query'
import { toast } from '@/lib/vue-dsl/primitives'
import { Dialog } from '@/components/Dialog'

import { api } from '@/lib/api'

interface User {
	id:    string
	name:  string
	email: string
}

export const UserCardView = defineComponent({
	props: {
		user: { type: Object as () => User, required: true },
	},
	setup(props) {
		const deleteOpen = ref(false)

		const deleteUser = useMutation(() => api.users.delete(props.user.id))

		async function confirmDelete() {
			try {
				await deleteUser.mutate()
				toast.success(`Deleted ${props.user.name}`)
				deleteOpen.value = false
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Delete failed')
			}
		}

		return () => h('div', { class: 'user-card' }, [
			h('h2', null, props.user.name),
			h('p', { class: 'user-email' }, props.user.email),

			h('div', { class: 'user-actions' }, [
				h('button', {
					class:   'btn btn-danger',
					onClick: () => { deleteOpen.value = true },
				}, 'Delete'),
			]),

			h(Dialog, {
				open:    deleteOpen.value,
				title:   'Delete user',
				body:    `This will permanently delete ${props.user.name}. This cannot be undone.`,
				onClose: () => { deleteOpen.value = false },
				actions: [
					{
						label:   'Cancel',
						onClick: () => { deleteOpen.value = false },
					},
					{
						label:    deleteUser.loading.value ? 'Deleting...' : 'Delete',
						onClick:  confirmDelete,
						primary:  true,
						disabled: deleteUser.loading.value,
					},
				],
			}),
		])
	},
})
```

Worth knowing:

- **The dialog is mounted unconditionally.** It always exists in the
  component tree, but renders nothing when `open` is false. This keeps
  the focus trap / scroll lock setup stable.
- **The dialog's primary button reflects mutation state.** Label switches
  to "Deleting..." and the button disables while the mutation runs.
- **Error toasting on failure.** `useMutation.mutate()` throws on failure,
  so the catch block surfaces the error via `toast.error()`. The dialog
  stays open so the user can retry or cancel.
- **The destructive action is `primary: true`.** The Dialog component's
  primary action gets the prominent styling. For a true "are you sure"
  pattern where you want the destructive option to NOT be primary, set
  `primary: false` and style the cancel button as the primary action.
  (The patterns doc's `confirm()` helper does this via the `destructive`
  option.)

## Dropdown menu usage

The patterns doc's `Menu` component takes a trigger and items, handles
positioning via `useFloating`, dismisses on click-outside or escape. Here's
a row-action menu inside a table.

```typescript
import { defineComponent, h } from 'vue'
import { useTable } from '@/lib/vue-dsl/dsl'
import { useQuery, useMutation } from '@/lib/vue-dsl/query'
import { toast } from '@/lib/vue-dsl/primitives'
import { Menu } from '@/components/Menu'
import { confirm } from '@/components/confirm'
import { useRouter } from 'vue-router'

import { api } from '@/lib/api'

interface User {
	id:    string
	name:  string
	email: string
	role:  string
}

export const UsersView = defineComponent({
	setup() {
		const router    = useRouter()
		const usersQuery = useQuery(() => api.users.list())

		const deleteUser = useMutation((id: string) => api.users.delete(id))

		async function handleDelete(user: User) {
			const ok = await confirm({
				title:        'Delete user',
				body:         `Delete ${user.name}? This cannot be undone.`,
				confirmLabel: 'Delete',
				destructive:  true,
			})
			if (!ok) return

			try {
				await deleteUser.mutate(user.id)
				toast.success(`Deleted ${user.name}`)
				usersQuery.refetch()
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Delete failed')
			}
		}

		const table = useTable<User>({
			query:   usersQuery,
			rows:    (data) => data,
			rowKey:  (user) => user.id,
			columns: [
				{ key: 'name',  header: 'Name' },
				{ key: 'email', header: 'Email' },
				{ key: 'role',  header: 'Role' },
				{
					header: '',
					render: (user) => h(Menu, {
						trigger: h('button', {
							class: 'btn-icon',
						}, '⋯'),
						items: [
							{
								label:   'Edit',
								onClick: () => router.push(`/users/${user.id}/edit`),
							},
							{
								label:   'Duplicate',
								onClick: () => duplicateUser(user),
							},
							{
								label:    'Delete',
								onClick:  () => handleDelete(user),
								disabled: user.role === 'admin',
							},
						],
					}),
				},
			],
		})

		async function duplicateUser(user: User) {
			try {
				await api.users.duplicate(user.id)
				toast.success(`Duplicated ${user.name}`)
				usersQuery.refetch()
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Duplicate failed')
			}
		}

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'Users'),
			table.render(),
		])
	},
})
```

Worth knowing:

- **The Menu is rendered inside a table cell.** The `render` callback
  returns a VNode containing the Menu. Each row gets its own Menu instance
  with row-specific items.
- **The confirm helper composes with the menu.** Clicking Delete opens a
  promise-returning confirm dialog. The menu closes automatically when its
  item is clicked; the confirm dialog handles the destructive prompt.
- **`usersQuery.refetch()` after mutations.** Server-side mutations need
  manual refetch — `useMutation` doesn't auto-invalidate. Call refetch
  after success to update the table.
- **Disabled items don't fire onClick.** The Menu component checks
  `item.disabled` and renders the button with `disabled` attribute. Useful
  for permission-based actions (e.g., can't delete admins).
- **The trigger is just a button VNode.** Pass any element you want as the
  trigger — an icon button, a "Actions" labeled button, an avatar that
  opens a user menu, etc. The Menu component wraps it with the toggle
  click handler.


## Dashboard composition

A realistic dashboard layout combining several lib pieces: route-aware
sidebar navigation, a header with user menu, a content area showing a
table with filters. Demonstrates how the pieces compose in a production
shape.

```typescript
// src/views/DashboardLayout.ts

import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { Sidebar } from '@/components/Sidebar'
import { Header }  from '@/components/Header'

export const DashboardLayout = defineComponent({
	setup() {
		return () => h('div', { class: 'dashboard' }, [
			h(Sidebar),
			h('main', { class: 'dashboard-main' }, [
				h(Header),
				h('div', { class: 'dashboard-content' }, [
					h(RouterView),
				]),
			]),
		])
	},
})
```

The layout is composed of three components: sidebar (route-aware nav from
the patterns doc), header (user menu, notifications), and a content area
rendering the current route.

### The sidebar

```typescript
// src/components/Sidebar.ts

import { defineComponent, h } from 'vue'
import { ActiveLink } from '@/components/ActiveLink'

export const Sidebar = defineComponent({
	setup() {
		return () => h('nav', { class: 'sidebar' }, [
			h('div', { class: 'sidebar-brand' }, 'Acme Admin'),

			h('section', { class: 'sidebar-section' }, [
				h('h3', { class: 'sidebar-heading' }, 'Operations'),
				h(ActiveLink, { to: '/dashboard', label: 'Dashboard' }),
				h(ActiveLink, { to: '/users',     label: 'Users' }),
				h(ActiveLink, { to: '/orders',    label: 'Orders' }),
			]),

			h('section', { class: 'sidebar-section' }, [
				h('h3', { class: 'sidebar-heading' }, 'Analytics'),
				h(ActiveLink, { to: '/reports',  label: 'Reports' }),
				h(ActiveLink, { to: '/insights', label: 'Insights' }),
			]),

			h('section', { class: 'sidebar-section' }, [
				h('h3', { class: 'sidebar-heading' }, 'Settings'),
				h(ActiveLink, { to: '/settings/users',    label: 'Team' }),
				h(ActiveLink, { to: '/settings/billing',  label: 'Billing' }),
			]),
		])
	},
})
```

The sidebar uses `ActiveLink` (from the patterns doc) for each item.
Active-route highlighting happens automatically via Vue Router's
`useRoute()` integration inside the component.

### The header

```typescript
// src/components/Header.ts

import { defineComponent, h } from 'vue'
import { useRouter } from 'vue-router'
import { useToasts } from '@/lib/vue-dsl/primitives'
import { Menu } from '@/components/Menu'

import { useCurrentUser } from '@/composables/use-current-user'
import { api } from '@/lib/api'

export const Header = defineComponent({
	setup() {
		const router = useRouter()
		const user   = useCurrentUser()
		const toasts = useToasts()

		async function logout() {
			try {
				await api.auth.logout()
				router.push('/login')
			} catch (err) {
				toasts.error(err instanceof Error ? err.message : 'Logout failed')
			}
		}

		return () => h('header', { class: 'header' }, [
			h('div', { class: 'header-title' }, 'Dashboard'),

			h('div', { class: 'header-right' }, [
				h('span', { class: 'header-user' }, user.value?.name ?? ''),

				h(Menu, {
					trigger: h('button', {
						class: 'btn-icon header-avatar',
					}, user.value?.initials ?? '?'),
					items: [
						{
							label:   'Profile',
							onClick: () => router.push('/profile'),
						},
						{
							label:   'Settings',
							onClick: () => router.push('/settings'),
						},
						{
							label:   'Sign out',
							onClick: logout,
						},
					],
				}),
			]),

			// Toast container — renders all active toasts
			h('div', { class: 'toast-container' },
				toasts.toasts.value.map((t) => h('div', {
					key:   t.id,
					class: ['toast', `toast--${t.kind}`],
				}, t.message)),
			),
		])
	},
})
```

The header has three responsibilities: showing the current view title,
exposing a user menu via the patterns doc's `Menu` component, and
rendering the toast container.

### The content view

A realistic content view: a users page with a search box, action button,
and table. Combines several lib pieces.

```typescript
// src/views/UsersView.ts

import { defineComponent, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTable } from '@/lib/vue-dsl/dsl'
import { useQuery, useMutation } from '@/lib/vue-dsl/query'
import { useDebounce, toast } from '@/lib/vue-dsl/primitives'
import { Menu } from '@/components/Menu'
import { confirm } from '@/components/confirm'
import type { SortState } from '@/lib/vue-dsl/dsl'

import { api } from '@/lib/api'

interface User {
	id:    string
	name:  string
	email: string
	role:  'admin' | 'member'
	createdAt: string
}

interface UserListResponse {
	rows:      User[]
	totalRows: number
}

export const UsersView = defineComponent({
	setup() {
		const router = useRouter()

		const search          = ref('')
		const debouncedSearch = useDebounce(search, 300)
		const page            = ref(1)
		const sort            = ref<SortState<User> | null>({
			field:     'createdAt',
			direction: 'desc',
		})

		const usersQuery = useQuery<UserListResponse>(() =>
			api.users.list({
				query:     debouncedSearch.value || undefined,
				page:      page.value,
				pageSize:  20,
				sortBy:    sort.value?.field,
				direction: sort.value?.direction,
			})
		)

		const deleteUser = useMutation((id: string) => api.users.delete(id))

		async function handleDelete(user: User) {
			const ok = await confirm({
				title:        'Delete user',
				body:         `Delete ${user.name}? This cannot be undone.`,
				confirmLabel: 'Delete',
				destructive:  true,
			})
			if (!ok) return

			try {
				await deleteUser.mutate(user.id)
				toast.success(`Deleted ${user.name}`)
				usersQuery.refetch()
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Delete failed')
			}
		}

		const table = useTable<User, UserListResponse>({
			query:   usersQuery,
			rows:    (data) => data.rows,
			rowKey:  (user) => user.id,
			sortRef: sort,
			pagination: {
				pageRef:   page,
				pageSize:  20,
				totalRows: (data) => data.totalRows,
			},
			columns: [
				{ key: 'name',  header: 'Name',  sortable: true },
				{ key: 'email', header: 'Email', sortable: true },
				{
					key:      'role',
					header:   'Role',
					sortable: true,
					render:   (user) => h('span', {
						class: ['badge', `badge--${user.role}`],
					}, user.role),
				},
				{
					key:    'createdAt',
					header: 'Created',
					sortable: true,
					render: (user) => new Date(user.createdAt).toLocaleDateString(),
				},
				{
					header: '',
					render: (user) => h(Menu, {
						trigger: h('button', { class: 'btn-icon' }, '⋯'),
						items: [
							{
								label:   'Edit',
								onClick: () => router.push(`/users/${user.id}/edit`),
							},
							{
								label:    'Delete',
								onClick:  () => handleDelete(user),
								disabled: user.role === 'admin',
							},
						],
					}),
				},
			],
		})

		return () => h('div', { class: 'page' }, [
			// Page header with title and primary action
			h('div', { class: 'page-header' }, [
				h('h1', null, 'Users'),
				h('button', {
					class:   'btn btn-primary',
					onClick: () => router.push('/users/new'),
				}, 'New user'),
			]),

			// Search input — drives the query via debouncedSearch
			h('div', { class: 'page-filters' }, [
				h('input', {
					type:        'search',
					placeholder: 'Search users...',
					class:       'search-input',
					value:       search.value,
					onInput:     (e: Event) => {
						search.value = (e.target as HTMLInputElement).value
						page.value = 1   // reset to first page on new search
					},
				}),
			]),

			// Table — driven by sort, page, and debouncedSearch
			table.render(),
		])
	},
})
```

Worth knowing about the composition:

- **State separation.** Search, page, and sort are independent refs the
  view owns. Each drives part of the query function. Changes to any of
  them re-fire the query reactively.
- **Search resets to page 1.** When the user types a new search, page is
  reset. Without this, the user could be on page 5 of the previous
  results, then search for something with only 2 pages, and see an empty
  page 5. Resetting is the natural fix.
- **Refetch after mutations.** Delete fires `usersQuery.refetch()` to
  update the table. The lib doesn't auto-invalidate; the consumer chooses
  when to refresh.
- **Multiple lib pieces working together.** `useQuery`, `useMutation`,
  `useDebounce`, `useTable`, `toast`, plus the patterns components
  (`Menu`, `confirm`). Each does one focused thing; composition is in
  the view's setup.

### The route configuration

```typescript
// src/router.ts

import { createRouter, createWebHistory } from 'vue-router'
import { DashboardLayout } from '@/views/DashboardLayout'
import { UsersView }       from '@/views/UsersView'
import { OrdersView }      from '@/views/OrdersView'
import { ReportsView }     from '@/views/ReportsView'

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path:      '/',
			component: DashboardLayout,
			children: [
				{ path: '',         component: () => import('@/views/DashboardHome') },
				{ path: 'users',    component: UsersView },
				{ path: 'orders',   component: OrdersView },
				{ path: 'reports',  component: ReportsView },
			],
		},
		{ path: '/login',  component: () => import('@/views/LoginView') },
		{ path: '/signup', component: () => import('@/views/SignupView') },
	],
})
```

The dashboard layout is the parent route; views inside are children that
render in the `<RouterView />` inside the layout's content area. Login
and signup are top-level routes without the dashboard chrome.

This is the typical shape for a dashboard SPA — one or two layouts as
parent routes, content views as children. Vue Router handles the
nesting; vue-dsl handles the views' internal state and DOM.


## Search box

A different shape entirely. Not a form-with-submit — a reactive input that
filters a list as the user types. Built with refs, a debounced reactive
input via `useDebounce`, and `useQuery`. Shown as a reusable Vue component
so you can drop it anywhere.

```typescript
import { defineComponent, h, ref } from 'vue'
import { useQuery } from '@/lib/vue-dsl/query'
import { useDebounce } from '@/lib/vue-dsl/primitives'

import { api } from '@/lib/api'

interface User {
	id:    string
	name:  string
	email: string
}

export const UserSearch = defineComponent({
	setup() {
		const query = ref('')

		// Debounce the query ref — the debounced version updates 300ms after
		// the user stops typing. The query function reads it, so the network
		// call only fires after the pause.
		const debouncedQuery = useDebounce(query, 300)

		const results = useQuery(() => {
			const q = debouncedQuery.value
			if (q.length < 2) return Promise.resolve([])
			return api.users.search({ query: q })
		})

		return () => {
			const items: ReturnType<typeof h>[] = []

			if (results.loading.value && !results.data.value) {
				items.push(h('li', { class: 'search-loading' }, 'Searching...'))
			} else if (results.error.value) {
				items.push(h('li', { class: 'search-error' },
					`Error: ${results.error.value.message}`))
			} else if (results.data.value && results.data.value.length > 0) {
				for (const user of results.data.value) {
					items.push(h('li', { class: 'search-result' }, [
						h('strong', null, user.name),
						h('span', { class: 'search-result-email' }, user.email),
					]))
				}
			} else if (query.value.length >= 2) {
				items.push(h('li', { class: 'search-empty' }, 'No results'))
			}

			return h('div', { class: 'search' }, [
				h('input', {
					type:        'search',
					placeholder: 'Search users...',
					class:       'search-input',
					value:       query.value,
					onInput:     (e: Event) => {
						query.value = (e.target as HTMLInputElement).value
					},
				}),
				h('ul', { class: 'search-results' }, items),
			])
		}
	},
})
```

Use it inside any parent component:

```typescript
return () => h('div', { class: 'page' }, [
	h('h1', null, 'Users'),
	h(UserSearch),
])
```

Notes:

- **One source ref + debounced derived ref.** `query` updates instantly with each keystroke for input responsiveness. `debouncedQuery` updates 300ms after the last change — that's what drives the actual fetch.
- **`useQuery` re-fires reactively.** The callback reads `debouncedQuery.value`, so whenever that ref updates, the query re-runs. No manual refetch logic needed.
- **The `length < 2` guard.** Don't fire the API on every keystroke; require at least two characters. Returning a resolved promise with an empty array keeps the type clean.
- **The render function returns fresh VNodes on every reactive change.** Vue diffs them efficiently. No manual DOM manipulation.
- **The component owns its lifecycle.** When unmounted, `useDebounce` cancels any pending update, and the query's effects clean up — all via Vue's component lifecycle. No explicit scope management needed.


## Where to go next

- **[Patterns](patterns.md)** — app-level patterns built on top of vue-dsl
  (dialogs, dropdown menus, nav menus, route-aware links).