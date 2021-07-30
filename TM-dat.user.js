// ==UserScript==
// @name			TM dat
// @namespace		https://icelava.root
// @version			0.5.3
// @description		Nested, type secure and auto saving data proxy on Tampermonkey.
// @author			ForkKILLET
// @match			http://localhost:1633/*
// @noframes
// @icon			data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant			unsafeWindow
// @grant			GM_listValues
// @grant			GM_getValue
// @grant			GM_setValue
// @grant			GM_deleteValue
// ==/UserScript==

"use strict"

Object.clone = o => JSON.parse(JSON.stringify(o))

const err = (t, m) => { throw window[t](`[TM dat] ${m}`) }

/* eslint-disable */
const type_dat = v =>
	v === null			? "null"   :
	v instanceof Array  ? "array"  :
	v instanceof RegExp ? "regexp" :
	typeof v
/* eslint-enable */

type_dat.convert = {
	string_number:  v => + v,
	string_regexp:  v => v,
	number_string:  v => "" + v,
	number_boolean: v => !! v
}

let raw_dat

const proto_scm = {
	object:	{ rec: 1, ctn: () => ({}) },
	tuple:	{ rec: 1, ctn: () => [] },
	array:	{ rec: 2, ctn: () => [], api: (A, s, P) => ({
		$new(k, n = 1) {
			for (let j = k; j < k + n; j ++) {
				const scm = A.scm.lvs[j]
				if (scm) err("ReferenceError", `Leaf @ ${scm.path} already exists, but was attempted to re-new.`)
				init_scm(A, j, P, true)
			}
		},
		get $length() {
			return s.lvs.length
		},
		$push(...a) {
			a.forEach(v => P[ s.lvs.length ] = v)
			return s.lvs.length
		},
		$pop() {
			const l = s.lvs.length
			const v = P[ l - 1 ]
			delete P[ l - 1 ]
			s.lvs.length --
			return v
		},
		$splice(k, n) {
			const l = s.lvs.length
			n = Math.min(l - k, n)
			for(; k < l; k ++)
				P[k] = k + n < l ? P[ k + n ] : undefined
			s.lvs.length -= n
		},
		$find(f) {
			for (const k in s.lvs) {
				const v = P[k]
				if (f(v)) return v
			}
		},
		$findIndex(f) {
			for (const k in s.lvs) {
				const v = P[k]
				if (f(v)) return k
			}
		},
		*[Symbol.iterator] () {
			for (const k in s.lvs) yield P[k]
		}
	}) },
}

const init_scm = (A, k, tar, isNew) => {
	const { dat, map, scm, oldRoot, old } = A
	if (isNew) scm.lvs[k] = Object.clone(scm.itm)
	const s = scm.lvs[k]
	s.path = (scm.path ?? "") + "." + k

	const proto = proto_scm[s.ty]
	s.rec = proto?.rec ?? 0
	if (s.rec) {
		dat[k] = proto.ctn()
		if (s.rec > 1) s.lvs = proto.ctn()
	}

	if (s.ty === "tuple") s.lvs = s.lvs.map(
		i => Array.from({ length: i.repeat ?? 1 }, () => Object.clone(i))
	).flat()

	map(s)
	s.pathRoot = s.root ? "#" + s.path : scm.pathRoot ?? k
	s.raw = (s.root ? null : scm.raw) ?? (() => dat[k])

	const Ak = {
		dat: dat[k],
		map,
		scm: s,
		oldRoot,
		old: old?.[k]
	}

	let tarP
	if (s.rec) [ tar[k], tarP ] = proxy_dat(Ak)
	else tar[k] = dat[k] = (s.root ? oldRoot[s.pathRoot] : old?.[k]) ?? s.dft ?? null

	if (proto?.api) s.api = proto.api(Ak, s, tarP)
}

