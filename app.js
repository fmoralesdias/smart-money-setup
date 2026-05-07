const API_KEY = '94448122c0624ccc858c8ad83a317940';
const API_BASE = 'https://api.twelvedata.com';

const TD_SYMBOLS = {
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  XAUUSD: 'XAU/USD',
  USDJPY: 'USD/JPY',
  GBPJPY: 'GBP/JPY',
};

let cp = 'EURUSD', ctf = 'H1';
let lastUpdate = null;

/* ── Helpers ── */
function fp(v) {
  if (!v && v !== 0) return '—';
  if (cp === 'XAUUSD') return v.toFixed(2);
  if (cp === 'USDJPY' || cp === 'GBPJPY') return v.toFixed(3);
  return v.toFixed(5);
}
function fp_pair(v, pair) {
  if (!v && v !== 0) return '—';
  if (pair === 'XAUUSD') return v.toFixed(2);
  if (pair === 'USDJPY' || pair === 'GBPJPY') return v.toFixed(3);
  return v.toFixed(5);
}

function setPair(p) {
  cp = p;
  document.querySelectorAll('.pair-btn').forEach(b => b.classList.toggle('active', b.dataset.pair === p));
  render();
}
function setTF(t) {
  ctf = t;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === t));
  render();
}
function refresh() {
  fetchAllPrices();
}

/* ── Live status badge ── */
function setLiveStatus(state) {
  const el = document.getElementById('liveStatus');
  if (!el) return;
  if (state === 'live') {
    const t = lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '—';
    el.innerHTML = `<span class="live-dot live-on"></span> Ao vivo · ${t}`;
    el.className = 'live-badge live-ok';
  } else if (state === 'loading') {
    el.innerHTML = `<span class="live-dot live-pulse"></span> Atualizando...`;
    el.className = 'live-badge live-load';
  } else {
    el.innerHTML = `<span class="live-dot live-off"></span> Offline · dados simulados`;
    el.className = 'live-badge live-err';
  }
}

/* ── Twelve Data: busca todos os pares ── */
async function fetchAllPrices() {
  setLiveStatus('loading');
  const symbols = Object.values(TD_SYMBOLS).join(',');
  try {
    const res = await fetch(`${API_BASE}/price?symbol=${encodeURIComponent(symbols)}&apikey=${API_KEY}`);
    const json = await res.json();
    let updated = false;
    Object.entries(TD_SYMBOLS).forEach(([pair, sym]) => {
      const entry = json[sym];
      if (entry && entry.price) {
        const raw = parseFloat(entry.price);
        const dec = pair === 'XAUUSD' ? 2 : (pair === 'USDJPY' || pair === 'GBPJPY' ? 3 : 5);
        PAIRS[pair].price = parseFloat(raw.toFixed(dec));
        recalcLevels(pair);
        updated = true;
      }
    });
    if (updated) {
      lastUpdate = new Date();
      setLiveStatus('live');
    } else {
      setLiveStatus('error');
    }
  } catch (e) {
    setLiveStatus('error');
  }
  render();
}

