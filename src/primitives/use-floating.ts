import { onScopeDispose, ref, watch, isRef, type Ref } from 'vue'

export type Placement =
	| 'top' | 'top-start' | 'top-end'
	| 'bottom' | 'bottom-start' | 'bottom-end'
	| 'left' | 'left-start' | 'left-end'
	| 'right' | 'right-start' | 'right-end'

export type SizeBehavior = 'width' | 'height' | 'both' | false

export interface UseFloatingOptions {
	/**
	 * Initial placement preference. Default 'bottom-start'.
	 */
	placement?: Placement

	/**
	 * Distance in pixels between anchor and floating element. Default 0.
	 */
	offset?: number

	/**
	 * If true, switches to the opposite placement when the chosen one
	 * would overflow the viewport. Default true.
	 */
	flip?: boolean

	/**
	 * If true, shifts the element along the cross-axis to keep it in view
	 * even when the anchor is near a viewport edge. Default true.
	 */
	shift?: boolean

	/**
	 * Constrains the floating element's size to fit available space.
	 * Default false (no constraint).
	 */
	size?: SizeBehavior

	/**
	 * If true, recomputes position on scroll/resize. Default true.
	 */
	autoUpdate?: boolean
}

export interface UseFloatingReturn {
	x: Ref<number>
	y: Ref<number>
	placement: Ref<Placement>
	maxWidth: Ref<number | null>
	maxHeight: Ref<number | null>
	isReady: Ref<boolean>
}

type AnchorTarget = Ref<HTMLElement | null> | HTMLElement
type FloatingTarget = Ref<HTMLElement | null> | HTMLElement

interface Rect {
	x: number   // top-left x (viewport coords)
	y: number   // top-left y (viewport coords)
	width: number
	height: number
}

interface PositionResult {
	x: number
	y: number
	placement: Placement
	maxWidth: number | null
	maxHeight: number | null
}

// ─── Placement math ─────────────────────────────────────────────────────

/**
 * Compute the position of a floating element relative to an anchor, given
 * a placement preference and offset. Returns viewport-relative coords for
 * `position: fixed` use.
 *
 * This is the pure positioning math — no flip, no shift, no clamping.
 * It just answers "if you wanted exactly this placement, where would the
 * floating element go?"
 */
function computePosition(
	anchor: Rect,
	floating: Rect,
	placement: Placement,
	offset: number,
): { x: number; y: number } {
	let x = 0
	let y = 0

	const [side, alignment] = parsePlacement(placement)

	switch (side) {
		case 'top':
			y = anchor.y - floating.height - offset
			x = computeMainAxis(anchor, floating, alignment, 'horizontal')
			break
		case 'bottom':
			y = anchor.y + anchor.height + offset
			x = computeMainAxis(anchor, floating, alignment, 'horizontal')
			break
		case 'left':
			x = anchor.x - floating.width - offset
			y = computeMainAxis(anchor, floating, alignment, 'vertical')
			break
		case 'right':
			x = anchor.x + anchor.width + offset
			y = computeMainAxis(anchor, floating, alignment, 'vertical')
			break
	}

	return { x, y }
}

type Side = 'top' | 'bottom' | 'left' | 'right'
type Alignment = 'start' | 'center' | 'end'

function parsePlacement(placement: Placement): [Side, Alignment] {
	const parts = placement.split('-') as [Side, 'start' | 'end' | undefined]
	return [parts[0], parts[1] ?? 'center']
}

function buildPlacement(side: Side, alignment: Alignment): Placement {
	if (alignment === 'center') return side
	return `${side}-${alignment}` as Placement
}

/**
 * Compute the main-axis coordinate (the axis perpendicular to the side).
 * For top/bottom sides: the x coordinate. For left/right: the y coordinate.
 *
 * Alignment:
 *   - start:  align floating's start edge with anchor's start edge
 *   - center: center floating on anchor (default)
 *   - end:    align floating's end edge with anchor's end edge
 */
