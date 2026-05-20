# Concepts

vue-dsl introduces a small set of patterns on top of Vue 3. This doc explains
them — what they are, why they're shaped the way they are, and how they
compose. You're assumed to know Vue 3's Composition API, refs, computed,
watchers, and lifecycle hooks.

Read top to bottom. Each pattern builds on the previous.

## The mental model

vue-dsl is built around two ideas: **declarative node trees** and
**composables that return both state and render**.

### Declarative node trees

Forms, tables, and their compositions (arrays, steps) are described as data
structures — not Vue components. You pass a node tree to a composable, and
the composable produces VNodes that render the described UI:

```typescript
const form = useForm<SignupState>({
	type:    'form',
	initial: { email: '', password: '' },
	onSubmit: async (state) => { /* ... */ },
	children: [
		{ type: 'input',  name: 'email',    label: 'Email' },
		{ type: 'input',  name: 'password', label: 'Password' },
		{ type: 'button', label: 'Sign up', action: 'submit' },
	],
})
```

The node tree is data — you can build it conditionally, store it in a
constant, share it across components. The engine reads the tree and produces
the corresponding DOM.

This is intentionally different from Vue's native idiom of "everything is a
component." A node tree captures structure and intent more compactly than
nesting components, and lets the engine handle cross-cutting concerns
(validation, state binding, error display) once rather than per-component.

The node tree approach earns its place for patterns with real complexity:
forms (state + validation + errors + submit lifecycle) and tables (data flow
+ sort + pagination + states). For simpler UI, you write Vue components
directly. vue-dsl doesn't try to express everything as nodes.

### Composables return state and render

Every vue-dsl composable returns both reactive state *and* a render function:

```typescript
const form = useForm<SignupState>(node)
// form.state    - Ref<SignupState>
// form.errors   - Ref<Record<string, string>>
// form.touched  - Ref<Set<string>>
// form.loading  - Ref<boolean>
// form.controller - { submit, reset }
// form.render() - () => VNode
```

The state is always exposed — you don't pass an optional `stateRef` to be
able to observe; the composable returns it. If you want to drive state from
outside (initialize from a server response, share between components), you
pass your own ref in. The composable uses what you pass, or creates one if
you don't.

`render` is a function that returns a VNode tree. Embed it in your
component's render output:

```typescript
return () => h('div', { class: 'page' }, [
	h('h1', null, 'Sign up'),
	form.render(),
])
```

Calling `render()` returns a fresh VNode tree each time — Vue handles the
diffing. The composable's internal state stays put across renders.

## Reactive validation with touched gating

vue-dsl's forms validate reactively — whenever state changes, validation
runs. Error display is gated by a `touched` set: errors only show for fields
the user has interacted with.

### Why reactive validation

Form libraries traditionally let you choose *when* to validate: on submit,
on blur, on every change. Each mode has tradeoffs:

- **Submit only** — no interim feedback. The user submits, sees a wall of
  errors, has to scroll up.
- **Blur** — feedback when leaving a field. Better. But: the user fixes the
  field, the error stays until they blur again. No real-time confirmation.
- **Change** — eager feedback. The user types `j` in email → "Invalid email"
  flashes. Jarring.

vue-dsl picks a different design. Validation runs reactively (on every state
change). But error *display* is gated by `touched.has(fieldKey)`. The user
hasn't interacted with the field → no error shown. They blur the field →
field is touched → errors show. They fix the field → state changes →
validation re-runs → error clears immediately.

Best of all three modes: no premature errors, immediate confirmation on
fixes, no need to choose a mode.

### The touched set

`form.touched` is a `Ref<Set<string>>` containing the names of fields the
user has interacted with (focused and then blurred). The error span for a
field only renders if its name is in the set.

The set gates display, not validation. Validation always runs in full. The
errors are always up to date.

### When touched is updated

- On field blur: that field's name is added to the set.
- On submit: every field name in the form is added to the set (so the user
  sees all errors, including for fields they never visited).
- On reset (`controller.reset()`): the set is cleared.

### Per-field override

A field can opt out of touched gating via `showErrorsEager: true`. Useful for
password strength meters or similar UI that should give immediate feedback
even before the user blurs.

```typescript
{
	type: 'input',
	name: 'password',
	label: 'Password',
	inputType: 'password',
	showErrorsEager: true,
}
```

The errors for this field display from the first state change, before any
blur or submit.

## Controllers for external triggers

