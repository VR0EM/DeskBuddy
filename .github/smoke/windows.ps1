# Starts the freshly built app for half a minute: does it run, show the
# buddy, count key presses and clicks, and save? The results are printed
# here; screenshots end up in the "smoke-Windows" artifact.
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force smoke | Out-Null

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FakeInput {
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
'@

function Save-Screenshot($path) {
  try {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
  } catch {
    "screenshot failed: $_"
  }
}

# Looks for Pip's orange fur, and checks the pixel next to the head: if the
# window is transparent it shows the desktop there, not white.
function Find-Buddy($path) {
  if (-not (Test-Path $path)) { return "${path}: no screenshot" }
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bitmap.Width, $bitmap.Height
  $bits = $bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($bits.Stride * $bitmap.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $bytes, 0, $bytes.Length)
  $bitmap.UnlockBits($bits)
  $stride = $bits.Stride
  $count = 0; $minX = 99999; $minY = 99999; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bitmap.Height; $y += 3) {
    for ($x = 0; $x -lt $bitmap.Width; $x += 3) {
      $i = $y * $stride + $x * 4
      if ([Math]::Abs($bytes[$i + 2] - 247) -lt 25 -and [Math]::Abs($bytes[$i + 1] - 180) -lt 25 -and [Math]::Abs($bytes[$i] - 110) -lt 25) {
        $count++
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $result = "${path}: $($bitmap.Width)x$($bitmap.Height), orange pixels: $count, box: $minX,$minY - $maxX,$maxY"
  if ($count -gt 0) {
    $cx = [Math]::Min($bitmap.Width - 1, $maxX + 30); $cy = $minY + 10
    $i = $cy * $stride + $cx * 4
    $result += "; pixel right of the head at ${cx},${cy}: $($bytes[$i + 2]),$($bytes[$i + 1]),$($bytes[$i])"
  }
  $bitmap.Dispose()
  return $result
}

function Send-TestInput {
  foreach ($vk in 0x41, 0x53, 0x44, 0x46, 0x20, 0x4A, 0x4B, 0x4C, 0x48, 0x41) {
    [FakeInput]::keybd_event([byte]$vk, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 40
    [FakeInput]::keybd_event([byte]$vk, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 90
  }
  [void][FakeInput]::SetCursorPos(5, 300)
  foreach ($n in 1..3) {
    [FakeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    [FakeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 150
  }
}

# First the input listener on its own (cargo run -p deskbuddy-input --example listen).
'--- input listener on its own'
Push-Location src-tauri
cargo build -p deskbuddy-input --example listen --release --quiet
Pop-Location
$listen = Start-Process -FilePath 'src-tauri\target\release\examples\listen.exe' -ArgumentList '8' -PassThru -NoNewWindow -RedirectStandardOutput 'smoke\listen.txt' -RedirectStandardError 'smoke\listen-err.txt'
Start-Sleep -Seconds 2
Send-TestInput
$listen.WaitForExit(15000) | Out-Null
Get-Content 'smoke\listen.txt', 'smoke\listen-err.txt' -ErrorAction SilentlyContinue

'--- the app'
$exe = 'src-tauri\target\release\deskbuddy.exe'
$env:DESKBUDDY_DEBUG = '1'
$app = Start-Process -FilePath $exe -PassThru -RedirectStandardError 'smoke\stderr.txt' -RedirectStandardOutput 'smoke\stdout.txt'
Start-Sleep -Seconds 15
Save-Screenshot 'smoke\windows-start.png'

# Real key presses and clicks through the system's input queue: first while
# DeskBuddy's own window has the focus, then while Notepad has it.
Send-TestInput
$notepad = Start-Process notepad -PassThru
Start-Sleep -Seconds 3
'--- now typing into Notepad'
Send-TestInput

# After the hooks' 30-second re-arm, type once more.
Start-Sleep -Seconds 16
'--- typing again after the re-arm'
Send-TestInput

# Autosave runs every 15 seconds.
Start-Sleep -Seconds 18
Save-Screenshot 'smoke\windows-after.png'

'--- what the screenshots show'
Find-Buddy 'smoke\windows-start.png'
Find-Buddy 'smoke\windows-after.png'

$data = Join-Path $env:APPDATA 'io.github.vr0em.deskbuddy'
'--- settings.json'
Get-Content (Join-Path $data 'settings.json') -ErrorAction SilentlyContinue
'--- stats.json'
Get-Content (Join-Path $data 'stats.json') -ErrorAction SilentlyContinue

$running = -not $app.HasExited
if ($running) { Stop-Process -Id $app.Id -Force; Start-Sleep -Seconds 1 }
Stop-Process -Id $notepad.Id -Force -ErrorAction SilentlyContinue
'--- app output'
Get-Content 'smoke\stderr.txt', 'smoke\stdout.txt' -ErrorAction SilentlyContinue

if (-not $running) {
  "DeskBuddy stopped unexpectedly (exit code $($app.ExitCode))"
  exit 1
}
'DeskBuddy was still running'
