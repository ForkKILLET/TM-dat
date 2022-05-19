'use strict'

const clone = o => JSON.parse(JSON.stringify(o))

const err = (t, m) => { throw globalThis[t](`[ProxyData] ${m}`) }

export const TamperMonkeyAccess = () => ({
	get: GM_getValue,
	set: GM_setValue,
	del: GM_deleteValue,
	list: GM_listValues
})

export const LocalStorageAccess = () => ({
	get: k => localStorage.getItem(k),
	set: (k, v) => localStorage.setItem(k, v),
	del: k => localStorage.removeItem(k),
	list: () => Object.keys(localStorage)
})

export const typeOf = v => {
	if (v?.__scm__?.ty)	return v.__scm__.ty
	if (v === null) return 'null'
	if (Array.isArray(v)) return 'array'
	if (v instanceof RegExp) return 'regexp'
	return typeof v
}

export const convertType = {
	string_number:  v => + v,
	string_regexp:  v => v,
	number_string:  v => '' + v,
	number_boolean: v => !! v
}

export const schemaPrototype = {
	object: {
		layer: 1,
		container: () => ({})
	},
	tuple: {
		layer: 1,
		container: () => []
	},
	array: {
		layer: 2,
		container: () => [],
		api: (A, P, s = P.__scm__, tar = P.__tar__) => ({
			$new(i, n = 1) {
				for (const j = i + n; i < j; i ++) {
					const scm = A.scm.lvs[j]
					if (scm) err('ReferenceError', `Leaf @ ${scm.path} already exists, but was attempted to re-new.`)
					initSchema(A, j, P, tar, true)
				}
			},
			get $length() {
				return s.lvs.length
			},
			$push(...a) {
				a.forEach(v => P[ s.lvs.length ] = v)
				return s.lvs.length
			},
			$fill(v, i = 0, j = s.lvs.length) {
				for (; i < j; i ++) P[i] = v
				return P
			},
			$pop() {
				const l = s.lvs.length
				const v = P[ l - 1 ]
				delete P[ l - 1 ]
				s.lvs.length --
				return v
			},
			$splice(i, n) {
				const l = s.lvs.length
				n ??= l
				n = Math.min(l - i, n)
				for(; i < l; i ++)
					P[i] = i + n < l ? P[ i + n ] : undefined
				s.lvs.length -= n
			},
			$swap(i, j) {
				P.__tmp__ = P[i]
				P[i] = P[j]
				P[j] = P.__tmp__
				delete P.__tmp__
			},
			$reverse() {
				const l = s.lvs.length
				const m = Math.floor(l / 2)
				for (let i = 0; i < m; i ++) if (i in s.lvs) {
					P.$swap(i, l - i - 1)
				}
				return P
			},
			$includes(v) {
				const l = s.lvs.length
				for (let i = 0; i < l; i ++) if (i in s.lvs)
					if (v === P[i]) return true
				return false
			},
			$indexOf(v) {
				const l = s.lvs.length
				for (let i = 0; i < l; i ++) if (i in s.lvs)
					if (v === P[i]) return + i
				return -1
			},
			$lastIndexOf(v) {
				for (let i = s.lvs.length - 1; i >= 0; i --) if (i in s.lvs)
					if (v === P[i]) return + i
				return -1
			},
			$find(f) {
				const l = s.lvs.length
				for (let i = 0; i < l; i ++) if (i in s.lvs) {
					const v = P[i]
					if (f(v)) return v
				}
			},
			$findIndex(f) {
				const l = s.lvs.length
				for (let i = 0; i < l; i ++) if (i in s.lvs) {
					const v = P[i]
					if (f(v)) return + i
				}
			},
			$forEach(f) {
				const l = s.lvs.length
				for (let i = 0; i < l; i ++) if (i in s.lvs)
					f(P[i], + i, P)
			},
			$at(i) {
				return i < 0 ? P[ s.lvs.length + i ] : P[i]
			},
			*[Symbol.iterator] () {
				for (const k in s.lvs) yield P[k]
			}
		})
	},
}

