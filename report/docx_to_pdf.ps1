# Converts report/final_report.docx to report/final_report.pdf with Microsoft Word and reports the page budget.
#   powershell -NoProfile -ExecutionPolicy Bypass -File report/docx_to_pdf.ps1
# The course limit is 8 pages for the abstract and sections 1 to 9; references and appendices do not count.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$docx = Join-Path $here 'final_report.docx'
$pdf = Join-Path $here 'final_report.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($docx, $false, $true)
    $doc.Repaginate()
    $total = $doc.ComputeStatistics(2)
    $find = $doc.Content
    $refPage = $null
    if ($find.Find.Execute('References')) { $refPage = $find.Information(3) }
    $doc.ExportAsFixedFormat([string]$pdf, 17)
    $doc.Close($false); $doc = $null
    Write-Output "pages: $total total; References starts on page $refPage, so sections 1-9 use $($refPage - 1) pages (limit 8)"
} finally {
    try { if ($doc) { $doc.Close($false) } } catch {}
    $word.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
