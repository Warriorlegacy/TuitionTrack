# MVP-1 vertical slice test. Requires: dev server + teacher session.
# Usage:
#   1. Apply migration + fixtures (replace TEACHER/STUDENT ids first).
#   2. Log in as teacher in browser, copy cookies OR set $BASE (default localhost:3000).
#   3. pwsh scripts/ai-slice-test.ps1 -Base http://localhost:3000 -StudentId <uuid>
param([string]$Base = "http://localhost:3000", [string]$StudentId = "")
if (-not $StudentId) { Write-Error "Pass -StudentId <uuid>"; exit 1 }

function Call([string]$Method, [string]$Path, [object]$Body) {
  $json = $Body | ConvertTo-Json -Depth 8
  # NOTE: reuses browser session; run `npx next dev` logged-in profile or paste -WebSession.
  Invoke-RestMethod -Method $Method -Uri "$Base$Path" -Body $json -ContentType "application/json"
}

Write-Output "== 1. tutor (Socratic stub without OPENAI_API_KEY) =="
$t = Call POST "/api/ai/tutor" @{ student_id = $StudentId; message = "How do I factor x^2 - 5x + 6?"; mode = "socratic"; source_only = $true }
$t | ConvertTo-Json -Depth 6

Write-Output "== 2. quiz =="
$q = Call POST "/api/ai/quiz" @{ student_id = $StudentId; count = 2; difficulty = 2 }
$q | ConvertTo-Json -Depth 6

Write-Output "== 3. flashcards =="
$f = Call POST "/api/ai/flashcards" @{ student_id = $StudentId; count = 2 }
$f | ConvertTo-Json -Depth 6

Write-Output "== 4. submit assessment (2 right, 1 sign-error) =="
$s = Call POST "/api/assessments/c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0/submit" @{
  student_id = $StudentId
  responses = @(
    @{ assessment_item_id = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1"; answer = "A"; time_ms = 25000; confidence = 4 },
    @{ assessment_item_id = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2"; answer = "2"; time_ms = 30000; confidence = 5 },
    @{ assessment_item_id = "d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3"; answer = "-1"; time_ms = 120000; confidence = 4 }
  )
}
$s | ConvertTo-Json -Depth 6

Write-Output "== 5. analysis (score + 3 actions) =="
Invoke-RestMethod -Method GET -Uri "$Base/api/attempts/$($s.attempt_id)/analysis" | ConvertTo-Json -Depth 8

Write-Output "== 6. mastery / readiness / mistakes =="
Invoke-RestMethod -Method GET -Uri "$Base/api/students/$StudentId/mastery" | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method GET -Uri "$Base/api/students/$StudentId/readiness" | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method GET -Uri "$Base/api/students/$StudentId/mistakes" | ConvertTo-Json -Depth 6

Write-Output "== 7. reviews =="
$n = Call POST "/api/reviews/next" @{ student_id = $StudentId }
$n | ConvertTo-Json -Depth 6
if ($n.due.Count -gt 0) {
  Call POST "/api/reviews/answer" @{ spaced_item_id = $n.due[0].id; student_id = $StudentId; grade = 3 } | ConvertTo-Json -Depth 6
}
Write-Output "SLICE OK — expect: score 2/4, 1 sign mistake, 3 next actions."