function computeMainAxis(
	anchor: Rect,
	floating: Rect,
	alignment: Alignment,
	axis: 'horizontal' | 'vertical',
): number {
	const anchorStart = axis === 'horizontal' ? anchor.x : anchor.y
	const anchorSize = axis === 'horizontal' ? anchor.width : anchor.height
	const floatingSize = axis === 'horizontal' ? floating.width : floating.height

	switch (alignment) {
		case 'start':
			return anchorStart
		case 'center':
			return anchorStart + anchorSize / 2 - floatingSize / 2
		case 'end':
			return anchorStart + anchorSize - floatingSize
	}
}

function getRect(el: HTMLElement): Rect {
	const r = el.getBoundingClientRect()
	return { x: r.x, y: r.y, width: r.width, height: r.height }
}

function getViewportRect(): Rect {
	return {
		x: 0,
		y: 0,
		width: globalThis.innerWidth,
		height: globalThis.innerHeight,
	}
}

// primitives/use-floating.ts (piece 2 of 6 — flip logic)

/**
 * Detect whether a floating element at a given position would overflow
 * the viewport. Returns the overflow amounts on each side (positive means
 * overflowing by that many pixels; zero or negative means fits).
 */
interface Overflow {
	top: number
	bottom: number
	left: number
	right: number
}

function detectOverflow(
	x: number,
	y: number,
	width: number,
	height: number,
	viewport: Rect,
): Overflow {
	return {
		top: viewport.y - y,
		bottom: (y + height) - (viewport.y + viewport.height),
		left: viewport.x - x,
		right: (x + width) - (viewport.x + viewport.width),
	}
}

/**
 * Given a placement, return its opposite (flipped on the main axis).
 * Used by flip logic when the requested placement overflows.
 *
 *   top    <-> bottom
 *   left   <-> right
 *
 * Alignment is preserved (e.g., top-start flips to bottom-start).
 */
function flipPlacement(placement: Placement): Placement {
	const [side, alignment] = parsePlacement(placement)
	const opposite: Record<Side, Side> = {
		top: 'bottom',
		bottom: 'top',
		left: 'right',
		right: 'left',
	}
	return buildPlacement(opposite[side], alignment)
}

/**
 * Apply flip middleware. If the chosen placement overflows the viewport
 * on its main axis (e.g., top placement overflows the top edge), try the
 * opposite placement. Pick whichever has less overflow.
 *
 * Returns the chosen placement and the resulting coordinates.
 */
function applyFlip(
	anchor: Rect,
	floating: Rect,
	placement: Placement,
	offset: number,
	viewport: Rect,
): { x: number; y: number; placement: Placement } {
	const original = computePosition(anchor, floating, placement, offset)
	const originalOverflow = detectOverflow(
		original.x, original.y, floating.width, floating.height, viewport,
	)

	const [side] = parsePlacement(placement)
	const mainOverflow = mainAxisOverflow(side, originalOverflow)

	// If no overflow on main axis, use original
	if (mainOverflow <= 0) {
		return { ...original, placement }
	}

	// Try the flipped placement
	const flipped = flipPlacement(placement)
	const flippedPos = computePosition(anchor, floating, flipped, offset)
	const flippedOverflow = detectOverflow(
		flippedPos.x, flippedPos.y, floating.width, floating.height, viewport,
	)

	const [flippedSide] = parsePlacement(flipped)
	const flippedMainOverflow = mainAxisOverflow(flippedSide, flippedOverflow)

	// If flipped also overflows on main axis, pick whichever has less overflow
	if (flippedMainOverflow >= mainOverflow) {
		return { ...original, placement }
	}

	return { ...flippedPos, placement: flipped }
}

/**
 * Get the overflow amount on the main axis for a given side.
 *
 *   top:    overflow.top
 *   bottom: overflow.bottom
 *   left:   overflow.left
 *   right:  overflow.right
 */
function mainAxisOverflow(side: Side, overflow: Overflow): number {
	return overflow[side]
}

// primitives/use-floating.ts (piece 3 of 6 — shift logic)

/**
 * Apply shift middleware. If the floating element overflows on the
 * cross-axis (perpendicular to the placement side), shift it along that
 * axis to keep it in view.
 *
 * For top/bottom placements: shifts horizontally.
 * For left/right placements: shifts vertically.
 *
 * The shift is clamped so the element doesn't shift past the opposite
 * edge of the viewport.
 */
