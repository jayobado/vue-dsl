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

vue-dsl is meant to be copied into your project's `lib/` folder, not
installed via a package manager. The expected layout:

```
your-project/
  src/
    lib/
      vue-dsl/
        dsl/
        query/
        primitives/
        mod.ts
        ...
```

Once copied, import from relative paths:

```typescript
import { useForm } from '@/lib/vue-dsl/dsl'
import { useQuery } from '@/lib/vue-dsl/query'
```

Path aliases (e.g., `@/lib/vue-dsl`) work with most Vue 3 toolchains (Vite,
unbuild, etc.). Configure your `tsconfig.json` paths to match.

### Requirements

- Vue 3 (Composition API)
- TypeScript with `strict: true`
- A bundler/dev server that handles TypeScript and Vue (Vite is the standard)

### What you bring

- CSS. The lib produces VNodes with class names; the visual layer is yours.
- Your own RPC client. The query composables wrap any Promise-returning
  function.
- Standard Schema (Zod, Valibot, ArkType, etc.) if you want schema-based form
  validation. Rule-based validation works without one.

## Quick start

A minimal form using the lib:

```typescript
import { defineComponent, h } from 'vue'
import { useForm } from '@/lib/vue-dsl/dsl'

interface NoteState {
	title: string
	body:  string
}

export const NewNoteView = defineComponent({
	setup() {
		const form = useForm<NoteState>({
			initial: { title: '', body: '' },
			onSubmit: async (state) => {
				await api.notes.create(state)
				// Navigate, show toast, etc.
			},
			children: [
				{ type: 'input',    name: 'title', label: 'Title', required: true },
				{ type: 'textarea', name: 'body',  label: 'Body',  rows: 5 },
				{ type: 'button',   label: 'Save', action: 'submit' },
			],
		})

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'New note'),
			form.render(),
		])
	},
})
```

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