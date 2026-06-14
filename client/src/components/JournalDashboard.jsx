import React, { useState, useEffect } from 'react';
import { BookOpen, Trash2, Calendar, Smile, Heart, Check, X, Plus } from 'lucide-react';

// === SUB-COMPONENT: SVG LINE CHART ===
function SvgLineChart({ data = [], width = 600, height = 220 }) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Grafik çizmek için yeterli veri bulunmuyor.
      </div>
    );
  }

  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const yMin = 1;
  const yMax = 5;

  const points = data.map((item, idx) => {
    const x = padding + (idx * chartWidth) / Math.max(1, data.length - 1);
    const y = padding + chartHeight - ((item.value - yMin) * chartHeight) / (yMax - yMin);
    return { x, y, ...item };
  });

  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  let areaD = '';
  if (points.length > 0) {
    areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  }

  const gridLines = [];
  for (let rating = 1; rating <= 5; rating++) {
    const y = padding + chartHeight - ((rating - yMin) * chartHeight) / (yMax - yMin);
    gridLines.push(y);
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines & Left Labels */}
        {gridLines.map((y, idx) => {
          const rating = idx + 1;
          let emoji = '';
          if (rating === 1) emoji = '😢';
          if (rating === 2) emoji = '😕';
          if (rating === 3) emoji = '😐';
          if (rating === 4) emoji = '🙂';
          if (rating === 5) emoji = '😄';

          return (
            <g key={idx}>
              <line 
                x1={padding} 
                y1={y} 
                x2={width - padding} 
                y2={y} 
                stroke="rgba(255,255,255,0.06)" 
                strokeDasharray="4 4"
              />
              <text 
                x={padding - 10} 
                y={y + 4} 
                fill="var(--text-muted)" 
                fontSize="11" 
                textAnchor="end"
              >
                {emoji} {rating}
              </text>
            </g>
          );
        })}

        {/* Area Gradient Under the Line */}
        {areaD && <path d={areaD} fill="url(#areaGrad)" />}

        {/* Line Path */}
        {pathD && (
          <path 
            d={pathD} 
            fill="none" 
            stroke="url(#lineGrad)" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        )}

        {/* Data Points (Dots) */}
        {points.map((pt, idx) => (
          <g key={idx}>
            <circle 
              cx={pt.x} 
              cy={pt.y} 
              r="5" 
              fill="#60a5fa" 
              stroke="#0f172a" 
              strokeWidth="2" 
            >
              <title>{`${pt.date}: ${pt.value}`}</title>
            </circle>
            {data.length <= 10 && (
              <text 
                x={pt.x} 
                y={pt.y - 12} 
                fill="var(--text-main)" 
                fontSize="10" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {pt.value}
              </text>
            )}
          </g>
        ))}

        {/* X Axis Labels */}
        {points.map((pt, idx) => {
          const showLabel = data.length <= 10 
            ? true 
            : (idx === 0 || idx === data.length - 1 || idx === Math.floor(data.length / 2) || idx % 5 === 0);

          if (!showLabel) return null;

          return (
            <text 
              key={idx} 
              x={pt.x} 
              y={height - padding + 22} 
              fill="var(--text-muted)" 
              fontSize="10" 
              textAnchor="middle"
            >
              {pt.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// === SUB-COMPONENT: SVG BAR CHART ===
function SvgBarChart({ data = [], width = 600, height = 220 }) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Grafik çizmek için yeterli veri bulunmuyor.
      </div>
    );
  }

  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const yMin = 0;
  const yMax = 5;

  const barWidth = (chartWidth / data.length) * 0.6;
  const barGap = (chartWidth / data.length) * 0.4;

  const gridLines = [];
  for (let rating = 1; rating <= 5; rating++) {
    const y = padding + chartHeight - ((rating - yMin) * chartHeight) / (yMax - yMin);
    gridLines.push(y);
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines & Left Labels */}
        {gridLines.map((y, idx) => {
          const rating = idx + 1;
          return (
            <g key={idx}>
              <line 
                x1={padding} 
                y1={y} 
                x2={width - padding} 
                y2={y} 
                stroke="rgba(255,255,255,0.06)" 
                strokeDasharray="4 4"
              />
              <text 
                x={padding - 10} 
                y={y + 4} 
                fill="var(--text-muted)" 
                fontSize="11" 
                textAnchor="end"
              >
                {rating}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const x = padding + idx * (barWidth + barGap) + barGap / 2;
          const y = padding + chartHeight - ((item.value - yMin) * chartHeight) / (yMax - yMin);
          const barH = ((item.value - yMin) * chartHeight) / (yMax - yMin);

          if (item.value === 0) {
            return (
              <g key={idx}>
                <text 
                  x={x + barWidth / 2} 
                  y={height - padding - 5} 
                  fill="var(--text-muted)" 
                  fontSize="10" 
                  textAnchor="middle"
                >
                  -
                </text>
                <text 
                  x={x + barWidth / 2} 
                  y={height - padding + 22} 
                  fill="var(--text-muted)" 
                  fontSize="10" 
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
                fill="url(#barGrad)" 
                rx="4"
              >
                <title>{`${item.label}: ${item.value.toFixed(2)}`}</title>
              </rect>
              <text 
                x={x + barWidth / 2} 
                y={y - 8} 
                fill="var(--text-main)" 
                fontSize="10" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {item.value.toFixed(1)}
              </text>
              <text 
                x={x + barWidth / 2} 
                y={height - padding + 22} 
                fill="var(--text-muted)" 
                fontSize="10" 
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

// === SUB-COMPONENT: MOOD ANALYTICS MODAL ===
function MoodAnalyticsModal({ entries = [], onClose, getMoodEmoji }) {
  const [activeTab, setActiveTab] = useState('weekly');

  const sorted = [...entries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));

  // 1. Weekly: last 7 entries
  const last7 = sorted.slice(-7);
  const weeklyData = last7.map(e => ({
    label: new Date(e.entry_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    date: new Date(e.entry_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' }),
    value: e.mood_rating
  }));

  // 2. Monthly: last 30 entries
  const last30 = sorted.slice(-30);
  const monthlyData = last30.map(e => ({
    label: new Date(e.entry_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    date: new Date(e.entry_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
    value: e.mood_rating
  }));

  // 3. Yearly: Monthly averages for current year
  const currentYear = new Date().getFullYear();
  const monthsTr = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  
  const yearlyData = monthsTr.map((monthLabel, idx) => {
    const monthEntries = entries.filter(e => {
      const d = new Date(e.entry_date);
      return d.getFullYear() === currentYear && d.getMonth() === idx;
    });

    const validEntries = monthEntries.filter(e => e.mood_rating);
    const avg = validEntries.length > 0 
      ? validEntries.reduce((sum, curr) => sum + curr.mood_rating, 0) / validEntries.length
      : 0;

    return {
      label: monthLabel,
      value: avg
    };
  });

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal glass-card" style={{ maxWidth: '700px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smile style={{ color: 'var(--primary)' }} /> Ruh Hali Grafik Analizi
          </h2>
          <button className="btn-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <div className="filters glass-card" style={{ display: 'flex', padding: '4px', gap: '4px', marginBottom: '24px', width: 'fit-content' }}>
            <button 
              className={`filter-btn ${activeTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly')}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Haftalık (Son 7 Gün)
            </button>
            <button 
              className={`filter-btn ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthly')}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Aylık (Son 30 Gün)
            </button>
            <button 
              className={`filter-btn ${activeTab === 'yearly' ? 'active' : ''}`}
              onClick={() => setActiveTab('yearly')}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Yıllık ({currentYear})
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            {activeTab === 'weekly' && (
              <>
                <h4 style={{ marginBottom: '16px', fontSize: '15px' }}>Son 7 Günlük Ruh Hali Grafiği</h4>
                <SvgLineChart data={weeklyData} width={600} height={220} />
              </>
            )}

            {activeTab === 'monthly' && (
              <>
                <h4 style={{ marginBottom: '16px', fontSize: '15px' }}>Son 30 Günlük Ruh Hali Gidişatı</h4>
                <SvgLineChart data={monthlyData} width={600} height={220} />
              </>
            )}

            {activeTab === 'yearly' && (
              <>
                <h4 style={{ marginBottom: '16px', fontSize: '15px' }}>{currentYear} Yılı Aylık Ruh Hali Ortalamaları</h4>
                <SvgBarChart data={yearlyData} width={600} height={220} />
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

// === MAIN JOURNAL DASHBOARD ===
export default function JournalDashboard({
  entries = [],
  onSaveEntry,
  onDeleteEntry
}) {
  const [moodRating, setMoodRating] = useState(null);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  
  const [suggestedTags, setSuggestedTags] = useState([
    'Verimli', 'Sakin', 'Yoğun', 'Mutlu', 'Yorgun', 'Sosyal', 'Sağlıklı', 'Eğlenceli'
  ]);

  // Sync suggestion tags cloud with unique tags from past entries
  useEffect(() => {
    const allPastTags = new Set([
      'Verimli', 'Sakin', 'Yoğun', 'Mutlu', 'Yorgun', 'Sosyal', 'Sağlıklı', 'Eğlenceli'
    ]);
    entries.forEach(entry => {
      if (Array.isArray(entry.tags)) {
        entry.tags.forEach(t => {
          if (t && t.trim()) {
            allPastTags.add(t.trim());
          }
        });
      }
    });
    setSuggestedTags(Array.from(allPastTags));
  }, [entries]);

  // Check if today already has an entry to populate form
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find(e => e.entry_date.split('T')[0] === todayStr);
    
    if (todayEntry) {
      setMoodRating(todayEntry.mood_rating);
      setContent(todayEntry.content || '');
      setSelectedTags(todayEntry.tags || []);
    } else {
      setMoodRating(null);
      setContent('');
      setSelectedTags([]);
    }
  }, [entries]);

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags(prev => [...prev, trimmed]);
    }
    if (!suggestedTags.includes(trimmed)) {
      setSuggestedTags(prev => [...prev, trimmed]);
    }
    setCustomTagInput('');
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!moodRating && !content.trim()) {
      alert('Lütfen en azından bir ruh hali seçin veya günlük notu yazın!');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    onSaveEntry({
      entry_date: todayStr,
      mood_rating: moodRating,
      content: content.trim(),
      tags: selectedTags
    });
  };

  const getMoodEmoji = (rating) => {
    switch (rating) {
      case 1: return { emoji: '😢', label: 'Üzgün', class: 'active-1' };
      case 2: return { emoji: '😕', label: 'Keyifsiz', class: 'active-2' };
      case 3: return { emoji: '😐', label: 'Normal', class: 'active-3' };
      case 4: return { emoji: '🙂', label: 'İyi', class: 'active-4' };
      case 5: return { emoji: '😄', label: 'Harika', class: 'active-5' };
      default: return { emoji: '❓', label: 'Bilinmiyor', class: '' };
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.entry_date.split('T')[0] === todayStr);
  const todayMoodRating = todayEntry ? todayEntry.mood_rating : null;

  const getAverageMood = (daysLimit) => {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysLimit);
    const filtered = entries.filter(e => new Date(e.entry_date) >= limitDate && e.mood_rating);
    if (filtered.length === 0) return '—';
    const sum = filtered.reduce((acc, curr) => acc + curr.mood_rating, 0);
    return (sum / filtered.length).toFixed(1);
  };

  const average7Days = getAverageMood(7);
  const average30Days = getAverageMood(30);
  const totalEntries = entries.length;

  return (
    <>
      {/* KPI Stats Section */}
      <div className="stats-section" style={{ marginBottom: '24px' }}>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-title">Bugünün Modu</span>
            <div className="stat-icon-wrapper orange">
              <Smile />
            </div>
          </div>
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {todayMoodRating ? (
              <>
                <span style={{ fontSize: '36px' }}>{getMoodEmoji(todayMoodRating).emoji}</span>
                <span style={{ fontSize: '18px', color: 'var(--text-main)' }}>{todayMoodRating} / 5</span>
              </>
            ) : '—'}
          </div>
          <div className="stat-desc">
            {todayMoodRating ? getMoodEmoji(todayMoodRating).label : 'Bugün henüz mod seçilmedi'}
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-title">7 Günlük Ortalama</span>
            <div className="stat-icon-wrapper violet">
              <Heart />
            </div>
          </div>
          <div className="stat-value">{average7Days}</div>
          <div className="stat-desc">Son 1 haftanın ruh hali ortalaması</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-title">30 Günlük Ortalama</span>
            <div className="stat-icon-wrapper blue">
              <Heart />
            </div>
          </div>
          <div className="stat-value">{average30Days}</div>
          <div className="stat-desc">Son 30 günün ruh hali ortalaması</div>
        </div>

        <div className="stat-card glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="stat-header">
              <span className="stat-title">Toplam Günlük</span>
              <div className="stat-icon-wrapper emerald">
                <BookOpen />
              </div>
            </div>
            <div className="stat-value">{totalEntries}</div>
            <div className="stat-desc">Yazılmış toplam günlük kaydı sayısı</div>
          </div>
          <button 
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAnalyticsOpen(true)}
            style={{ 
              marginTop: '12px', 
              width: '100%', 
              justifyContent: 'center', 
              fontSize: '12px', 
              padding: '8px',
              borderRadius: '8px' 
            }}
          >
            Detaylı Grafikleri İncele
          </button>
        </div>
      </div>

      <div className="journal-split-layout">
        {/* Left Column: Log Today */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={18} style={{ color: 'var(--danger)' }} />
            Bugün Nasıl Hissediyorsun?
          </h3>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Mood Selection */}
            <div className="mood-select-container">
              <div className="mood-emoji-grid">
                {[1, 2, 3, 4, 5].map(rating => {
                  const config = getMoodEmoji(rating);
                  const isActive = moodRating === rating;
                  return (
                    <button
                      type="button"
                      key={rating}
                      className={`mood-emoji-btn ${isActive ? config.class : ''}`}
                      onClick={() => setMoodRating(rating)}
                    >
                      <span>{config.emoji}</span>
                      <span className="mood-emoji-label">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Diary Editor */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={13} style={{ color: 'var(--primary)' }} />
                Bugünün Hikayesi / Günlük Notu
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows="5"
                placeholder="Bugün neler oldu? Seni ne mutlu etti veya ne zorladı? Düşüncelerini buraya dök..."
                style={{ fontSize: '14px', lineHeight: '1.5' }}
              />
            </div>

            {/* Tags Selector */}
            <div className="form-group">
              <label>Günün Etiketleri (Tags)</label>
              <div className="tag-badge-selector" style={{ marginBottom: '10px' }}>
                {suggestedTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <span
                      key={tag}
                      className={`tag-selectable ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>

              {/* Custom Tag Input */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Özel etiket yazın (Örn: kahve, kitap)..."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                  style={{ fontSize: '13px', padding: '8px 12px', flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddCustomTag}
                  style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', gap: '4px', alignItems: 'center' }}
                >
                  <Plus size={14} /> Ekle
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
              Günlüğü Kaydet
            </button>
          </form>
        </div>

        {/* Right Column: History Timeline */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            Günlük Tarihçesi
          </h3>

          {entries.length === 0 ? (
            <div className="empty-state" style={{ minHeight: '200px' }}>
              <Smile style={{ width: '48px', height: '48px' }} />
              <h3>Henüz Kayıt Yok</h3>
              <p>Bugünün ruh halini ve notlarını girerek ilk günlük kaydını oluştur.</p>
            </div>
          ) : (
            <div className="timeline-container">
              {entries.map(entry => {
                const mood = getMoodEmoji(entry.mood_rating);
                return (
                  <div key={entry.id} className="timeline-item">
                    <div className="timeline-card-wrapper glass-card">
                      <div className="timeline-header">
                        <span className="timeline-date-label">
                          {formatDate(entry.entry_date)}
                        </span>
                        {entry.mood_rating && (
                          <span 
                            className="timeline-mood-indicator" 
                            title={mood.label}
                          >
                            {mood.emoji}
                          </span>
                        )}
                      </div>

                      {entry.content && (
                        <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                          {entry.content}
                        </p>
                      )}

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="timeline-tags-row">
                          {entry.tags.map(t => (
                            <span key={t} className="timeline-tag">{t}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                        <button
                          className="btn-card-action delete"
                          onClick={() => onDeleteEntry(entry.id)}
                          title="Günlük Girişini Sil"
                          style={{ padding: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Modal */}
      {isAnalyticsOpen && (
        <MoodAnalyticsModal 
          entries={entries} 
          onClose={() => setIsAnalyticsOpen(false)} 
          getMoodEmoji={getMoodEmoji}
        />
      )}
    </>
  );
}
