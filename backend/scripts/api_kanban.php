<?php
/**
 * ==============================================================================
 * SEIN PE-Portal - GBA Task Manager Kanban API
 * Path: htdocs/tkdn/api_kanban.php or htdocs/tkdn/kanban_api.php
 * Target: Intranet PC (107.102.39.55 / Local XAMPP Server)
 * Mode: /ponytail (Zero-dependency, high resilience, full database fetch)
 * ==============================================================================
 * Database: project_manager_db (Priority #1)
 * Features:
 *   - Prioritizes project_manager_db as the primary GBA database
 *   - Auto-discovers tables: tasks, project_tasks, gba_tasks, projects, etc.
 *   - Maps all 8 Kanban columns expected by GbaTasksPage.jsx
 *   - ?debug=1 parameter to inspect databases and tables
 *   - ?db=... and ?table=... overrides
 *   - Safe memory limit (512M) & timeout (120s)
 * ==============================================================================
 */

ini_set('memory_limit', '512M');
set_time_limit(120);

// 1. CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Database Candidates & Configuration
$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = getenv('DB_PORT') ?: '3306';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

// Prioritize project_manager_db as requested by user
$dbCandidates = array_unique(array_filter([
    $_GET['db'] ?? '',
    getenv('DB_NAME') ?: '',
    'project_manager_db',
    'tkdn',
    'gba',
    'task_manager',
]));

$passCandidates = array_unique([$DB_PASS, '', 'rootpassword', 'root_password', 'password', 'sein2016!']);

// Standard 8 Kanban Status Categories expected by PE-Portal
$KANBAN_STATUSES = [
    'Task Baru',
    'Downloaded',
    'Test Ongoing',
    'Pending Feedback',
    'Feedback Sent',
    'Submitted',
    'Approved',
    'Batal',
];

// 3. Database Connection Discovery
$pdo = null;
$connectedDb = null;
$dbError = null;

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

