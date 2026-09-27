Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '../web/icons'
New-Item -ItemType Directory -Path $iconRoot -Force | Out-Null
foreach ($iconSpec in @(@('icon-192.png',192), @('icon-512.png',512), @('maskable-512.png',512), @('apple-touch-icon.png',180))) {
  $size = [int]$iconSpec[1]
  $bitmap = New-Object System.Drawing.Bitmap($size,$size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#165c48'))
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White,($size * 0.035))
  $graphics.DrawRectangle($pen,($size * 0.25),($size * 0.27),($size * 0.50),($size * 0.48))
  $graphics.DrawLine($pen,($size * 0.25),($size * 0.40),($size * 0.75),($size * 0.40))
  $graphics.DrawLine($pen,($size * 0.36),($size * 0.21),($size * 0.36),($size * 0.34))
  $graphics.DrawLine($pen,($size * 0.64),($size * 0.21),($size * 0.64),($size * 0.34))
  $graphics.DrawLine($pen,($size * 0.38),($size * 0.56),($size * 0.47),($size * 0.65))
  $graphics.DrawLine($pen,($size * 0.47),($size * 0.65),($size * 0.65),($size * 0.48))
  $bitmap.Save((Join-Path $iconRoot $iconSpec[0]),[System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
