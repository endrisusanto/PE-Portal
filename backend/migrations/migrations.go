package migrations

import "embed"

// FS embeds all migration SQL files into the compiled binary so migrations never fail due to working directory mismatches.
//
//go:embed *.sql
var FS embed.FS
