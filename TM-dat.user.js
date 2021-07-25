// ==UserScript==
// @name			TM dat
// @namespace		https://icelava.root
// @version			0.4.3
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

const type_dat = v =>
	v === null			? "null"   :
	v instanceof Array  ? "array"  :
	v instanceof RegExp ? "regexp" :
	typeof v

type_dat.convert = {
	string_number:  v => + v,
	string_regexp:  v => v,
	number_string:  v => "" + v,
	number_boolean: v => !! v
}

let raw_dat

const proxy_dat = (dat, map, scm, oldRoot, old = oldRoot) => {
	const lvs = {}
	const ini_scm = (s, k) => {
		s.path = (scm.path ?? "") + "." + k
		s.pathRoot = s.root ? "#" + s.path : scm.pathRoot ?? k
		s.raw = (s.root ? null : scm.raw) ?? (() => dat[k])

		switch (s.ty) {
		case "object":
			s.rec = 1
			dat[k] = {}
			break
		case "tuple":
			s.rec = 1
			s.lvs = s.lvs.map(i => Array.from({ length: i.repeat ?? 1 }, () => Object.clone(i))).flat()
			dat[k] = []
			break
		case "array":
			s.rec = 2
			s.lvs = []
			s.api = {
				get length() {
					return s.lvs.length
				},
				push(...a) {
					a.forEach(v => lvs[k][ s.lvs.length ] = v)
				},
				pop() {
					const l = s.lvs.length
					const v = lvs[k][ l - 1 ]
					delete lvs[k][ l - 1 ]
					s.lvs.length --
					return v
				},
				splice(i, n) {
					const l = s.lvs.length
					n = Math.min(l - i, n)
					for(; i < l; i ++)
						lvs[k][i] = i + n < l ? lvs[k][ i + n ] : undefined
					s.lvs.length -= n
				},
				*[Symbol.iterator] () {
					for (const k_ in s.lvs) yield lvs[k][k_]
				}
			}
			dat[k] = []
			break
		default:
			dft_scm(s, k)
			break
		}
		if (s.rec) {
			lvs[k] = proxy_dat(dat[k], map, s, oldRoot, old?.[k])
		}
	}
	const dft_scm = (s, k) => {
		lvs[k] = dat[k] = (s.root ? oldRoot[s.pathRoot] : old?.[k]) ?? s.dft ?? null
	}

	switch (scm.rec) {
	case 1:
		for (let k in scm.lvs) ini_scm(map(scm.lvs[k]), k)
		break
	case 2:
		const keys = map(scm.itm).root
			? Object.keys(oldRoot).map(k => k.match(`^#${scm.path}\.([^.])+$`.replaceAll(".", "\\."))?.[1]).filter(k => k)
			: Object.keys(old)
		keys.forEach(k => ini_scm(map(scm.lvs[k] = Object.clone(scm.itm)), k))
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

	const P = new Proxy(lvs, {
		get: (_, k) => {
			cAR(k)

			if (scm.api && k in scm.api) return scm.api[k]
			return lvs[k]
		},

		set: (_, k, v) => {
			cAR(k)

			if (! scm.lvs[k]) switch (scm.rec) {
			case 1:
				err("TypeError", eP + ` doesn't have leaf ${k}.`)
				break
			case 2:
				ini_scm(map(scm.lvs[k] = Object.clone(scm.itm)), k)
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

			lvs[k] = dat[k] = v
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

		has: (_, k) => k in dat
	})

	return P
}

const load_dat = (lvs, { autoSave, old, map }) => {
	if (raw_dat) err("Error", `Dat cannot be loaded multiple times.`)
	raw_dat = {}

	if (autoSave) window.addEventListener("beforeunload", () => save_dat())

	return proxy_dat(
		raw_dat,
		map ?? (s => s),
		{ lvs, rec: 1 },
		old ?? GM_listValues().reduce((o, k) => (
			o[k] = JSON.parse(GM_getValue(k) ?? "null"), o
		), {})
	)
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

