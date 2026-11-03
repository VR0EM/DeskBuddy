# Starts the freshly built app for half a minute: does it run, draw, count
# key presses and save? Screenshots end up in the "smoke-Windows" artifact.
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force smoke | Out-Null

$exe = 'src-tauri\target\release\deskbuddy.exe'
$app = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 15

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
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

Save-Screenshot 'smoke\windows-start.png'

# Type a little. The low-level keyboard hook sees these like real key presses.
$shell = New-Object -ComObject WScript.Shell
foreach ($key in 'a', 's', 'd', 'f', ' ', 'j', 'k', 'l', 'a', 'l', ' ', 'h') {
  $shell.SendKeys($key)
  Start-Sleep -Milliseconds 120
}

# Autosave runs every 15 seconds.
Start-Sleep -Seconds 18
Save-Screenshot 'smoke\windows-after.png'

$data = Join-Path $env:APPDATA 'io.github.vr0em.deskbuddy'
'--- settings.json'
Get-Content (Join-Path $data 'settings.json') -ErrorAction SilentlyContinue
'--- stats.json'
Get-Content (Join-Path $data 'stats.json') -ErrorAction SilentlyContinue

if ($app.HasExited) {
  "DeskBuddy stopped unexpectedly (exit code $($app.ExitCode))"
  exit 1
}
'DeskBuddy is still running'
Stop-Process -Id $app.Id -Force
