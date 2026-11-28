# Exports slides/final_presentation.pptx to slides/final_presentation.pdf with Microsoft PowerPoint.
#   powershell -NoProfile -ExecutionPolicy Bypass -File slides/src/export_pdf.ps1 [png_dir]
# With png_dir, also writes one PNG per slide there (for checking the layout).
param([string]$PngDir = '')
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pptx = Resolve-Path (Join-Path $here '..\final_presentation.pptx')
$pdf = Join-Path (Split-Path -Parent $pptx) 'final_presentation.pdf'
$app = New-Object -ComObject PowerPoint.Application
$deck = $null
try {
    $deck = $app.Presentations.Open([string]$pptx, $true, $false, $false)
    $deck.SaveAs([string]$pdf, 32)
    if ($PngDir) {
        New-Item -ItemType Directory -Force $PngDir | Out-Null
        foreach ($s in $deck.Slides) { $s.Export((Join-Path $PngDir ('s{0:D2}.png' -f $s.SlideIndex)), 'PNG', 1600, 900) }
    }
    Write-Output "slides: $($deck.Slides.Count); wrote $pdf"
} finally {
    if ($deck) { $deck.Close() }
    $app.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
