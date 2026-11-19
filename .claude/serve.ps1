# Простий локальний сервер для перегляду сайту (http://localhost:5173)
param([int]$Port = 5173)
$root = Split-Path -Parent $PSScriptRoot
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='application/javascript'; '.json'='application/json';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.svg'='image/svg+xml';
  '.mp4'='video/mp4'; '.webm'='video/webm'; '.woff2'='font/woff2'; '.ico'='image/x-icon' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $root on http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    # Лише для розробки: POST /__save/<шлях> зберігає тіло запиту у файл проєкту (нарізка кадрів тощо)
    if ($ctx.Request.HttpMethod -eq 'POST' -and $rel.StartsWith('__save/')) {
      $target = [IO.Path]::GetFullPath((Join-Path $root $rel.Substring(7)))
      if (-not $target.StartsWith($root)) { throw 'bad path' }
      New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
      $ms = New-Object IO.MemoryStream; $ctx.Request.InputStream.CopyTo($ms)
      [IO.File]::WriteAllBytes($target, $ms.ToArray())
      $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue
    }
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (Test-Path $path -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($path)
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control','no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  $ctx.Response.Close()
}
