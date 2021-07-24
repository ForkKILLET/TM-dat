const $ = s => document.querySelector(s)

window.onload = () =>
	$("textarea").value = localStorage.scm ?? "{}"

$("#load_dat").onclick = () => {
	const scm = $("textarea").value
    window.sto = TM_dat.load_dat(eval(`(${scm})`), {
		map: $("#root_map").checked ? s => {
			s.root = ! [ "object", "tuple", "array" ].includes(s.ty)
			return s
		} : undefined
	})
	localStorage.scm = scm
}

$("#save_dat").onclick = () =>
    TM_dat.save_dat()

