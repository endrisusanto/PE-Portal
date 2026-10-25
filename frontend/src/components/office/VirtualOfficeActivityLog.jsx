// VirtualOfficeActivityLog.jsx
// Live Activity Feed, Zone Distribution Metrics, and Engineer Inspector Drawer

import React from 'react';
import { Users, Coffee, Gamepad2, Laptop, FlaskConical, DoorOpen, Briefcase } from 'lucide-react';
import { TEAMS, ZONES } from './virtualOfficeData';

export const VirtualOfficeActivityLog = ({
  engineers = [],
  activePhase,
  selectedEngineer,
  onSelectEngineer,
  filterTeam,
  onFilterTeam,
}) => {
  // Compute zone statistics
  const zoneStats = {
    workstations: engineers.filter((e) => e.currentZone?.includes('PE ') || e.currentZone?.includes('Manager') || e.currentZone?.includes('Leader')).length,
    labs: engineers.filter((e) => e.currentZone?.includes('Lab') || e.currentZone?.includes('Storage')).length,
    pantry: engineers.filter((e) => e.currentZone?.includes('Pantry')).length,
    gaming: engineers.filter((e) => e.currentZone?.includes('Gaming')).length,
  };

  const filteredEngineers = engineers.filter((eng) => {
    if (filterTeam === 'ALL') return true;
    return eng.team === filterTeam;
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        padding: '16px',
        height: '100%',
        minWidth: '320px',
      }}
    >
      {/* Title & Filter Tabs */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={16} color="var(--color-accent)" />
            Aktivitas Personil PE
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Total {engineers.length} Personil
          </span>
        </div>

        {/* Team Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `Semua (${engineers.length})` },
            { id: TEAMS.MANAGEMENT, label: `Management (${engineers.filter((e) => e.team === TEAMS.MANAGEMENT).length})` },
            { id: TEAMS.PRODUCTION, label: `Production (${engineers.filter((e) => e.team === TEAMS.PRODUCTION).length})` },
            { id: TEAMS.MECHA, label: `Mecha (${engineers.filter((e) => e.team === TEAMS.MECHA).length})` },
            { id: TEAMS.SOLUTION, label: `Solution (${engineers.filter((e) => e.team === TEAMS.SOLUTION).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onFilterTeam(tab.id)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: 'pointer',
                border: filterTeam === tab.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                backgroundColor: filterTeam === tab.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
                color: filterTeam === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone Distribution Badges (Workstations, Labs, Pantry, Gaming) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
        }}
      >
        <div
          style={{
            padding: '8px 4px',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '10px', color: '#3b82f6', fontWeight: 600 }}>
            <Briefcase size={11} /> Work
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>{zoneStats.workstations}</div>
        </div>

        <div
          style={{
            padding: '8px 4px',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
            <FlaskConical size={11} /> Labs
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
            {zoneStats.labs}
          </div>
        </div>

        <div
          style={{
            padding: '8px 4px',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
            <Coffee size={11} /> Pantry
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
            {zoneStats.pantry}
          </div>
        </div>

        <div
          style={{
            padding: '8px 4px',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '10px', color: '#ec4899', fontWeight: 600 }}>
            <Gamepad2 size={11} /> Gaming
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
            {zoneStats.gaming}
          </div>
        </div>
      </div>

      {/* Inspector Card when an Engineer is Selected */}
      {selectedEngineer && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1.5px solid var(--color-accent)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: selectedEngineer.avatarColor || '#3b82f6',
                }}
              />
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                {selectedEngineer.name}
              </h3>
            </div>
            <button
              onClick={() => onSelectEngineer(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {selectedEngineer.role} • <strong>{selectedEngineer.team}</strong>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-primary)' }}>
            <strong>Lokasi Saat Ini:</strong> {selectedEngineer.currentZone}
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <strong>Aktivitas:</strong> {selectedEngineer.currentActivity}
          </div>
        </div>
      )}

      {/* Scrollable Engineer Roster List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflowY: 'auto',
          maxHeight: '400px',
          paddingRight: '4px',
        }}
      >
        {filteredEngineers.map((eng) => {
          const isSelected = selectedEngineer?.id === eng.id;
          return (
            <div
              key={eng.id}
              onClick={() => onSelectEngineer(eng)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: eng.avatarColor || '#3b82f6',
                    flexShrink: 0,
                  }}
                />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{eng.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {eng.currentZone || 'Workstation'}
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {eng.team.replace('PE ', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
