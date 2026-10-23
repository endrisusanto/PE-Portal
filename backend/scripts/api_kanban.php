<?php
/**
 * ==============================================================================
 * SEIN PE-Portal - GBA Task Manager Kanban API
 * Path: htdocs/tkdn/api_kanban.php or htdocs/tkdn/kanban_api.php
 * Target: Intranet PC (107.102.39.55 / Local XAMPP Server)
 * Mode: /ponytail (Zero-dependency, high resilience, auto-schema mapping)
 * ==============================================================================
 * Description:
 *   Exposes GBA Task Manager database records as standard JSON for PE-Portal.
 *   - Auto-detects MySQL / MariaDB (PDO or mysqli)
 *   - Fallback to Mock Data if DB is offline (graceful degradation)
 *   - Supports standard 8 Kanban columns grouping expected by GbaTasksPage.jsx
 *   - Handles CORS headers, filtering, search, and status updates
 * ==============================================================================
 */

// 1. CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Database Configuration (Easily customized for local XAMPP / Intranet server)
$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = getenv('DB_PORT') ?: '3306';
$DB_NAME = getenv('DB_NAME') ?: 'tkdn'; // Common DB names: tkdn, gba, task_manager
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

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

// 3. Database Connection
$pdo = null;
$dbError = null;