function applyShift(
	x: number,
	y: number,
	floating: Rect,
	placement: Placement,
	viewport: Rect,
): { x: number; y: number } {
	const [side] = parsePlacement(placement)

	if (side === 'top' || side === 'bottom') {
		// Cross-axis is horizontal
		const minX = viewport.x
		const maxX = viewport.x + viewport.width - floating.width

		let shiftedX = x
		if (shiftedX < minX) shiftedX = minX
		if (shiftedX > maxX) shiftedX = maxX

		// Don't shift past minX even if maxX < minX (floating wider than viewport)
		if (shiftedX < minX) shiftedX = minX

		return { x: shiftedX, y }
	} else {
		// Cross-axis is vertical
		const minY = viewport.y
		const maxY = viewport.y + viewport.height - floating.height

		let shiftedY = y
		if (shiftedY < minY) shiftedY = minY
		if (shiftedY > maxY) shiftedY = maxY

		if (shiftedY < minY) shiftedY = minY

		return { x, y: shiftedY }
	}
}

// primitives/use-floating.ts (piece 4 of 6 — size logic)

/**
 * Compute size constraints for the floating element based on available
 * space. Returns max-width and max-height that fit within the viewport.
 *
 * The constraints are computed *before* the floating element is sized —
 * the consumer applies them via inline styles so the element shrinks to
 * fit available space.
 *
 *   'width':   constrain max-width based on horizontal available space
 *   'height':  constrain max-height based on vertical available space
 *   'both':    constrain both
 *   false:     no constraints (returns null/null)
 *
 * Available space is computed from the anchor and the chosen side:
 *   - bottom placement: vertical space below the anchor
 *   - top placement:    vertical space above the anchor
 *   - left placement:   horizontal space to the left of the anchor
 *   - right placement:  horizontal space to the right of the anchor
 *
 * On the cross-axis: always the full viewport dimension on that axis
 * (the floating element can use full width/height even if narrow on
 * the main axis).
 */
function computeSize(
	anchor: Rect,
	placement: Placement,
	offset: number,
	viewport: Rect,
	behavior: SizeBehavior,
): { maxWidth: number | null; maxHeight: number | null } {
	if (behavior === false) {
		return { maxWidth: null, maxHeight: null }
	}

	const [side] = parsePlacement(placement)

	let mainAvailable: number
	switch (side) {
		case 'top':
			mainAvailable = anchor.y - viewport.y - offset
			break
		case 'bottom':
			mainAvailable = (viewport.y + viewport.height) - (anchor.y + anchor.height) - offset
			break
		case 'left':
			mainAvailable = anchor.x - viewport.x - offset
			break
		case 'right':
			mainAvailable = (viewport.x + viewport.width) - (anchor.x + anchor.width) - offset
			break
	}

	mainAvailable = Math.max(0, mainAvailable)

	const isVerticalSide = side === 'top' || side === 'bottom'

	let maxWidth: number | null = null
	let maxHeight: number | null = null

	if (behavior === 'width' || behavior === 'both') {
		// On vertical sides, width constraint = viewport width
		// On horizontal sides, width constraint = main-axis space
		maxWidth = isVerticalSide ? viewport.width : mainAvailable
	}

	if (behavior === 'height' || behavior === 'both') {
		// On vertical sides, height constraint = main-axis space
		// On horizontal sides, height constraint = viewport height
		maxHeight = isVerticalSide ? mainAvailable : viewport.height
	}

	return { maxWidth, maxHeight }
}

// primitives/use-floating.ts (piece 5 of 6 — auto-update wiring)

/**
 * Auto-update: re-compute position when the anchor or floating element
 * changes size, when ancestor elements scroll, or when the viewport resizes.
 *
 * Returns a cleanup function that removes all listeners.
 */
function setupAutoUpdate(
	anchor: HTMLElement,
	floating: HTMLElement,
	update: () => void,
): () => void {
	const cleanups: Array<() => void> = []

	if (typeof ResizeObserver === 'function') {
		const observer = new ResizeObserver(() => update())
		observer.observe(anchor)
		observer.observe(floating)
		cleanups.push(() => observer.disconnect())
	}

	const scrollAncestors = getScrollAncestors(anchor)
	for (const ancestor of scrollAncestors) {
		ancestor.addEventListener('scroll', update, { passive: true })
		cleanups.push(() => {
			ancestor.removeEventListener('scroll', update)
		})
	}

	globalThis.addEventListener('resize', update, { passive: true })
	cleanups.push(() => {
		globalThis.removeEventListener('resize', update)
	})

	return () => {
		for (const fn of cleanups) fn()
	}
}

