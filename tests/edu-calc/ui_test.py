"""Browser test of the calculator page. Serve frontend/ first:  cd frontend && python3 -m http.server 8765
Then:  python3 tests/edu-calc/ui_test.py   (needs: pip install playwright && playwright install chromium)"""
import json, sys
from playwright.sync_api import sync_playwright
URL="http://localhost:8765/education-calculator.html"
res=[]
def check(name, cond, info=""):
    res.append(("PASS" if cond else "FAIL")+" "+name+(" — "+str(info) if info else ""))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(accept_downloads=True, viewport={"width":1280,"height":900}); pg=ctx.new_page()
    errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" and "TUNNEL" not in m.text and "fonts" not in m.text else None)
    pg.goto(URL); pg.wait_for_timeout(400)
    rail=lambda: pg.inner_text(".ec-rail-figure")
    check("initial rail figure", rail().startswith("PKR"), rail())
    # number of children reveals forms
    pg.select_option('[data-path="family.numChildren"]', "4"); pg.wait_for_timeout(100)
    vis=pg.eval_on_selector_all('.ec-child', 'els => els.filter(e=>!e.hidden).length')
    check("4 child forms visible", vis==4, vis)
    pg.select_option('[data-path="family.numChildren"]', "1"); pg.wait_for_timeout(100)
    vis=pg.eval_on_selector_all('.ec-child', 'els => els.filter(e=>!e.hidden).length')
    check("1 child form visible", vis==1, vis)
    pg.select_option('[data-path="family.numChildren"]', "3")
    # invalid age
    pg.fill('[data-path="children.0.age"]', "-3"); pg.wait_for_timeout(100)
    err=pg.inner_text('[data-path="children.0.age"] >> xpath=ancestor::div[contains(@class,"field")] >> .ec-error')
    check("invalid age message", "whole number" in err, err)
    check("rail warns invalid child", "left out" in pg.inner_text("#ec-rail"))
    pg.fill('[data-path="children.0.age"]', "19"); pg.wait_for_timeout(100)
    notice=pg.is_visible('[data-notice="0"]')
    check("college-age notice", notice)
    check("lump sum shown", "needed now" in pg.inner_text("#ec-rail"), pg.inner_text("#ec-rail")[:200])
    pg.fill('[data-path="children.0.age"]', "10")
    # repCcy change updates
    before=rail()
    pg.select_option('[data-path="family.repCcy"]', "USD"); pg.wait_for_timeout(100)
    check("currency switch", rail().startswith("USD") and rail()!=before, rail())
    # child country change + custom qualification
    pg.select_option('[data-path="children.2.country"]', "Germany")
    pg.select_option('[data-path="children.2.qualification"]', "Other / Custom Qualification")
    check("custom name field shown", pg.is_visible('[data-path="children.2.custom"]'))
    pg.fill('[data-path="children.2.custom"]', "Veterinary Science")
    # step 2 override
    pg.click('.ec-steps [data-step="2"]'); pg.wait_for_timeout(200)
    check("no-data warning for custom", "no verified fee record" in pg.inner_text("#ec-plans"))
    inp='[data-override="2"][data-field="tuition"]'
    pg.fill(inp, "5000"); pg.press(inp, "Tab"); pg.wait_for_timeout(200)
    check("override badge", pg.locator(".ec-badge").count()>=1)
    # named university benchmark
    pg.click('.ec-steps [data-step="1"]')
    opts=pg.eval_on_selector('[data-path="children.0.benchmark"]', 'el => Array.from(el.options).map(o=>o.textContent)')
    check("university options", len(opts)>=3, opts)
    pg.select_option('[data-path="children.0.benchmark"]', index=1)
    # step 3 assumptions & funding sync
    pg.click('.ec-steps [data-step="3"]'); pg.wait_for_timeout(200)
    pg.fill('#ec-funding [data-path="children.1.savings"]', "12345"); pg.wait_for_timeout(100)
    v=pg.eval_on_selector('#ec-children [data-path="children.1.savings"]', 'el=>el.value')
    check("funding table synced to step 1", v=="12345", v)
    pg.fill('[data-path="family.ret"]', "0"); pg.wait_for_timeout(100)
    pg.fill('[data-path="family.ret"]', "-5"); pg.wait_for_timeout(100)
    check("negative return works", rail().startswith("USD"), rail())
    pg.fill('[data-path="family.ret"]', "")
    pg.select_option('[data-path="family.mode"]', "annual"); pg.wait_for_timeout(100)
    check("annual mode label", "this year" in pg.inner_text(".ec-rail-label"))
    pg.select_option('[data-path="family.mode"]', "monthly")
    # results
    pg.click('.ec-steps [data-step="4"]'); pg.wait_for_timeout(300)
    check("results kpis", pg.locator(".ec-kpi").count()==6)
    check("chart rendered", pg.locator("svg.ec-chart rect").count()>0)
    check("scenarios table", "Higher return" in pg.inner_text("#ec-results"))
    pg.select_option('#ec-cmp-country', "Australia"); pg.click('[data-action="add-compare"]'); pg.wait_for_timeout(200)
    check("comparison added", "alternative" in pg.inner_text(".ec-compare"))
    pg.select_option('[data-schedule]', "1"); pg.wait_for_timeout(200)
    check("per-child schedule", "Study year" in pg.inner_text(".ec-sched"))
    # step 5 exports
    pg.click('.ec-steps [data-step="5"]')
    with pg.expect_download() as d: pg.click('[data-action="csv"]')
    csvp=d.value.path(); txt=open(csvp,encoding="utf-8-sig").read()
    check("CSV export", "Net cost" in txt and txt.count("\n")>10, len(txt))
    with pg.expect_download() as d: pg.click('[data-action="json"]')
    jp=d.value.path(); bk=json.load(open(jp))
    check("JSON backup", bk["app"]=="sindhi-connect-education-calculator" and bk["state"]["family"]["numChildren"]==3)
    fig=rail()
    pg.click('[data-action="save"]'); check("save local", "saved" in pg.inner_text("#ec-status").lower())
    pg.once("dialog", lambda dlg: dlg.accept()); pg.click('[data-action="reset"]'); pg.wait_for_timeout(300)
    check("reset to example", rail()!=fig and rail().startswith("PKR"), rail())
    pg.click('.ec-steps [data-step="5"]')
    pg.set_input_files('#ec-load', jp); pg.wait_for_timeout(400)
    check("load backup restores", rail()==fig, (rail(), fig))
    # bad file
    bad="/tmp/bad.json"; open(bad,"w").write('{"hello":1}')
    pg.set_input_files('#ec-load', bad); pg.wait_for_timeout(300)
    check("bad backup rejected", "not a calculator backup" in pg.inner_text("#ec-status"))
    pg.click('[data-action="restore"]'); pg.wait_for_timeout(300)
    check("restore saved", rail()==fig)
    pg.emulate_media(media="print"); pg.evaluate("document.dispatchEvent(new Event('x'))")
    pg.evaluate("window.dispatchEvent(new Event('beforeprint'))")
    check("print report built", "plan report" in pg.inner_text("#ec-print"))
    pg.emulate_media(media="screen")
    # keyboard: tab focus visible on step buttons
    pg.focus('.ec-steps [data-step="1"]'); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check("keyboard step nav", pg.get_attribute('.ec-steps [data-step="1"]','aria-current')=="step")
    # index page nav link
    pg.goto("http://localhost:8765/index.html"); pg.wait_for_timeout(300)
    check("home nav has calculator link", pg.locator('.site-nav a[href="education-calculator.html"]').count()==1)
    check("no page errors", not errs, errs)
    b.close()
print("\n".join(res))
