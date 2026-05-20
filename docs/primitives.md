# Primitives

Small composables for common patterns — event handling, focus/scroll
management, observers, timing, layout helpers, clipboard, and toasts. These
are the building blocks vue-dsl uses internally and that you'll reach for in
app code.

Each primitive is independent — you can use any of them on their own without
the rest of vue-dsl.

All event-based primitives (click-outside, escape key, listeners, observers,
intervals, etc.) auto-clean-up when the calling component unmounts via Vue's
lifecycle. You don't need to dispose them manually.

## Event handling

### useClickOutside

Fire a handler when a click lands outside an element.

```typescript
import { ref } from 'vue'
import { useClickOutside } from '@/lib/vue-dsl/primitives'

const elRef = ref<HTMLElement | null>(null)

useClickOutside(elRef, (event) => {
	// User clicked outside elRef.value
	closeDropdown()
})
```

Listens to the document for click events. When a click lands inside `elRef`,
the handler doesn't fire. Useful for dismissing dropdowns, popovers, and
modals when the user clicks elsewhere.

The handler receives the original MouseEvent. The composable handles cleanup
on unmount.

### useEscapeKey

Fire a handler when the Escape key is pressed.

```typescript
import { useEscapeKey } from '@/lib/vue-dsl/primitives'

useEscapeKey(() => {
	closeModal()
})
```

Listens globally. The handler fires on any Escape keypress, regardless of
focus. Useful for dismissing overlays.

### useEventListener

Add an event listener with automatic cleanup on unmount.

```typescript
import { ref } from 'vue'
import { useEventListener } from '@/lib/vue-dsl/primitives'

const elRef = ref<HTMLElement | null>(null)

useEventListener(elRef, 'mousemove', (e) => {
	// Handle mouse move
})

// Or on window:
useEventListener(window, 'resize', () => {
	// Handle resize
})
```

A thin wrapper over `addEventListener` that handles cleanup. The target can
be a ref to an element, a direct element, or `window`/`document`. If the
ref's value changes, the listener moves to the new element.

## Focus and scroll

### useFocusTrap

Trap keyboard focus inside an element while active.

```typescript
import { ref } from 'vue'
import { useFocusTrap } from '@/lib/vue-dsl/primitives'

const modalRef = ref<HTMLElement | null>(null)

const trap = useFocusTrap(modalRef)
// trap.active.value === true while active
// trap.activate(), trap.deactivate()
```

When active, Tab and Shift+Tab cycle through focusable elements inside the
ref. The composable starts inactive; call `trap.activate()` when you want
trapping (e.g., when a modal opens). Call `trap.deactivate()` when done
(e.g., when the modal closes). Focus is automatically restored to the
previously focused element on deactivation.

### useScrollLock

Prevent body scroll.

```typescript
import { useScrollLock } from '@/lib/vue-dsl/primitives'

const scrollLock = useScrollLock()

scrollLock.lock()    // body scroll disabled
scrollLock.unlock()  // body scroll restored
// scrollLock.isLocked.value tracks state
```

Used when modals or overlays should prevent background scrolling. Multiple
calls to `lock()` are reference-counted — the scroll only unlocks when all
locks are released. Always auto-unlocks on unmount.

## Reactive browser state

### useMediaQuery

A ref tracking whether a media query matches.

```typescript
import { useMediaQuery } from '@/lib/vue-dsl/primitives'

const isMobile  = useMediaQuery('(max-width: 768px)')
const isPrint   = useMediaQuery('print')
const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

// isMobile.value is reactively true/false
```

Returns `Ref<boolean>`. Updates when the query result changes. Useful for
responsive layouts that need to react to viewport changes beyond what CSS
handles.

### useLocalStorage

A ref backed by `localStorage`, synced across the same origin.

```typescript
import { useLocalStorage } from '@/lib/vue-dsl/primitives'

const theme = useLocalStorage<'light' | 'dark'>('theme', 'light')

// theme.value === 'light' (or whatever's in storage)
theme.value = 'dark'   // writes to localStorage and updates the ref
```

Reads the initial value from localStorage; falls back to the second argument
if no stored value. Subsequent reads/writes via the ref are synced with
localStorage automatically.

The composable also listens for storage events from other tabs — if the
value changes in another tab, the ref updates in this one. Useful for
preferences shared across tabs.

Serialization is JSON. Don't store non-JSON-serializable values (Dates,
Functions, etc.).

## Observers