/* ── Recalcula níveis relativos ao preço ao vivo ── */
function recalcLevels(pair) {
  const d = PAIRS[pair];
  const p = d.price;
  let swing;
  if (pair === 'XAUUSD') swing = p * 0.025;
  else if (pair === 'USDJPY' || pair === 'GBPJPY') swing = p * 0.012;
  else swing = p * 0.008;

  const hi = p + swing * 0.6;
  const lo = p - swing * 0.4;
  const range = hi - lo;
  const dec = pair === 'XAUUSD' ? 2 : (pair === 'USDJPY' || pair === 'GBPJPY' ? 3 : 5);

  d.fibs = [
    parseFloat((lo + range * 1.0).toFixed(dec)),
    parseFloat((lo + range * 0.786).toFixed(dec)),
    parseFloat((lo + range * 0.618).toFixed(dec)),
    p,
    parseFloat((lo + range * 0.382).toFixed(dec)),
    parseFloat((lo + range * 0.236).toFixed(dec)),
    parseFloat((lo + range * 0.0).toFixed(dec)),
  ];
  d.resistances = [d.fibs[2], d.fibs[1]];
  d.supports    = [d.fibs[4], d.fibs[5]];

  d.poc = parseFloat((p - swing * 0.05).toFixed(dec));
  d.vah = parseFloat((p + swing * 0.25).toFixed(dec));
  d.val = parseFloat((p - swing * 0.30).toFixed(dec));

  d.ema20  = parseFloat((p * 0.9994).toFixed(dec));
  d.ema50  = parseFloat((p * 0.9975).toFixed(dec));
  d.ema200 = parseFloat((p * 0.9870).toFixed(dec));

  d.vpLevels = [
    {p: d.fibs[0], v: 18},
    {p: d.fibs[1], v: 35},
    {p: d.fibs[2], v: 62},
    {p: d.price,   v: 55, cur: true},
    {p: d.poc,     v: 100, poc: true},
    {p: d.fibs[4], v: 78},
    {p: d.fibs[5], v: 42},
    {p: d.fibs[6], v: 20},
  ];

  const e = d.entry;
  if (e.dir !== 'AGUARDAR') {
    const pipMult = (pair === 'XAUUSD') ? 1 : (pair === 'USDJPY' || pair === 'GBPJPY') ? 100 : 10000;
    if (e.dir === 'COMPRA') {
      e.zone = `${fp_pair(d.fibs[4], pair)}–${fp_pair(d.poc, pair)}`;
      e.sl = d.fibs[5]; e.tp1 = d.fibs[2]; e.tp2 = d.fibs[1]; e.tp3 = d.fibs[0];
    } else {
      e.zone = `${fp_pair(d.poc, pair)}–${fp_pair(d.fibs[2], pair)}`;
      e.sl = d.fibs[1]; e.tp1 = d.fibs[4]; e.tp2 = d.fibs[5]; e.tp3 = d.fibs[6];
    }
    d.pips_sl  = Math.abs(Math.round((p - e.sl)  * pipMult));
    d.pips_tp1 = Math.abs(Math.round((e.tp1 - p) * pipMult));
    d.pips_tp2 = Math.abs(Math.round((e.tp2 - p) * pipMult));
    d.pips_tp3 = Math.abs(Math.round((e.tp3 - p) * pipMult));
  }
}

/* ── Clock & Sessions ── */
function updateClock() {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2,'0');
  const m = String(now.getUTCMinutes()).padStart(2,'0');
  const s = String(now.getUTCSeconds()).padStart(2,'0');
  const el = document.getElementById('clock');
  if (el) el.textContent = `UTC ${h}:${m}:${s}`;
}
function getActiveSessions() {
  const h = new Date().getUTCHours();
  const active = [];
  if (h >= 22 || h < 7) active.push('Sydney');
  if (h >= 0 && h < 9) active.push('Tóquio');
  if (h >= 7 && h < 16) active.push('Londres');
  if (h >= 12 && h < 21) active.push('NY');
  return active;
}
function renderSessions() {
  const active = getActiveSessions();
  const all = ['Sydney','Tóquio','Londres','NY'];
  document.getElementById('sessionPills').innerHTML = all.map(s =>
    `<span class="session-pill ${active.includes(s)?'on':'off'}">${s}</span>`
  ).join('');
}

/* ── Controls ── */
function renderControls() {
  document.getElementById('pairGroup').innerHTML = Object.keys(PAIRS).map(p =>
    `<button class="pair-btn${p===cp?' active':''}" data-pair="${p}" onclick="setPair('${p}')">${p}</button>`
  ).join('');
  const tfs = ['M15','H1','H4','D1'];
  document.getElementById('tfGroup').innerHTML = `<span class="tf-separator"></span>` + tfs.map(t =>
    `<button class="tf-btn${t===ctf?' active':''}" data-tf="${t}" onclick="setTF('${t}')">${t}</button>`
  ).join('');
}