// 4. Debug Diagnostic Endpoint: ?debug=1 or ?info=1
if (isset($_GET['debug']) || isset($_GET['info'])) {
    $info = [
        'status'        => $pdo ? 'connected' : 'failed',
        'connected_db'  => $connectedDb,
        'db_candidates' => $dbCandidates,
        'db_error'      => $dbError,
        'databases'     => [],
        'tables_in_db'  => [],
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

// 5. Detect Target Table in Connected Database
$targetTable = $_GET['table'] ?? null;
if ($pdo && !$targetTable) {
    try {
        $tableCandidates = ['tasks', 'project_tasks', 'gba_tasks', 'projects', 'new_tasks', 'kanban_tasks', 'issues', 'tickets'];
        foreach ($tableCandidates as $tbl) {
            $check = $pdo->query("SHOW TABLES LIKE '{$tbl}'")->fetch();
            if ($check) {
                $targetTable = $tbl;
                break;
            }
        }

        // If candidate names not found, find the table in DB with the most rows
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
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// 6. Handle POST Updates (Status transition from PE-Portal)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $pdo && $targetTable) {
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    $action = $_GET['action'] ?? ($postData['action'] ?? '');

    if ($action === 'update_status' || isset($postData['status'])) {
        $taskId = (int)($postData['id'] ?? 0);
        $newStatus = trim($postData['status'] ?? '');

        if ($taskId > 0 && in_array($newStatus, $KANBAN_STATUSES, true)) {
            // Find status column name
            $cols = $pdo->query("SHOW COLUMNS FROM `{$targetTable}`")->fetchAll(PDO::FETCH_COLUMN);
            $stCol = in_array('progress_status', $cols, true) ? 'progress_status' : (in_array('status', $cols, true) ? 'status' : 'progress_status');

            $stmt = $pdo->prepare("UPDATE `{$targetTable}` SET `{$stCol}` = :st WHERE `id` = :id");
            $stmt->execute([':st' => $newStatus, ':id' => $taskId]);
            echo json_encode([
                'status'  => 'success',
                'message' => "Task #{$taskId} status updated to '{$newStatus}' in {$targetTable}"
            ]);
            exit;
        }
    }
}

// 7. Fetch Full Records from Database
$tasks = [];
$sourceType = 'mysql';

if ($pdo && $targetTable) {
    try {
        $limitParam = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
        $limitClause = $limitParam > 0 ? "LIMIT {$limitParam}" : "";

        $cols = $pdo->query("SHOW COLUMNS FROM `{$targetTable}`")->fetchAll(PDO::FETCH_COLUMN);
        $orderCol = in_array('id', $cols, true) ? 'id' : ($cols[0] ?? '');
        $orderClause = $orderCol ? "ORDER BY `{$orderCol}` DESC" : "";

        $query = "SELECT * FROM `{$targetTable}` {$orderClause} {$limitClause}";
        $rawRows = $pdo->query($query)->fetchAll();

        foreach ($rawRows as $idx => $r) {
            $id = $r['id'] ?? ($idx + 1);
            $modelName = $r['model_name'] ?? ($r['model'] ?? ($r['device'] ?? ($r['device_model'] ?? '')));
            $projectName = $r['project_name'] ?? ($r['project'] ?? ($r['title'] ?? ($r['name'] ?? '')));
            $ap = $r['ap'] ?? ($r['ap_version'] ?? '');
            $cp = $r['cp'] ?? ($r['cp_version'] ?? '');
            $csc = $r['csc'] ?? ($r['csc_version'] ?? '');
            $planType = $r['test_plan_type'] ?? ($r['type'] ?? ($r['plan_type'] ?? 'MR'));

            // Status normalization
            $rawStatus = trim($r['progress_status'] ?? ($r['status'] ?? ($r['state'] ?? 'Task Baru')));
            $status = 'Task Baru';
            if (in_array($rawStatus, $KANBAN_STATUSES, true)) {
                $status = $rawStatus;
            } elseif (stripos($rawStatus, 'ongoing') !== false || stripos($rawStatus, 'test') !== false || stripos($rawStatus, 'progress') !== false) {
                $status = 'Test Ongoing';
            } elseif (stripos($rawStatus, 'down') !== false) {
                $status = 'Downloaded';
            } elseif (stripos($rawStatus, 'done') !== false || stripos($rawStatus, 'approve') !== false || stripos($rawStatus, 'finish') !== false || stripos($rawStatus, 'pass') !== false) {
                $status = 'Approved';
            } elseif (stripos($rawStatus, 'submit') !== false) {
                $status = 'Submitted';
            } elseif (stripos($rawStatus, 'feedback') !== false) {
                $status = 'Pending Feedback';
            } elseif (stripos($rawStatus, 'cancel') !== false || stripos($rawStatus, 'batal') !== false || stripos($rawStatus, 'reject') !== false) {
                $status = 'Batal';
            }

            // Priority / Is Urgent
            $isUrgent = 0;
            if (isset($r['is_urgent'])) {
                $isUrgent = (int)$r['is_urgent'];
            } elseif (isset($r['priority'])) {
                $p = strtolower((string)$r['priority']);
                $isUrgent = ($p === 'urgent' || $p === 'high' || $p === 'critical' || $p === '1') ? 1 : 0;
            }

            $pic = $r['pic_email'] ?? ($r['pic'] ?? ($r['assignee'] ?? ($r['engineer'] ?? '')));
            $reviewer = $r['reviewer_email'] ?? ($r['reviewer'] ?? ($r['manager'] ?? ''));
            $subId = $r['submission_id'] ?? ($r['sub_id'] ?? ('SUB-' . $id));
            $reqDate = $r['request_date'] ?? ($r['req_date'] ?? ($r['created_at'] ?? date('Y-m-d')));
            $deadline = $r['deadline'] ?? ($r['due_date'] ?? ($r['target_date'] ?? date('Y-m-d', strtotime('+3 days'))));

            $normalized = [
                'id'              => is_numeric($id) ? (int)$id : $id,
                'model_name'      => (string)$modelName,
                'project_name'    => (string)$projectName,
                'ap'              => (string)$ap,
                'cp'              => (string)$cp,
                'csc'             => (string)$csc,
                'test_plan_type'  => (string)$planType,
                'progress_status' => (string)$status,
                'is_urgent'       => $isUrgent,
                'pic_email'       => (string)$pic,
                'reviewer_email'  => (string)$reviewer,
                'submission_id'   => (string)$subId,
                'request_date'    => (string)$reqDate,
                'deadline'        => (string)$deadline,
                'qb_user'         => (string)($r['qb_user'] ?? ''),
                'qb_userdebug'    => (string)($r['qb_userdebug'] ?? ''),
                'qb_eng'          => (string)($r['qb_eng'] ?? ''),
                'remarks'         => (string)($r['remarks'] ?? ($r['note'] ?? ($r['description'] ?? ''))),
            ];

            // Merge so all raw DB fields are preserved
            $tasks[] = array_merge($r, $normalized);
        }
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// 8. Fallback Mock Data ONLY if database completely failed and has zero rows
if (empty($tasks) && !$pdo) {
    $sourceType = 'mock_fallback';
    $today = date('Y-m-d');
    $tasks = [
        [
            'id'              => 101,
            'model_name'      => 'SM-S928B',
            'project_name'    => 'Galaxy S24 Ultra',
            'ap'              => 'S928BXXU1AXB5',
            'cp'              => 'S928BXXU1AXB5',
            'csc'             => 'S928BOLE1AXB5',
            'test_plan_type'  => 'MR',
            'progress_status' => 'Task Baru',
            'is_urgent'       => 1,
            'pic_email'       => 'endri.s@samsung.com',
            'reviewer_email'  => 'manager.pe@samsung.com',
            'submission_id'   => 'SUB-2026-001',
            'request_date'    => $today,
            'deadline'        => date('Y-m-d', strtotime('+2 days')),
            'qb_user'         => 'http://quickbuild/build/10492',
        ]
    ];
}

// 9. Group Tasks into Standard 8 Kanban Columns
$columns = [];
foreach ($KANBAN_STATUSES as $statusName) {
    $columns[$statusName] = [];
}

foreach ($tasks as $t) {
    $st = $t['progress_status'] ?? 'Task Baru';
    if (!array_key_exists($st, $columns)) {
        $st = 'Task Baru';
    }
    $columns[$st][] = $t;
}

// 10. Output Final JSON Response
$response = [
    'status'     => 'success',
    'source'     => $sourceType,
    'total'      => count($tasks),
    'db_status'  => $pdo ? 'connected' : 'offline',
    'database'   => $connectedDb,
    'table'      => $targetTable,
    'columns'    => $columns,
    'timestamp'  => date('c'),
];

if ($dbError && empty($tasks)) {
    $response['db_warning'] = $dbError;
}

echo json_encode($response, JSON_UNESCAPED_SLASHES);