### useResizeObserver

Observe size changes of an element.

```typescript
import { ref } from 'vue'
import { useResizeObserver } from '@/lib/vue-dsl/primitives'

const elRef = ref<HTMLElement | null>(null)

useResizeObserver(elRef, (entry) => {
	const { width, height } = entry.contentRect
	// React to size change
})
```

Wraps `ResizeObserver` with auto-cleanup. The callback fires when the
observed element's size changes. Useful for responsive components that need
to know their own dimensions (canvas elements, chart libraries, layout
helpers).

### useIntersectionObserver

Observe an element's intersection with a target (typically the viewport).

```typescript
import { ref } from 'vue'
import { useIntersectionObserver } from '@/lib/vue-dsl/primitives'

const elRef = ref<HTMLElement | null>(null)

useIntersectionObserver(elRef, (entry) => {
	if (entry.isIntersecting) {
		// Element entered viewport
		loadMore()
	}
}, {
	rootMargin: '100px',   // optional
	threshold:  0.1,       // optional
})
```

Wraps `IntersectionObserver` with auto-cleanup. Common uses: infinite
scroll triggers, lazy-loaded images, sticky-when-scrolled-past patterns.

## Timing

### useDebounce

Debounce a function call.

```typescript
import { ref, watch } from 'vue'
import { useDebounce } from '@/lib/vue-dsl/primitives'

const search = ref('')
const debouncedSearch = useDebounce(search, 300)

watch(debouncedSearch, (value) => {
	// Fires 300ms after the user stops typing
	performSearch(value)
})
```

Two forms:

**Debounce a ref** — the returned ref updates with a delay after the source
ref changes:

```typescript
const debouncedRef = useDebounce(sourceRef, ms)
```

**Debounce a function** — the returned function delays execution:

```typescript
const handleInput = useDebounce(() => doSomething(), 300)
handleInput()   // queued; fires 300ms later if not re-called
```

The function form returns the debounced callable. The ref form returns a
new ref. Both forms cancel pending invocations on unmount.

### useInterval

Run a function on an interval, with automatic cleanup.

```typescript
import { useInterval } from '@/lib/vue-dsl/primitives'

const interval = useInterval(() => {
	refetchData()
}, 5000)

// interval.start(), interval.stop(), interval.isActive.value
```

Returns `{ start, stop, isActive }`. The interval starts automatically when
the composable is called. Stops on component unmount. Can be controlled
manually if you want to pause/resume.

## Layout helpers

### useFloating

Position a floating element relative to an anchor. Handles placement,
offset, flipping, shifting, and size constraints.

```typescript
import { ref } from 'vue'
import { useFloating } from '@/lib/vue-dsl/primitives'

const anchor   = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)

const { x, y, placement, isReady } = useFloating(anchor, floating, {
	placement:  'bottom-start',
	offset:     8,
	flip:       true,
	shift:      true,
	autoUpdate: true,
})

// Use the returned values to position the floating element:
return () => h('div', {
	ref:   floating,
	style: {
		position: 'fixed',
		left:     `${x.value}px`,
		top:      `${y.value}px`,
	},
	'data-placement': placement.value,
}, [/* content */])
```

**Options:**

- **`placement`** — one of `'top'`, `'top-start'`, `'top-end'`,
  `'bottom'`, `'bottom-start'`, `'bottom-end'`, `'left'`, `'left-start'`,
  `'left-end'`, `'right'`, `'right-start'`, `'right-end'`. Default
  `'bottom-start'`.
- **`offset`** — distance in pixels between anchor and floating element.
  Default 0.
- **`flip`** — if true, switches to the opposite placement when the chosen
  one would overflow the viewport. Default true.
- **`shift`** — if true, shifts the element along the cross-axis to keep
  it in view. Default true.
- **`size`** — `'width'`, `'height'`, `'both'`, or `false`. When set,
  constrains the floating element's size to fit available space. Default
  `false`.
- **`autoUpdate`** — if true, recomputes position on scroll/resize. Default
  true.

**Returns:**

- **`x`**, **`y`** — `Ref<number>`. The computed coordinates.
- **`placement`** — `Ref<Placement>`. The actually-chosen placement after
  any flipping. May differ from the requested placement.
- **`isReady`** — `Ref<boolean>`. True once both refs are mounted and the
  first computation has run.

Common usage patterns:

