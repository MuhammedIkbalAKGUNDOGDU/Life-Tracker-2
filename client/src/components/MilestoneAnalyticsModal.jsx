import React, { useState } from 'react';
import { X, Trophy, Lock, Calendar, Tag, BarChart2, PieChart, Activity } from 'lucide-react';

// === SUB-COMPONENT: MONTHLY UNLOCKS BAR CHART ===
function SvgUnlockBarChart({ data = [], width = 580, height = 200 }) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Aylık kilit açılma bilgisi bulunmuyor.
      </div>
    );
  }

  const padding = 35;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const maxVal = Math.max(3, ...data.map(d => d.value)); // Scale to max unlocked

  const barWidth = (chartWidth / data.length) * 0.6;
  const barGap = (chartWidth / data.length) * 0.4;

  const gridLines = [];
  const step = Math.ceil(maxVal / 4);
  for (let val = step; val <= maxVal; val += step) {
    const y = padding + chartHeight - (val * chartHeight) / maxVal;
    if (y >= padding) gridLines.push({ y, val });
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="unlockBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line 
              x1={padding} 
              y1={line.y} 
              x2={width - padding} 
              y2={line.y} 
              stroke="rgba(255,255,255,0.06)" 
              strokeDasharray="4 4"
            />
            <text 
              x={padding - 8} 
              y={line.y + 4} 
              fill="var(--text-muted)" 
              fontSize="11" 
              textAnchor="end"
            >
              {line.val}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((item, idx) => {
          const x = padding + idx * (barWidth + barGap) + barGap / 2;
          const y = padding + chartHeight - (item.value * chartHeight) / maxVal;
          const barH = (item.value * chartHeight) / maxVal;

          if (item.value === 0) {
            return (
              <g key={idx}>
                <text 
                  x={x + barWidth / 2} 
                  y={height - padding + 20} 
                  fill="var(--text-muted)" 
                  fontSize="9.5" 
                  textAnchor="middle"
                >
                  {item.label}
                </text>
              </g>
            );
          }

          return (
            <g key={idx}>
              <rect 
                x={x} 
                y={y} 
                width={barWidth} 
                height={barH} 
                fill="url(#unlockBarGrad)" 
                rx="3.5"
              >
                <title>{`${item.label}: ${item.value} Kilit Açıldı`}</title>
              </rect>
              <text 
                x={x + barWidth / 2} 
                y={y - 8} 
                fill="var(--text-main)" 
                fontSize="10" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {item.value}
              </text>
              <text 
                x={x + barWidth / 2} 
                y={height - padding + 20} 
                fill="var(--text-muted)" 
                fontSize="9.5" 
                textAnchor="middle"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// === MAIN ANALYTICS MODAL ===
export default function MilestoneAnalyticsModal({ milestones = [], onClose }) {
  const [activeTab, setActiveTab] = useState('graphs');

  const total = milestones.length;
  const unlocked = milestones.filter(m => m.is_unlocked).length;

  // Categories count
  const pCount = milestones.filter(m => m.target_type === 'projects_completed').length;
  const gCount = milestones.filter(m => m.target_type === 'goals_achieved').length;
  const hCount = milestones.filter(m => m.target_type === 'habit_streak').length;
  const mCount = milestones.filter(m => m.target_type === 'manual').length;

  const categories = [
    { label: 'Proje', count: pCount, color: '#3b82f6', labelType: 'projects_completed' },
    { label: 'Hedef', count: gCount, color: '#10b981', labelType: 'goals_achieved' },
    { label: 'Alışkanlık', count: hCount, color: '#fb923c', labelType: 'habit_streak' },
    { label: 'Manuel', count: mCount, color: '#a78bfa', labelType: 'manual' }
  ].filter(c => c.count > 0);

  // Donut chart parameters
  const radius = 55;
  const circumference = 2 * Math.PI * radius; // ~345.57
  let currentOffset = 0;

  // Monthly unlock times series
  const currentYear = new Date().getFullYear();
  const monthsTr = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  const monthlyUnlocks = monthsTr.map((monthLabel, idx) => {
    const count = milestones.filter(m => {
      if (!m.is_unlocked || !m.unlocked_at) return false;
      const d = new Date(m.unlocked_at);
      return d.getFullYear() === currentYear && d.getMonth() === idx;
    }).length;

    return {
      label: monthLabel,
      value: count
    };
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTargetTypeLabel = (type) => {
    switch (type) {
      case 'projects_completed': return 'Proje';
      case 'goals_achieved': return 'Hedef';
      case 'habit_streak': return 'Alışkanlık';
      case 'manual': return 'Manuel';
      default: return 'Genel';
    }
  };

  const getElapsedDays = (m) => {
    const start = new Date(m.created_at);
    const end = m.is_unlocked && m.unlocked_at ? new Date(m.unlocked_at) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (m.is_unlocked) {
      return `${diffDays} gün sürdü`;
    }
    return `${diffDays} gündür devam ediyor`;
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal glass-card" style={{ maxWidth: '750px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy style={{ color: 'var(--primary)' }} /> Başarım & Kilometre Taşı Analizi
          </h2>
          <button className="btn-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          {/* Modal Tabs */}
          <div className="filters glass-card" style={{ display: 'flex', padding: '4px', gap: '4px', marginBottom: '24px', width: 'fit-content' }}>
            <button 
              className={`filter-btn ${activeTab === 'graphs' ? 'active' : ''}`}
              onClick={() => setActiveTab('graphs')}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Grafikler & Dağılım
            </button>
            <button 
              className={`filter-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Zaman Çizelgesi & Tarihçe
            </button>
          </div>

          {activeTab === 'graphs' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {/* Donut Chart */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h4 style={{ marginBottom: '14px', fontSize: '14px', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PieChart size={15} style={{ color: 'var(--primary)' }} /> Kategori Dağılımı
                  </h4>
                  {total === 0 ? (
                    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      Dağılım bilgisi yok
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '20px', width: '100%', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap' }}>
                      <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                        <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="14" />
                        {categories.map((cat, idx) => {
                          const percentage = cat.count / total;
                          const strokeLength = circumference * percentage;
                          const strokeOffset = circumference - strokeLength + currentOffset;
                          currentOffset -= strokeLength;

                          return (
                            <circle 
                              key={idx}
                              cx="75"
                              cy="75"
                              r={radius}
                              fill="none"
                              stroke={cat.color}
                              strokeWidth="14"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeOffset}
                              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                          );
                        })}
                        {/* Middle Text */}
                        <g style={{ transform: 'rotate(90deg) translate(0px, -150px)' }}>
                          <text x="75" y="70" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="500">
                            TOPLAM
                          </text>
                          <text x="75" y="92" textAnchor="middle" fill="var(--text-main)" fontSize="18" fontWeight="bold">
                            {total}
                          </text>
                        </g>
                      </svg>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {categories.map((cat, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.color }}></div>
                            <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                              {cat.label}: <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{cat.count} adet</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* KPI/Brief statistics inside charts tab */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
                  <h4 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} style={{ color: 'var(--primary)' }} /> İstatistik Özetleri
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Kazanılan Kilit Sayısı:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{unlocked} / {total}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Kazanılma Yüzdesi:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{total > 0 ? Math.round((unlocked / total) * 100) : 0}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Kilitli Kalanlar:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{total - unlocked}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly unlock graph */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ marginBottom: '14px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart2 size={15} style={{ color: 'var(--primary)' }} /> {currentYear} Yılı Aylık Kilit Açma İstatistikleri
                </h4>
                <SvgUnlockBarChart data={monthlyUnlocks} width={640} height={180} />
              </div>
            </div>
          ) : (
            /* Time history Table */
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ marginBottom: '14px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} style={{ color: 'var(--primary)' }} /> Başarım Çizelgesi & Süre Analizi
              </h4>

              {total === 0 ? (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Henüz hiçbir başarım tanımlanmamış.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ padding: '12px' }}>Başarım</th>
                        <th style={{ padding: '12px' }}>Tür / Hedef</th>
                        <th style={{ padding: '12px' }}>Oluşturulma Tarihi</th>
                        <th style={{ padding: '12px' }}>Kilit Açılma Tarihi</th>
                        <th style={{ padding: '12px' }}>Geçen Süre</th>
                        <th style={{ padding: '12px' }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: m.is_unlocked ? 'rgba(16,185,129,0.01)' : 'transparent' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{m.title}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="timeline-tag" style={{ margin: 0, fontSize: '11px', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}>
                              {getTargetTypeLabel(m.target_type)} ({m.target_value})
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{formatDate(m.created_at)}</td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{m.is_unlocked ? formatDate(m.unlocked_at) : '—'}</td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>{getElapsedDays(m)}</td>
                          <td style={{ padding: '12px' }}>
                            {m.is_unlocked ? (
                              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                <Trophy size={14} /> Açıldı
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={14} /> Kilitli
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
