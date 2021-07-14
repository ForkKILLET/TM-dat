const $ = s => document.querySelector(s)

$("#load_dat").onclick = () =>
    window.dat = TM_dat.load_dat(eval("(" + $("textarea").value + ")"))
$("#save_dat").onclick = () =>
    TM_dat.save_dat()

