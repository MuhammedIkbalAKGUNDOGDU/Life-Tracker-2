import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Calendar, User, FileText, X, ExternalLink, Settings, BarChart2, Eye, EyeOff } from 'lucide-react';

export default function YearlyPaymentsDashboard({ 
  projects = [], 
  onOpenProject,
  displayCurrency,
  setDisplayCurrency,
  hideAmounts,
  setHideAmounts,
  usdTryRate: propUsdTryRate
}) {
  const [payments, setPayments] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usdTryRate, setUsdTryRate] = useState(34.0);

  // Sync prop exchange rate if available
  useEffect(() => {
    if (propUsdTryRate) {
      setUsdTryRate(propUsdTryRate);
    }
  }, [propUsdTryRate]);

  // Form Modal Status States
  const [isPaid, setIsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [isCancelled, setIsCancelled] = useState(false);

  // Filter States (initialized from localStorage where possible)
  const [filterProjectId, setFilterProjectId] = useState(() => {
    return localStorage.getItem('yearly_filter_project_id') || '';
  });
  const [filterClient, setFilterClient] = useState(() => {
    return localStorage.getItem('yearly_filter_client') || '';
  });
  const [filterStatus, setFilterStatus] = useState(() => {
    return localStorage.getItem('yearly_filter_status') || 'all';
  });
  const [filterYear, setFilterYear] = useState(() => {
    return localStorage.getItem('yearly_filter_year') || 'active';
  });

  // Sync filters to localStorage
  useEffect(() => {
    localStorage.setItem('yearly_filter_project_id', filterProjectId);
  }, [filterProjectId]);

  useEffect(() => {
    localStorage.setItem('yearly_filter_client', filterClient);
  }, [filterClient]);

  useEffect(() => {
    localStorage.setItem('yearly_filter_status', filterStatus);
  }, [filterStatus]);

  useEffect(() => {
    localStorage.setItem('yearly_filter_year', filterYear);
  }, [filterYear]);

  // Breakdown Modal States
  const [breakdownTab, setBreakdownTab] = useState('category'); // 'category' or 'project'
  const [breakdownOnlyPending, setBreakdownOnlyPending] = useState(true);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState([]); // Array of { category, amount, currency, description }

  // Option Category Management Modal State
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');

  // Breakdown Modal State
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/yearly-payments');
      if (!res.ok) throw new Error('Yıllık ödemeler yüklenirken bir hata oluştu.');
      const data = await res.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/yearly-payment-options');
      if (!res.ok) throw new Error('Seçenekler yüklenemedi.');
      const data = await res.json();
      setOptions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('/api/finance/prices');
      if (res.ok) {
        const data = await res.json();
        if (data.USD && data.USD.TRY) {
          setUsdTryRate(data.USD.TRY);
        }
      }
    } catch (err) {
      console.error('Döviz kuru alınamadı:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchOptions();
    fetchExchangeRate();
  }, []);

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    try {
      const res = await fetch('/api/yearly-payment-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOptionName.trim() })
      });
      if (!res.ok) throw new Error('Seçenek eklenemedi (zaten var olabilir).');
      setNewOptionName('');
      fetchOptions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteOption = async (id) => {
    if (!window.confirm('Bu ödeme kategorisini silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/yearly-payment-options/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Seçenek silinemedi.');
      fetchOptions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedPayment(null);
    setTitle('');
    setClient('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setProjectId('');
    setItems([]);
    setIsPaid(false);
    setPaymentDate('');
    setIsCancelled(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (payment) => {
    setSelectedPayment(payment);
    setTitle(payment.title || '');
    setClient(payment.client || '');
    setDueDate(payment.due_date ? new Date(payment.due_date).toISOString().split('T')[0] : '');
    setDescription(payment.description || '');
    setProjectId(payment.project_id || '');
    setItems(payment.items ? payment.items.map(item => ({
      category: item.category,
      amount: parseFloat(item.amount) || 0,
      currency: item.currency || 'TRY',
      description: item.description || ''
    })) : []);
    setIsPaid(payment.is_paid || false);
    setPaymentDate(payment.payment_date ? new Date(payment.payment_date).toISOString().split('T')[0] : '');
    setIsCancelled(payment.is_cancelled || false);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      client: client.trim(),
      due_date: dueDate || null,
      description: description.trim(),
      project_id: projectId ? parseInt(projectId) : null,
      is_paid: isPaid,
      payment_date: isPaid ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
      is_cancelled: isCancelled,
      items: items.map(item => ({
        category: item.category,
        amount: parseFloat(item.amount) || 0,
        currency: item.currency || 'TRY',
        description: item.description.trim()
      }))
    };

    try {
      let res;
      if (selectedPayment) {
        res = await fetch(`/api/yearly-payments/${selectedPayment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/yearly-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Ödeme kaydedilemedi.');
      setIsModalOpen(false);
      fetchPayments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu yıllık ödeme kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/yearly-payments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ödeme silinemedi.');
      fetchPayments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddItemRow = () => {
    const defaultCategory = options[0]?.name || 'Diğer';
    setItems([...items, { category: defaultCategory, amount: 0, currency: 'TRY', description: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    const amt = parseFloat(amount) || 0;
    const from = fromCurrency || 'TRY';
    const to = toCurrency || 'TRY';
    if (from === to) return amt;
    if (from === 'USD' && to === 'TRY') {
      return amt * usdTryRate;
    }
    if (from === 'TRY' && to === 'USD') {
      return amt / usdTryRate;
    }
    return amt;
  };

  const fmt = (val, currencyCode = displayCurrency) => {
    if (hideAmounts) {
      return currencyCode === 'USD' ? '*** $' : '*** ₺';
    }
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  // Check due urgency
  const getDueStatus = (dateStr) => {
    if (!dateStr) return { label: 'Vade Yok', color: 'var(--text-muted)' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Gecikmiş', color: '#ef4444' };
    if (diffDays === 0) return { label: 'Bugün', color: '#f97316' };
    if (diffDays <= 7) return { label: '1 Hafta İçinde', color: '#eab308' };
    if (diffDays <= 30) return { label: '1 Ay İçinde', color: '#3b82f6' };
    return { label: 'Normal', color: 'var(--success)' };
  };

  // Calculations
  const getPaymentTotal = (payment, targetCurrency) => {
    if (!payment.items) return 0;
    return payment.items.reduce((sum, item) => {
      return sum + convertAmount(item.amount, item.currency || 'TRY', targetCurrency);
    }, 0);
  };

  // Dynamic Year List Extraction from payment due dates
  const uniqueYears = [...new Set(payments.map(p => {
    if (!p.due_date) return null;
    const d = new Date(p.due_date);
    return isNaN(d.getTime()) ? null : d.getFullYear();
  }).filter(y => y !== null))].sort((a, b) => b - a);

  // Always include the current year in the select dropdown list
  const currentYear = new Date().getFullYear();
  if (!uniqueYears.includes(currentYear)) {
    uniqueYears.push(currentYear);
    uniqueYears.sort((a, b) => b - a);
  }

  // Stats filtering (based on Project, Client, and Year filters, but NOT Status filter, so stats cards are independent)
  const statsPayments = payments.filter(p => {
    const matchProject = !filterProjectId || String(p.project_id) === String(filterProjectId);
    const matchClient = !filterClient || p.client === filterClient;
    
    // Year filter matching
    let matchYear = true;
    if (p.due_date) {
      const pYear = new Date(p.due_date).getFullYear();
      if (filterYear === 'active') {
        matchYear = pYear === currentYear;
      } else if (filterYear !== 'all') {
        matchYear = pYear === parseInt(filterYear);
      }
    } else {
      // If a payment has no due date, include it only under 'all' years filter
      matchYear = filterYear === 'all';
    }

    return matchProject && matchClient && matchYear;
  });

  // Calculate statistics cards (excluding cancelled ones)
  const totalReceivable = statsPayments
    .filter(p => !p.is_cancelled)
    .reduce((sum, p) => sum + getPaymentTotal(p, displayCurrency), 0);

  const totalCollected = statsPayments
    .filter(p => p.is_paid && !p.is_cancelled)
    .reduce((sum, p) => sum + getPaymentTotal(p, displayCurrency), 0);

  const totalRemaining = statsPayments
    .filter(p => !p.is_paid && !p.is_cancelled)
    .reduce((sum, p) => sum + getPaymentTotal(p, displayCurrency), 0);

  // List payments (respects all filters including status)
  const filteredPayments = statsPayments.filter(p => {
    if (filterStatus === 'pending') {
      return !p.is_paid && !p.is_cancelled;
    }
    if (filterStatus === 'paid') {
      return p.is_paid && !p.is_cancelled;
    }
    if (filterStatus === 'cancelled') {
      return p.is_cancelled;
    }
    // 'all' status hides cancelled subscriptions by default
    return !p.is_cancelled;
  });

  // Unique clients list for filtering dropdown
  const uniqueClients = [...new Set(payments.map(p => p.client).filter(c => c && c.trim() !== ''))];

  // Grouping logic for breakdown modal
  const breakdownPayments = statsPayments.filter(p => {
    if (breakdownOnlyPending) {
      return !p.is_paid && !p.is_cancelled;
    } else {
      return !p.is_cancelled;
    }
  });

  const breakdownTotal = breakdownPayments.reduce((sum, p) => sum + getPaymentTotal(p, displayCurrency), 0);

  let breakdownList = [];
  if (breakdownTab === 'category') {
    const categoryBreakdown = breakdownPayments.reduce((acc, p) => {
      if (p.items && p.items.length > 0) {
        p.items.forEach(item => {
          const cat = item.category || 'Diğer';
          const converted = convertAmount(item.amount, item.currency || 'TRY', displayCurrency);
          acc[cat] = (acc[cat] || 0) + converted;
        });
      }
      return acc;
    }, {});
    breakdownList = Object.entries(categoryBreakdown)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  } else {
    // Project-based breakdown
    const projectBreakdown = breakdownPayments.reduce((acc, p) => {
      const name = p.project_title || p.title || 'Diğer';
      const amount = getPaymentTotal(p, displayCurrency);
      acc[name] = (acc[name] || 0) + amount;
      return acc;
    }, {});
    breakdownList = Object.entries(projectBreakdown)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header bar */}
      <section className="action-bar-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>Yıllık Ödeme Takibi</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Yıllık ödemelerinizi kalem kalem takip edin. {usdTryRate ? `(Güncel Kur: 1 $ = ${usdTryRate.toFixed(2)} ₺)` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Hide/Show Amounts Eye Button */}
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            onClick={() => setHideAmounts(!hideAmounts)}
            title={hideAmounts ? "Tutarları Göster" : "Tutarları Gizle"}
          >
            {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          {/* Currency Toggle Buttons */}
          <div className="glass-card" style={{ display: 'flex', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', gap: '2px' }}>
            <button
              type="button"
              className={`btn-sm`}
              style={{ 
                padding: '6px 12px', 
                fontSize: '12px', 
                borderRadius: '6px', 
                border: 'none', 
                cursor: 'pointer',
                background: displayCurrency === 'TRY' ? 'var(--primary)' : 'transparent',
                color: displayCurrency === 'TRY' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600
              }}
              onClick={() => setDisplayCurrency('TRY')}
            >
              ₺ TL
            </button>
            <button
              type="button"
              className={`btn-sm`}
              style={{ 
                padding: '6px 12px', 
                fontSize: '12px', 
                borderRadius: '6px', 
                border: 'none', 
                cursor: 'pointer',
                background: displayCurrency === 'USD' ? 'var(--primary)' : 'transparent',
                color: displayCurrency === 'USD' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600
              }}
              onClick={() => setDisplayCurrency('USD')}
            >
              $ USD
            </button>
          </div>

          <button className="btn btn-secondary" onClick={() => setIsOptionsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={16} /> Kategorileri Yönet
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus /> Yıllık Ödeme Ekle
          </button>
        </div>
      </section>

      {/* Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {/* Toplam Yıllık Alacak */}
        <div 
          className="stat-card glass-card animate-fade-in" 
          onClick={() => {
            setBreakdownOnlyPending(false);
            setIsBreakdownModalOpen(true);
          }}
          style={{ 
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          title="Detaylı kalem kırılımı için tıklayın"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="stat-header">
            <span className="stat-title">Toplam Yıllık Alacak ({displayCurrency})</span>
            <div className="stat-icon-wrapper blue" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <BarChart2 size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '26px', color: '#60a5fa' }}>{fmt(totalReceivable)}</div>
          <div className="stat-desc" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Aktif (iptal edilmemiş) tüm kalemlerin toplamı. Grafik için tıklayın.
          </div>
        </div>

        {/* Toplam Ödenen */}
        <div 
          className="stat-card glass-card animate-fade-in" 
          onClick={() => {
            setBreakdownOnlyPending(false);
            setIsBreakdownModalOpen(true);
          }}
          style={{ 
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          title="Detaylı kalem kırılımı için tıklayın"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="stat-header">
            <span className="stat-title">Ödenen / Tahsil Edilen ({displayCurrency})</span>
            <div className="stat-icon-wrapper emerald" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
              <BarChart2 size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '26px', color: 'var(--success)' }}>{fmt(totalCollected)}</div>
          <div className="stat-desc" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Ödendi olarak işaretlenen aktif ödemelerin toplamı.
          </div>
        </div>

        {/* Bekleyen / Kalan */}
        <div 
          className="stat-card glass-card animate-fade-in" 
          onClick={() => {
            setBreakdownOnlyPending(true);
            setIsBreakdownModalOpen(true);
          }}
          style={{ 
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          title="Bekleyen kalem kırılımı için tıklayın"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="stat-header">
            <span className="stat-title">Bekleyen / Kalan ({displayCurrency})</span>
            <div className="stat-icon-wrapper orange" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
              <BarChart2 size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '26px', color: '#f97316' }}>{fmt(totalRemaining)}</div>
          <div className="stat-desc" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Ödenmemiş aktif ödemelerin toplamı. Grafik için tıklayın.
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div 
        className="glass-card animate-fade-in" 
        style={{ 
          padding: '16px 20px', 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '16px', 
          alignItems: 'center', 
          background: 'rgba(255,255,255,0.01)', 
          border: '1px solid rgba(255,255,255,0.04)', 
          borderRadius: '12px' 
        }}
      >
        {/* Year Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yıl Seçimi</label>
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)} 
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-main)'
            }}
          >
            <option value="active" style={{ background: '#1c1917' }}>Aktif Yıl ({currentYear})</option>
            <option value="all" style={{ background: '#1c1917' }}>Tüm Yıllar</option>
            {uniqueYears.map(y => (
              <option key={y} value={y} style={{ background: '#1c1917' }}>{y} Yılı</option>
            ))}
          </select>
        </div>

        {/* Project Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proje Filtresi</label>
          <select 
            value={filterProjectId} 
            onChange={(e) => setFilterProjectId(e.target.value)} 
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-main)'
            }}
          >
            <option value="" style={{ background: '#1c1917' }}>Tüm Projeler</option>
            {projects.map(p => (
              <option key={p.id} value={p.id} style={{ background: '#1c1917' }}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Client Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Müşteri / Sahip Filtresi</label>
          <select 
            value={filterClient} 
            onChange={(e) => setFilterClient(e.target.value)} 
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-main)'
            }}
          >
            <option value="" style={{ background: '#1c1917' }}>Tüm Müşteriler</option>
            {uniqueClients.map(c => (
              <option key={c} value={c} style={{ background: '#1c1917' }}>{c}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ödeme Durumu</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-main)'
            }}
          >
            <option value="all" style={{ background: '#1c1917' }}>Tümü (İptal Edilenler Hariç)</option>
            <option value="pending" style={{ background: '#1c1917' }}>Sadece Bekleyenler</option>
            <option value="paid" style={{ background: '#1c1917' }}>Sadece Ödenenler</option>
            <option value="cancelled" style={{ background: '#1c1917' }}>İptal Edilenler</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Yükleniyor...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>Veriler yüklenirken bir hata oluştu.</div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <Calendar style={{ width: '48px', height: '48px', color: 'var(--text-muted)', marginBottom: '16px', strokeWidth: 1.2 }} />
          <h3>Kayıtlı Yıllık Ödeme Bulunmuyor</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px', maxWidth: '300px', marginInline: 'auto' }}>
            Seçilen filtrelere uygun ödeme kaydı bulunamadı veya henüz yıllık ödeme eklenmedi.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredPayments.map((payment) => {
            const dueStatus = getDueStatus(payment.due_date);
            const totalInDisplay = getPaymentTotal(payment, displayCurrency);
            return (
              <div
                key={payment.id}
                className="routine-card glass-card animate-fade-in"
                style={{
                  minHeight: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  cursor: 'pointer',
                  opacity: payment.is_cancelled ? 0.6 : 1,
                  borderStyle: payment.is_cancelled ? 'dashed' : 'solid',
                  borderColor: payment.is_cancelled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.08)'
                }}
                onClick={() => handleOpenEditModal(payment)}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', textDecoration: payment.is_cancelled ? 'line-through' : 'none' }}>
                      {payment.title}
                    </h3>
                    {payment.client && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} style={{ color: 'var(--primary)' }} />
                        Sahip / Müşteri: <strong style={{ color: 'var(--text-main)' }}>{payment.client}</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <strong style={{ fontSize: '18px', fontFamily: 'Fira Code, monospace', color: payment.is_cancelled ? 'var(--text-muted)' : 'var(--primary)' }}>
                      {fmt(totalInDisplay)}
                    </strong>
                    {payment.is_cancelled ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          background: 'rgba(239, 68, 68, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171'
                        }}
                      >
                        İptal Edildi
                      </span>
                    ) : payment.is_paid ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#34d399'
                        }}
                        title={payment.payment_date ? `Ödeme Tarihi: ${formatDate(payment.payment_date)}` : ''}
                      >
                        Ödendi {payment.payment_date ? `(${formatDate(payment.payment_date)})` : ''}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          background: 'rgba(255,255,255,0.03)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${dueStatus.color}40`,
                          color: dueStatus.color
                        }}
                      >
                        {dueStatus.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Row */}
                {payment.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    {payment.description}
                  </p>
                )}

                {/* Items List inside Card */}
                {payment.items && payment.items.length > 0 && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                      Ödeme Kalemleri ({payment.items.length})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {payment.items.map((item, idx) => {
                        const originalAmt = parseFloat(item.amount) || 0;
                        const originalCurr = item.currency || 'TRY';
                        const displayAmt = convertAmount(originalAmt, originalCurr, displayCurrency);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: idx < payment.items.length - 1 ? '1px dashed rgba(255,255,255,0.04)' : 'none', paddingBottom: idx < payment.items.length - 1 ? '6px' : '0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.category}</span>
                              {item.description && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.description}</span>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontFamily: 'Fira Code, monospace', color: 'var(--text-main)', fontWeight: 500 }}>
                                {fmt(displayAmt)}
                              </span>
                              {originalCurr !== displayCurrency && !hideAmounts && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Fira Code, monospace' }}>
                                  ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: originalCurr, maximumFractionDigits: 0 }).format(originalAmt)})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer Actions Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> Vade: <strong>{formatDate(payment.due_date)}</strong>
                    </span>

                    {payment.project_id && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(99,102,241,0.08)',
                          border: '1px solid rgba(99,102,241,0.2)',
                          color: '#a5b4fc'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProject(payment.project_id);
                        }}
                      >
                        <ExternalLink size={11} /> Projeyi Göster
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-card-action"
                      onClick={() => handleOpenEditModal(payment)}
                      title="Ödemeyi Düzenle"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-card-action delete"
                      onClick={() => handleDelete(payment.id)}
                      title="Ödemeyi Sil"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="modal-backdrop open" onClick={() => setIsModalOpen(false)}>
          <div className="modal glass-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedPayment ? 'Yıllık Ödemeyi Düzenle' : 'Yıllık Ödeme Ekle'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)} type="button">
                <X />
              </button>
            </div>

            <form onSubmit={handleSave} className="modal-form">
              <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* Title */}
                <div className="form-group">
                  <label>Ödeme Adı / Proje</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ödeme başlığını girin..."
                    required
                  />
                </div>

                {/* Owner/Client */}
                <div className="form-group">
                  <label>Sahip / Müşteri</label>
                  <input
                    type="text"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Kişi veya kurum..."
                  />
                </div>

                {/* Due Date & Associated Project Row */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Ödeme Tarihi (Vade)</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>İlişkili Proje (İsteğe Bağlı)</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="">İlişkili Proje Yok</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.title} {proj.client ? `(${proj.client})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status Toggle Checkboxes */}
                <div className="form-row-2" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                    <input
                      type="checkbox"
                      id="isPaid"
                      checked={isPaid}
                      onChange={(e) => {
                        setIsPaid(e.target.checked);
                        if (e.target.checked && !paymentDate) {
                          setPaymentDate(new Date().toISOString().split('T')[0]);
                        }
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="isPaid" style={{ cursor: 'pointer', marginBottom: 0, fontWeight: 600, color: 'var(--text-main)' }}>Ödendi Olarak İşaretle</label>
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                    <input
                      type="checkbox"
                      id="isCancelled"
                      checked={isCancelled}
                      onChange={(e) => setIsCancelled(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="isCancelled" style={{ cursor: 'pointer', marginBottom: 0, fontWeight: 600, color: 'var(--text-main)' }}>Aboneliği İptal Et</label>
                  </div>
                </div>

                {isPaid && (
                  <div className="form-group animate-fade-in">
                    <label>Ödeme Tarihi</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Description */}
                <div className="form-group">
                  <label>Detaylar / Notlar</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="2"
                    placeholder="Banka hesap bilgileri, periyot notları vb..."
                  />
                </div>

                {/* Payment Items Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Ödeme Kalemleri</span>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAddItemRow}
                      style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> Kalem Ekle
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', padding: '15px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.04)' }}>
                      Henüz hiç ödeme kalemi eklemediniz. "Kalem Ekle" butonuna basarak ekleyebilirsiniz.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                      {items.map((item, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.6fr 1fr 1.5fr auto', gap: '8px', alignItems: 'center' }}>
                          {/* Category select */}
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                            required
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                          >
                            {options.map((opt) => (
                              <option key={opt.id} value={opt.name}>{opt.name}</option>
                            ))}
                            {!options.some(opt => opt.name === item.category) && (
                              <option value={item.category}>{item.category}</option>
                            )}
                          </select>

                          {/* Currency select */}
                          <select
                            value={item.currency || 'TRY'}
                            onChange={(e) => handleItemChange(idx, 'currency', e.target.value)}
                            required
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                          >
                            <option value="TRY">₺ TRY</option>
                            <option value="USD">$ USD</option>
                          </select>

                          {/* Amount input */}
                          <input
                            type="number"
                            value={item.amount || ''}
                            onChange={(e) => handleItemChange(idx, 'amount', Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="Tutar"
                            required
                            min="0"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                          />

                          {/* Description input */}
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="Detay (örn: Yenileme)..."
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                          />

                          {/* Delete row button */}
                          <button
                            type="button"
                            className="btn-card-action delete"
                            onClick={() => handleRemoveItemRow(idx)}
                            title="Kalemi Sil"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary of items */}
                  {items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                      <span>Toplam (TL bazında): <strong style={{ color: 'var(--primary)' }}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(items.reduce((sum, item) => sum + convertAmount(item.amount, item.currency || 'TRY', 'TRY'), 0))}</strong></span>
                      <span>Toplam (Dolar bazında): <strong style={{ color: '#10b981' }}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(items.reduce((sum, item) => sum + convertAmount(item.amount, item.currency || 'TRY', 'USD'), 0))}</strong></span>
                    </div>
                  )}
                </div>

              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Options Management Modal */}
      {isOptionsModalOpen && (
        <div className="modal-backdrop open" onClick={() => setIsOptionsModalOpen(false)}>
          <div className="modal glass-card" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={18} /> Ödeme Kategorilerini Yönet</h2>
              <button className="btn-close" onClick={() => setIsOptionsModalOpen(false)} type="button">
                <X />
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Add Option Form */}
              <form onSubmit={handleAddOption} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Yeni kategori adı (örn: Lisans)..."
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={16} /> Ekle
                </button>
              </form>

              {/* Options List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mevcut Kategoriler ({options.length})
                </span>
                {options.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>Hiç kategori tanımlanmamış.</p>
                ) : (
                  options.map((opt) => (
                    <div 
                      key={opt.id} 
                      className="glass-card" 
                      style={{ 
                        padding: '10px 14px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>{opt.name}</span>
                      <button
                        type="button"
                        className="btn-card-action delete"
                        onClick={() => handleDeleteOption(opt.id)}
                        title="Kategoriyi Sil"
                        style={{ padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsOptionsModalOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Modal */}
      {isBreakdownModalOpen && (
        <div className="modal-backdrop open" onClick={() => setIsBreakdownModalOpen(false)}>
          <div className="modal glass-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 style={{ color: 'var(--success)' }} /> Kırılım Analizi (Yıllık)</h2>
              <button className="btn-close" onClick={() => setIsBreakdownModalOpen(false)} type="button">
                <X />
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tab Selector & Filter Toggle Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '4px' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', padding: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', gap: '2px' }}>
                  <button
                    type="button"
                    style={{ 
                      padding: '5px 10px', 
                      fontSize: '11px', 
                      borderRadius: '6px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: breakdownTab === 'category' ? 'var(--primary)' : 'transparent',
                      color: breakdownTab === 'category' ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: 600,
                      transition: 'background 0.2s ease, color 0.2s ease'
                    }}
                    onClick={() => setBreakdownTab('category')}
                  >
                    Kalem Bazlı
                  </button>
                  <button
                    type="button"
                    style={{ 
                      padding: '5px 10px', 
                      fontSize: '11px', 
                      borderRadius: '6px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: breakdownTab === 'project' ? 'var(--primary)' : 'transparent',
                      color: breakdownTab === 'project' ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: 600,
                      transition: 'background 0.2s ease, color 0.2s ease'
                    }}
                    onClick={() => setBreakdownTab('project')}
                  >
                    Proje Bazlı
                  </button>
                </div>

                {/* Switch Only Pending */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    id="breakdownOnlyPending"
                    checked={breakdownOnlyPending}
                    onChange={(e) => setBreakdownOnlyPending(e.target.checked)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <label htmlFor="breakdownOnlyPending" style={{ fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: 0, fontWeight: 500 }}>
                    Sadece Bekleyenler
                  </label>
                </div>
              </div>

              {breakdownList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px', padding: '20px' }}>Gereksinimlere uygun hiçbir kayıt bulunmuyor.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {breakdownList.map((item, idx) => {
                    const percentage = breakdownTotal > 0 ? (item.amount / breakdownTotal) * 100 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.name}</span>
                          <span style={{ fontFamily: 'Fira Code, monospace', fontWeight: 700, color: 'var(--primary)' }}>
                            {fmt(item.amount)} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                    <span>Kırılım Toplamı</span>
                    <span style={{ color: 'var(--success)' }}>{fmt(breakdownTotal)}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsBreakdownModalOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
