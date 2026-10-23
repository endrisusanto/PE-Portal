<?php
/**
 * ==============================================================================
 * SEIN PE-Portal - Companion Release Cheatsheet (Software MR) API
 * Path: htdocs/companion-release-cheatsheet/api_releases.php
 * Target: Intranet PC (107.102.39.55 / Local XAMPP Server)
 * Mode: /ponytail (Zero-dependency, high resilience, auto-schema mapping)
 * ==============================================================================
 */

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
$DB_NAME = getenv('DB_NAME') ?: 'companion_release';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

$pdo = null;
try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT            => 2,
    ]);
} catch (Exception $e) {
    // Database offline, will use sample fallback
}

$releases = [];
if ($pdo) {
    try {
        $targetTable = 'releases';
        $check = $pdo->query("SHOW TABLES LIKE 'releases'")->fetch();
        if (!$check) {
            $checkAlt = $pdo->query("SHOW TABLES LIKE 'software_mr'")->fetch();
            if ($checkAlt) $targetTable = 'software_mr';
        }
        $releases = $pdo->query("SELECT * FROM `{$targetTable}` ORDER BY id DESC LIMIT 50")->fetchAll();
    } catch (Exception $e) {
        $releases = [];
    }
}

// Fallback sample data if DB is empty or offline
if (empty($releases)) {
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
        ],
        [
            'id'                  => 2,
            'model'               => 'SM-A556E',
            'ole_version'         => 'OLE2BXA1',
            'oxm_olm_new_version' => 'OXM2BXA1',
            'ap'                  => 'A556EXXU2BXA1',
            'cp'                  => 'A556EXXU2BXA1',
            'csc'                 => 'A556EOLE2BXA1',
            'ap_mapping'          => 'AP_A556E_MAPPING_V2',
            'cp_mapping'          => 'CP_A556E_MAPPING_V2',
            'csc_version_up'      => 'UP_TO_DATE',
            'status'              => 'Release',
            'pic'                 => 'Apta Prana',
            'release_note_format' => 'Monthly Security Maintenance Release',
            'created_at'          => $now,
            'updated_at'          => $now,
        ]
    ];
}

echo json_encode($releases, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
