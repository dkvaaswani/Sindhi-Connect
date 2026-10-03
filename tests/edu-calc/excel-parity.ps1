<# Excel side of the Excel-vs-web parity check (method v2). Needs Microsoft Excel (Windows).
   powershell -ExecutionPolicy Bypass -File tests/edu-calc/excel-parity.ps1 [-Store]
   Runs every scenario in tests/edu-calc/parity-scenarios.json through the workbook and writes the
   results to tests/edu-calc/excel-results.json; parity-js.js then compares them with the web engine.
   -Store also recalculates the blank workbook and saves it, so viewers without a calculation
   engine (previews, phones) show values. #>
param([switch]$Store)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$book = Join-Path $root 'frontend\downloads\Children_Education_Fund_Calculator.xlsx'
$scen = (Get-Content (Join-Path $PSScriptRoot 'parity-scenarios.json') -Raw -Encoding UTF8 | ConvertFrom-Json).scenarios
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
$results = @()
function W($rng, $v) { if ($v -is [psobject]) { $v = $v.psobject.BaseObject }; if ($v -is [string]) { $rng.Value2 = [string]$v } else { $rng.Value2 = [double]$v } }
try {
  $wb = $xl.Workbooks.Open($book)
  foreach ($ws in $wb.Worksheets) { $ws.Unprotect() }
  $in = $wb.Worksheets.Item('Inputs'); $as = $wb.Worksheets.Item('Assumptions and Currency')
  $dash = $wb.Worksheets.Item('Dashboard'); $cmp = $wb.Worksheets.Item('Compare Countries')
  $ccyRows = @{}; $r = 8; while ($as.Range("A$r").Text -match "^[A-Z]{3}$") { $ccyRows[$as.Range("A$r").Text] = $r; $r++ }
  $fxClear = "C8:C" + ($r - 1)
  $kidCol = 'C', 'D', 'E', 'F'
  $ovRow = @{ tuition = 23; accommodation = 24; food = 25; transport = 26; healthInsurance = 27; books = 28; otherFees = 29
              admission = 30; visaApplication = 31; travelRelocation = 32; preTuition = 33; preOtherFees = 34 }
  $val = { param($v) if ($null -eq $v) { $null } else { $v } }
  foreach ($s in $scen) {
    $in.Range('C4:C11').ClearContents(); $in.Range('C14:F21').ClearContents(); $in.Range('C23:F34').ClearContents(); $as.Range($fxClear).ClearContents()
    $f = $s.family
    W $in.Range('C4') $f.numChildren; W $in.Range('C5') $f.residence; W $in.Range('C6') $f.nationality
    W $in.Range('C7') $f.repCcy; W $in.Range('C8') $f.coverage; W $in.Range('C10') $f.savInc
    if ($null -ne $f.ret) { W $in.Range('C9') $f.ret }
    W $in.Range('C11') $(if ($s.cmpChild) { $s.cmpChild } else { 1 })
    if ($s.fx) { foreach ($p in $s.fx.PSObject.Properties) { W $as.Range('C' + $ccyRows[$p.Name]) $p.Value } }
    for ($i = 0; $i -lt 4; $i++) {
      $k = if ($i -lt $s.children.Count) { $s.children[$i] } else { $null }
      $col = $kidCol[$i]
      $in.Range("${col}19").Value2 = 18
      if (-not $k) { continue }
      if ($null -ne $k.age) { W $in.Range("${col}15") $k.age }
      if ($k.country) { W $in.Range("${col}17") $k.country }
      if ($k.qualification) { W $in.Range("${col}18") $k.qualification }
      if ($null -ne $k.entryAge) { W $in.Range("${col}19") $k.entryAge }
      if ($null -ne $k.tInf) { W $in.Range("${col}20") $k.tInf }
      if ($null -ne $k.lInf) { W $in.Range("${col}21") $k.lInf }
      if ($k.overrides) { foreach ($p in $k.overrides.PSObject.Properties) { W $in.Range("$col" + $ovRow[$p.Name]) $p.Value } }
    }
    $xl.CalculateFull()
    $h = [int]$dash.Range('C8').Value2
    $years = @(); for ($p = 1; $p -le $h; $p++) { $r = 31 + $p
      $years += [ordered]@{ opening = $dash.Range("D$r").Value2; saving = $dash.Range("E$r").Value2; growth = $dash.Range("F$r").Value2
                            expense = $dash.Range("G$r").Value2; closing = $dash.Range("H$r").Value2; studying = $dash.Range("C$r").Text } }
    $kids = @(); for ($i = 0; $i -lt $f.numChildren; $i++) { $r = 12 + $i; $kids += [ordered]@{ total = $dash.Range("G$r").Value2; message = $dash.Range("H$r").Text } }
    $compare = @(); for ($r = 9; $r -le 14; $r++) { $compare += [ordered]@{ country = $cmp.Range("B$r").Text; total = $cmp.Range("C$r").Value2; note = $cmp.Range("D$r").Text; current = $cmp.Range("E$r").Text } }
    $results += [ordered]@{ name = $s.name; currency = $in.Range('D7').Text; total = $dash.Range('C4').Value2; saving = $dash.Range('C5').Value2
                            lump = $dash.Range('C6').Value2; planYears = $h; children = $kids; years = $years; compare = $compare
                            addsUp = $dash.Range('B95').Text }
    Write-Host ("ran: " + $s.name)
  }
  if ($Store) {
    # back to the blank starting state, then save with calculated values
    $in.Range('C4:C11').ClearContents(); $in.Range('C14:F21').ClearContents(); $in.Range('C23:F34').ClearContents(); $as.Range($fxClear).ClearContents()
    $in.Range('C4').Value2 = 1; $in.Range('C5').Value2 = 'Pakistan'; $in.Range('C6').Value2 = 'Pakistan'; $in.Range('C7').Value2 = 'USD'
    $in.Range('C8').Value2 = 0; $in.Range('C10').Value2 = 0; $in.Range('C11').Value2 = 1; $in.Range('C19:F19').Value2 = 18
    $xl.CalculateFull()
    foreach ($ws in $wb.Worksheets) { if ($ws.Name -ne 'Lists' -and $ws.Name -ne 'Compare Calc') { $ws.Protect('', $true, $true, $false, $false, $true, $true, $true) } }
    $wb.Worksheets.Item('Inputs').Activate()
    $wb.Save()
    Write-Host 'Stored recalculated workbook.'
  }
  $wb.Close($false)
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
$out = Join-Path $PSScriptRoot 'excel-results.json'
[IO.File]::WriteAllText($out, (ConvertTo-Json $results -Depth 6), (New-Object Text.UTF8Encoding($false)))
Write-Host "Wrote $out"
