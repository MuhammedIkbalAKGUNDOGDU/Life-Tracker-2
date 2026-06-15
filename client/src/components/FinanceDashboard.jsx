import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  Activity,
  X,
  CreditCard,
  Building,
  Utensils,
  Car,
  FileText,
  Briefcase,
  Eye,
  EyeOff
} from 'lucide-react';

export default function FinanceDashboard({
  assets = [],
  transactions = [],
  prices = null,
  loading = false,
  onSaveAsset,
  onDeleteAsset,
  onSaveTransaction,
  onDeleteTransaction,
  onRefreshPrices
}) {
  const [displayCurrency, setDisplayCurrency] = useState('TRY');
  const [hideBalances, setHideBalances] = useState(() => localStorage.getItem('hide_finance_balances') === 'true');
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isAddingToAsset, setIsAddingToAsset] = useState(null);

  useEffect(() => {
    localStorage.setItem('hide_finance_balances', hideBalances);
  }, [hideBalances]);

  // Asset Form State
  const [assetType, setAssetType] = useState('gold');
  const [ticker, setTicker] = useState('GRAM_GOLD');
  const [amount, setAmount] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [assetCurrency, setAssetCurrency] = useState('TRY');

  const handleOpenAddAssetModal = (existingAsset = null) => {
    if (existingAsset) {
      setIsAddingToAsset(existingAsset);
      setAssetType(existingAsset.asset_type);
      setTicker(existingAsset.ticker);
      setAssetCurrency(existingAsset.asset_currency || 'TRY');
      setAmount('');
      setCostPrice('');
    } else {
      setIsAddingToAsset(null);
      setAssetType('gold');
      setTicker('GRAM_GOLD');
      setAssetCurrency('TRY');
      setAmount('');
      setCostPrice('');
    }
    setIsAssetModalOpen(true);
  };

  // Ledger Filter State - Default to current month/year
  const today = new Date();
  const currentMonthIdx = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Transaction Form State
  const [txType, setTxType] = useState('expense');
  const [txCategory, setTxCategory] = useState('food');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(today.toISOString().split('T')[0]);
  const [txDescription, setTxDescription] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(6);

  // Local ticker prices state for saniye bazlı gerçekçi dalgalanmalar (fluctuations)
  const [localPrices, setLocalPrices] = useState(null);
  const [priceFlash, setPriceFlash] = useState({}); // { [ticker]: 'up' | 'down' }

  // Sync local prices with backend prices initially
  useEffect(() => {
    if (prices) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalPrices(JSON.parse(JSON.stringify(prices)));
    }
  }, [prices]);

  // Simulate active market tickers every 4 seconds
  useEffect(() => {
    if (!localPrices) return;

    const timer = setInterval(() => {
      setLocalPrices(prev => {
        if (!prev) return null;
        const next = JSON.parse(JSON.stringify(prev));
        const flashes = {};

        // Helper to slightly fluctuate prices
        const fluctuate = (tickerKey) => {
          if (!next[tickerKey]) return;
          const current = next[tickerKey].TRY;
          const change = (Math.random() - 0.5) * 0.001; // Max 0.1% change
          const newTry = current * (1 + change);
          
          const usdTry = next.USD ? next.USD.TRY : 32.50;
          const eurTry = next.EUR ? next.EUR.TRY : 35.10;
          
          next[tickerKey].TRY = newTry;
          next[tickerKey].USD = newTry / usdTry;
          next[tickerKey].EUR = newTry / eurTry;
          
          if (change > 0) flashes[tickerKey] = 'up';
          else if (change < 0) flashes[tickerKey] = 'down';
        };

        // Fluctuate assets
        ['GRAM_GOLD', 'CEYREK_GOLD', 'BTC', 'ETH', 'SOL', 'THYAO', 'ASELS', 'EREGL', 'KCHOL', 'BIMAS'].forEach(fluctuate);

        // Flash UI update
        setPriceFlash(flashes);
        setTimeout(() => setPriceFlash({}), 800);

        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [localPrices]);

  // Price resolver helper
  const resolvePrice = (assetTicker, type) => {
    const defaultVal = { TRY: 0, USD: 0, EUR: 0, changePercent: 0 };
    const activePrices = localPrices || prices;
    if (!activePrices) return defaultVal;

    const upper = assetTicker.trim().toUpperCase();

    // Check direct predefined matches
    if (activePrices[upper]) {
      return activePrices[upper];
    }

    // Try normalization checks for suffix variations
    const normalized = upper.replace('.IS', '').replace('-USD', '').trim();
    if (activePrices[normalized]) {
      return activePrices[normalized];
    }
    if (activePrices[`${normalized}.IS`]) {
      return activePrices[`${normalized}.IS`];
    }
    if (activePrices[`${normalized}-USD`]) {
      return activePrices[`${normalized}-USD`];
    }

    // Check TEFAS funds
    if (type === 'fund' && activePrices.TEFAS) {
      const fundPrice = activePrices.TEFAS[upper] || activePrices.TEFAS[normalized];
      if (fundPrice) {
        const fundTry = fundPrice;
        const usdTry = activePrices.USD.TRY;
        const eurTry = activePrices.EUR.TRY;
        return {
          TRY: fundTry,
          USD: fundTry / usdTry,
          EUR: fundTry / eurTry,
          changePercent: 0
        };
      }
    }

    // Cash matching
    if (upper === 'TRY') return { TRY: 1, USD: 1 / activePrices.USD.TRY, EUR: 1 / activePrices.EUR.TRY, changePercent: 0 };
    if (upper === 'USD') return activePrices.USD;
    if (upper === 'EUR') return activePrices.EUR;

    return defaultVal;
  };

  // Convert an asset cost to the display currency
  const getAssetCostInDisplayCurrency = (asset) => {
    const cost = parseFloat(asset.cost_price) || 0;
    const fromCur = (asset.asset_currency || 'TRY').toUpperCase();
    if (fromCur === displayCurrency) return cost;

    const activePrices = localPrices || prices;
    if (!activePrices) return cost;

    // Convert from cost currency to TRY first
    let costTry = cost;
    if (fromCur === 'USD') costTry = cost * activePrices.USD.TRY;
    else if (fromCur === 'EUR') costTry = cost * activePrices.EUR.TRY;

    // Convert from TRY to display currency
    if (displayCurrency === 'TRY') return costTry;
    if (displayCurrency === 'USD') return costTry / activePrices.USD.TRY;
    if (displayCurrency === 'EUR') return costTry / activePrices.EUR.TRY;

    return cost;
  };

  // Portfolio aggregates
  const portfolioSummary = assets.reduce((summary, asset) => {
    const amountFloat = parseFloat(asset.amount) || 0;
    const currentPricesObj = resolvePrice(asset.ticker, asset.asset_type);
    
    const currentValueDisplay = amountFloat * (currentPricesObj[displayCurrency] || 0);
    const costValueDisplay = amountFloat * getAssetCostInDisplayCurrency(asset);

    summary.totalValue += currentValueDisplay;
    summary.totalCost += costValueDisplay;
    
    return summary;
  }, { totalValue: 0, totalCost: 0 });

  const totalPL = portfolioSummary.totalValue - portfolioSummary.totalCost;
  const plPercent = portfolioSummary.totalCost > 0 ? (totalPL / portfolioSummary.totalCost) * 100 : 0;

  // Asset allocation mapping
  const allocation = assets.reduce((map, asset) => {
    const val = (parseFloat(asset.amount) || 0) * (resolvePrice(asset.ticker, asset.asset_type)[displayCurrency] || 0);
    const label = asset.asset_type === 'gold' ? 'Altın' 
                : asset.asset_type === 'stock' ? 'Hisse Senedi' 
                : asset.asset_type === 'crypto' ? 'Kripto' 
                : asset.asset_type === 'fund' ? 'Fon' 
                : 'Nakit';

    map[label] = (map[label] || 0) + val;
    return map;
  }, {});

  const totalAllocation = Object.values(allocation).reduce((sum, v) => sum + v, 0);

  // Month labels
  const monthsTr = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  // Ledger calculations (filter by selected month and year)
  const filteredTxs = transactions.filter(tx => {
    const d = new Date(tx.transaction_date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const monthlyIncome = filteredTxs
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  const monthlyExpense = filteredTxs
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  const netCashFlow = monthlyIncome - monthlyExpense;

  // Category based expenses
  const categoryExpenses = filteredTxs
    .filter(tx => tx.type === 'expense')
    .reduce((map, tx) => {
      const cat = tx.category;
      map[cat] = (map[cat] || 0) + parseFloat(tx.amount);
      return map;
    }, {});

  // Ticker items definition
  const tickerItems = [
    { label: 'BIST 100', val: 'XU100', type: 'index', symbol: 'TRY' },
    { label: 'Gram Altın', val: 'GRAM_GOLD', type: 'gold', symbol: 'TRY' },
    { label: 'Dolar', val: 'USD', type: 'cash', symbol: 'TRY' },
    { label: 'Euro', val: 'EUR', type: 'cash', symbol: 'TRY' },
    { label: 'Bitcoin', val: 'BTC', type: 'crypto', symbol: 'USD' },
    { label: 'Ethereum', val: 'ETH', type: 'crypto', symbol: 'USD' },
    { label: 'THY', val: 'THYAO', type: 'stock', symbol: 'TRY' },
    { label: 'Aselsan', val: 'ASELS', type: 'stock', symbol: 'TRY' },
    { label: 'BİM', val: 'BIMAS', type: 'stock', symbol: 'TRY' },
    { label: 'Ereğli', val: 'EREGL', type: 'stock', symbol: 'TRY' }
  ];

  const handleAssetSubmit = (e) => {
    e.preventDefault();
    if (!amount || !costPrice) return;
    onSaveAsset({
      asset_type: assetType,
      ticker: ticker.toUpperCase().trim(),
      amount: parseFloat(amount),
      cost_price: parseFloat(costPrice),
      asset_currency: assetCurrency
    });
    setIsAssetModalOpen(false);
    setAmount('');
    setCostPrice('');
  };

  const handleTxSubmit = (e) => {
    e.preventDefault();
    if (!txAmount) return;
    onSaveTransaction({
      type: txType,
      category: txType === 'income' ? 'income' : txCategory,
      amount: parseFloat(txAmount),
      transaction_date: txDate,
      description: txDescription.trim(),
      installments_count: txType === 'expense' && isInstallment ? parseInt(installmentsCount) : 1
    });
    setTxAmount('');
    setTxDescription('');
    setIsInstallment(false);
  };

  const formatMoney = (val) => {
    if (hideBalances) return '****';
    const prefix = displayCurrency === 'USD' ? '$' : displayCurrency === 'EUR' ? '€' : '';
    const suffix = displayCurrency === 'TRY' ? ' TL' : '';
    return `${prefix}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'salary': return <Briefcase size={14} />;
      case 'rent': return <Building size={14} />;
      case 'food': return <Utensils size={14} />;
      case 'transport': return <Car size={14} />;
      case 'bills': return <FileText size={14} />;
      case 'installments': return <CreditCard size={14} />;
      default: return <Coins size={14} />;
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'salary': return 'Maaş / Gelir';
      case 'rent': return 'Kira / Ev';
      case 'food': return 'Gıda / Market';
      case 'transport': return 'Ulaşım / Araç';
      case 'bills': return 'Faturalar';
      case 'installments': return 'Taksit Ödemeleri';
      case 'investment': return 'Yatırım';
      case 'income': return 'Gelir';
      default: return 'Genel';
    }
  };

  // Render donut allocation
  const renderAllocationDonut = () => {
    if (totalAllocation === 0) {
      return (
        <div className="empty-state" style={{ minHeight: '180px' }}>
          <Coins style={{ width: '40px', height: '40px' }} />
          <h3>Varlık Bulunmuyor</h3>
          <p>Portföyünüze altın, hisse senedi veya döviz ekleyerek dağılımınızı inceleyin.</p>
        </div>
      );
    }

    const segments = Object.entries(allocation).map(([label, val]) => ({
      label,
      value: val,
      percent: val / totalAllocation,
      color: label === 'Altın' ? '#f59e0b' 
           : label === 'Hisse Senedi' ? '#3b82f6' 
           : label === 'Kripto' ? '#a78bfa' 
           : label === 'Fon' ? '#10b981' 
           : '#64748b'
    }));

    const r = 50;
    const circ = 2 * Math.PI * r;
    let offset = 0;

    return (
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap' }}>
        <svg width="150" height="150" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
          {segments.map((seg, idx) => {
            const strokeLen = circ * seg.percent;
            const strokeOffset = circ - strokeLen + offset;
            offset -= strokeLen;
            return (
              <circle 
                key={idx}
                cx="65"
                cy="65"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={circ}
                strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            );
          })}
          <g style={{ transform: 'rotate(90deg) translate(0px, -130px)' }}>
            <text x="65" y="60" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="bold">PORTFÖY</text>
            <text x="65" y="78" textAnchor="middle" fill="var(--text-main)" fontSize="14" fontWeight="bold">
              {formatMoney(totalAllocation)}
            </text>
          </g>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {segments.map((seg, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: seg.color }}></div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-main)' }}>
                {seg.label}: <span style={{ color: 'var(--text-muted)' }}>{Math.round(seg.percent * 100)}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Live Rolling Ticker Bar */}
      <div className="glass-card" style={{ padding: '8px 16px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', overflow: 'hidden' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={12} /> Canlı Piyasalar:
        </span>
        
        <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', flex: 1, whiteSpace: 'nowrap', padding: '4px 0', scrollbarWidth: 'none' }} className="market-ticker-scrollbar">
          {tickerItems.map(item => {
            const pObj = resolvePrice(item.val, item.type);
            const price = pObj[item.symbol] || 0;
            const chg = pObj.changePercent || 0;
            const flash = priceFlash[item.val];
            
            return (
              <div 
                key={item.label} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  transition: 'background 0.5s ease',
                  background: flash === 'up' ? 'rgba(16, 185, 129, 0.15)' : flash === 'down' ? 'rgba(239, 68, 68, 0.15)' : 'transparent'
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span style={{ color: 'var(--text-main)' }}>
                  {item.symbol === 'USD' ? '$' : ''}{price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{item.symbol === 'TRY' ? ' TL' : ''}
                </span>
                <span style={{ color: chg >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '10px', display: 'flex', alignItems: 'center' }}>
                  {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        <button 
          onClick={onRefreshPrices}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '11px', gap: '4px', flexShrink: 0 }}
          disabled={loading}
          title="Fiyatları Yenile"
        >
          <RefreshCw size={12} className={loading ? 'spin-animation' : ''} /> Yenile
        </button>
      </div>

      {/* Control Bar: Currency Selector */}
      <section className="action-bar-section" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Finansal Durum & Yatırımlar</h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Görünüm Para Birimi:</span>
            <div className="filters glass-card" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
              {['TRY', 'USD', 'EUR'].map(cur => (
                <button 
                  key={cur}
                  className={`filter-btn ${displayCurrency === cur ? 'active' : ''}`}
                  onClick={() => setDisplayCurrency(cur)}
                  style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="btn btn-secondary btn-icon-only"
            title={hideBalances ? "Bakiyeleri Göster" : "Bakiyeleri Gizle"}
            style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            {hideBalances ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </section>

      {/* Portfolio Stats Section */}
      <div className="stats-section" style={{ marginBottom: '24px' }}>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-title">Portföy Değeri</span>
            <div className="stat-icon-wrapper blue">
              <Wallet />
            </div>
          </div>
          <div className="stat-value">{formatMoney(portfolioSummary.totalValue)}</div>
          <div className="stat-desc">Güncel piyasa değeri karşılığı</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-title">Toplam Maliyet</span>
            <div className="stat-icon-wrapper violet">
              <Coins />
            </div>
          </div>
          <div className="stat-value">{formatMoney(portfolioSummary.totalCost)}</div>
          <div className="stat-desc">Yatırılan toplam anapara</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <span className="stat-title">Toplam Kâr/Zarar</span>
            <div className={`stat-icon-wrapper ${totalPL >= 0 ? 'emerald' : 'orange'}`}>
              {totalPL >= 0 ? <TrendingUp /> : <TrendingDown />}
            </div>
          </div>
          <div className="stat-value" style={{ color: totalPL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {totalPL >= 0 ? '+' : ''}{formatMoney(totalPL)}
          </div>
          <div className="stat-desc" style={{ color: totalPL >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
            {totalPL >= 0 ? '+' : ''}{plPercent.toFixed(2)}% kâr/zarar oranı
          </div>
        </div>

        <div className="stat-card glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="stat-header">
              <span className="stat-title">Nakit Akışı ({monthsTr[selectedMonth]})</span>
              <div className={`stat-icon-wrapper ${netCashFlow >= 0 ? 'emerald' : 'orange'}`}>
                <Activity />
              </div>
            </div>
            <div className="stat-value" style={{ color: netCashFlow >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {hideBalances ? '****' : `${netCashFlow >= 0 ? '+' : ''}${netCashFlow.toLocaleString('tr-TR')} TL`}
            </div>
            <div className="stat-desc">
              {hideBalances ? 'Gelir: **** | Gider: ****' : `Gelir: ${monthlyIncome.toLocaleString('tr-TR')} TL | Gider: ${monthlyExpense.toLocaleString('tr-TR')} TL`}
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Split Section */}
      <div className="journal-split-layout" style={{ marginBottom: '32px' }}>
        {/* Left: Asset List */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Varlık Portföyüm</h3>
            <button className="btn btn-primary" onClick={() => handleOpenAddAssetModal(null)} style={{ padding: '6px 12px', fontSize: '12px' }}>
              <Plus size={14} /> Varlık Ekle
            </button>
          </div>

          {assets.length === 0 ? (
            <div className="empty-state" style={{ minHeight: '180px' }}>
              <Wallet style={{ width: '48px', height: '48px' }} />
              <h3>Varlık Yok</h3>
              <p>Altın, BIST Hissesi veya Kripto ekleyerek kâr/zarar durumunuzu takip edin.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {assets.map(asset => {
                const amountFloat = parseFloat(asset.amount) || 0;
                const pObj = resolvePrice(asset.ticker, asset.asset_type);
                const currentPrice = pObj[displayCurrency] || 0;
                const totalValue = amountFloat * currentPrice;

                const costPriceDisplay = getAssetCostInDisplayCurrency(asset);
                const totalCost = amountFloat * costPriceDisplay;
                const assetPL = totalValue - totalCost;
                const assetPLPercent = totalCost > 0 ? (assetPL / totalCost) * 100 : 0;

                return (
                  <div key={asset.id} className="routine-card glass-card" style={{ minHeight: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="routine-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                        {asset.asset_type === 'gold' ? '🏆' : asset.asset_type === 'stock' ? '📈' : asset.asset_type === 'crypto' ? '🪙' : '💵'}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>{asset.ticker}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                          {hideBalances ? '**** adet @ **** (Güncel: ****)' : (
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>
                                {amountFloat} adet @ {displayCurrency === 'USD' ? '$' : displayCurrency === 'EUR' ? '€' : ''}{costPriceDisplay.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                              </span>
                              <span style={{ opacity: 0.85, color: 'var(--text-light)', fontSize: '10px' }}>
                                Güncel: {displayCurrency === 'USD' ? '$' : displayCurrency === 'EUR' ? '€' : ''}{currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                              </span>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatMoney(totalValue)}</span>
                      <span style={{ fontSize: '11px', color: assetPL >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {assetPL >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {assetPLPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        className="btn-card-action add"
                        onClick={() => handleOpenAddAssetModal(asset)}
                        title="Bu Varlığa Ekle (Ortalama Maliyet Hesapla)"
                        style={{ padding: '4px' }}
                      >
                        <Plus size={14} />
                      </button>
                      <button 
                        className="btn-card-action delete"
                        onClick={() => onDeleteAsset(asset.id)}
                        title="Varlığı Sil"
                        style={{ padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Allocation */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Portföy Dağılımı</h3>
          {renderAllocationDonut()}
        </div>
      </div>

      {/* Cash Flow Section */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Gelir / Gider Defteri & Gelecek Planlama</h3>
          
          {/* Month & Year Navigation Filters */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '8px' }}
            >
              {monthsTr.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '8px' }}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Monthly Ledger Layout */}
        <div className="journal-split-layout">
          {/* Left: Add Income/Expense */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '16px' }}>Yeni Gelir/Gider Kaydet</h4>
            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label>İşlem Türü</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${txType === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setTxType('expense'); setTxCategory('food'); }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Gider
                  </button>
                  <button
                    type="button"
                    className={`btn ${txType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setTxType('income'); setTxCategory('income'); }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Gelir
                  </button>
                </div>
              </div>

              {txType === 'expense' && (
                <div className="form-group">
                  <label>Gider Kategorisi</label>
                  <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                    <option value="food">Gıda / Market</option>
                    <option value="rent">Kira / Ev</option>
                    <option value="transport">Ulaşım / Araç</option>
                    <option value="bills">Faturalar</option>
                    <option value="installments">Taksitler</option>
                    <option value="investment">Yatırım</option>
                    <option value="general">Diğer Giderler</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Miktar (TL)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={txAmount} 
                  onChange={(e) => setTxAmount(e.target.value)} 
                  required 
                  placeholder="0.00" 
                />
              </div>

              <div className="form-group">
                <label>İşlem Tarihi</label>
                <input 
                  type="date" 
                  value={txDate} 
                  onChange={(e) => setTxDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Açıklama</label>
                <input 
                  type="text" 
                  value={txDescription} 
                  onChange={(e) => setTxDescription(e.target.value)} 
                  placeholder="Örn: Ev kirası, market alışverişi..." 
                />
              </div>

              {/* Installments Option */}
              {txType === 'expense' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input 
                      type="checkbox" 
                      checked={isInstallment} 
                      onChange={(e) => setIsInstallment(e.target.checked)} 
                    />
                    Taksitli Alışveriş mi?
                  </label>
                  
                  {isInstallment && (
                    <div className="form-group">
                      <label>Taksit Sayısı (Ay)</label>
                      <select 
                        value={installmentsCount} 
                        onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                      >
                        {[2, 3, 4, 5, 6, 9, 12].map(num => (
                          <option key={num} value={num}>{num} Taksit (Aylık {(txAmount / num).toFixed(1)} TL)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: '6px' }}>
                Kaydet
              </button>
            </form>
          </div>

          {/* Right: Cash flow ledger transactions list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
              <span>{monthsTr[selectedMonth]} {selectedYear} Hesap Hareketleri</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{filteredTxs.length} İşlem</span>
            </h4>

            {filteredTxs.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '220px' }}>
                <Calendar style={{ width: '40px', height: '40px' }} />
                <h3>Hareket Yok</h3>
                <p>Bu ay için henüz herhangi bir gelir/gider veya taksit kaydı bulunmamaktadır.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredTxs.map(tx => (
                  <div key={tx.id} className="routine-card glass-card" style={{ minHeight: 'auto', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="routine-icon-box" style={{ width: '30px', height: '30px', borderRadius: '6px', fontSize: '11px', background: tx.type === 'income' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                        {getCategoryIcon(tx.category)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>
                          {tx.description || getCategoryLabel(tx.category)}
                        </h4>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(tx.transaction_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: tx.type === 'income' ? 'var(--success)' : 'var(--text-main)' }}>
                        {hideBalances ? '****' : `${tx.type === 'income' ? '+' : '-'}${parseFloat(tx.amount).toLocaleString('tr-TR')} TL`}
                      </span>
                      <button
                        className="btn-card-action delete"
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="İşlemi Sil"
                        style={{ padding: '2px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category Expenses Charts */}
            {Object.keys(categoryExpenses).length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '10px' }}>
                <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Harcama Dağılımı
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(categoryExpenses).map(([cat, val]) => {
                    const percent = Math.round((val / monthlyExpense) * 100);
                    return (
                      <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                          <span>{getCategoryLabel(cat)}</span>
                          <span>{hideBalances ? '****' : `${val.toLocaleString('tr-TR')} TL`} ({percent}%)</span>
                        </div>
                        <div className="progress-bar-track" style={{ height: '5px' }}>
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: `${percent}%`, 
                              backgroundColor: cat === 'installments' ? '#fb923c' : 'var(--primary)' 
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset Creation/Management Modal */}
      {isAssetModalOpen && (
        <div className="modal-backdrop open">
          <div className="modal glass-card" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>{isAddingToAsset ? `${isAddingToAsset.ticker} Alım Yap / Ekle` : 'Portföye Varlık Ekle'}</h2>
              <button className="btn-close" onClick={() => setIsAssetModalOpen(false)}>
                <X />
              </button>
            </div>
            
            <form onSubmit={handleAssetSubmit} className="modal-form">
              <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '24px' }}>
                <div className="form-group">
                  <label>Varlık Türü</label>
                  <select 
                    value={assetType} 
                    disabled={!!isAddingToAsset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssetType(val);
                      if (val === 'gold') setTicker('GRAM_GOLD');
                      else if (val === 'stock') setTicker('THYAO');
                      else if (val === 'crypto') setTicker('BTC');
                      else if (val === 'fund') setTicker('MAC');
                      else setTicker('USD');
                    }}
                  >
                    <option value="gold">Altın / Değerli Metal</option>
                    <option value="stock">Hisse Senedi (BIST)</option>
                    <option value="crypto">Kripto Para</option>
                    <option value="fund">Yatırım Fonu (TEFAS)</option>
                    <option value="cash">Nakit Döviz</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Varlık Kodu / Ticker</label>
                  {assetType === 'gold' ? (
                    <select value={ticker} disabled={!!isAddingToAsset} onChange={(e) => setTicker(e.target.value)}>
                      <option value="GRAM_GOLD">Gram Altın (GRAM_GOLD)</option>
                      <option value="CEYREK_GOLD">Çeyrek Altın (CEYREK_GOLD)</option>
                      <option value="ONS_GOLD">Ons Altın (ONS_GOLD)</option>
                    </select>
                  ) : assetType === 'cash' ? (
                    <select value={ticker} disabled={!!isAddingToAsset} onChange={(e) => setTicker(e.target.value)}>
                      <option value="USD">Amerikan Doları (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={ticker} 
                      disabled={!!isAddingToAsset}
                      onChange={(e) => setTicker(e.target.value)} 
                      required 
                      placeholder={assetType === 'stock' ? 'Örn: THYAO, ASELS, SASA' : assetType === 'fund' ? 'Örn: MAC, TCD, TI1' : 'Örn: BTC, ETH, SOL'}
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>Miktar (Adet / Gram)</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    required 
                    placeholder="0.00" 
                  />
                </div>

                <div className="form-group">
                  <label>Alış Maliyeti (Birim Başına)</label>
                  <input 
                    type="number" 
                    step="0.00000001" 
                    value={costPrice} 
                    onChange={(e) => setCostPrice(e.target.value)} 
                    required 
                    placeholder="0.00" 
                  />
                </div>

                <div className="form-group">
                  <label>Maliyet Para Birimi</label>
                  <select value={assetCurrency} disabled={!!isAddingToAsset} onChange={(e) => setAssetCurrency(e.target.value)}>
                    <option value="TRY">TL (TRY)</option>
                    <option value="USD">Dolar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAssetModalOpen(false)}>Vazgeç</button>
                <button type="submit" className="btn btn-primary">{isAddingToAsset ? 'Alım Yap' : 'Portföye Ekle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
