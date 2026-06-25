import { onScopeDispose, watchEffect } from 'vue'

/** A `<meta>` tag to manage — provide `name` or `property`, plus `content`. */
export interface HeadMeta {
	name?: string
	property?: string
	content: string
}

export interface UseHeadOptions {
	/** Document title — a string, or a getter for data-dependent titles. */
	title?: string | (() => string)
	/** `<meta>` tags to add while this scope is alive — a list, or a getter. */
	meta?: readonly HeadMeta[] | (() => readonly HeadMeta[])
}

/**
 * Reactively manage the document head (title + meta) for the current component.
 *
 *   useHead({ title: 'Home' })
 *   useHead({ title: () => `Order ${props.order.id}` })
 *   useHead({ meta: [{ name: 'description', content: 'My app' }] })
 *
 * The title updates whenever it changes; the next component's `useHead` takes
 * over on navigation. Meta tags are added on mount and removed on scope dispose,
 * so they don't leak across pages.
 *
 * No-op during SSR (no `document`). For data-dependent values, pass a getter so
 * the effect tracks your reactive sources.
 */
export function useHead(options: UseHeadOptions): void {
	if (typeof document === 'undefined') return

	const { title, meta } = options

	if (title !== undefined) {
		watchEffect(() => {
			document.title = typeof title === 'function' ? title() : title
		})
	}

	if (meta !== undefined) {
		const managed: HTMLMetaElement[] = []
		const clear = (): void => {
			for (const el of managed) el.remove()
			managed.length = 0
		}

		watchEffect(() => {
			clear()
			const tags = typeof meta === 'function' ? meta() : meta
			for (const tag of tags) {
				const el = document.createElement('meta')
				if (tag.name) el.setAttribute('name', tag.name)
				if (tag.property) el.setAttribute('property', tag.property)
				el.setAttribute('content', tag.content)
				document.head.appendChild(el)
				managed.push(el)
			}
		})

		onScopeDispose(clear)
	}
}
