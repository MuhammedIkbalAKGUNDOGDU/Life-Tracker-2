import { useState } from 'react';
import { Calendar, AlertCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, User } from 'lucide-react';

export default function UpcomingInstallments({ projects = [], onOpenProject }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'overdue', 'today', 'week', 'month' or null

  const fmt = (val) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(val);

  const getDiffDays = (dueDateStr) => {
    if (!dueDateStr) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const overdue = [];
  const todayList = [];
  const weekList = [];
  const monthList = [];

  for (const project of projects) {
    if (project.type !== 'external') continue;
    for (const task of project.tasks || []) {
      const price = parseFloat(task.price) || 0;
      const paid = parseFloat(task.paid_price) || 0;
      
      // Skip if paid or no due date
      if (price <= paid || !task.due_date) continue;
      
      const diffDays = getDiffDays(task.due_date);
      const item = {
        projectId: project.id,
        projectTitle: project.title,
        client: project.client || '',
        taskId: task.id,
        taskTitle: task.title,
        amount: price - paid, // Remaining amount
        dueDate: task.due_date,
        diffDays
      };

      if (diffDays < 0) {
        overdue.push(item);
      } else if (diffDays === 0) {
        todayList.push(item);
      } else if (diffDays > 0 && diffDays <= 7) {
        weekList.push(item);
      } else if (diffDays > 7 && diffDays <= 30) {
        monthList.push(item);
      }
    }
  }

  const totalCount = overdue.length + todayList.length + weekList.length + monthList.length;
  if (totalCount === 0) return null;

  // Format date to local readable format
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR');
  };

  const sections = [
    {
      id: 'overdue',
      label: 'Geciken Ödemeler',
      items: overdue,
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.25)',
      icon: <AlertCircle size={16} />
    },
    {
      id: 'today',
      label: 'Gününde Olan Ödemeler (Bugün)',
      items: todayList,
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.08)',
      borderColor: 'rgba(249, 115, 22, 0.25)',
      icon: <Clock size={16} />
    },
    {
      id: 'week',
      label: '1 Hafta İçinde Olanlar',
      items: weekList,
      color: '#eab308',
      bgColor: 'rgba(234, 179, 8, 0.08)',
      borderColor: 'rgba(234, 179, 8, 0.25)',
      icon: <AlertTriangle size={16} />
    },
    {
      id: 'month',
      label: '1 Ay İçinde Olanlar',
      items: monthList,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.25)',
      icon: <Calendar size={16} />
    }
  ].filter(s => s.items.length > 0);

  return (
    <div style={{
      borderRadius: 16,
      border: '1.5px solid rgba(59,130,246,0.25)',
      background: 'rgba(59,130,246,0.04)',
      marginBottom: 16,
    }}>
      {/* Header */}
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
            background: 'rgba(59,130,246,0.18)',
            border: '1px solid rgba(59,130,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3b82f6', flexShrink: 0,
          }}>
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              Yaklaşan Ödeme Vadeleri
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              <span style={{ color: overdue.length > 0 ? '#ef4444' : 'inherit', fontWeight: overdue.length > 0 ? 600 : 'normal' }}>
                {overdue.length > 0 ? `${overdue.length} geciken vade, ` : ''}
              </span>
              <span>{totalCount} bekleyen ödeme vadesi takip ediliyor</span>
            </div>
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '10px 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sections.map((section) => {
            const isExpanded = activeSection === section.id;
            const totalAmount = section.items.reduce((s, i) => s + i.amount, 0);

            return (
              <div
                key={section.id}
                style={{
                  border: `1px solid ${section.borderColor}`,
                  background: section.bgColor,
                  borderRadius: 12,
                  overflow: 'hidden'
                }}
              >
                {/* Section header */}
                <div
                  onClick={() => setActiveSection(isExpanded ? null : section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: section.color, display: 'flex', alignItems: 'center' }}>
                      {section.icon}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-main)', letterSpacing: '0.3px' }}>
                      {section.label} ({section.items.length})
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '12px', fontWeight: 700, color: section.color }}>
                      Kalan: {fmt(totalAmount)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </div>
                </div>

                {/* Section items list */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${section.borderColor}`, background: 'rgba(0,0,0,0.15)' }}>
                    <div style={{
                      display: 'flex',
                      padding: '6px 16px',
                      background: 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <span style={colHeadStyle(2)}>PROJE</span>
                      <span style={colHeadStyle(1.5)}>MÜŞTERİ</span>
                      <span style={colHeadStyle(2.5)}>İŞ MADDESİ / GÖREV</span>
                      <span style={{ ...colHeadStyle(1.2), textAlign: 'right' }}>VADE TARİHİ</span>
                      <span style={{ ...colHeadStyle(1.2), textAlign: 'right', color: section.color }}>KALAN TUTAR</span>
                    </div>

                    {section.items.map((item, idx) => (
                      <DataRow
                        key={idx}
                        item={item}
                        fmt={fmt}
                        formatDate={formatDate}
                        sectionColor={section.color}
                        onOpen={() => onOpenProject(item.projectId)}
                        isLast={idx === section.items.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function colHeadStyle(flex) {
  return {
    flex,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    paddingRight: 8,
    lineHeight: '24px',
  };
}

function DataRow({ item, fmt, formatDate, sectionColor, onOpen, isLast }) {
  const [hovered, setHovered] = useState(false);

  const cellBase = {
    fontSize: 12.5,
    color: 'var(--text-main)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    paddingRight: 8,
    lineHeight: '38px',
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
        padding: '0 16px',
        height: 38,
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Proje */}
      <span style={{ ...cellBase, flex: 2, fontWeight: 600, color: 'var(--primary)' }}>
        {item.projectTitle}
      </span>

      {/* Müşteri */}
      <span style={{ ...cellBase, flex: 1.5 }}>
        {item.client ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.22)',
            borderRadius: 5,
            padding: '1px 5px',
            color: '#a5b4fc',
            lineHeight: '14px',
            verticalAlign: 'middle',
          }}>
            <User size={9} /> {item.client}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </span>

      {/* İş Maddesi */}
      <span style={{ ...cellBase, flex: 2.5, color: 'var(--text-muted)' }}>
        {item.taskTitle}
      </span>

      {/* Vade Tarihi */}
      <span style={{ ...cellBase, flex: 1.2, fontFamily: 'Fira Code, monospace', fontSize: 11.5, textAlign: 'right', color: item.diffDays < 0 ? '#ef4444' : 'var(--text-main)' }}>
        {formatDate(item.dueDate)}
      </span>

      {/* Tutar */}
      <span style={{ ...cellBase, flex: 1.2, fontFamily: 'Fira Code, monospace', fontSize: 12, color: sectionColor, fontWeight: 700, textAlign: 'right', paddingRight: 0 }}>
        {fmt(item.amount)}
      </span>
    </div>
  );
}