export const initSchema = (A, k, P, tar, isNew) => {
	const { data, map, scm, oldRoot, old, access } = A
	if (isNew) scm.lvs[k] = clone(scm.itm)
	const s = scm.lvs[k]
	s.path = (scm.path ?? '') + '.' + k

	const proto = schemaPrototype[s.ty]
	s.layer = proto?.layer ?? 0
	if (s.layer) {
		data[k] = proto.container()
		if (s.layer > 1) s.lvs = proto.container()
	}

	const eS = s => JSON.stringify(s, null, 2) + ': '

	if (s.ty === 'enum') {
		s.get ??= 'val'
		s.set ??= 'val'
		s.fromOld = v => {
			let set = s.set
			s.set = 'id'
			P[k] = v
			s.set = set
		}
		if (s.get !== 'both' && s.set === 'both') err('SyntaxError', eS(s) + `{ ty: 'enum' → ¬(get: 'both' ∧ set: ¬ 'both') }`)
	}
	if (s.ty === 'tuple') s.lvs = s.lvs.flatMap(
		i => {
			let r = 1
			if ('repeat' in i) {
				r = i.repeat
				if (typeof r !== 'number' || r < 0 || r % 1)
					err('SyntaxError', eS(s) + `{ ty: 'tuple' → itm: [ ∀ i: { repeat?: integer } } ]`)
				delete i.repeat
			}
			return Array.from({ length: r }, () => clone(i))
		}
	)

	map(s)
	s.pathRoot = s.root ? '#' + s.path : scm.pathRoot ?? k
	s.raw = (s.root ? null : scm.raw) ?? (() => data[k])

	const Ak = {
		data: data[k],
		map,
		scm: s,
		oldRoot,
		old: old?.[k],
		access
	}

	if (s.layer) tar[k] = createProxy(Ak)
	else {
		let old_v = s.root ? oldRoot[s.pathRoot] : old?.[k]
		if (old_v !== undefined) {
			if (s.ty === 'enum') s.fromOld(old_v)
			else P[k] = old_v
		}
		else if ('dft' in s) P[k] = s.dft
	}

	if (proto?.api) s.api = proto.api(Ak, tar[k])
}

