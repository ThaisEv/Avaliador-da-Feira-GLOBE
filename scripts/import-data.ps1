param([string]$Workbook = (Join-Path $PSScriptRoot '..\Ficha_Avaliacao_Professores_2a_FEIRA_GLOBE_2026 (3).xlsx'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Workbook))
function Read-Sheet([string]$path) {
  $entry = $zip.GetEntry($path); $reader = [IO.StreamReader]::new($entry.Open()); $xml = [xml]$reader.ReadToEnd(); $reader.Close()
  $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable); $ns.AddNamespace('x','http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $out = @()
  foreach ($row in $xml.SelectNodes('//x:sheetData/x:row',$ns)) {
    $cells = @{}
    foreach ($cell in $row.SelectNodes('x:c',$ns)) {
      $ref = $cell.GetAttribute('r'); $col = [regex]::Match($ref,'^[A-Z]+').Value
      $node = $cell.SelectSingleNode('x:is/x:t',$ns); if (!$node) { $node = $cell.SelectSingleNode('x:v',$ns) }
      $cells[$col] = if ($node) { [System.Net.WebUtility]::HtmlDecode($node.InnerText) } else { '' }
    }
    $out += ,$cells
  }
  return ,$out
}
try {
  $criteriaRows = Read-Sheet 'xl/worksheets/sheet1.xml'
  $criteria = @($criteriaRows | Where-Object { $_.A -match '^C[1-7]$' } | ForEach-Object { [ordered]@{ id=$_.A; name=$_.B; description=$_.C } })
  if ($criteria.Count -ne 7 -or @($criteria | Where-Object { !$_.name -or !$_.description }).Count) { throw 'A aba Critérios não contém os sete critérios completos.' }
  $works = @(); $sheets = @(@{file='sheet2.xml';key='ORAL';modality='Oral'},@{file='sheet3.xml';key='POSTER';modality='Pôster'},@{file='sheet4.xml';key='ONLINE';modality='Online'})
  foreach ($sheet in $sheets) {
    $rows = Read-Sheet ('xl/worksheets/' + $sheet.file)
    foreach ($row in $rows) {
      if ($row.A -notmatch '^\d+$' -or !$row.D) { continue }
      $number = [int]$row.A; $id = '{0}-{1:D3}' -f $sheet.key,$number
      $works += [ordered]@{ id=$id; number=$number; modality=$sheet.modality; title=$row.D; school=$row.E; dayTime=$row.B; location=$row.C; url=('?trabalho=' + $id) }
    }
  }
  if ($works.Count -ne 134) { Write-Warning "Quantidade encontrada: $($works.Count); esperado: 134." }
  $ids = @($works | ForEach-Object { $_['id'] })
  if (@($ids | Sort-Object -Unique).Count -ne $works.Count) { throw 'IDs compostos duplicados.' }
  $outDir = Join-Path $PSScriptRoot '..\data'; New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  @{works=$works} | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $outDir 'trabalhos.json')
  @{criteria=$criteria} | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $outDir 'criterios.json')
  Write-Host "Importados $($works.Count) trabalhos e $($criteria.Count) critérios oficiais."
} finally { $zip.Dispose() }
