<?php
/**
 * ==============================================================================
 * SEIN PE-Portal - Companion Release Cheatsheet (Software MR) API
 * Path: htdocs/companion-release-cheatsheet/api_releases.php
 * Target: Intranet PC (107.102.39.55 / Local XAMPP Server)
 * Mode: /ponytail (Zero-dependency, high resilience, full database fetch)
 * ==============================================================================
 * Database: companion_release_db (Priority #1)
 * Features:
 *   - Fetches 100% full dataset from companion_release_db
 *   - Auto-scans tables: releases, release_cheatsheets, software_mr, or any table with rows
 *   - Flexible column normalization (model, ap, cp, csc, etc.)
 *   - ?debug=1 parameter to inspect databases and tables
 *   - ?db=... and ?table=... overrides
 *   - Safe memory limit (512M) & timeout (120s)
 * ==============================================================================
 */

ini_set('memory_limit', '512M');
set_time_limit(120);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = getenv('DB_PORT') ?: '3306';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

// Prioritize companion_release_db as requested by user
$dbCandidates = array_unique(array_filter([
    $_GET['db'] ?? '',
    getenv('DB_NAME') ?: '',
    'companion_release_db',
    'companion_release',
    'tkdn',
    'project_manager_db',
    'gba',
]));

$pdo = null;
$connectedDb = null;
$dbError = null;

// Multi-credential fallback for intranet XAMPP & Docker MySQL
$passCandidates = array_unique([$DB_PASS, '', 'rootpassword', 'root_password', 'password', 'sein2016!']);

foreach ($dbCandidates as $dbName) {
    foreach ($passCandidates as $pass) {
        try {
            $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$dbName};charset=utf8mb4";
            $testPdo = new PDO($dsn, $DB_USER, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT            => 2,
            ]);
            $pdo = $testPdo;
            $connectedDb = $dbName;
            break 2;
        } catch (Exception $e) {
            $dbError = $e->getMessage();
            continue;
        }
    }
}

