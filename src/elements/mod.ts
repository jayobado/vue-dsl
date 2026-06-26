// Render-function authoring helpers: typed element factories + VNode memoization.
// A lighter alternative to templates/SFCs (drop the compiler, run runtime-only
// Vue). Adapted from the now-deprecated vue-toolkit.

export {
	a,
	article,
	aside,
	br,
	button,
	code,
	div,
	em,
	fieldset,
	footer,
	form,
	h1,
	h2,
	h3,
	h4,
	h5,
	h6,
	header,
	hr,
	img,
	input,
	label,
	li,
	main,
	nav,
	ol,
	option,
	p,
	pre,
	section,
	select,
	small,
	span,
	strong,
	table,
	tbody,
	td,
	textarea,
	th,
	thead,
	tr,
	ul,
} from './elements.ts'

export type { AnchorElProps, ButtonElProps, ElProps, InputElProps } from './elements.ts'

export { createMemoCache, withMemo } from './memo.ts'
