import { LocalStorageAccess, ProxyData } from './index.js'

const $ = s => document.querySelector(s)

window.onload = () =>
	$("textarea").value = localStorage.scm ?? "{}"

const $load_dat = $("#load_dat")
$load_dat.onclick = () => {
	$load_dat.disabled = true
	const scm = $("textarea").value
	window.pd = new ProxyData
	window.sto = pd.loadData(eval(`(${scm})`), {
		access: LocalStorageAccess(),
		map: $("#root_map").checked
			? s => {
				s.root = ! s.rec
				s.itmRoot = s.rec === 2
			}
			: undefined
	})
	localStorage.scm = scm
}

$("#save_dat").onclick = () =>
	pd.saveData()

$("#clear_dat").onclick = () =>
	pd.clearData()

$("#test").onclick = () => {
	document.body.innerHTML = ""
}