Sometimes you need to trigger submit or reset from outside the form — a
sticky save bar at the bottom of the page, a parent dialog, a keyboard
shortcut handler. The form provides a controller for this:

```typescript
const form = useForm<SignupState>(node)

// In a sticky save bar:
return () => h('div', { class: 'save-bar' }, [
	h('button', {
		type: 'button',
		disabled: form.loading.value,
		onClick: () => form.controller.submit(),
	}, 'Save'),
	h('button', {
		type: 'button',
		onClick: () => form.controller.reset(),
	}, 'Reset'),
])
```

The controller is a plain object with `submit` and `reset` methods. The
composable wires them up internally — calling `controller.submit()` triggers
the same flow as clicking a submit button (validate, then call `onSubmit` if
valid).

You don't always need the controller. If your form has its own submit button
inside `children`, that handles submission natively. The controller is for
when submit lives elsewhere.

## The optional-ref pattern

Forms accept optional `stateRef` and `errorsRef` parameters. If provided, the
composable uses them. If not, it creates internal refs.

```typescript
// Internal refs (most common):
const form = useForm<SignupState>({
	initial: { email: '', password: '' },
	// ...
})
// form.state is a ref the composable created.

// External refs:
const myState = ref<SignupState>({ email: '', password: '' })
const form = useForm<SignupState>({
	stateRef: myState,
	initial:  myState.value,
	// ...
})
// form.state === myState
```

When you'd use external refs:

- **Initialize from server data.** You fetch a user object, want to edit it
  in a form. Create the ref with the fetched data, pass it as `stateRef`.
- **Share state between components.** Form A and a preview panel both read
  the same state. The shared ref is the source of truth.
- **Persist state across navigation.** The ref lives in a Pinia store; the
  form reads/writes through it.

When external refs aren't needed (most cases), internal refs do the right
thing automatically.

### A note on ref types

vue-dsl requires the state ref to be **deeply reactive** — created with
`ref({...})` (not `shallowRef({...})`). The engine writes via direct
mutation (`state.value.email = newValue`), which requires Vue's deep proxy
tracking to pick up changes.

If you pass a `shallowRef`, mutations won't trigger reactivity. The form
will appear frozen — user types, nothing updates. This is a footgun worth
knowing about. Use plain `ref({...})` for form state.

## Slots receive context, return VNodes

When the engine renders a node, it sometimes accepts slots — callbacks the
consumer provides to customize what's rendered. Slots receive a context
object and return VNodes.

The pattern is the same across the lib:

```typescript
// Steps node's indicator slot:
useForm({
	// ...
	children: [{
		type: 'steps',
		steps: [/* ... */],
		indicatorSlot: (ctx) => {
			// ctx provides reactive accessors and navigation methods
			return h('nav', { class: 'wizard-tabs' },
				ctx.steps.map((step, i) =>
					h('button', {
						type: 'button',
						class: ctx.isStepCurrent(i) ? 'tab tab--current' : 'tab',
						onClick: () => ctx.goTo(i),
					}, step.label ?? `Step ${i + 1}`)
				)
			)
		},
	}],
})
```

Two things to understand about slot context:

**1. Reactive accessors are getter functions.** `ctx.isStepCurrent(i)` is a
function that returns the current value. When the slot's VNodes are
re-rendered (because Vue's component re-renders), these calls produce fresh
values. The render-on-state-change happens automatically because the parent
component is reactive.

**2. Slots return VNodes; render-time logic stays in the slot.** Inside the
slot function, you have access to Vue's full toolkit — `h()`, `computed`,
even `watchEffect` if needed. The engine doesn't constrain what the slot can
do; it just gives the slot the context it needs.

In practice, slots that just produce VNodes from context are simple and
sufficient. For slots that need their own internal state, you can either
factor them as Vue components (the slot function returns
`h(MyCustomSlotComponent, { ctx })`) or use Vue's reactivity directly inside
the slot.

## Where this leaves us

These five patterns — node trees, composable returns, reactive-touched
validation, controllers, optional refs, slot contexts — are the foundation.
Everything else in the lib is applying these patterns to specific shapes
(forms, tables, arrays, steps).

The next doc walks through those shapes in depth.

## See also

- **[The declarative layer](declarative.md)** — full DSL deep dive.
- **[Examples](examples.md)** — real shapes.
- **[Patterns](patterns.md)** — app-level patterns the lib doesn't ship.