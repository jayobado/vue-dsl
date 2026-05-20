# Patterns

App-level patterns vue-dsl doesn't ship — built on top of the primitives.
The lib deliberately keeps its surface narrow (forms, tables, queries,
primitives), leaving styling, layout, and domain-specific shapes to the app.
This doc shows a handful of patterns that come up often enough to be worth
documenting as recipes.

Each pattern is yours to copy into your app and adapt. The code here is a
starting point, not a library. Adjust the shape, classes, and behavior to
your design system.

## Dialog layouts

Vue 3 ships `<Teleport>` for portal mounting. vue-dsl's primitives handle
focus trapping, scroll locking, and escape key. The layout — title, body,
actions — is yours to define.

A reusable Dialog component:

```typescript
import { defineComponent, h, ref, Teleport, watch, type VNode } from 'vue'
import {
	useFocusTrap,
	useScrollLock,
	useEscapeKey,
} from '@/lib/vue-dsl/primitives'

interface DialogAction {
	label:    string
	onClick:  () => void
	primary?: boolean
	disabled?: boolean
}

export const Dialog = defineComponent({
	props: {
		open:     { type: Boolean, required: true },
		title:    { type: String, required: true },
		body:     { type: [String, Object] as () => string | VNode },
		actions:  { type: Array as () => readonly DialogAction[], default: () => [] },
		onClose:  { type: Function as () => () => void, required: true },
	},
	setup(props) {
		const containerRef = ref<HTMLElement | null>(null)
		const focusTrap    = useFocusTrap(containerRef)
		const scrollLock   = useScrollLock()

		useEscapeKey(() => {
			if (props.open) props.onClose()
		})

		watch(() => props.open, (isOpen) => {
			if (isOpen) {
				focusTrap.activate()
				scrollLock.lock()
			} else {
				focusTrap.deactivate()
				scrollLock.unlock()
			}
		}, { immediate: true })

		return () => {
			if (!props.open) return null

			return h(Teleport, { to: 'body' }, [
				h('div', {
					class:   'dialog-backdrop',
					onClick: () => props.onClose(),
				}),
				h('div', {
					ref:     containerRef,
					class:   'dialog',
					role:    'dialog',
					'aria-modal': 'true',
					onClick: (e: Event) => e.stopPropagation(),
				}, [
					h('header', { class: 'dialog-header' }, [
						h('h2', { class: 'dialog-title' }, props.title),
					]),
					h('div', { class: 'dialog-body' },
						typeof props.body === 'string'
							? props.body
							: props.body ? [props.body] : [],
					),
					props.actions.length > 0
						? h('footer', { class: 'dialog-actions' },
							props.actions.map(action =>
								h('button', {
									type:     'button',
									class:    action.primary ? 'btn btn-primary' : 'btn',
									onClick:  action.onClick,
									disabled: action.disabled ?? false,
								}, action.label)
							)
						)
						: null,
				]),
			])
		}
	},
})
```

Usage:

```typescript
import { defineComponent, h, ref } from 'vue'
import { Dialog } from '@/components/Dialog'

export const UserListView = defineComponent({
	setup() {
		const deleteOpen = ref(false)
		const userToDelete = ref<User | null>(null)

		const openDelete = (user: User) => {
			userToDelete.value = user
			deleteOpen.value   = true
		}

		const confirmDelete = async () => {
			if (userToDelete.value) {
				await api.users.delete(userToDelete.value.id)
				deleteOpen.value = false
			}
		}

		return () => h('div', { class: 'page' }, [
			h('h1', null, 'Users'),
			// ... user list ...
			h(Dialog, {
				open:    deleteOpen.value,
				title:   'Delete user',
				body:    `Are you sure you want to delete ${userToDelete.value?.name}?`,
				onClose: () => { deleteOpen.value = false },
				actions: [
					{ label: 'Cancel', onClick: () => { deleteOpen.value = false } },
					{ label: 'Delete', onClick: confirmDelete, primary: true },
				],
			}),
		])
	},
})
```

The Dialog component handles:

- **Teleport to `<body>`** — so the dialog escapes any overflow-hidden
  ancestors.
- **Backdrop click closes** — clicking outside the dialog content fires
  `onClose`.
- **Focus trap** — `Tab` and `Shift+Tab` cycle within the dialog while open.
- **Scroll lock** — body scroll disabled while open.
- **Escape key closes** — `useEscapeKey` from primitives.

Style the `.dialog-backdrop`, `.dialog`, `.dialog-header`, `.dialog-body`,
`.dialog-actions` classes to match your design system.

### Why it lives in app code

This component isn't in vue-dsl because the layout decisions are
app-specific. Some apps want the title in a colored bar; some want actions
on the left; some want a close-X in the corner. vue-dsl can't ship one
layout that fits all apps. The component is small enough (~80 lines) that
copying it per app is the right tradeoff.

## Confirm helper