export const createProxy = A => {
	const { data, scm, oldRoot, old, access } = A
	const tar = {}

	const eP = `Parent ${scm.ty} @ ${scm.path}`
	const checkKey = k => {
		if (typeof k === 'symbol') return
		if (scm.ty === 'array') {
			const eR = eP + ` requires the index to be in [ ${scm.minIdx ??= 0}, ${scm.maxIdx ??= +Infinity} ], but got ${k}. `
			if (k < scm.minIdx || k > scm.maxIdx) err('RangeError', eR)
		}
	}
	const P = new Proxy(tar, {
		get: (_, k) => {
			if (k === '__scm__') return scm
			if (k === '__tar__') return tar
			if (scm.api && k in scm.api) return scm.api[k]

			checkKey(k)

			if (! scm.lvs[k]) switch (scm.layer) {
			case 1:
				err('TypeError', eP + ` doesn't have leaf ${k}.`)
				break
			case 2:
				return undefined
			}

			const s = scm.lvs[k]
			if (s.ty === 'enum') switch (s.get) {
			case 'id':
				return tar[k]
			case 'val':
				return s.vals[tar[k]]
			case 'both':
				return {
					get id() { return tar[k] },
					set id(v) {
						const o_set = s.set
						s.set = 'id'
						P[k] = v
						s.set = o_set
					},
					get val() { return s.vals[tar[k]] },
					set val(v) {
						const o_set = s.set
						s.set = 'val'
						P[k] = v
						s.set = o_set
					},
				}
			}

			return tar[k]
		},

		set: (_, k, v) => {
			checkKey(k)

			if (! scm.lvs[k]) switch (scm.layer) {
			case 1:
				err('TypeError', eP + ` doesn't have leaf ${k}.`)
				break
			case 2:
				initSchema(A, k, P, tar, true)
				break
			}

			if (scm.api && k in scm.api) {
				err('TypeError', eP + ` has API ${k}. Failed.`)
			}
			const s = scm.lvs[k]

			const eF = `Leaf @ ${s.path}`, eS = 'Failed strictly.', eT = eF + ` is ${ [ 'simple', 'fixed complex', 'flexible complex' ][s.layer] } type, `
			if (s.locked) err('TypeError', eF + ` is locked, but was attempted to modify.`)

			const ty = typeOf(v)

			if (ty === 'undefined') {
				if (scm.layer === 1 && ! scm.del) err('TypeError', eT + `but its ` + eF + ' was attempted to delete.')
				if (s.layer) {
					s.del = true
					for (let j in s.lvs) delete tar[k][j]
				}
				delete scm.lvs[k]
			}

			else if (
				ty === 'array'	&& s.lvs instanceof Array ||
				ty === 'object'	&& s.lvs && ! (s.lvs instanceof Array)
			) {
				for (let j in s.lvs) tar[k][j] = v[j]
				return true
			}

			else if (! [ 'any', 'enum' ].includes(s.ty) && ty !== s.ty) {
				const eM = eF + ` requires type ${s.ty}, but got ${ty}: ${v}. `
				if (s.strict) err('TypeError', eM + eS)
				const f = convertType[`${ty}_${s.ty}`]
				if (f) v = f(v)
				else err('TypeError', eM + 'Failed to convert.')
			}

			if (s.ty === 'number') {
				const eR = eF + ` requires to be in [ ${ s.min ?? -Infinity }, ${ s.max ?? +Infinity } ], but got ${v}. `
				if (v < s.min || v > s.max) err('RangeError', eR)

				if (s.int && v % 1) {
					if (s.strict) err('RangeError', eF + ` requires to be an integer. ` + eS)
					v = Math.floor(v)
				}
			}

			else if (s.ty === 'enum') switch (s.set) {
			case 'id':
				if (typeof v !== 'number' || ! v in s.vals)
					err('RangeError', eF + ` requires to be an enum index in [ ${0}, ${s.vals.length} ], but got ${v}.`)
				break
			case 'val':
				v = s.vals.findIndex(val => val === v)
				if (v < 0)
					err('RangeError', eF + ` requires to be in the enum { ${ s.vals.join(', ') } }, but got ${v}.`)
				break
			case 'both':
				err('TypeError', eF + ` is an enum accepting both id and value ways of modification, but was attempted to modify without using any setter.`)
			}

			tar[k] = data[k] = v
			if (s.quick || s.root) {
				const vRoot = s.raw()
				if (vRoot === undefined) access.del(s.pathRoot)
				else access.set(s.pathRoot, vRoot)
			}

			return true
		},

		deleteProperty: (_, k) => {
			P[k] = undefined
			return true
		},

		has: (_, k) => k in scm.lvs
	})

	switch (scm.layer) {
	case 1:
		for (let k in scm.lvs) initSchema(A, k, P, tar)
		break
	case 2:
		const keys = scm.itmRoot
			? Object.keys(oldRoot).map(k => k.match(String.raw`^#${scm.path}\.([^.]+)`)?.[1]).filter(k => k)
			: Object.keys(old ?? {})
		keys.forEach(k => initSchema(A, k, P, tar, true))
		break
	}

	return P
}

export class ProxyData {
	loadData(lvs, { access, autoSave, old, map }) {
		if (this.raw) err('Error', `ProxyData cannot be loaded multiple times.`)
		this.raw = {}

		old ??= access.list().reduce((o, k) => (
			o[k] = access.get(k), o
		), {})

		if (autoSave) window.addEventListener('beforeunload', () => this.saveData())

		return createProxy({
			data: this.raw,
			scm: { lvs, layer: 1 },
			map: map ?? (s => s),
			old,
			oldRoot: old,
			access
		})
	}

	saveData(data) {
		Object.keys(data ?? this.raw).forEach(k => this.access.set(k, data[k]))
	}

	clearData() {
		this.raw = null
		this.access.list().forEach(this.access.del)
	}
}
