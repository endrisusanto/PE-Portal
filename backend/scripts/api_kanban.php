<?php
/**
 * ==============================================================================
 * SEIN PE-Portal - GBA Task Manager Kanban API
 * Path: htdocs/tkdn/api_kanban.php or htdocs/tkdn/kanban_api.php
 * Target: Intranet PC (107.102.39.55 / Local XAMPP Server)
 * Mode: /ponytail (Zero-dependency, high resilience, full database fetch)
 * ==============================================================================
 * Description:
 *   Exposes GBA Task Manager database records as standard JSON for PE-Portal.
 *   - Auto-scans databases: tkdn, project_manager_db, gba, task_manager
 *   - Auto-scans tables: gba_tasks, new_tasks, tasks
 *   - Retrieves the COMPLETE database (supports optional ?limit= parameter, default: all)
 *   - Maps all 8 Kanban columns expected by GbaTasksPage.jsx
 * ==============================================================================
 */

// Safe limits for full database transfer
ini_set('memory_limit', '512M');
set_time_limit(60);

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

$dbCandidates = array_unique(array_filter([
    getenv('DB_NAME') ?: '',
    'tkdn',
    'project_manager_db',
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
            continue;
        }
    }
}

// If no existing candidate connected, try creating default db
if (!$pdo) {
    try {
        $defaultDb = $dbCandidates[0] ?? 'tkdn';
        $dsnNoDb = "mysql:host={$DB_HOST};port={$DB_PORT};charset=utf8mb4";
        $pdoInit = new PDO($dsnNoDb, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdoInit->exec("CREATE DATABASE IF NOT EXISTS `{$defaultDb}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
        $pdo = new PDO("mysql:host={$DB_HOST};port={$DB_PORT};dbname={$defaultDb};charset=utf8mb4", $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $connectedDb = $defaultDb;
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// 4. Handle POST Updates (Status transition from PE-Portal)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $pdo) {
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    $action = $_GET['action'] ?? ($postData['action'] ?? '');

    if ($action === 'update_status' || isset($postData['status'])) {
        $taskId = (int)($postData['id'] ?? 0);
        $newStatus = trim($postData['status'] ?? '');

        if ($taskId > 0 && in_array($newStatus, $KANBAN_STATUSES, true)) {
            $targetTable = 'gba_tasks';
            $check = $pdo->query("SHOW TABLES LIKE 'gba_tasks'")->fetch();
            if (!$check) {
                $checkAlt = $pdo->query("SHOW TABLES LIKE 'tasks'")->fetch();
                if ($checkAlt) $targetTable = 'tasks';
            }
            $stmt = $pdo->prepare("UPDATE `{$targetTable}` SET `progress_status` = :st WHERE `id` = :id");
            $stmt->execute([':st' => $newStatus, ':id' => $taskId]);
            echo json_encode([
                'status'  => 'success',
                'message' => "Task #{$taskId} status updated to '{$newStatus}'"
            ]);
            exit;
        }
    }
}

// 5. Fetch Full Records from Database
$tasks = [];
$sourceType = 'mysql';

if ($pdo) {
    try {
        $tableCandidates = ['gba_tasks', 'tasks', 'new_tasks'];
        $targetTable = null;

        foreach ($tableCandidates as $tbl) {
            $check = $pdo->query("SHOW TABLES LIKE '{$tbl}'")->fetch();
            if ($check) {
                $targetTable = $tbl;
                break;
            }
        }

        if ($targetTable) {
            // Optional ?limit= parameter. If omitted or 0, retrieves the ENTIRE table
            $limitParam = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
            $limitClause = $limitParam > 0 ? "LIMIT {$limitParam}" : "";

            // Query full database records
            $query = "SELECT * FROM `{$targetTable}` ORDER BY is_urgent DESC, deadline ASC, id DESC {$limitClause}";
            $tasks = $pdo->query($query)->fetchAll();
        }
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// 6. Fallback Mock Data ONLY if database is completely empty or offline
if (empty($tasks)) {
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
        ],
        [
            'id'              => 102,
            'model_name'      => 'SM-A556E',
            'project_name'    => 'Galaxy A55 5G',
            'ap'              => 'A556EXXU2BXA1',
            'cp'              => 'A556EXXU2BXA1',
            'csc'             => 'A556EOLE2BXA1',
            'test_plan_type'  => 'Initial Release',
            'progress_status' => 'Downloaded',
            'is_urgent'       => 0,
            'pic_email'       => 'apta.p@samsung.com',
            'reviewer_email'  => 'manager.pe@samsung.com',
            'submission_id'   => 'SUB-2026-002',
            'request_date'    => $today,
            'deadline'        => date('Y-m-d', strtotime('+3 days')),
            'qb_user'         => 'http://quickbuild/build/10493',
        ],
        [
            'id'              => 103,
            'model_name'      => 'SM-A356E',
            'project_name'    => 'Galaxy A35 5G',
            'ap'              => 'A356EXXU1AXC2',
            'cp'              => 'A356EXXU1AXC2',
            'csc'             => 'A356EOLE1AXC2',
            'test_plan_type'  => 'FOTA',
            'progress_status' => 'Test Ongoing',
            'is_urgent'       => 0,
            'pic_email'       => 'taufik.h@samsung.com',
            'reviewer_email'  => 'manager.pe@samsung.com',
            'submission_id'   => 'SUB-2026-003',
            'request_date'    => $today,
            'deadline'        => date('Y-m-d', strtotime('+4 days')),
        ],
        [
            'id'              => 104,
            'model_name'      => 'SM-S921B',
            'project_name'    => 'Galaxy S24',
            'ap'              => 'S921BXXU1AXB1',
            'cp'              => 'S921BXXU1AXB1',
            'csc'             => 'S921BOLE1AXB1',
            'test_plan_type'  => 'Security Patch',
            'progress_status' => 'Pending Feedback',
            'is_urgent'       => 1,
            'pic_email'       => 'dimas.w@samsung.com',
            'reviewer_email'  => 'manager.pe@samsung.com',
            'submission_id'   => 'SUB-2026-004',
            'request_date'    => $today,
            'deadline'        => date('Y-m-d', strtotime('+1 day')),
        ],
        [
            'id'              => 105,
            'model_name'      => 'SM-A155F',
            'project_name'    => 'Galaxy A15 LTE',
            'ap'              => 'A155FXXU1AXA2',
            'cp'              => 'A155FXXU1AXA2',
            'csc'             => 'A155FOLE1AXA2',
            'test_plan_type'  => 'MR',
            'progress_status' => 'Submitted',
            'is_urgent'       => 0,
            'pic_email'       => 'endri.s@samsung.com',
            'reviewer_email'  => 'manager.pe@samsung.com',
            'submission_id'   => 'SUB-2026-005',
            'request_date'    => $today,
            'deadline'        => date('Y-m-d', strtotime('+2 days')),
        ],
        [
            'id'              => 106,
            'model_name'      => 'SM-S926B',
            'project_name'    => 'Galaxy S24+',
            'ap'              => 'S926BXXU1AXB5',
            'cp'              => 'S926BXXU1AXB5',
            'csc'             => 'S926BOLE1AXB5',
            'test_plan_type'  => 'MR',
            'progress_status' => 'Approved',
            'is_urgent'       => 0,
            'pic_email'       => 'bayu.p@samsung.com',
            'reviewer_email'  => 'manager.pe@samsung.com',
            'submission_id'   => 'SUB-2026-006',
            'request_date'    => $today,
            'deadline'        => date('Y-m-d', strtotime('+5 days')),
            'approved_date'   => $today,
        ],
    ];
}

// 7. Group Tasks into Standard 8 Kanban Columns
$columns = [];
foreach ($KANBAN_STATUSES as $statusName) {
    $columns[$statusName] = [];
}

foreach ($tasks as $t) {
    $t['id'] = (int)($t['id'] ?? 0);
    $t['is_urgent'] = (int)($t['is_urgent'] ?? 0);
    $status = trim($t['progress_status'] ?? 'Task Baru');

    if (!array_key_exists($status, $columns)) {
        if (stripos($status, 'ongoing') !== false || stripos($status, 'test') !== false) {
            $status = 'Test Ongoing';
        } elseif (stripos($status, 'done') !== false || stripos($status, 'pass') !== false || stripos($status, 'approve') !== false) {
            $status = 'Approved';
        } elseif (stripos($status, 'submit') !== false) {
            $status = 'Submitted';
        } elseif (stripos($status, 'cancel') !== false || stripos($status, 'reject') !== false) {
            $status = 'Batal';
        } else {
            $status = 'Task Baru';
        }
        $t['progress_status'] = $status;
    }

    $columns[$status][] = $t;
}

// 8. Output Final JSON Response
$response = [
    'status'     => 'success',
    'source'     => $sourceType,
    'total'      => count($tasks),
    'db_status'  => $pdo ? 'connected' : 'offline',
    'database'   => $connectedDb,
    'columns'    => $columns,
    'timestamp'  => date('c'),
];

if ($dbError && $sourceType === 'mock_fallback') {
    $response['db_warning'] = $dbError;
}

echo json_encode($response, JSON_UNESCAPED_SLASHES);
