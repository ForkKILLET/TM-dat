// ==UserScript==
// @name			TM dat
// @namespace		https://icelava.root
// @version			0.3
// @description		Nested, type secure and auto saving data proxy on Tampermonkey.
// @author			ForkKILLET
// @match			localhost:1633/*
// @noframes
// @icon			data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant			unsafeWindow
// @grant			GM_listValues
// @grant			GM_getValue
// @grant			GM_setValue
// @grant			GM_deleteValue
// ==/UserScript==

"use strict"

const err = (t, m) => { throw window[t](`[TM dat] ${m}`) }

const type_dat = v =>
	v === null		  ? "null"   :
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
	for (let k in scm.lvs) {
		const s = map(scm.lvs[k])

		s.path = (scm.path ?? "") + "." + k
		s.pathRoot = s.root ? "#" + s.path : scm.pathRoot ?? k
		s.raw = (s.root ? null : scm.raw) ?? (() => dat[k])

		switch (s.ty) {
		case "object":
			dat[k] = {}
			break
		case "tuple":
			s.lvs = s.lvs.map(i => Array.from({ length: i.repeat ?? 1 }, () => i)).flat()
			dat[k] = []
			break
		default:
			lvs[k] = dat[k] = (s.root ? oldRoot[s.pathRoot] : old?.[k]) ?? s.dft
			break
		}
		lvs[k] ??= proxy_dat(dat[k], map, s, oldRoot, old?.[k])
	}
	return new Proxy(lvs, {
		get: (_, k) => lvs[k],
		set: (_, k, v) => {
			const s = scm.lvs[k]
			const eF = `Field @ ${s.path}`, eS = "Failed strictly."
			if (s.locked) err("TypeError", eF + ` is locked, but was attempted to write.`)

			if (s.ty === "enum" && ! s.vals.includes(v)) {
				err("TypeError", eF + ` requires to be in the enum { ${ s.vals.join(", ") } }, but got ${v}.`)
			}

			const ty = type_dat(v)
			if (! [ "any", "enum" ].includes(s.ty) && ty !== s.ty) {
				const eM = eF + ` requires type ${s.ty}, but got ${ty}: ${v}. `
				if (s.strict) err("TypeError", eM + eS)
				const f = type_dat.convert[`${ty}_${s.ty}`]
				if (f) v = f(v)
				else err("TypeError", eM + "Failed to convert.")
			}

			if (s.ty === "number") {
				let eR = eF + ` requires to be in the range [ ${s.min ??= -Infinity}, ${s.max ??= +Infinity} ], but got ${v}. `
				if (v < s.min || v > s.max) err("RangeError", eR)

				if (s.int) {
					if (s.strict) err("RangeError", eF + ` requires to be an integer. ` + eS)
					v = ~~ v
				}
			}

			lvs[k] = dat[k] = v
			if (s.quick || s.root) GM_setValue(s.pathRoot, JSON.stringify(s.raw()))
		}
	})
}

const load_dat = (lvs, { autoSave, old, map }) => {
	if (raw_dat) err("Error", `Dat cannot be loaded multiple times.`)
	raw_dat = {}

	if (autoSave) window.addEventListener("beforeunload", () => save_dat())

	return proxy_dat(
		raw_dat,
		map ?? (s => s),
		{ lvs },
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

if (location.host === "localhost:1633") Object.assign(unsafeWindow, {
	TM_dat: { type_dat, proxy_dat, load_dat, save_dat, clear_dat, raw_dat }
})