const proxy_dat = A => {
	const { dat, scm, oldRoot, old } = A
	const tar = {}

	switch (scm.rec) {
	case 1:
		for (let k in scm.lvs) init_scm(A, k, tar)
		break
	case 2:
		const keys = scm.itmRoot
			? Object.keys(oldRoot).map(k => k.match(String.raw`^#${scm.path}\.([^.]+)`)?.[1]).filter(k => k)
			: Object.keys(old ?? {})
		keys.forEach(k => init_scm(A, k, tar, true))
		break
	}

	const eP = `Parent ${scm.ty} @ ${scm.path}`
	const cAR = k => {
		if (typeof k === "symbol") return
		if (scm.ty === "array") {
			const eR = eP + ` requires the index to be in [ ${scm.minIdx ??= 0}, ${scm.maxIdx ??= +Infinity} ], but got ${k}. `
			if (k < scm.minIdx || k > scm.maxIdx) err("RangeError", eR)
		}
	}
	const P = new Proxy(tar, {
		get: (_, k) => {
			if (scm.api && k in scm.api) return scm.api[k]

			cAR(k)
			return tar[k]
		},

		set: (_, k, v) => {
			cAR(k)

			if (! scm.lvs[k]) switch (scm.rec) {
			case 1:
				err("TypeError", eP + ` doesn't have leaf ${k}.`)
				break
			case 2:
				init_scm(A, k, tar, true)
				break
			}

			if (scm.api && k in scm.api) {
				err("TypeError", eP + ` has API ${k}. Failed.`)
			}
			const s = scm.lvs[k]

			const eF = `Leaf @ ${s.path}`, eS = "Failed strictly.", eT = eF + ` is ${ [ "simple", "fixed complex", "flexible complex" ] } type, `
			if (s.locked) err("TypeError", eF + ` is locked, but was attempted to modify.`)

			if (s.ty === "enum" && ! s.vals.includes(v)) {
				err("TypeError", eF + ` requires to be in the enum { ${ s.vals.join(", ") } }, but got ${v}.`)
			}

			const ty = type_dat(v)

			if (ty === "undefined") {
				if (scm.rec === 1) err("TypeError", eT + `but its ` + eF + " was attempted to delete.")
				if (s.rec) err("TypeError", eT + `but it was attempted to delete`)
			}

			else if (! [ "any", "enum" ].includes(s.ty) && ty !== s.ty) {
				const eM = eF + ` requires type ${s.ty}, but got ${ty}: ${v}. `
				if (s.strict) err("TypeError", eM + eS)
				const f = type_dat.convert[`${ty}_${s.ty}`]
				if (f) v = f(v)
				else err("TypeError", eM + "Failed to convert.")
			}

			if (s.ty === "number") {
				const eR = eF + ` requires to be in [ ${s.min ??= -Infinity}, ${s.max ??= +Infinity} ], but got ${v}. `
				if (v < s.min || v > s.max) err("RangeError", eR)

				if (s.int) {
					if (s.strict) err("RangeError", eF + ` requires to be an integer. ` + eS)
					v = ~~ v
				}
			}

			tar[k] = dat[k] = v
			if (s.quick || s.root) {
				const vRoot = s.raw()
				if (vRoot === undefined) GM_deleteValue(s.pathRoot)
				else GM_setValue(s.pathRoot, JSON.stringify(vRoot))
			}

			return true
		},

		deleteProperty: (_, k) => {
			P[k] = undefined
			return true
		},

		has: (_, k) => k in scm.lvs
	})

	return [ P, tar ]
}

const load_dat = (lvs, { autoSave, old, map }) => {
	if (raw_dat) err("Error", `Dat cannot be loaded multiple times.`)
	raw_dat = {}

	old ??= GM_listValues().reduce((o, k) => (
		o[k] = JSON.parse(GM_getValue(k) ?? "null"), o
	), {})

	if (autoSave) window.addEventListener("beforeunload", () => save_dat())

	return proxy_dat({
		dat: raw_dat,
		scm: { lvs, rec: 1 },
		map: map ?? (s => s),
		old, oldRoot: old
	}) [0]
}

const save_dat = (dat = raw_dat) => {
	Object.keys(dat).forEach(k => GM_setValue(k, JSON.stringify(dat[k])))
}

const clear_dat = () => {
	raw_dat = null
	GM_listValues().forEach(GM_deleteValue)
}

// Debug
if (location.host === "localhost:1633") Object.assign(unsafeWindow, {
	TM_dat: { type_dat, proxy_dat, load_dat, save_dat, clear_dat, raw_dat: () => raw_dat }
})

