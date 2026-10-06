import { useState } from 'react';
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  CalendarDays,
  Bell,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderKanban,
  Repeat
} from 'lucide-react';
import YearlyPaymentsDashboard from './YearlyPaymentsDashboard';
import { MONTH_NAMES, dueLabel, dueColor } from '../receivables';

const SOURCE_META = {
  project: { label: 'Proje', icon: <FolderKanban size={12} />, cls: 'project' },
  yearly: { label: 'Yıllık', icon: <Repeat size={12} />, cls: 'yearly' }
};

export default function ReceivablesDashboard({
  receivables,
  projects,
  onOpenProject,
  displayCurrency,
  setDisplayCurrency,
  hideAmounts,
  setHideAmounts,
  usdTryRate,
  onPaymentsLoaded
}) {
  const [view, setView] = useState('overview'); // 'overview' | 'manage'
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [openMonth, setOpenMonth] = useState(new Date().getMonth());
  const [openClients, setOpenClients] = useState({});
  const [reminderRange, setReminderRange] = useState(60);

  const { byClient, byYear, reminders, undated, totals } = receivables;
  const undatedLines = receivables.lines.filter(l => !l.date);

  const yearOptions = [...new Set([...receivables.years, currentYear, currentYear + 1])].sort((a, b) => a - b);
  const yearData = byYear[year] || {
    months: Array.from({ length: 12 }, (_, m) => ({ month: m, paid: 0, pending: 0, oneTime: 0, yearly: 0, lines: [] })),
    total: 0, paid: 0, remaining: 0, oneTime: 0, yearly: 0
  };
  const maxMonth = Math.max(1, ...yearData.months.map(m => m.paid + m.pending));

  const fmt = (tryValue) => {
    if (hideAmounts) return displayCurrency === 'USD' ? '*** $' : '*** ₺';
    const value = displayCurrency === 'USD' ? tryValue / usdTryRate : tryValue;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: displayCurrency,
      maximumFractionDigits: 0
    }).format(value);
  };

  const fmtDate = (d) => d ? d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Vadesiz';

  const visibleReminders = reminders.filter(r => r.diffDays <= reminderRange);
  const overdueCount = reminders.filter(r => r.diffDays < 0).length;

  const openLine = (line) => {
    if (line.projectId && onOpenProject) onOpenProject(line.projectId);
  };

  const SourceBadge = ({ source }) => (
    <span className={`rc-badge ${SOURCE_META[source].cls}`}>
      {SOURCE_META[source].icon} {SOURCE_META[source].label}
    </span>
  );

  const LineRow = ({ line, showClient = false }) => (
    <div
      className={`rc-line ${line.projectId ? 'clickable' : ''}`}
      onClick={() => openLine(line)}
    >
      <div className="rc-line-main">
        <SourceBadge source={line.source} />
        <div className="rc-line-text">
          <strong>{line.title}</strong>
          <span>
            {showClient ? `${line.client} · ` : ''}
            {line.projectTitle && line.projectTitle !== line.title ? `${line.projectTitle} · ` : ''}
            {fmtDate(line.date)}
          </span>
        </div>
      </div>
      <div className="rc-line-amount">
        <strong>{fmt(line.remaining > 0 ? line.remaining : line.total)}</strong>
        {line.remaining <= 0 ? (
          <span style={{ color: 'var(--success)' }}>Tahsil edildi</span>
        ) : line.paid > 0 ? (
          <span>{fmt(line.paid)} alındı</span>
        ) : (
          <span style={{ color: dueColor(line.diffDays) }}>{dueLabel(line.diffDays)}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="rc-page">
      <section className="action-bar-section rc-header">
        <div>
          <h2 className="rc-title">Alacaklar</h2>
          <p className="rc-sub">
            Projelerden ve yıllık ödemelerden gelecek tüm paranız tek yerde. Kur: 1 $ = {usdTryRate.toFixed(2)} ₺
          </p>
        </div>
        <div className="rc-header-actions">
          <div className="filters glass-card rc-seg">
            <button className={`filter-btn ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>Genel Bakış</button>
            <button className={`filter-btn ${view === 'manage' ? 'active' : ''}`} onClick={() => setView('manage')}>Yıllık Ödemeleri Yönet</button>
          </div>
          <div className="filters glass-card rc-seg">
            {['TRY', 'USD'].map(c => (
              <button key={c} className={`filter-btn ${displayCurrency === c ? 'active' : ''}`} onClick={() => setDisplayCurrency(c)}>
                {c === 'TRY' ? '₺' : '$'}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setHideAmounts(!hideAmounts)}
            title={hideAmounts ? 'Tutarları göster' : 'Tutarları gizle'}
          >
            {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </section>

      {view === 'manage' ? (
        <YearlyPaymentsDashboard
          projects={projects}
          onOpenProject={onOpenProject}
          displayCurrency={displayCurrency}
          setDisplayCurrency={setDisplayCurrency}
          hideAmounts={hideAmounts}
          setHideAmounts={setHideAmounts}
          usdTryRate={usdTryRate}
          onPaymentsLoaded={onPaymentsLoaded}
          embedded
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="stats-section">
            <div className="stat-card glass-card">
              <div className="stat-header">
                <span className="stat-title">Toplam Alacak</span>
                <div className="stat-icon-wrapper blue"><Wallet /></div>
              </div>
              <div className="stat-value">{fmt(totals.total)}</div>
              <div className="stat-desc">Proje + yıllık ödemeler</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-header">
                <span className="stat-title">Tahsil Edilen</span>
                <div className="stat-icon-wrapper emerald"><CheckCircle2 /></div>
              </div>
              <div className="stat-value">{fmt(totals.paid)}</div>
              <div className="stat-desc">
                {totals.total > 0 ? `%${Math.round((totals.paid / totals.total) * 100)} tahsil edildi` : '—'}
              </div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-header">
                <span className="stat-title">Kalan</span>
                <div className="stat-icon-wrapper orange"><Clock /></div>
              </div>
              <div className="stat-value">{fmt(totals.remaining)}</div>
              <div className="stat-desc">Önümüzdeki 30 gün: {fmt(totals.next30)}</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-header">
                <span className="stat-title">Geciken</span>
                <div className="stat-icon-wrapper violet"><AlertCircle /></div>
              </div>
              <div className="stat-value" style={{ color: totals.overdue > 0 ? '#ef4444' : undefined }}>{fmt(totals.overdue)}</div>
              <div className="stat-desc">{overdueCount > 0 ? `${overdueCount} kalem vadesi geçti` : 'Geciken ödeme yok'}</div>
            </div>
          </div>

          <div className="rc-grid">
            {/* Reminders */}
            <section className="glass-card rc-card">
              <div className="rc-card-head">
                <h3><Bell size={18} /> Hatırlatmalar</h3>
                <div className="rc-chips">
                  {[30, 60, 180].map(d => (
                    <button key={d} className={`rc-chip ${reminderRange === d ? 'active' : ''}`} onClick={() => setReminderRange(d)}>
                      {d === 180 ? '6 ay' : `${d} gün`}
                    </button>
                  ))}
                </div>
              </div>
              {visibleReminders.length === 0 ? (
                <p className="rc-empty">Bu aralıkta bekleyen ödeme yok. 🎉</p>
              ) : (
                <div className="rc-list">
                  {visibleReminders.map(line => (
                    <div key={line.id} className="rc-reminder" style={{ borderLeftColor: dueColor(line.diffDays) }}>
                      <LineRow line={line} showClient />
                    </div>
                  ))}
                </div>
              )}
              {undated.length > 0 && (
                <details className="rc-undated">
                  <summary>Vadesi girilmemiş {undated.length} kalem ({fmt(undated.reduce((s, l) => s + l.remaining, 0))})</summary>
                  <div className="rc-list">
                    {undated.map(line => <LineRow key={line.id} line={line} showClient />)}
                  </div>
                </details>
              )}
            </section>

            {/* Yearly / monthly outlook */}
            <section className="glass-card rc-card">
              <div className="rc-card-head">
                <h3><CalendarDays size={18} /> Aylık Takvim</h3>
                <select className="rc-select" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}{y === currentYear ? ' (bu yıl)' : y > currentYear ? ' (gelecek)' : ''}</option>)}
                </select>
              </div>

              <div className="rc-year-summary">
                <div><span>Toplam</span><strong>{fmt(yearData.total)}</strong></div>
                <div><span>Tek seferlik</span><strong>{fmt(yearData.oneTime)}</strong></div>
                <div><span>Yıllık</span><strong>{fmt(yearData.yearly)}</strong></div>
                <div><span>Kalan</span><strong>{fmt(yearData.remaining)}</strong></div>
              </div>

              <div className="rc-months">
                {yearData.months.map(m => {
                  const total = m.paid + m.pending;
                  const isOpen = openMonth === m.month;
                  return (
                    <div key={m.month} className={`rc-month ${isOpen ? 'open' : ''} ${total === 0 ? 'empty' : ''}`}>
                      <button className="rc-month-row" onClick={() => setOpenMonth(isOpen ? null : m.month)} disabled={total === 0}>
                        <span className="rc-month-name">{MONTH_NAMES[m.month]}</span>
                        <div className="rc-bar">
                          <div className="rc-bar-paid" style={{ width: `${(m.paid / maxMonth) * 100}%` }} />
                          <div className="rc-bar-pending" style={{ width: `${(m.pending / maxMonth) * 100}%` }} />
                        </div>
                        <span className="rc-month-amount">{total > 0 ? fmt(total) : '—'}</span>
                      </button>
                      {isOpen && total > 0 && (
                        <div className="rc-list rc-month-lines">
                          {m.lines.map(line => <LineRow key={line.id} line={line} showClient />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="rc-legend">
                <span><i className="paid" /> Tahsil edilen</span>
                <span><i className="pending" /> Bekleyen</span>
              </div>
            </section>
          </div>

          {/* Years overview */}
          {(receivables.years.length > 0 || undatedLines.length > 0) && (
            <section className="glass-card rc-card">
              <div className="rc-card-head"><h3><CalendarDays size={18} /> Yıllara Göre Gelir</h3></div>
              <div className="rc-years">
                {receivables.years.map(y => {
                  const d = byYear[y];
                  return (
                    <button key={y} className={`rc-year-tile ${y === year ? 'active' : ''}`} onClick={() => setYear(y)}>
                      <span>{y}{y > currentYear ? ' · tahmini' : ''}</span>
                      <strong>{fmt(d.total)}</strong>
                      <small>Yıllık {fmt(d.yearly)} · Tek seferlik {fmt(d.oneTime)}</small>
                    </button>
                  );
                })}
                {undatedLines.length > 0 && (
                  <div className="rc-year-tile" style={{ cursor: 'default' }}>
                    <span>Vadesi girilmemiş</span>
                    <strong>{fmt(undatedLines.reduce((s, l) => s + l.total, 0))}</strong>
                    <small>{undatedLines.length} kalem · takvime girmesi için görevlere vade tarihi ekleyin</small>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* By client */}
          <section className="glass-card rc-card">
            <div className="rc-card-head"><h3><Users size={18} /> Kimden Ne Geldi / Gelecek</h3></div>
            {byClient.length === 0 ? (
              <p className="rc-empty">Henüz fiyatlandırılmış proje görevi veya yıllık ödeme yok.</p>
            ) : (
              <div className="rc-clients">
                <div className="rc-client-head">
                  <span>Müşteri</span><span>Toplam</span><span>Alınan</span><span>Kalan</span>
                </div>
                {byClient.map(c => {
                  const isOpen = !!openClients[c.client];
                  const pct = c.total > 0 ? Math.round((c.paid / c.total) * 100) : 0;
                  return (
                    <div key={c.client} className="rc-client">
                      <button className="rc-client-row" onClick={() => setOpenClients(prev => ({ ...prev, [c.client]: !isOpen }))}>
                        <span className="rc-client-name">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span>
                            <strong>{c.client}</strong>
                            <small>Tek seferlik {fmt(c.oneTime)} · Yıllık {fmt(c.yearly)}</small>
                          </span>
                        </span>
                        <span>{fmt(c.total)}</span>
                        <span style={{ color: 'var(--success)' }}>{fmt(c.paid)}</span>
                        <span style={{ color: c.remaining > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{fmt(c.remaining)}</span>
                        <div className="rc-client-progress"><div style={{ width: `${pct}%` }} /></div>
                      </button>
                      {isOpen && (
                        <div className="rc-list rc-client-lines">
                          {c.lines.map(line => <LineRow key={line.id} line={line} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
