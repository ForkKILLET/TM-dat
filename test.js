const $ = s => document.querySelector(s)

window.onload = () =>
	$("textarea").value = localStorage.scm ?? "{}"

const $load_dat = $("#load_dat")
$load_dat.onclick = () => {
	$load_dat.disabled = true
	const scm = $("textarea").value
	window.sto = TM_dat.load_dat(window.scm = eval(`(${scm})`), {
		map: $("#root_map").checked ? s => {
			s.root = ! s.rec
			s.itmRoot = s.rec === 2
		} : undefined
	})
	localStorage.scm = scm
}

$("#save_dat").onclick = () =>
	TM_dat.save_dat()

$("#clear_dat").onclick = () =>
	TM_dat.clear_dat()

const _tests = []

$("#test").onclick = () => {
	document.body.innerHTML = ""
}
