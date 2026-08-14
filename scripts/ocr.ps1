param(
    [string]$Dir = "assets/images/mockups_ocr"
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Load WinRT types
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Foundation, ContentType=WindowsRuntime]

# Await helper for WinRT IAsyncOperation
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

# Prefer French, fall back to user profile languages
$lang = New-Object Windows.Globalization.Language "fr-FR"
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if (-not $engine) {
    Write-Error "No OCR engine available"
    exit 1
}
Write-Host "OCR engine language: $($engine.RecognizerLanguage.LanguageTag)"

Get-ChildItem -Path $Dir -Filter *.png | Sort-Object Name | ForEach-Object {
    $path = $_.FullName
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $outFile = $_.BaseName + ".txt"
    $lines = @()
    foreach ($line in $result.Lines) {
        if ($line.Words.Count -eq 0) { continue }
        $minX = [double]::MaxValue; $minY = [double]::MaxValue
        $maxX = [double]::MinValue; $maxY = [double]::MinValue
        foreach ($w in $line.Words) {
            $r = $w.BoundingRect
            if ($r.X -lt $minX) { $minX = $r.X }
            if ($r.Y -lt $minY) { $minY = $r.Y }
            if (($r.X + $r.Width) -gt $maxX) { $maxX = $r.X + $r.Width }
            if (($r.Y + $r.Height) -gt $maxY) { $maxY = $r.Y + $r.Height }
        }
        $lines += ("[{0:F0},{1:F0},{2:F0},{3:F0}] {4}" -f $minX, $minY, ($maxX - $minX), ($maxY - $minY), $line.Text)
    }
    Set-Content -Path (Join-Path $Dir $outFile) -Value $lines -Encoding UTF8
    Write-Host ("OK {0} ({1} lines)" -f $_.Name, $lines.Count)
}