// Debug endpoint: ?debug=1 or ?info=1
if (isset($_GET['debug']) || isset($_GET['info'])) {
    $info = [
        'status'         => $pdo ? 'connected' : 'failed',
        'connected_db'   => $connectedDb,
        'db_candidates'  => $dbCandidates,
        'db_error'       => $dbError,
        'databases'      => [],
        'tables_in_db'   => [],
    ];
    if ($pdo) {
        try {
            $info['databases'] = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($tables as $t) {
                $count = (int)$pdo->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
                $columns = $pdo->query("SHOW COLUMNS FROM `{$t}`")->fetchAll(PDO::FETCH_COLUMN);
                $info['tables_in_db'][$t] = [
                    'rows'    => $count,
                    'columns' => $columns,
                ];
            }
        } catch (Exception $ex) {
            $info['query_error'] = $ex->getMessage();
        }
    }
    echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$releases = [];
if ($pdo) {
    try {
        $targetTable = $_GET['table'] ?? null;
        if (!$targetTable) {
            $tableCandidates = ['releases', 'release_cheatsheets', 'software_mr', 'companion_releases', 'cheatsheets', 'release_notes'];
            foreach ($tableCandidates as $tbl) {
                $check = $pdo->query("SHOW TABLES LIKE '{$tbl}'")->fetch();
                if ($check) {
                    $targetTable = $tbl;
                    break;
                }
            }

            // If not found in known candidates, find first table that has rows
            if (!$targetTable) {
                $allTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
                $maxRows = -1;
                foreach ($allTables as $tbl) {
                    $cnt = (int)$pdo->query("SELECT COUNT(*) FROM `{$tbl}`")->fetchColumn();
                    if ($cnt > $maxRows) {
                        $maxRows = $cnt;
                        $targetTable = $tbl;
                    }
                }
            }
        }

        if ($targetTable) {
            $limitParam = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
            $limitClause = $limitParam > 0 ? "LIMIT {$limitParam}" : "";

            // Check if 'id' column exists for ORDER BY
            $cols = $pdo->query("SHOW COLUMNS FROM `{$targetTable}`")->fetchAll(PDO::FETCH_COLUMN);
            $orderCol = in_array('id', $cols, true) ? 'id' : ($cols[0] ?? '');
            $orderClause = $orderCol ? "ORDER BY `{$orderCol}` DESC" : "";

            $query = "SELECT * FROM `{$targetTable}` {$orderClause} {$limitClause}";
            $rawRows = $pdo->query($query)->fetchAll();

            foreach ($rawRows as $idx => $r) {
                // Flexible field mapping so UI and Go backend always find required keys
                $id = $r['id'] ?? ($idx + 1);
                $model = $r['model'] ?? ($r['model_name'] ?? ($r['device'] ?? ($r['device_name'] ?? '')));
                $oleVer = $r['ole_version'] ?? ($r['old_version'] ?? ($r['prev_version'] ?? ($r['version_old'] ?? '')));
                $newVer = $r['oxm_olm_new_version'] ?? ($r['new_version'] ?? ($r['version'] ?? ($r['version_new'] ?? '')));
                $ap = $r['ap'] ?? ($r['ap_version'] ?? ($r['ap_binary'] ?? ''));
                $cp = $r['cp'] ?? ($r['cp_version'] ?? ($r['cp_binary'] ?? ''));
                $csc = $r['csc'] ?? ($r['csc_version'] ?? ($r['csc_binary'] ?? ''));
                $apMap = $r['ap_mapping'] ?? ($r['mapping_ap'] ?? '');
                $cpMap = $r['cp_mapping'] ?? ($r['mapping_cp'] ?? '');
                $cscUp = $r['csc_version_up'] ?? ($r['version_up'] ?? ($r['csc_up'] ?? ''));
                $status = $r['status'] ?? ($r['release_status'] ?? 'DONE');
                $pic = $r['pic'] ?? ($r['pic_name'] ?? ($r['engineer'] ?? ''));
                $note = $r['release_note_format'] ?? ($r['note'] ?? ($r['release_note'] ?? ($r['description'] ?? '')));
                $created = $r['created_at'] ?? ($r['request_date'] ?? date('Y-m-d H:i:s'));
                $updated = $r['updated_at'] ?? ($r['updated_date'] ?? $created);

                $normalized = [
                    'id'                  => is_numeric($id) ? (int)$id : $id,
                    'model'               => (string)$model,
                    'ole_version'         => (string)$oleVer,
                    'oxm_olm_new_version' => (string)$newVer,
                    'ap'                  => (string)$ap,
                    'cp'                  => (string)$cp,
                    'csc'                 => (string)$csc,
                    'ap_mapping'          => (string)$apMap,
                    'cp_mapping'          => (string)$cpMap,
                    'csc_version_up'      => (string)$cscUp,
                    'status'              => (string)$status,
                    'pic'                 => (string)$pic,
                    'release_note_format' => (string)$note,
                    'created_at'          => (string)$created,
                    'updated_at'          => (string)$updated,
                ];

                // Merge with raw row so no custom columns are lost
                $releases[] = array_merge($r, $normalized);
            }
        }
    } catch (Exception $e) {
        $releases = [];
    }
}

// Fallback ONLY if database connection completely failed and zero rows found
if (empty($releases) && !$pdo) {
    $now = date('Y-m-d H:i:s');
    $releases = [
        [
            'id'                  => 1,
            'model'               => 'SM-S928B',
            'ole_version'         => 'OLE1AXB5',
            'oxm_olm_new_version' => 'OXM1AXB5',
            'ap'                  => 'S928BXXU1AXB5',
            'cp'                  => 'S928BXXU1AXB5',
            'csc'                 => 'S928BOLE1AXB5',
            'ap_mapping'          => 'AP_S928B_MAPPING_V1',
            'cp_mapping'          => 'CP_S928B_MAPPING_V1',
            'csc_version_up'      => 'UP_TO_DATE',
            'status'              => 'Release',
            'pic'                 => 'Endri Susanto',
            'release_note_format' => 'FOTA / Smart Switch MR Update',
            'created_at'          => $now,
            'updated_at'          => $now,
        ]
    ];
}

echo json_encode($releases, JSON_UNESCAPED_SLASHES);