- **Dropdowns**: `placement: 'bottom-start'`, `offset: 4`.
- **Tooltips**: `placement: 'top'`, `offset: 8`.
- **Context menus**: `placement: 'bottom-start'`, `offset: 2`, position
  based on click coordinates.
- **Popovers**: `placement: 'bottom'`, `offset: 12`, `size: 'width'` to
  constrain wide content.

### usePagination

Compute pagination state from current page, page size, and total items.

```typescript
import { ref } from 'vue'
import { usePagination } from '@/lib/vue-dsl/primitives'

const page      = ref(1)
const pageSize  = 20
const totalRows = ref(350)

const pagination = usePagination(page, totalRows, pageSize)

// pagination.totalPages.value === 18
// pagination.canPrev.value === false
// pagination.canNext.value === true
// pagination.startIndex.value === 0
// pagination.endIndex.value === 19
// pagination.prev(), pagination.next(), pagination.goTo(n)
```

Useful when you have pagination UI outside a vue-dsl table — e.g., a custom
list view, a calendar grid, etc. The table DSL handles its own pagination
internally; use this composable for cases that aren't tables.

### useSelection

Manage a set of selected items reactively.

```typescript
import { useSelection } from '@/lib/vue-dsl/primitives'

const selection = useSelection<string>()

selection.add('user-1')
selection.add('user-2')
selection.toggle('user-1')   // removes it
selection.has('user-2')      // true
selection.clear()

// selection.selected is a Ref<Set<T>>
// selection.size.value === current count
// selection.isEmpty.value === boolean
```

Wraps a `Set<T>` with reactive accessors. Useful for multi-select tables,
checkbox lists, batch actions. Pass to a vue-dsl table via custom row
rendering to track selection.

## Clipboard

### useClipboard

Read from and write to the clipboard.

```typescript
import { useClipboard } from '@/lib/vue-dsl/primitives'

const clipboard = useClipboard()

await clipboard.write('Some text')
const text = await clipboard.read()

// clipboard.lastWritten.value tracks the most recent write
// clipboard.isSupported.value === boolean
```

Wraps the Clipboard API with error handling. `write()` and `read()` return
Promises. The composable also tracks the most recently written text in a
reactive ref — useful for "Copied!" confirmation UI.

Clipboard access requires HTTPS (or localhost) and may prompt for
permission depending on the browser.

## Notifications

### useToasts

Show transient toast notifications.

```typescript
import { useToasts } from '@/lib/vue-dsl/primitives'

// In setup():
const toasts = useToasts()

toasts.success('User created')
toasts.error('Network error')
toasts.show('Custom message', { kind: 'info', duration: 5000 })

// toasts.toasts is Ref<readonly Toast[]> — render them:
return () => h('div', { class: 'toast-container' },
	toasts.toasts.value.map(t => h('div', {
		key:   t.id,
		class: ['toast', `toast--${t.kind}`],
	}, t.message))
)
```

**Methods:**

- **`show(message, opts?)`** — show a toast. Returns the toast id.
- **`info(message, opts?)`**, **`success(...)`**, **`warning(...)`**,
  **`error(...)`** — shortcuts with `kind` preset.
- **`dismiss(id)`** — remove a specific toast.
- **`clear()`** — remove all toasts.

**Options:**

- **`kind`** — `'info'`, `'success'`, `'warning'`, `'error'`. Default
  `'info'`.
- **`duration`** — milliseconds before auto-dismissal. `0` means
  persistent. Default 3000.

**Returns:**

- **`toasts`** — `Ref<readonly Toast[]>`. Reactive list of current toasts.
- All the methods above.

State is module-level — all calls to `useToasts()` share the same toast
list. This means you have one toast container component (typically in your
app root) that renders the toasts, and any component can call methods to
add to the list.

### toast

The same toast state, exposed as a singleton object for imperative calls.

```typescript
import { toast } from '@/lib/vue-dsl/primitives'

toast.success('Saved')
toast.error('Failed to save')

// Same as toasts.success() via useToasts() — they share state.
```

Useful for calls outside of component setup — API error handlers, route
guards, store actions. Same methods as `useToasts()` minus the `toasts`
ref (since you can't reactively read state from non-component code anyway).

The convention: use `useToasts()` in components (where you have a setup
function); use `toast` everywhere else.

## See also

- **[Concepts](concepts.md)** — the patterns the lib introduces.
- **[The declarative layer](declarative.md)** — forms, tables, arrays,
  steps.
- **[Patterns](patterns.md)** — app-level patterns using these primitives.