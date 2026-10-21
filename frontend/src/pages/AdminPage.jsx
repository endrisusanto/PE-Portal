import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Shield, UserCheck, History } from 'lucide-react';
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
  const [tab, setTab] = useState('users'); // 'users' | 'audit'
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, gRes, aRes] = await Promise.all([
        api.get('/users'),
        api.get('/groups'),
        api.get('/admin/audit-logs').catch(() => ({ data: [] })),
      ]);
      setUsers(uRes.data);
      setGroups(gRes.data);
      setAuditLogs(aRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        group_part_id: groupPartId || undefined,
        preferred_lang: 'en',
      });
      setUsers((prev) => [...prev, res.data]);
      setIsModalOpen(false);
      setEmployeeId('');
      setUsername('');
      setEmail('');
      setFullName('');
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
      render: (val) => <span>{val || 'General PE'}</span>,
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
        {tab === 'users' && (
          <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
            Add Engineer User
          </Button>
        )}
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
          variant={tab === 'audit' ? 'primary' : 'secondary'}
          size="sm"
          icon={History}
          onClick={() => setTab('audit')}
        >
          Audit Logs
        </Button>
      </div>

      {loading ? (
        <LoadingState message="Loading administration data..." />
      ) : tab === 'users' ? (
        <Table columns={userColumns} data={users} />
      ) : (
        <Table columns={auditColumns} data={auditLogs} />
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
                Group Part
              </label>
              <select
                value={groupPartId}
                onChange={(e) => setGroupPartId(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="">Select Group Part...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.parent_group})</option>
                ))}
              </select>
            </div>

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
          </div>

          <Input
            label="Initial Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
};