A common dialog pattern is "are you sure?" — wait for a yes/no answer, then
proceed. Wrap the dialog in a promise via a global mount point:

```typescript
import { createApp, h, ref, type App } from 'vue'
import { Dialog } from '@/components/Dialog'

interface ConfirmOpts {
	title:         string
	body:          string
	confirmLabel?: string
	cancelLabel?:  string
	destructive?:  boolean
}

export function confirm(opts: ConfirmOpts): Promise<boolean> {
	return new Promise((resolve) => {
		const container = document.createElement('div')
		document.body.appendChild(container)

		let app: App | null = null
		const open = ref(true)

		const cleanup = (result: boolean) => {
			open.value = false
			setTimeout(() => {
				if (app) app.unmount()
				container.remove()
				resolve(result)
			}, 0)
		}

		app = createApp({
			setup() {
				return () => h(Dialog, {
					open:    open.value,
					title:   opts.title,
					body:    opts.body,
					onClose: () => cleanup(false),
					actions: [
						{
							label:   opts.cancelLabel ?? 'Cancel',
							onClick: () => cleanup(false),
						},
						{
							label:   opts.confirmLabel ?? 'Confirm',
							onClick: () => cleanup(true),
							primary: !opts.destructive,
						},
					],
				})
			},
		})

		app.mount(container)
	})
}
```

Usage:

```typescript
const onDelete = async () => {
	const ok = await confirm({
		title:        'Delete user',
		body:         'This cannot be undone.',
		confirmLabel: 'Delete',
		destructive:  true,
	})
	if (ok) {
		await deleteUser()
	}
}
```

The `destructive` option flips the primary styling — when destructive, the
"confirm" button is *not* primary, so a careless reader won't accidentally
hit it. A small detail, worth getting right.

The implementation mounts a fresh Vue app for each confirm call. This keeps
the confirm helper isolated from the calling component's lifecycle — useful
because the calling component might unmount before the user responds (e.g.,
the user navigates away mid-confirm).

### Other promise-returning dialogs

The same pattern extends to:

- **`prompt({ title, body, placeholder })`** — show an input, resolve with
  the entered value or `null` on cancel.
- **`alert({ title, body })`** — single-action notification, resolve when
  acknowledged.

Build them as you need them. The pattern is always: mount a Dialog with the
shape you want, resolve the promise based on which action fired.

## Dropdown menus

A dropdown menu combines `useFloating` for positioning, `useClickOutside`
for dismissal, and `useEscapeKey` for keyboard. All three are in
vue-dsl/primitives.

```typescript
import { defineComponent, h, ref, type VNode } from 'vue'
import {
	useFloating,
	useClickOutside,
	useEscapeKey,
} from '@/lib/vue-dsl/primitives'

interface MenuItem {
	label:    string
	onClick:  () => void
	disabled?: boolean
	icon?:     VNode
}

export const Menu = defineComponent({
	props: {
		items:   { type: Array as () => readonly MenuItem[], required: true },
		trigger: { type: Object as () => VNode, required: true },
	},
	setup(props) {
		const isOpen     = ref(false)
		const triggerRef = ref<HTMLElement | null>(null)
		const menuRef    = ref<HTMLElement | null>(null)

		const { x, y, placement, isReady } = useFloating(triggerRef, menuRef, {
			placement: 'bottom-start',
			offset:    4,
			flip:      true,
			shift:     true,
		})

		useClickOutside(menuRef, () => {
			if (isOpen.value) isOpen.value = false
		})

		useEscapeKey(() => {
			if (isOpen.value) isOpen.value = false
		})

		return () => h('div', { class: 'menu-container' }, [
			h('div', {
				ref: triggerRef,
				onClick: (e: Event) => {
					e.stopPropagation()
					isOpen.value = !isOpen.value
				},
			}, [props.trigger]),

			isOpen.value && isReady.value
				? h('ul', {
					ref:   menuRef,
					class: 'menu',
					style: {
						position: 'fixed',
						left:     `${x.value}px`,
						top:      `${y.value}px`,
					},
					'data-placement': placement.value,
				}, props.items.map(item =>
					h('li', { class: 'menu-item' }, [
						h('button', {
							type:     'button',
							class:    'menu-item-button',
							disabled: item.disabled ?? false,
							onClick:  () => {
								item.onClick()
								isOpen.value = false
							},
						}, [
							item.icon ?? null,
							h('span', { class: 'menu-item-label' }, item.label),
						].filter(Boolean))
					])
				))
				: null,
		])
	},
})
```

Usage:

```typescript
const actionsButton = h('button', { class: 'btn' }, 'Actions')

return () => h(Menu, {
	trigger: actionsButton,
	items: [
		{ label: 'Edit',      onClick: () => editUser(user) },
		{ label: 'Duplicate', onClick: () => duplicateUser(user) },
		{
			label:    'Delete',
			onClick:  () => deleteUser(user),
			disabled: !canDelete(user),
		},
	],
})
```