type ScrollAncestor = HTMLElement | (typeof globalThis)

function getScrollAncestors(el: HTMLElement): ScrollAncestor[] {
	const result: ScrollAncestor[] = []
	let node: HTMLElement | null = el.parentElement

	while (node) {
		if (isScrollable(node)) {
			result.push(node)
		}
		node = node.parentElement
	}

	result.push(globalThis)
	return result
}

function isScrollable(el: HTMLElement): boolean {
	const style = getComputedStyle(el)
	const overflowX = style.overflowX
	const overflowY = style.overflowY
	const scrollable = (v: string) =>
		v === 'auto' || v === 'scroll' || v === 'overlay'
	return scrollable(overflowX) || scrollable(overflowY)
}

/**
 * Position a floating element relative to an anchor with placement, offset,
 * flip, shift, size constraints, and auto-update.
 */
export function useFloating(
	anchor: AnchorTarget,
	floating: FloatingTarget,
	options: UseFloatingOptions = {},
): UseFloatingReturn {
	const {
		placement: placementOpt = 'bottom-start',
		offset = 0,
		flip = true,
		shift = true,
		size = false,
		autoUpdate = true,
	} = options

	const x = ref(0)
	const y = ref(0)
	const placement = ref<Placement>(placementOpt)
	const maxWidth = ref<number | null>(null)
	const maxHeight = ref<number | null>(null)
	const isReady = ref(false)

	let autoUpdateCleanup: (() => void) | null = null
	let currentAnchor: HTMLElement | null = null
	let currentFloating: HTMLElement | null = null

	function update(): void {
		const anchorEl = currentAnchor
		const floatingEl = currentFloating
		if (!anchorEl || !floatingEl) return

		const anchorRect = getRect(anchorEl)
		const floatingRect = getRect(floatingEl)
		const viewport = getViewportRect()

		// 1. Compute initial position with flip if enabled
		let result: { x: number; y: number; placement: Placement }
		if (flip) {
			result = applyFlip(anchorRect, floatingRect, placementOpt, offset, viewport)
		} else {
			const pos = computePosition(anchorRect, floatingRect, placementOpt, offset)
			result = { ...pos, placement: placementOpt }
		}

		// 2. Apply shift to keep in view on cross-axis
		if (shift) {
			const shifted = applyShift(result.x, result.y, floatingRect, result.placement, viewport)
			result = { ...result, ...shifted }
		}

		// 3. Compute size constraints
		const sizeResult = computeSize(anchorRect, result.placement, offset, viewport, size)

		// 4. Write to refs
		x.value = result.x
		y.value = result.y
		placement.value = result.placement
		maxWidth.value = sizeResult.maxWidth
		maxHeight.value = sizeResult.maxHeight
		isReady.value = true
	}

	function teardownAutoUpdate(): void {
		if (autoUpdateCleanup) {
			autoUpdateCleanup()
			autoUpdateCleanup = null
		}
	}

	function setupForCurrentElements(): void {
		teardownAutoUpdate()

		if (!currentAnchor || !currentFloating) {
			isReady.value = false
			return
		}

		update()

		if (autoUpdate) {
			autoUpdateCleanup = setupAutoUpdate(currentAnchor, currentFloating, update)
		}
	}

	// Track anchor changes
	if (isRef(anchor)) {
		watch(
			anchor,
			(el) => {
				currentAnchor = el
				setupForCurrentElements()
			},
			{ immediate: true },
		)
	} else {
		currentAnchor = anchor
	}

	// Track floating changes
	if (isRef(floating)) {
		watch(
			floating,
			(el) => {
				currentFloating = el
				setupForCurrentElements()
			},
			{ immediate: true },
		)
	} else {
		currentFloating = floating
	}

	// If both are direct elements (not refs), set up immediately
	if (!isRef(anchor) && !isRef(floating)) {
		setupForCurrentElements()
	}

	onScopeDispose(() => {
		teardownAutoUpdate()
	})

	return { x, y, placement, maxWidth, maxHeight, isReady }
}