try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT            => 2,
    ]);
} catch (Exception $e) {
    // If specific DB does not exist, try connecting without DB to auto-create
    try {
        $dsnNoDb = "mysql:host={$DB_HOST};port={$DB_PORT};charset=utf8mb4";
        $pdoInit = new PDO($dsnNoDb, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdoInit->exec("CREATE DATABASE IF NOT EXISTS `{$DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (Exception $e2) {
        $dbError = $e->getMessage();
    }
}

// 4. Ensure Table Exists if connected
if ($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `gba_tasks` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `model_name` VARCHAR(100) NOT NULL,
                `project_name` VARCHAR(150) DEFAULT 'Standard Model',
                `ap` VARCHAR(100) DEFAULT '',
                `cp` VARCHAR(100) DEFAULT '',
                `csc` VARCHAR(100) DEFAULT '',
                `test_plan_type` VARCHAR(50) DEFAULT 'MR',
                `progress_status` VARCHAR(50) NOT NULL DEFAULT 'Task Baru',
                `is_urgent` TINYINT(1) DEFAULT 0,
                `pic_email` VARCHAR(150) DEFAULT '',
                `reviewer_email` VARCHAR(150) DEFAULT '',
                `submission_id` VARCHAR(100) DEFAULT '',
                `base_submission_id` VARCHAR(100) DEFAULT '',
                `request_date` DATE DEFAULT NULL,
                `deadline` DATE DEFAULT NULL,
                `submission_date` DATE DEFAULT NULL,
                `approved_date` DATE DEFAULT NULL,
                `qb_user` VARCHAR(255) DEFAULT '',
                `qb_userdebug` VARCHAR(255) DEFAULT '',
                `qb_eng` VARCHAR(255) DEFAULT '',
                `remarks` TEXT DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (`progress_status`),
                INDEX idx_model (`model_name`),
                INDEX idx_pic (`pic_email`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Seed initial data if table is empty
        $count = (int)$pdo->query("SELECT COUNT(*) FROM `gba_tasks`")->fetchColumn();
        if ($count === 0) {
            $sampleDate = date('Y-m-d');
            $deadlineDate = date('Y-m-d', strtotime('+3 days'));
            
            $stmt = $pdo->prepare("
                INSERT INTO `gba_tasks` 
                (`model_name`, `project_name`, `ap`, `cp`, `csc`, `test_plan_type`, `progress_status`, `is_urgent`, `pic_email`, `reviewer_email`, `submission_id`, `request_date`, `deadline`, `qb_user`)
                VALUES 
                ('SM-S928B', 'Galaxy S24 Ultra (Eureka)', 'S928BXXU1AXB5', 'S928BXXU1AXB5', 'S928BOLE1AXB5', 'MR', 'Task Baru', 1, 'endri.s@samsung.com', 'manager.pe@samsung.com', 'SUB-2026-001', :d1, :d2, 'http://quickbuild/build/10492'),
                ('SM-A556E', 'Galaxy A55 5G', 'A556EXXU2BXA1', 'A556EXXU2BXA1', 'A556EOLE2BXA1', 'Initial Release', 'Downloaded', 0, 'apta.p@samsung.com', 'manager.pe@samsung.com', 'SUB-2026-002', :d3, :d4, 'http://quickbuild/build/10493'),
                ('SM-A356E', 'Galaxy A35 5G', 'A356EXXU1AXC2', 'A356EXXU1AXC2', 'A356EOLE1AXC2', 'FOTA', 'Test Ongoing', 0, 'taufik.h@samsung.com', 'manager.pe@samsung.com', 'SUB-2026-003', :d5, :d6, ''),
                ('SM-S921B', 'Galaxy S24', 'S921BXXU1AXB1', 'S921BXXU1AXB1', 'S921BOLE1AXB1', 'Security Patch', 'Pending Feedback', 1, 'dimas.w@samsung.com', 'manager.pe@samsung.com', 'SUB-2026-004', :d7, :d8, ''),
                ('SM-A155F', 'Galaxy A15 LTE', 'A155FXXU1AXA2', 'A155FXXU1AXA2', 'A155FOLE1AXA2', 'MR', 'Submitted', 0, 'endri.s@samsung.com', 'manager.pe@samsung.com', 'SUB-2026-005', :d9, :d10, ''),
                ('SM-S926B', 'Galaxy S24+', 'S926BXXU1AXB5', 'S926BXXU1AXB5', 'S926BOLE1AXB5', 'MR', 'Approved', 0, 'bayu.p@samsung.com', 'manager.pe@samsung.com', 'SUB-2026-006', :d11, :d12, '')
            ");
            $stmt->execute([
                ':d1' => $sampleDate, ':d2' => $deadlineDate,
                ':d3' => $sampleDate, ':d4' => $deadlineDate,
                ':d5' => $sampleDate, ':d6' => $deadlineDate,
                ':d7' => $sampleDate, ':d8' => $deadlineDate,
                ':d9' => $sampleDate, ':d10' => $deadlineDate,
                ':d11' => $sampleDate, ':d12' => $deadlineDate,
            ]);
        }
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// 5. Handle POST Updates (Status transition / updates from PE-Portal if enabled)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $pdo) {
    $rawInput = file_get_contents('php://input');
    $postData = json_decode($rawInput, true) ?: $_POST;
    $action = $_GET['action'] ?? ($postData['action'] ?? '');

    if ($action === 'update_status' || isset($postData['status'])) {
        $taskId = (int)($postData['id'] ?? 0);
        $newStatus = trim($postData['status'] ?? '');

        if ($taskId > 0 && in_array($newStatus, $KANBAN_STATUSES, true)) {
            $stmt = $pdo->prepare("UPDATE `gba_tasks` SET `progress_status` = :st WHERE `id` = :id");
            $stmt->execute([':st' => $newStatus, ':id' => $taskId]);
            echo json_encode([
                'status'  => 'success',
                'message' => "Task #{$taskId} status updated to '{$newStatus}'"
            ]);
            exit;
        }
    }
}

// 6. Fetch Tasks from DB or Fallback Mock Data
$tasks = [];
$sourceType = 'mysql';

if ($pdo) {
    try {
        // Find existing table (gba_tasks or tasks)
        $targetTable = 'gba_tasks';
        $check = $pdo->query("SHOW TABLES LIKE 'gba_tasks'")->fetch();
        if (!$check) {
            $checkAlt = $pdo->query("SHOW TABLES LIKE 'tasks'")->fetch();
            if ($checkAlt) $targetTable = 'tasks';
        }

        $query = "SELECT * FROM `{$targetTable}` ORDER BY is_urgent DESC, deadline ASC, id DESC";
        $tasks = $pdo->query($query)->fetchAll();
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// Fallback Mock Data if MySQL is offline on intranet PC
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
    // Standardize integer types & strings
    $t['id'] = (int)($t['id'] ?? 0);
    $t['is_urgent'] = (int)($t['is_urgent'] ?? 0);
    $status = trim($t['progress_status'] ?? 'Task Baru');

    if (!array_key_exists($status, $columns)) {
        // Map unknown / legacy statuses to closest match
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
    'columns'    => $columns,
    'timestamp'  => date('c'),
];

if ($dbError && $sourceType === 'mock_fallback') {
    $response['db_warning'] = $dbError;
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
