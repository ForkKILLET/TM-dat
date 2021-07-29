const $ = s => document.querySelector(s)
const TM_dat = window.TM_dat

window.onload = () =>
	$("textarea").value = localStorage.scm ?? "{}"

$("#load_dat").onclick = () => {
	const scm = $("textarea").value
	window.sto = TM_dat.load_dat(window.scm = eval(`(${scm})`), {
		map: $("#root_map").checked ? s => {
			s.root = ! [ "object", "tuple", "array" ].includes(s.ty)
			return s
		} : undefined
	})
	localStorage.scm = scm
}

$("#save_dat").onclick = () =>
	TM_dat.save_dat()

$("#clear_dat").onclick = () =>
	TM_dat.clear_dat()

const tests = []

$("#test").onclick = () => {
	document.body.innerHTML = ""
}
