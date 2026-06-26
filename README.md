# vue-dsl

A small set of declarative patterns and primitives on top of Vue 3. Reusable
across projects — forms, tables, async data hooks, plus a few patterns the
Vue ecosystem doesn't quite shape the way you'd want them.

## What is vue-dsl

vue-dsl is a personal reusable lib for Vue 3 projects. It's not a full
framework or a replacement for anything Vue ships — it's the patterns and
shapes that come up across every backend-developer-built Vue app and benefit
from being captured once rather than rewritten per project.

The lib gives you:

- A declarative forms layer with reactive validation, schema integration,
  controllers for external triggers, and support for tabular sections and
  multi-step flows.
- A declarative tables layer for read-only data display with sorting,
  pagination, and reactive data sources.
- `useQuery` and `useMutation` composables for wrapping any Promise-returning
  function in reactive state.
- A grab-bag of headless **primitives** — document head/title (`useHead`),
  toasts, clipboard, media queries, click-outside, focus trap, observers,
  timing — the small composables every app otherwise rewrites.
- Typed **element factories** (`div`, `button`, `input`, `table`, …) plus
  `withMemo` — author components as plain render functions with a lighter
  toolchain (no template compiler, no `.vue` SFCs; run runtime-only Vue).
- Patterns for common things Vue itself doesn't ship — dialog layouts,
  dropdown menus, route-aware links — documented as recipes you copy into
  app code.

The lib is **additive**. It doesn't replace Vue's component model, reactivity
system, router, or anything else. It assumes you already have Vue 3 + Vue
Router + your chosen state management. It just gives you a sharper, more
opinionated layer for forms, tables, and async data.

## What vue-dsl isn't

To be honest about scope:

- **Not a Vue component library.** No prebuilt date pickers, modals,
  comboboxes, or rich text editors. The lib produces VNodes; you handle the
  visual layer via CSS and your own components.
- **Not a Vue plugin.** No `app.use(vueDsl)`. The lib is just composables and
  types you import.
- **Not an RPC layer.** `useQuery` and `useMutation` wrap any
  Promise-returning function. Bring your own client.
- **Not a router.** Use Vue Router. The lib stays out of routing.
- **Not optimized for very large interactive surfaces.** Suitable for typical
  dashboard sizes. For 10,000-row tables or virtualized lists, drop down to
  custom Vue components.
- **Not stable.** This is a personal lib. APIs change when better designs
  surface.

## Who it's for

You'll likely find vue-dsl useful if:

- You build Vue 3 apps with the Composition API and render functions (or
  templates) in strict TypeScript.
- You write your own backend and want the frontend to be a thin window
  into it.
- You want consistent patterns for forms, tables, and async data across
  multiple projects.
- You'd rather see and own your patterns than depend on a third-party form
  library.

You'll likely find it frustrating if:

