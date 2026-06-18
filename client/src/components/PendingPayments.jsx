import { useState } from 'react';
import { Coins, ChevronDown, ChevronUp, User } from 'lucide-react';

export default function PendingPayments({ 
  projects = [], 
  onOpenProject,
  displayCurrency = 'TRY',
  hideAmounts = false,
  usdTryRate = 34.0
}) {
  const [collapsed, setCollapsed] = useState(false);

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    const amt = parseFloat(amount) || 0;
    const from = fromCurrency || 'TRY';
    const to = toCurrency || 'TRY';
    if (from === to) return amt;
    if (from === 'USD' && to === 'TRY') return amt * usdTryRate;
    if (from === 'TRY' && to === 'USD') return amt / usdTryRate;
    return amt;
  };

  const fmt = (val) => {
    if (hideAmounts) {
      return displayCurrency === 'USD' ? '*** $' : '*** ₺';
    }
    const converted = convertAmount(val, 'TRY', displayCurrency);
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: displayCurrency,
      maximumFractionDigits: 0,
    }).format(converted);
  };

  const pendingItems = [];
  for (const project of projects) {
    if (project.type !== 'external') continue;
    for (const task of project.tasks || []) {
      const price = parseFloat(task.price) || 0;
      const paid  = parseFloat(task.paid_price) || 0;
      const rem   = price - paid;
      if (rem > 0.01) {
        pendingItems.push({
          projectId:    project.id,
          projectTitle: project.title,
          client:       project.client || '',
          taskTitle:    task.title,
          price,
          paid,
          remaining:    rem,
        });
      }
    }
  }

  const grandTotal = pendingItems.reduce((s, i) => s + i.remaining, 0);

  if (pendingItems.length === 0) return null;

  return (
    <div style={{
      borderRadius: 16,
      border: '1.5px solid rgba(245,158,11,0.28)',
      background: 'rgba(245,158,11,0.05)',
      marginBottom: 4,
    }}>
      {/* ── Header ── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 20px',
          cursor: 'pointer',
          borderRadius: collapsed ? 16 : '16px 16px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(245,158,11,0.18)',
            border: '1px solid rgba(245,158,11,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f59e0b', flexShrink: 0,
          }}>
            <Coins size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              Kalan Ödemeler
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {pendingItems.length} alacak kalemi &mdash; toplam{' '}
              <strong style={{ color: '#f59e0b', fontFamily: 'Fira Code, monospace' }}>
                {fmt(grandTotal)}
              </strong>
            </div>
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}>

          {/* Column header */}
          <div style={{
            display: 'flex',
            padding: '6px 20px',
            background: 'rgba(245,158,11,0.07)',
            borderBottom: '1px solid rgba(245,158,11,0.10)',
          }}>
            <span style={colHeadStyle(2)}>PROJE</span>
            <span style={colHeadStyle(1.6)}>MÜŞTERİ</span>
            <span style={colHeadStyle(2.5)}>GÖREV / İŞ MADDESİ</span>
            <span style={{ ...colHeadStyle(1), textAlign: 'right' }}>TOPLAM</span>
            <span style={{ ...colHeadStyle(1), textAlign: 'right' }}>ÖDENEN</span>
            <span style={{ ...colHeadStyle(1), textAlign: 'right', color: '#f59e0b' }}>KALAN</span>
          </div>

          {/* Data rows */}
          {pendingItems.map((item, idx) => (
            <DataRow
              key={idx}
              item={item}
              fmt={fmt}
              onOpen={() => onOpenProject(item.projectId)}
              isLast={idx === pendingItems.length - 1}
            />
          ))}

          {/* Total */}
          <div style={{
            display: 'flex',
            padding: '8px 20px',
            background: 'rgba(245,158,11,0.09)',
            borderTop: '1px solid rgba(245,158,11,0.16)',
            borderRadius: '0 0 14px 14px',
          }}>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right', paddingRight: 12, letterSpacing: '0.5px' }}>
              Toplam Kalan
            </span>
            <span style={{ fontFamily: 'Fira Code, monospace', fontSize: 13, fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>
              {fmt(grandTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function colHeadStyle(flex) {
  return {
    flex,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    paddingRight: 8,
    lineHeight: '28px',
  };
}

function DataRow({ item, fmt, onOpen, isLast }) {
  const [hovered, setHovered] = useState(false);

  const cellBase = {
    fontSize: 13,
    color: 'var(--text-main)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    paddingRight: 8,
    lineHeight: '44px',
  };

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      title="Projeyi açmak için tıklayın"
      style={{
        display: 'flex',
        padding: '0 20px',
        height: 44,
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: isLast ? 'none' : '1px solid rgba(200,150,0,0.08)',
        background: hovered ? 'rgba(245,158,11,0.06)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Proje */}
      <span style={{ ...cellBase, flex: 2, fontWeight: 600, color: 'var(--primary)' }}>
        {item.projectTitle}
      </span>

      {/* Müşteri */}
      <span style={{ ...cellBase, flex: 1.6 }}>
        {item.client ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.22)',
            borderRadius: 5,
            padding: '2px 7px',
            color: '#a5b4fc',
            lineHeight: '18px',
            verticalAlign: 'middle',
          }}>
            <User size={10} /> {item.client}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </span>

      {/* Görev */}
      <span style={{ ...cellBase, flex: 2.5, fontSize: 12, color: 'var(--text-muted)' }}>
        {item.taskTitle}
      </span>

      {/* Toplam */}
      <span style={{ ...cellBase, flex: 1, fontFamily: 'Fira Code, monospace', fontSize: 12, textAlign: 'right', paddingRight: 8 }}>
        {fmt(item.price)}
      </span>

      {/* Ödenen */}
      <span style={{ ...cellBase, flex: 1, fontFamily: 'Fira Code, monospace', fontSize: 12, color: '#10b981', textAlign: 'right', paddingRight: 8 }}>
        {fmt(item.paid)}
      </span>

      {/* Kalan */}
      <span style={{ ...cellBase, flex: 1, fontFamily: 'Fira Code, monospace', fontSize: 12, color: '#f59e0b', fontWeight: 700, textAlign: 'right', paddingRight: 0 }}>
        {fmt(item.remaining)}
      </span>
    </div>
  );
}
