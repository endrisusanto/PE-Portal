import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Layers, ShieldCheck, Mail } from 'lucide-react';
import api from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';

const PARENT_GROUP_TITLES = {
  pe_production: 'PE Production',
  pe_mecha: 'PE Mecha',
  pe_solution: 'PE Solution Production',
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

  if (loading) return <LoadingState message="Loading engineering organization..." />;

  const groupedByParent = groups.reduce((acc, g) => {
    if (!acc[g.parent_group]) acc[g.parent_group] = [];
    acc[g.parent_group].push(g);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
          {t('nav.team')}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          SEIN Production Engineer Group structure (30 members across 3 specialized divisions)
        </p>
      </div>

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
              {PARENT_GROUP_TITLES[parentKey] || parentKey}
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}>
              {parts.length} Group Parts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {parts.map((p) => {
              const partMembers = users.filter((u) => u.group_part_id === p.id);
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
                      ASSIGNED MEMBERS ({partMembers.length})
                    </div>
                    {partMembers.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No members assigned</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {partMembers.map((m) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
                            <Avatar name={m.full_name} size="sm" />
                            <span style={{ fontWeight: 500 }}>{m.full_name}</span>
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
    </div>
  );
};
