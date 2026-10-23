import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Shield,
  History,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  RotateCcw,
  Search,
  Check,
  Layers,
  User,
  UserCheck,
  UserX,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { Table } from '../components/common/Table';
import { LoadingState } from '../components/common/LoadingState';

export const AdminPage = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [menuPermissions, setMenuPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionSuccess, setPermissionSuccess] = useState('');
  const [searchMenuQuery, setSearchMenuQuery] = useState('');
  const [tab, setTab] = useState('users'); // 'users' | 'menu_access' | 'audit'
  const [loading, setLoading] = useState(true);

  // New user modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('sein1234');
  const [role, setRole] = useState('member');
  const [groupPartId, setGroupPartId] = useState('');
  const [createGroupPartIds, setCreateGroupPartIds] = useState([]);

  // Edit user modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGroupPartId, setEditGroupPartId] = useState('');
  const [editGroupPartIds, setEditGroupPartIds] = useState([]);
  const [editRole, setEditRole] = useState('member');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, gRes, aRes, mRes] = await Promise.all([
        api.get('/users'),
        api.get('/groups'),
        api.get('/admin/audit-logs').catch(() => ({ data: [] })),
        api.get('/navigation/menu-permissions').catch(() => ({ data: [] })),
      ]);
      setUsers(uRes.data);
      setGroups(gRes.data);
      setAuditLogs(aRes.data);
      setMenuPermissions(mRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleMenuVisibility = (menuKey) => {
    setMenuPermissions((prev) =>
      prev.map((item) =>
        item.menu_key === menuKey ? { ...item, is_visible: !item.is_visible } : item
      )
    );
  };

  const handleToggleRole = (menuKey, roleName) => {
    setMenuPermissions((prev) =>
      prev.map((item) => {
        if (item.menu_key !== menuKey) return item;
        const currentRoles = item.allowed_roles || [];
        const hasRole = currentRoles.includes(roleName);
        const nextRoles = hasRole
          ? currentRoles.filter((r) => r !== roleName)
          : [...currentRoles, roleName];
        return { ...item, allowed_roles: nextRoles };
      })
    );
  };

  const handleToggleGroup = (menuKey, groupKey) => {
    setMenuPermissions((prev) =>
      prev.map((item) => {
        if (item.menu_key !== menuKey) return item;
        const currentGroups = item.allowed_groups || [];
        const hasGroup = currentGroups.includes(groupKey);
        const nextGroups = hasGroup
          ? currentGroups.filter((g) => g !== groupKey)
          : [...currentGroups, groupKey];
        return { ...item, allowed_groups: nextGroups };
      })
    );
  };

  const handleAddWhitelistUser = (menuKey, userIdentifier) => {
    if (!userIdentifier) return;
    setMenuPermissions((prev) =>
      prev.map((item) => {
        if (item.menu_key !== menuKey) return item;
        const currentUsers = item.allowed_users || [];
        if (currentUsers.includes(userIdentifier)) return item;
        const currentBlocked = (item.blocked_users || []).filter((u) => u !== userIdentifier);
        return {
          ...item,
          allowed_users: [...currentUsers, userIdentifier],
          blocked_users: currentBlocked,
        };
      })
    );
  };

  const handleRemoveWhitelistUser = (menuKey, userIdentifier) => {
    setMenuPermissions((prev) =>
      prev.map((item) => {
        if (item.menu_key !== menuKey) return item;
        const currentUsers = item.allowed_users || [];
        return { ...item, allowed_users: currentUsers.filter((u) => u !== userIdentifier) };
      })
    );
  };

  const handleAddBlacklistUser = (menuKey, userIdentifier) => {
    if (!userIdentifier) return;
    setMenuPermissions((prev) =>
      prev.map((item) => {
        if (item.menu_key !== menuKey) return item;
        const currentBlocked = item.blocked_users || [];
        if (currentBlocked.includes(userIdentifier)) return item;
        const currentAllowed = (item.allowed_users || []).filter((u) => u !== userIdentifier);
        return {
          ...item,
          blocked_users: [...currentBlocked, userIdentifier],
          allowed_users: currentAllowed,
        };
      })
    );
  };

  const handleRemoveBlacklistUser = (menuKey, userIdentifier) => {
    setMenuPermissions((prev) =>
      prev.map((item) => {
        if (item.menu_key !== menuKey) return item;
        const currentBlocked = item.blocked_users || [];
        return { ...item, blocked_users: currentBlocked.filter((u) => u !== userIdentifier) };
      })
    );
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    setPermissionSuccess('');
    try {
      await api.put('/navigation/menu-permissions', menuPermissions);
      setPermissionSuccess('Konfigurasi akses & visibilitas side menu berhasil disimpan!');
      window.dispatchEvent(new CustomEvent('pe_menu_permissions_updated'));
      setTimeout(() => setPermissionSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetPermissions = () => {
    if (!window.confirm('Reset semua menu ke visibilitas penuh (semua role, part & user)?')) return;
    setMenuPermissions((prev) =>
      prev.map((item) => ({
        ...item,
        is_visible: true,
        allowed_roles: item.menu_key === 'admin' || item.menu_key === 'settings' ? ['admin'] : ['admin', 'manager', 'member', 'guest'],
        allowed_groups: [],
        allowed_users: [],
        blocked_users: [],
      }))
    );
  };

  const toggleCreateGroupPart = (id) => {
    setCreateGroupPartIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const toggleEditGroupPart = (id) => {
    setEditGroupPartIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', {
        employee_id: employeeId,
        username,
        email,
        full_name: fullName,
        password,
        role,
        group_part_id: createGroupPartIds[0] || undefined,
        group_part_ids: createGroupPartIds,
        preferred_lang: 'en',
      });
      setUsers((prev) => [...prev, res.data]);
      setIsModalOpen(false);
      setEmployeeId('');
      setUsername('');
      setEmail('');
      setFullName('');
      setCreateGroupPartIds([]);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleOpenEditUser = (u) => {
    setEditingUserId(u.id);
    setEditEmployeeId(u.employee_id || '');
    setEditUsername(u.username || '');
    setEditFullName(u.full_name || '');
    setEditEmail(u.email || '');
    const initialGroupPartIds = u.group_part_ids && u.group_part_ids.length > 0
      ? u.group_part_ids
      : (u.group_part_id ? [u.group_part_id] : []);
    setEditGroupPartIds(initialGroupPartIds);
    setEditGroupPartId(u.group_part_id || '');
    setEditRole(u.role || 'member');
    setEditIsActive(u.is_active !== false);
    setEditNewPassword('');
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUserId) return;
    setSavingUser(true);
    try {
      const payload = {
        employee_id: editEmployeeId,
        full_name: editFullName,
        email: editEmail,
        group_part_id: editGroupPartIds[0] || null,
        group_part_ids: editGroupPartIds,
        role: editRole,
        is_active: editIsActive,
      };
      if (editNewPassword.trim()) {
        payload.new_password = editNewPassword.trim();
      }
      const res = await api.put(`/users/${editingUserId}`, payload);
      const updatedUser = res.data;

      const matchedGroupNames = editGroupPartIds
        .map((gid) => groups.find((g) => g.id === gid)?.name)
        .filter(Boolean);

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== editingUserId) return u;
          return {
            ...u,
            ...updatedUser,
            group_part_ids: editGroupPartIds,
            group_part_names: matchedGroupNames,
            group_part_name: matchedGroupNames.join(', ') || 'General PE',
          };
        })
      );

      setIsEditModalOpen(false);
      setPermissionSuccess(`User '${editFullName || editUsername}' berhasil diperbarui!`);
      setTimeout(() => setPermissionSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'admin') {
      alert('Akun primary administrator tidak dapat dihapus.');
      return;
    }
    if (!window.confirm(`Hapus user '${u.full_name || u.username}' (@${u.username})? User akan dinonaktifkan.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      setPermissionSuccess(`User '${u.username}' berhasil dihapus.`);
      setTimeout(() => setPermissionSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const userColumns = [
    {
      title: 'Employee ID',
      key: 'employee_id',
      render: (val) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>,
    },
    {
      title: 'Name & Username',
      key: 'full_name',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>@{row.username}</div>
        </div>
      ),
    },
    {
      title: 'Email',
      key: 'email',
    },
    {
      title: 'Group Part',
      key: 'group_part_name',
      render: (val, row) => {
        const names = row.group_part_names && row.group_part_names.length > 0
          ? row.group_part_names
          : (val && val !== 'General PE' ? [val] : []);
        if (names.length === 0) {
          return <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>General PE</span>;
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {names.map((name, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Role',
      key: 'role',
      render: (val, row) => (
        <select
          value={val}
          onChange={(e) => handleRoleChange(row.id, e.target.value)}
          style={{
            height: '28px',
            padding: '0 8px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
        </select>
      ),
    },
    {
      title: 'Status',
      key: 'is_active',
      render: (val) => <StatusBadge status={val ? 'healthy' : 'blocked'} label={val ? 'Active' : 'Disabled'} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            size="sm"
            variant="secondary"
            icon={Edit2}
            onClick={() => handleOpenEditUser(row)}
            title="Edit User Data"
          >
            Edit
          </Button>
          {row.username !== 'admin' && (
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={() => handleDeleteUser(row)}
              title="Delete User"
            />
          )}
        </div>
      ),
    },
  ];

  const auditColumns = [
    {
      title: 'Timestamp',
      key: 'created_at',
      render: (val) => <span>{new Date(val).toLocaleString()}</span>,
    },
    {
      title: 'User',
      key: 'user_name',
      render: (val) => <span>{val || 'System'}</span>,
    },
    {
      title: 'Action Code',
      key: 'action',
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)' }}>
          {val}
        </span>
      ),
    },
    {
      title: 'IP Address',
      key: 'ip_address',
      render: (val) => <span>{val || 'Internal'}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('nav.admin')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            User provisioning, role access assignments, and corporate audit logs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tab === 'users' && (
            <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
              Add Engineer User
            </Button>
          )}
          {tab === 'menu_access' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                icon={RotateCcw}
                onClick={handleResetPermissions}
                disabled={savingPermissions}
              >
                Reset Default
              </Button>
              <Button
                variant="primary"
                icon={Save}
                onClick={handleSavePermissions}
                disabled={savingPermissions}
              >
                {savingPermissions ? 'Saving...' : 'Save Permissions'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          variant={tab === 'users' ? 'primary' : 'secondary'}
          size="sm"
          icon={UserCheck}
          onClick={() => setTab('users')}
        >
          User Management ({users.length})
        </Button>
        <Button
          variant={tab === 'menu_access' ? 'primary' : 'secondary'}
          size="sm"
          icon={SlidersHorizontal}
          onClick={() => setTab('menu_access')}
        >
          Side Menu & Access Matrix ({menuPermissions.length})
        </Button>
        <Button
          variant={tab === 'audit' ? 'primary' : 'secondary'}
          size="sm"
          icon={History}
          onClick={() => setTab('audit')}
        >
          Audit Logs
        </Button>
      </div>

      {permissionSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#10b981',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{permissionSuccess}</span>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading administration data..." />
      ) : tab === 'users' ? (
        <Table columns={userColumns} data={users} />
      ) : tab === 'audit' ? (
        <Table columns={auditColumns} data={auditLogs} />
      ) : (
        /* Menu & Access Matrix Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="var(--color-accent)" />
                Dynamic Side Menu Visibility & Access Control
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Atur menu yang tampil di sidebar untuk setiap Role (Admin/Manager/Member/Guest) dan Part (PE Production, PE Mecha, PE Solution).
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Filter menu..."
                  value={searchMenuQuery}
                  onChange={(e) => setSearchMenuQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    paddingLeft: '32px',
                    paddingRight: '10px',
                    fontSize: 'var(--font-size-xs)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Menu & Route</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '140px' }}>Visibilitas</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Akses Role (Siapa yang bisa lihat?)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Akses Part / Bagian</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, minWidth: '190px' }}>Whitelist User (Diizinkan)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, minWidth: '190px' }}>Blacklist User (Diblokir)</th>
                </tr>
              </thead>
              <tbody>
                {menuPermissions
                  .filter((item) =>
                    !searchMenuQuery ||
                    item.label.toLowerCase().includes(searchMenuQuery.toLowerCase()) ||
                    item.menu_key.toLowerCase().includes(searchMenuQuery.toLowerCase()) ||
                    item.path.toLowerCase().includes(searchMenuQuery.toLowerCase())
                  )
                  .map((item) => {
                    const isVisible = item.is_visible !== false;
                    const roles = item.allowed_roles || [];
                    const groups = item.allowed_groups || [];

                    return (
                      <tr
                        key={item.menu_key}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          opacity: isVisible ? 1 : 0.6,
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* 1. Menu Name & Route */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {item.label}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                  color: 'var(--color-accent)',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-xs)',
                                }}
                              >
                                {item.path}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                                ({item.category})
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Master Visibility Toggle */}
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleMenuVisibility(item.menu_key)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isVisible
                                ? '1px solid rgba(16, 185, 129, 0.4)'
                                : '1px solid rgba(239, 68, 68, 0.4)',
                              backgroundColor: isVisible
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                              color: isVisible ? '#10b981' : '#ef4444',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            {isVisible ? 'Visible' : 'Hidden'}
                          </button>
                        </td>

                        {/* 3. Role Access Checkboxes */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {['admin', 'manager', 'member', 'guest'].map((r) => {
                              const isChecked = roles.includes(r);
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => handleToggleRole(item.menu_key, r)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'capitalize',
                                    cursor: 'pointer',
                                    border: isChecked
                                      ? '1px solid var(--color-accent)'
                                      : '1px solid var(--color-border)',
                                    backgroundColor: isChecked
                                      ? 'rgba(59, 130, 246, 0.15)'
                                      : 'var(--color-bg-primary)',
                                    color: isChecked
                                      ? 'var(--color-accent)'
                                      : 'var(--color-text-secondary)',
                                  }}
                                >
                                  {isChecked && <Check size={12} />}
                                  {r}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* 4. Group / Part Access */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {[
                              { id: 'pe_production', label: 'PE Production' },
                              { id: 'pe_mecha', label: 'PE Mecha' },
                              { id: 'pe_solution', label: 'PE Solution' },
                            ].map((g) => {
                              const isChecked = groups.includes(g.id);
                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => handleToggleGroup(item.menu_key, g.id)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: isChecked
                                      ? '1px solid #8b5cf6'
                                      : '1px solid var(--color-border)',
                                    backgroundColor: isChecked
                                      ? 'rgba(139, 92, 246, 0.15)'
                                      : 'var(--color-bg-primary)',
                                    color: isChecked
                                      ? '#8b5cf6'
                                      : 'var(--color-text-secondary)',
                                  }}
                                >
                                  {isChecked && <Check size={12} />}
                                  {g.label}
                                </button>
                              );
                            })}

                            {groups.length === 0 && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--color-text-secondary)',
                                  fontStyle: 'italic',
                                }}
                              >
                                (Semua Part / No Restriction)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Whitelist User Access */}
                        <td style={{ padding: '14px 16px', minWidth: '190px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {(item.allowed_users || []).map((u) => {
                                const matchedUser = users.find(
                                  (usr) => usr.username === u || usr.employee_id === u || usr.id === u
                                );
                                const displayName = matchedUser
                                  ? `${matchedUser.full_name} (@${matchedUser.username})`
                                  : u;

                                return (
                                  <span
                                    key={u}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 6px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.35)',
                                    }}
                                  >
                                    <UserCheck size={11} />
                                    <span>{displayName}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveWhitelistUser(item.menu_key, u)}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: '#10b981',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                      }}
                                      title="Hapus dari whitelist"
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                );
                              })}

                              {(!item.allowed_users || item.allowed_users.length === 0) && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--color-text-secondary)',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  (Semua / Bebas)
                                </span>
                              )}
                            </div>

                            {/* Dropdown to add whitelist user */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddWhitelistUser(item.menu_key, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: 'var(--color-bg-primary)',
                                  color: 'var(--color-text-secondary)',
                                  cursor: 'pointer',
                                  maxWidth: '200px',
                                }}
                              >
                                <option value="">+ Whitelist User...</option>
                                {users
                                  .filter((u) => !(item.allowed_users || []).includes(u.username))
                                  .map((u) => (
                                    <option key={u.id} value={u.username}>
                                      {u.full_name} (@{u.username})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </td>

                        {/* 6. Blacklist User Access */}
                        <td style={{ padding: '14px 16px', minWidth: '190px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {(item.blocked_users || []).map((u) => {
                                const matchedUser = users.find(
                                  (usr) => usr.username === u || usr.employee_id === u || usr.id === u
                                );
                                const displayName = matchedUser
                                  ? `${matchedUser.full_name} (@${matchedUser.username})`
                                  : u;

                                return (
                                  <span
                                    key={u}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 6px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                      color: '#ef4444',
                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                    }}
                                  >
                                    <UserX size={11} />
                                    <span>{displayName}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBlacklistUser(item.menu_key, u)}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: '#ef4444',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                      }}
                                      title="Hapus dari blacklist"
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                );
                              })}

                              {(!item.blocked_users || item.blocked_users.length === 0) && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--color-text-secondary)',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  (Tidak Ada / Bebas Blokir)
                                </span>
                              )}
                            </div>

                            {/* Dropdown to add blacklist user */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddBlacklistUser(item.menu_key, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: 'var(--color-bg-primary)',
                                  color: 'var(--color-text-secondary)',
                                  cursor: 'pointer',
                                  maxWidth: '200px',
                                }}
                              >
                                <option value="">+ Blacklist User...</option>
                                {users
                                  .filter((u) => !(item.blocked_users || []).includes(u.username))
                                  .map((u) => (
                                    <option key={u.id} value={u.username}>
                                      {u.full_name} (@{u.username})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Engineer to PE-Portal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateUser}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            placeholder="e.g. EMP202601"
          />

          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. Budi Santoso"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="e.g. bsantoso"
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="budi.s@sein.local"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Role Access
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <Input
              label="Initial Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Group Part (Bisa Pilih Lebih Dari 1 / Multi-Jobdesk)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {createGroupPartIds.length} dipilih
              </span>
            </div>
            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-secondary)',
                padding: '8px 10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '6px',
              }}
            >
              {groups.map((g) => {
                const isChecked = createGroupPartIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      border: isChecked ? '1px solid #3b82f6' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCreateGroupPart(g.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: isChecked ? 600 : 400, color: 'var(--color-text-primary)' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      {g.parent_group}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit User: @${editUsername}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleUpdateUser} disabled={savingUser}>
              {savingUser ? 'Saving...' : t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Employee ID"
              value={editEmployeeId}
              onChange={(e) => setEditEmployeeId(e.target.value)}
              required
              placeholder="e.g. EMP202601"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Username
              </label>
              <input
                type="text"
                value={editUsername}
                disabled
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  cursor: 'not-allowed',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Full Name"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              required
              placeholder="e.g. Budi Santoso"
            />

            <Input
              label="Email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
              placeholder="budi.s@sein.local"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Role Access
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Account Status
              </label>
              <select
                value={editIsActive ? 'active' : 'disabled'}
                onChange={(e) => setEditIsActive(e.target.value === 'active')}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: editIsActive ? '#10b981' : '#ef4444',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <option value="active">Active (Dapat Login)</option>
                <option value="disabled">Disabled (Diblokir)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Group Part (Bisa Pilih Lebih Dari 1 / Multi-Jobdesk)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {editGroupPartIds.length} dipilih
              </span>
            </div>
            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-secondary)',
                padding: '8px 10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '6px',
              }}
            >
              {groups.map((g) => {
                const isChecked = editGroupPartIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      border: isChecked ? '1px solid #3b82f6' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEditGroupPart(g.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: isChecked ? 600 : 400, color: 'var(--color-text-primary)' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      {g.parent_group}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <Input
            label="Reset Password (Opsional)"
            type="password"
            value={editNewPassword}
            onChange={(e) => setEditNewPassword(e.target.value)}
            placeholder="Kosongkan jika tidak diubah"
          />
        </form>
      </Modal>
    </div>
  );
};