- You expect a full component library out of the box.
- You want extensive customization options for every node type.
- You need the lib to follow a popular API convention (it doesn't try to
  match React Hook Form, Formik, TanStack Table, etc. — it's its own shape).

## Installation

Published to JSR as [`@jayobado/vue-dsl`](https://jsr.io/@jayobado/vue-dsl). Vue
is a peer dependency.

**Deno:**

```sh
deno add jsr:@jayobado/vue-dsl
```

Or pin in `deno.json`:

```jsonc
{
  "imports": {
    "@jayobado/vue-dsl": "jsr:@jayobado/vue-dsl@^0.2.4",
    "vue": "npm:vue@^3.5.13"
  }
}
```

**Node / npm** (via the JSR npm bridge):

```sh
npx jsr add @jayobado/vue-dsl
```

Prefer to vendor it? The lib is small and dependency-light (just Vue + an
optional Standard Schema validator) — copy `src/` into your project and import
from relative paths. Owning the patterns is fine; that's the original ethos.

### Entry points

```ts
import { useForm, useTable }     from '@jayobado/vue-dsl/dsl'
import { useQuery, useMutation } from '@jayobado/vue-dsl/query'
import { useHead, toast }        from '@jayobado/vue-dsl/primitives'
// …or everything from the root:
import { useForm, useQuery, useHead } from '@jayobado/vue-dsl'
```

| Entry | Contents |
| --- | --- |
| `./dsl` | the declarative node layer — `useForm` / `useTable` (plus setup-free `createFormEngine` / `createTableEngine` for nesting), the data-driven node vocabulary `renderAction`/`renderActionGroup`, `renderDisplay` (text/badge/image), and the container-content seam `renderContent` (leaf) / `createContentEngine` (full `PanelContent`, incl. nested forms & tables) |
| `./query` | `useQuery`, `useMutation` — reactive wrappers over any Promise |
| `./primitives` | headless composables: `useHead`, `useToasts`/`toast`, `useClipboard`, `useMediaQuery`, `useLocalStorage`, `useFloating`, `usePagination`, `useSelection`, `useClickOutside`, `useEscapeKey`, `useEventListener`, `useFocusTrap`, `useScrollLock`, `useResizeObserver`, `useIntersectionObserver`, `useDebounce`, `useInterval` |
| `./elements` | typed element factories (`div`, `button`, `input`, `table`, … + `ElProps`/`InputElProps`/…) and `withMemo` / `createMemoCache` — render-function authoring |
| `.` (root) | re-exports all of the above |

### Requirements

- Vue 3.5+ (Composition API)
- TypeScript with `strict: true`
- A bundler/dev server that handles TypeScript + Vue (Vite, or rolldown/esbuild via Deno)

### What you bring

- CSS. The lib produces VNodes with class names; the visual layer is yours.
- Your own data client. `useQuery` / `useMutation` wrap any Promise-returning
  function.
- A Standard Schema validator (Zod, Valibot, ArkType, …) if you want
  schema-based form validation. Rule-based validation works without one.

## Quick start

A minimal form using the lib:

```typescript
import { defineComponent, h } from 'vue'
import { useForm } from '@jayobado/vue-dsl/dsl'

interface NoteState {
	title: string
	body:  string
}

export const NewNoteView = defineComponent({
	setup() {
		const form = useForm<NoteState>({
			node: 'form',
			initial: { title: '', body: '' },
			onSubmit: async (state) => {
				await api.notes.create(state)
				// Navigate, show toast, etc.
			},
			children: [
				{ node: 'input',    name: 'title', label: 'Title', required: true },
				{ node: 'textarea', name: 'body',  label: 'Body',  rows: 5 },
				{ node: 'button',   label: 'Save', action: 'submit' },
			],
		})

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'New note'),
			form.render(),
		])
	},
})
```

> Field nodes use a `node` discriminant (`'input'`, `'select'`, `'textarea'`,
> `'checkbox'`, `'radio'`, `'array'`, `'steps'`, `'button'`), and the top-level
> form node is `node: 'form'`.

What's happening:

- **`useForm<NoteState>(node)`** declares a form. Generic over `TState` so
  field `name` references are type-checked against your state shape.
- **`form.render()`** returns a VNode tree (a `<form>` element with all field
  VNodes inside). Embed it in your component's render output.
- **Validation is reactive.** When state changes, validation runs
  automatically. Errors display only for fields the user has interacted with
  (the `touched` gating). On submit, all fields are marked touched.
- **The composable returns more than `render`.** You also get `state`,
  `errors`, `touched`, `loading`, and `controller` — all reactive refs you
  can read or pass to other parts of your component.

From here, you'd add schema validation, more field types, array sections for
tabular forms, steps for wizards, and a query composable for data fetching.
See [Concepts](docs/concepts.md) and [The declarative layer](docs/declarative.md).

### Data — `useQuery` / `useMutation`

Reactive wrappers over any Promise-returning function (bring your own client):

```ts
import { useQuery, useMutation } from '@jayobado/vue-dsl/query'

// fires immediately; re-runs when reactive deps change; stale results discarded
const { data: orders, loading, error, refetch } = useQuery(() => api.orders.list())

// manual; call mutate(...) when ready
const create = useMutation((input: NewOrder) => api.orders.create(input), {
	onSuccess: () => refetch(),
})
// create.mutate({ ... });  create.loading.value;  create.error.value
```

### Primitives

Headless composables — no markup, just reactive behavior:

```ts
import { useHead, toast, useMediaQuery, useClickOutside } from '@jayobado/vue-dsl/primitives'

useHead({ title: () => `Order ${order.value.id}` })  // reactive document title (+ meta)
toast.success('Saved')                                // imperative; useToasts() gives the reactive list + a renderer
const isMobile = useMediaQuery('(max-width: 768px)')  // Ref<boolean>, SSR-safe
useClickOutside(menuRef, () => (open.value = false))
```

### Elements — render-function authoring

Typed factories over `createVNode` for writing components without templates or
SFCs (so you can run runtime-only Vue and skip the template compiler). Pair with
`withMemo` to memoize static-heavy subtrees — the equivalent of the compiler's
`v-memo`, which hand-written render trees don't get for free:

```ts
import { defineComponent } from 'vue'
import { button, createMemoCache, div, h1, ul, withMemo } from '@jayobado/vue-dsl/elements'

export default defineComponent({
	props: { rows: { type: Array, required: true } },
	setup(props) {
		const cache = createMemoCache(1)
		return () =>
			div({ class: 'page' }, [
				h1(null, 'Orders'),
				withMemo([props.rows.length], () => ul(null, props.rows.map((r) => /* … */ r)), cache, 0),
				button({ type: 'submit', onClick: save }, 'Save'),
			])
	},
})
```

> This is a *lighter toolchain*, not raw speed — hand-written render trees miss
> the SFC compiler's static-hoisting/patch-flag optimizations; `withMemo` is how
> you claw that back where it matters.

## Where to go next

- **[Concepts](docs/concepts.md)** — the patterns the lib introduces on top
  of Vue: reactive validation with touched gating, controllers, declarative
  node trees, the array/steps composition model.
- **[The declarative layer](docs/declarative.md)** — forms, tables, arrays,
  steps — the full DSL surface.
- **[Primitives](docs/primitives.md)** — small composables for event
  handling, focus, observers, timing, positioning, and toasts.
- **[Examples](docs/examples.md)** — signup forms, login forms, expense
  entry, search boxes.
- **[Patterns](docs/patterns.md)** — app-level patterns built on top of
  the primitives: dialogs, dropdown menus, route-aware links.

## License

MIT. See [LICENSE](LICENSE).