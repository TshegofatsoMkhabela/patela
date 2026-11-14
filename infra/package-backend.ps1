$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backend = Join-Path $repo 'backend'
$packageDir = Join-Path ([System.IO.Path]::GetTempPath()) ('patela-lambda-' + [guid]::NewGuid().ToString('N'))
$artifactDir = Join-Path $PSScriptRoot 'artifacts'
$artifact = Join-Path $artifactDir 'patela-backend.zip'

Push-Location $backend
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript build failed' }
} finally { Pop-Location }

Write-Output 'Backend build complete; staging Lambda package.'

New-Item -ItemType Directory -Path $packageDir -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $backend 'dist') -Destination $packageDir -Recurse
Copy-Item -LiteralPath (Join-Path $backend 'migrations') -Destination $packageDir -Recurse
Copy-Item -LiteralPath (Join-Path $backend 'node_modules') -Destination $packageDir -Recurse
Copy-Item -LiteralPath (Join-Path $backend 'package.json') -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $backend 'package-lock.json') -Destination $packageDir

Push-Location $packageDir
try {
  & npm.cmd prune --omit=dev --offline --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'Production dependency pruning failed' }
  if (Test-Path -LiteralPath $artifact) { Remove-Item -LiteralPath $artifact }
  & tar -a -cf $artifact -C $packageDir .
  if ($LASTEXITCODE -ne 0) { throw 'ZIP creation failed' }
} finally { Pop-Location }

Write-Output $artifact