The component:

- Uses `useFloating` to position the menu (handles flip/shift for viewport
  edges).
- Closes on click-outside via `useClickOutside`.
- Closes on escape key via `useEscapeKey`.
- Wires each item's click to the item's handler and closes the menu.
- Stops propagation on the trigger click so click-outside doesn't
  immediately re-close.

### Variations

For divider items, item groups, or nested submenus, extend the `MenuItem`
type. A divider could be:

```typescript
type MenuItem =
	| { kind: 'item';     label: string; onClick: () => void; disabled?: boolean }
	| { kind: 'divider' }
```

And the loop renders dividers as `<hr>` between items. The base helper
stays small; variations live in the same file or in domain-specific
helpers.

## Route-aware links

Vue Router's `useRoute()` returns the current route reactively. Combine
that with `RouterLink` to build auto-highlighting links:

```typescript
import { defineComponent, h, computed, type VNode } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

interface ActiveLinkProps {
	to:           string
	label:        string
	activeClass?: string
	icon?:        VNode
}

export const ActiveLink = defineComponent<ActiveLinkProps>({
	props: ['to', 'label', 'activeClass', 'icon'] as never,
	setup(props) {
		const route = useRoute()
		const isActive = computed(() => {
			return route.path === props.to
				|| route.path.startsWith(props.to + '/')
		})

		return () => h(RouterLink, {
			to: props.to,
			class: [
				'nav-link',
				isActive.value && (props.activeClass ?? 'nav-link--active'),
			].filter(Boolean),
		}, () => [
			props.icon ?? null,
			h('span', { class: 'nav-link-label' }, props.label),
		].filter(Boolean))
	},
})
```

Usage in a sidebar:

```typescript
const Sidebar = defineComponent({
	setup() {
		return () => h('nav', { class: 'sidebar' }, [
			h(ActiveLink, { to: '/dashboard', label: 'Dashboard' }),
			h(ActiveLink, { to: '/users',     label: 'Users' }),
			h(ActiveLink, { to: '/reports',   label: 'Reports' }),
			h(ActiveLink, { to: '/settings',  label: 'Settings' }),
		])
	},
})
```

A few real points:

- **Prefix matching for nested routes.** Checking `route.path.startsWith(
  props.to + '/')` means `/users/123` highlights the `/users` link. Adjust
  to exact-only (`route.path === props.to`) if you want different behavior.
- **`RouterLink` handles SPA navigation.** No need to add `onClick` for
  intercepting native clicks — Vue Router does that.
- **`computed` for active state.** Re-evaluates only when `route.path`
  changes.

### Building a full nav

A real sidebar with sections is composition:

```typescript
export const Sidebar = defineComponent({
	setup() {
		return () => h('nav', { class: 'sidebar' }, [
			h('section', { class: 'sidebar-section' }, [
				h('h3', { class: 'sidebar-heading' }, 'Operations'),
				h(ActiveLink, { to: '/dashboard', label: 'Dashboard' }),
				h(ActiveLink, { to: '/orders',    label: 'Orders' }),
				h(ActiveLink, { to: '/customers', label: 'Customers' }),
			]),
			h('section', { class: 'sidebar-section' }, [
				h('h3', { class: 'sidebar-heading' }, 'Analytics'),
				h(ActiveLink, { to: '/reports',  label: 'Reports' }),
				h(ActiveLink, { to: '/insights', label: 'Insights' }),
			]),
		])
	},
})
```

Style the `.sidebar`, `.sidebar-section`, `.sidebar-heading`, `.nav-link`,
and `.nav-link--active` classes to match your design.

For collapsible sections, mobile breakpoints, or keyboard navigation, build
those on top. They're not universal; they're product decisions.

## Why these aren't in vue-dsl

Each of these patterns has the same shape: vue-dsl provides the universal
primitives (focus trap, scroll lock, escape key, click-outside, floating
positioning) plus the lib's core scope (forms, tables, queries). The app
provides the structural composition (the dialog layout, the menu styling,
the sidebar shape).

vue-dsl owns the universal behaviors. Vue itself owns the rendering and
lifecycle. Apps own structural and visual decisions. The helpers in this
doc show how to compose vue-dsl's primitives into common app shapes — copy
them, modify them, make them yours.

## Where to go next

If you've read every doc in order, you've covered:

- **[Concepts](concepts.md)** — the patterns the lib introduces.
- **[The declarative layer](declarative.md)** — forms, tables, arrays,
  steps.
- **[Primitives](primitives.md)** — the building blocks.
- **[Examples](examples.md)** — real shapes.
- **[Patterns](patterns.md)** — this doc.

The source is the next layer of detail. The lib is small enough to read in
a sitting — modules in `/dsl`, `/query`, and `/primitives` are each
focused enough to skim individually.