/* ── Alert ── */
function renderAlert(d) {
  const msgs = {
    bull: `<span class="alert-icon">▲</span> <strong>Viés institucional: ALTA</strong> — Confluências apontam posicionamento comprador. Aguardar reteste da zona de demanda.`,
    bear: `<span class="alert-icon">▼</span> <strong>Viés institucional: BAIXA</strong> — Estrutura distributiva detectada. Pullback até resistência = oportunidade de venda.`,
    neut: `<span class="alert-icon">◆</span> <strong>Aguardar confirmação</strong> — Mercado em consolidação. Confluência insuficiente. Não operar sem confirmação.`,
  };
  const cls = { bull: 'alert-bull', bear: 'alert-bear', neut: 'alert-neut' };
  document.getElementById('alertBanner').innerHTML =
    `<div class="alert-box ${cls[d.bias]}">${msgs[d.bias]}</div>`;
}

/* ── Metrics ── */
function renderMetrics(d) {
  const bc = d.bias==='bull'?'mv-bull':d.bias==='bear'?'mv-bear':'mv-neut';
  const vc = d.volSign==='bull'?'mv-bull':d.volSign==='bear'?'mv-bear':'mv-neut';
  const rc = d.rsi>60?'mv-bull':d.rsi<40?'mv-bear':'mv-neut';
  const wL = {A:'Fase A',B:'Fase B',C:'Fase C',D:'Fase D',E:'Fase E'};
  document.getElementById('metricsGrid').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Preço / Spread</div>
      <div class="metric-val mv-white">${fp(d.price)}</div>
      <div class="metric-sub">Spread: ${d.spread} pip</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Viés ${ctf}</div>
      <div class="metric-val ${bc}">${d.bias==='bull'?'▲ Alta':d.bias==='bear'?'▼ Baixa':'◆ Lateral'}</div>
      <div class="metric-sub">${d.trend}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">ATR (pip)</div>
      <div class="metric-val ${vc}">${d.atr}</div>
      <div class="metric-sub">Volume: ${d.vol}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">RSI (14)</div>
      <div class="metric-val ${rc}">${d.rsi}</div>
      <div class="metric-sub">${d.rsi>70?'Sobrecomprado':d.rsi<30?'Sobrevendido':d.rsi>55?'Força compradora':d.rsi<45?'Pressão vendedora':'Neutro'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Wyckoff</div>
      <div class="metric-val mv-white" style="font-size:14px">${wL[d.wyckoffPhase]}</div>
      <div class="metric-sub">${d.wyckoffLabel}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Confluências</div>
      <div class="metric-val ${d.confluence>=6?'mv-bull':d.confluence>=4?'mv-neut':'mv-bear'}">${d.confluence}/8</div>
      <div class="metric-sub">${d.confluence>=6?'Setup válido':d.confluence>=4?'Parcial':'Não operar'}</div>
    </div>`;
}

/* ── Chart ── */
function drawChart(d) {
  const canvas = document.getElementById('mainChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const allL = [...d.supports,...d.resistances,d.ema20,d.ema50,d.ema200,d.poc,d.vah,d.val,d.price];
  const mn = Math.min(...allL)*0.9994, mx = Math.max(...allL)*1.0006;
  const pad = {l:72,r:16,t:14,b:20};
  const cH = H-pad.t-pad.b;
  function toY(p){return pad.t+cH-((p-mn)/(mx-mn))*cH}
  ctx.fillStyle='#111111'; ctx.fillRect(0,0,W,H);
  for(let i=0;i<=5;i++){
    const y=pad.t+(i/5)*cH;
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    const pv=mx-(i/5)*(mx-mn);
    ctx.fillStyle='#4a4845'; ctx.font='10px "Space Mono",monospace'; ctx.textAlign='right';
    ctx.fillText(fp(pv),pad.l-5,y+3);
  }
  const lines=[
    [d.vah,'#a78bfa',1,[3,3],'VAH'],[d.val,'#60a5fa',1,[3,3],'VAL'],
    ...d.supports.map(s=>[s,'#3de89a',1,[4,3],'S']),
    ...d.resistances.map(r=>[r,'#ff5c3e',1,[4,3],'R']),
    [d.ema200,'#7f77dd',1.5,[],'EMA200'],[d.ema50,'#378add',1.5,[],'EMA50'],
    [d.ema20,'#ef9f27',1.5,[],'EMA20'],[d.poc,'#f5c842',2,[],'POC'],
  ];
  lines.forEach(([v,c,lw,dash,lbl])=>{
    const y=toY(v);
    ctx.strokeStyle=c; ctx.lineWidth=lw; ctx.setLineDash(dash||[]);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=c; ctx.font='10px "Space Mono",monospace'; ctx.textAlign='left';
    ctx.fillText(lbl+' '+fp(v),pad.l+5,y-3);
  });
  const py=toY(d.price);
  ctx.strokeStyle='#c8f542'; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(pad.l,py); ctx.lineTo(W-pad.r,py); ctx.stroke();
  ctx.fillStyle='#c8f542'; ctx.fillRect(W-pad.r-68,py-10,66,18);
  ctx.fillStyle='#0a0a0a'; ctx.font='bold 11px "Space Mono",monospace'; ctx.textAlign='center';
  ctx.fillText(fp(d.price),W-pad.r-35,py+3);
  document.getElementById('chartLegend').innerHTML=[
    ['EMA20','#ef9f27'],['EMA50','#378add'],['EMA200','#7f77dd'],
    ['POC','#f5c842'],['VAH','#a78bfa'],['VAL','#60a5fa'],
    ['Suporte','#3de89a'],['Resistência','#ff5c3e'],['Preço','#c8f542']
  ].map(([l,c])=>`<span class="legend-item"><span class="legend-dot" style="background:${c}"></span>${l}</span>`).join('');
  document.getElementById('chartBadge').textContent=cp+' · '+ctf;
  document.getElementById('chartBadge').className='card-badge '+(d.bias==='bull'?'badge-bull':d.bias==='bear'?'badge-bear':'badge-neut');
}

/* ── Volume Profile ── */
function renderVolumeProfile(d) {
  const maxV=Math.max(...d.vpLevels.map(l=>l.v));
  const rows=d.vpLevels.map(l=>{
    const w=Math.round((l.v/maxV)*100);
    const isPoc=l.poc;
    const isVAH=Math.abs(l.p-d.vah)<0.5||Math.abs(l.p-d.vah)<0.002;
    const isVAL=Math.abs(l.p-d.val)<0.5||Math.abs(l.p-d.val)<0.002;
    const col=isPoc?'#f5c842':l.p>d.poc?'#3de89a':'#ff5c3e';
    const tag=isPoc?'<span class="vp-tag tag-poc">POC</span>':isVAH?'<span class="vp-tag tag-vah">VAH</span>':isVAL?'<span class="vp-tag tag-val">VAL</span>':l.cur?'<span class="vp-tag tag-cur">←</span>':'';
    return `<div class="vp-row"><span class="vp-price">${fp(l.p)}</span><div class="vp-bar-outer"><div class="vp-bar-inner" style="width:${w}%;background:${col}"></div></div>${tag}</div>`;
  }).join('');
  document.getElementById('vpContent').innerHTML=`
    <div class="vp-summary">
      <div class="vp-stat"><div class="vp-stat-label">POC</div><div class="vp-stat-val" style="color:#f5c842">${fp(d.poc)}</div></div>
      <div class="vp-stat"><div class="vp-stat-label">VAH</div><div class="vp-stat-val" style="color:#a78bfa">${fp(d.vah)}</div></div>
      <div class="vp-stat"><div class="vp-stat-label">VAL</div><div class="vp-stat-val" style="color:#60a5fa">${fp(d.val)}</div></div>
    </div>${rows}
    <div style="margin-top:10px;padding:8px 12px;background:#1a1a1a;border-radius:4px;font-size:11px;color:#8a8780;line-height:1.6;border-left:2px solid #f5c842">
      Preço ${d.price>d.poc?'acima':'abaixo'} do POC (${fp(d.poc)}) — viés ${d.price>d.poc?'comprador':'vendedor'}.
      ${d.price>d.poc?'Pullback ao POC = oportunidade de compra.':'Rali ao POC = oportunidade de venda.'}
    </div>`;
}

/* ── Hierarchy ── */
function renderHierarchy(d) {
  const hier=[
    {color:'#a78bfa',bg:'rgba(167,139,250,0.12)',name:'Volume Profile',desc:`POC em ${fp(d.poc)} — preço ${d.price>d.poc?'acima':'abaixo'} do POC. Viés ${d.price>d.poc?'comprador confirmado':'vendedor confirmado'}.`},
    {color:'#60a5fa',bg:'rgba(96,165,250,0.12)',name:'Elliott Wave',desc:`Onda ${d.elliottWave} ${d.elliottImpulse?'de impulso':'corretiva'}. ${d.elliottDesc.split('.')[0]}.`},
    {color:'#f5a623',bg:'rgba(245,166,35,0.12)',name:'Wyckoff',desc:`Fase ${d.wyckoffPhase} — ${d.wyckoffLabel}. Define o momento do ciclo institucional.`},
    {color:'#3de89a',bg:'rgba(61,232,154,0.12)',name:'Fibonacci + S/R',desc:`Zona de entrada: ${d.entry.zone}. Confluência com nível chave de retração.`},
  ];
  const confDots=Array(8).fill(0).map((_,i)=>{
    const c=i<d.confluence?(d.bias==='bull'?'on-bull':d.bias==='bear'?'on-bear':'on-neut'):'';
    return `<div class="conf-dot ${c}"></div>`;
  }).join('');
  document.getElementById('confIndicator').innerHTML=confDots;
  document.getElementById('hierarchyContent').innerHTML=hier.map((h,i)=>`
    <div class="hier-step">
      <div class="hier-num" style="background:${h.bg};color:${h.color}">${i+1}</div>
      <div class="hier-body"><div class="hier-name" style="color:${h.color}">${h.name}</div><div class="hier-desc">${h.desc}</div></div>
    </div>`).join('')+
    `<div style="margin-top:10px;padding:8px 12px;background:#1a1a1a;border-radius:4px;font-size:11px;color:#8a8780">
      <strong style="color:#f0ede8">${d.confluence}/8 confluências</strong> — ${d.confluence>=6?'Setup institucional válido.':d.confluence>=4?'Aguardar mais confirmação.':'Confluência insuficiente.'}
    </div>`;
}

/* ── Elliott ── */
function renderElliott(d) {
  const bars=d.elliottHeights.map((h,i)=>{
    const isActive=i===d.elliottCurrent;
    const col=d.elliottColors[i];
    return `<div class="wave-bar-wrap"><div class="wave-lbl" style="color:${isActive?col:'#4a4845'}">${d.elliottLabels[i]}</div><div class="wave-bar" style="height:${h}px;background:${isActive?col:col+'30'}"></div><div class="wave-cur">${isActive?'●':''}</div></div>`;
  }).join('');
  document.getElementById('elliottBadge').textContent=`Onda ${d.elliottWave} · ${d.elliottImpulse?'Impulso':'Corretivo'}`;
  document.getElementById('elliottBadge').className='card-badge '+(d.bias==='bull'?'badge-bull':d.bias==='bear'?'badge-bear':'badge-neut');
  document.getElementById('elliottContent').innerHTML=`<div class="wave-chart">${bars}</div><div class="wave-desc">${d.elliottDesc}</div><div class="wave-next"><strong>Próximo movimento:</strong> ${d.correctiveDesc}</div>`;
}

/* ── Entry ── */
function renderEntry(d) {
  const e=d.entry;
  const card=document.getElementById('entryCard');
  if(e.dir==='AGUARDAR'){
    document.getElementById('entryDirBadge').textContent='— aguardar';
    document.getElementById('entryDirBadge').className='card-badge badge-neut';
    document.getElementById('entryContent').innerHTML='<div class="entry-await">◆ Sem setup válido.<br>Aguardar rompimento com volume<br>ou conclusão da onda Elliott.</div>';
    card.style.borderColor=''; return;
  }
  const isBull=e.dir==='COMPRA';
  const dc=isBull?'#3de89a':'#ff5c3e';
  const bg=isBull?'rgba(61,232,154,0.06)':'rgba(255,92,62,0.06)';
  const rrW=Math.min(100,(e.rr/4)*100).toFixed(0);
  document.getElementById('entryDirBadge').textContent=e.dir;
  document.getElementById('entryDirBadge').className='card-badge '+(isBull?'badge-bull':'badge-bear');
  card.style.borderColor=dc+'40';
  document.getElementById('entryContent').innerHTML=`
    <div class="entry-dir-row" style="background:${bg}">
      <div><div class="entry-dir-label" style="color:${dc}">${e.dir}</div><div class="entry-zone">Zona: ${e.zone}</div></div>
      <div class="rr-box"><div class="rr-val" style="color:${dc}">1:${e.rr.toFixed(1)}</div><div class="rr-lbl">risco/retorno</div></div>
    </div>
    <div class="rr-bar"><div class="rr-fill" style="width:${rrW}%;background:${dc}"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#4a4845;margin-bottom:12px;font-family:'Space Mono',monospace"><span>1:0</span><span>mín 1:2</span><span>1:4</span></div>
    <div class="sl-row"><span class="sl-label">Stop Loss</span><span class="sl-val">${fp(e.sl)}<span class="sl-pip">${d.pips_sl}p</span></span></div>
    ${[[e.tp1,d.pips_tp1,'50%'],[e.tp2,d.pips_tp2,'30%'],[e.tp3,d.pips_tp3,'20%']].map(([tp,pip,pct],i)=>`
    <div class="tp-row"><span class="tp-label">TP${i+1} — fechar ${pct}</span><span class="tp-val">${fp(tp)}<span class="tp-pip">+${pip}p</span></span></div>`).join('')}
    <div class="entry-rule"><strong>Regra de ouro:</strong> Entre apenas no reteste da zona com candle de confirmação (engolfo ou pin bar). Mova SL para breakeven ao atingir TP1. Máximo 1–2% do capital por trade.</div>`;
}

/* ── Zones ── */
function renderZones(d) {
  const tC={res:'#ff5c3e',fib:'#60a5fa',sup:'#3de89a',cur:'#8a8780'};
  const tL={res:'Resistência',fib:'Fibonacci',sup:'Suporte',cur:'Preço atual'};
  const items=d.fibs.map((f,i)=>{
    const t=d.fibTypes[i]||'fib';
    return `<div class="zone-item${t==='cur'?' is-price':''}"><div class="zone-type zt-${t}">${tL[t]}</div><div class="zone-name">${d.fibLabels[i]}</div><div class="zone-price" style="color:${tC[t]}">${fp(f)}</div></div>`;
  });
  items.push(`<div class="zone-item"><div class="zone-type zt-poc">Volume POC</div><div class="zone-name">Point of Control</div><div class="zone-price" style="color:#f5c842">${fp(d.poc)}</div></div>`);
  document.getElementById('zonesContent').innerHTML=`<div class="zones-grid">${items.join('')}</div>`;
}

/* ── Master render ── */
function render() {
  const d=PAIRS[cp];
  renderSessions(); renderAlert(d); renderMetrics(d);
  drawChart(d); renderVolumeProfile(d); renderHierarchy(d);
  renderElliott(d); renderEntry(d); renderZones(d);
}

/* ── Init ── */
renderControls();

/* Badge de status ao vivo */
const headerRight = document.querySelector('.header-right');
if (headerRight) {
  const badge = document.createElement('div');
  badge.id = 'liveStatus';
  badge.className = 'live-badge live-load';
  badge.innerHTML = '<span class="live-dot live-pulse"></span> Conectando...';
  headerRight.appendChild(badge);
}

/* Estilos do badge */
const liveStyle = document.createElement('style');
liveStyle.textContent = `
  .live-badge{display:flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:10px;padding:3px 10px;border-radius:2px;font-weight:700;letter-spacing:.06em}
  .live-ok{background:rgba(61,232,154,.12);color:#3de89a;border:1px solid rgba(61,232,154,.3)}
  .live-load{background:rgba(245,166,35,.12);color:#f5a623;border:1px solid rgba(245,166,35,.3)}
  .live-err{background:rgba(255,92,62,.12);color:#ff5c3e;border:1px solid rgba(255,92,62,.3)}
  .live-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .live-on{background:#3de89a}.live-off{background:#ff5c3e}
  @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.3}}
  .live-pulse{background:#f5a623;animation:livePulse 1s ease-in-out infinite}
`;
document.head.appendChild(liveStyle);

/* Busca preços ao vivo na carga inicial */
fetchAllPrices();

/* Auto-refresh a cada 30 segundos */
setInterval(fetchAllPrices, 30000);

setInterval(updateClock, 1000);
updateClock();
