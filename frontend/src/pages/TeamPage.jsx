import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Layers, ShieldCheck, Mail, Building2, Briefcase } from 'lucide-react';
import api from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';

const PARENT_GROUP_TITLES = {
  pe_management: 'PE Executive Management',
  pe_production: 'PE Part',
  pe_mecha: 'PE Mecha',
  pe_solution: 'PE Solution Production',
  purchasing: 'Purchasing & Sourcing Department',
  qa: 'Quality Assurance (QA) Department',
};

export const TeamPage = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      try {
        const [gRes, uRes] = await Promise.all([
          api.get('/groups'),
          api.get('/users'),
        ]);
        setGroups(gRes.data);
        setUsers(uRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  if (loading) return <LoadingState message={t('team.loading', 'Loading engineering organization...')} />;

  // Filter PE internal groups vs Cross-Department partner groups
  const peGroups = groups.filter((g) => g.parent_group && g.parent_group.startsWith('pe_'));
  const crossDeptGroups = groups.filter((g) => !g.parent_group || !g.parent_group.startsWith('pe_'));

  const groupedByParent = peGroups.reduce((acc, g) => {
    if (!acc[g.parent_group]) acc[g.parent_group] = [];
    acc[g.parent_group].push(g);
    return acc;
  }, {});

  const crossDeptByParent = crossDeptGroups.reduce((acc, g) => {
    const pKey = g.parent_group || 'other';
    if (!acc[pKey]) acc[pKey] = [];
    acc[pKey].push(g);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
          {t('team.title', 'PE Team Directory')}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {t('team.subtitle', 'SEIN PE Group structure (Specialized engineering divisions & cross-functional partners)')}
        </p>
      </div>

      {/* 1. Internal PE Organization Sections */}
      {Object.entries(groupedByParent).map(([parentKey, parts]) => (
        <section
          key={parentKey}
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={20} color="var(--color-accent)" />
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>
              {t(`team.parent_${parentKey}`, PARENT_GROUP_TITLES[parentKey] || parentKey)}
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}>
              {t('team.group_parts_count', { count: parts.length, defaultValue: `${parts.length} Group Parts` })}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {parts.map((p) => {
              // Ensure members shown in PE Part are internal PE only
              const partMembers = users.filter((u) => {
                if (u.department && u.department.toUpperCase() !== 'PE') return false;
                if (Array.isArray(u.group_part_ids) && u.group_part_ids.length > 0) {
                  return u.group_part_ids.includes(p.id);
                }
                return u.group_part_id === p.id;
              });
              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{p.name}</h3>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      #{p.sort_order}
                    </span>
                  </div>
                  {p.description && (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                      {p.description}
                    </p>
                  )}

                  {/* Members assigned to this group part */}
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      {t('team.assigned_members', 'ASSIGNED MEMBERS')} ({partMembers.length})
                    </div>
                    {partMembers.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('team.no_members', 'No members assigned')}</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {partMembers.map((m) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
                            <Avatar name={m.full_name} src={m.avatar_path} size="sm" />
                            <span style={{ fontWeight: 500 }}>{m.full_name}</span>
                            {m.group_part_ids && m.group_part_ids.length > 1 && (
                              <span
                                title={`Multi-Jobdesk: ${m.group_part_names?.join(', ') || `${m.group_part_ids.length} parts`}`}
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 5px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                  color: '#3b82f6',
                                  fontWeight: 600,
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {t('team.multi_jobdesk_badge', 'Multi-Jobdesk')}
                              </span>
                            )}
                            <StatusBadge status={m.role} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* 2. Cross-Department Partners & Collaborators Section */}
      {Object.keys(crossDeptByParent).length > 0 && (
        <section
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} color="#ea580c" />
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: 0 }}>
                  {t('team.cross_dept_title', 'Cross-Department Partners & Collaborators')}
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                  {t('team.cross_dept_desc', 'Mitra kerja departemen lain (Purchasing, SCM, dll.) yang berkolaborasi dalam modul PE Portal')}
                </p>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(249, 115, 22, 0.12)',
              color: '#ea580c',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}>
              {t('team.partner_collaborators', 'Non-PE Partners')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(crossDeptByParent).map(([pKey, pParts]) => (
              <div key={pKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={14} color="var(--color-text-muted)" />
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-primary)' }}>
                    {PARENT_GROUP_TITLES[pKey] || pKey.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {pParts.map((p) => {
                    const partnerMembers = users.filter((u) => {
                      if (Array.isArray(u.group_part_ids) && u.group_part_ids.length > 0) {
                        return u.group_part_ids.includes(p.id);
                      }
                      return u.group_part_id === p.id;
                    });

                    return (
                      <div
                        key={p.id}
                        style={{
                          backgroundColor: 'var(--color-bg-primary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{p.name}</h3>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            #{p.sort_order}
                          </span>
                        </div>
                        {p.description && (
                          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                            {p.description}
                          </p>
                        )}

                        <div style={{ marginTop: '8px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                            {t('team.assigned_members', 'ASSIGNED MEMBERS')} ({partnerMembers.length})
                          </div>
                          {partnerMembers.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('team.no_members', 'No members assigned')}</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {partnerMembers.map((m) => (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Avatar name={m.full_name} src={m.avatar_path} size="sm" />
                                    <div>
                                      <div style={{ fontWeight: 600 }}>{m.full_name}</div>
                                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{m.email}</div>
                                    </div>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      backgroundColor: 'rgba(249, 115, 22, 0.12)',
                                      color: '#ea580c',
                                      fontWeight: 600,
                                      border: '1px solid rgba(249, 115, 22, 0.3)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {m.department || 'Partner'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
