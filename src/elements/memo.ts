import { markRaw, type VNode } from 'vue'

/**
 * Memoize a VNode by a dependency array — re-renders the subtree only when a dep
 * changes. The render-function equivalent of the template compiler's `v-memo` /
 * static hoisting, which hand-written render trees don't get for free.
 *
 *   const cache = createMemoCache(1)
 *   // inside render():
 *   withMemo([rows.length], () => h('ul', rows.map(renderRow)), cache, 0)
 */

interface MemoVNode extends VNode {
	_memo?: unknown[]
}

export function withMemo<T extends MemoVNode>(
	deps: unknown[],
	render: () => T,
	cache: (T | undefined)[],
	index: number,
): T {
	const cached = cache[index]
	if (cached && isMemoSame(cached, deps)) return cached
	const next = render()
	next._memo = deps
	cache[index] = next
	return next
}

function isMemoSame(cached: MemoVNode, deps: unknown[]): boolean {
	const memo = cached._memo
	if (!memo || memo.length !== deps.length) return false
	for (let i = 0; i < deps.length; i++) {
		if (deps[i] !== memo[i]) return false
	}
	return true
}

/** A fixed-size, non-reactive cache for `withMemo` (one slot per memoized subtree). */
export function createMemoCache(size: number): (MemoVNode | undefined)[] {
	return markRaw(new Array<MemoVNode | undefined>(size).fill(undefined))
}
