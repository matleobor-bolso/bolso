"use strict";
/* ============ Utilidades ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const BRL = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const money = v => BRL.format(Math.round(v*100)/100);
const pad = n => String(n).padStart(2,"0");
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const ymOf = d => d.slice(0,7);
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MES3 = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function ymAdd(ym, n){ let [y,m]=ym.split("-").map(Number); m+=n; while(m>12){m-=12;y++} while(m<1){m+=12;y--} return `${y}-${pad(m)}`; }
function daysIn(y,m){ return new Date(y,m,0).getDate(); }
function dateAddMonths(ds, n, keepDay){ const [y,m,d]=ds.split("-").map(Number); const t=ymAdd(`${y}-${pad(m)}`,n); const [ny,nm]=t.split("-").map(Number); const dd=Math.min(keepDay||d, daysIn(ny,nm)); return `${t}-${pad(dd)}`; }
function ymLabel(ym){ const [y,m]=ym.split("-").map(Number); const cur=new Date().getFullYear(); return MESES[m-1] + (y!==cur?` ${y}`:""); }
function dayLabel(ds){ const [y,m,d]=ds.split("-").map(Number); const dt=new Date(y,m-1,d); const w=dt.toLocaleDateString("pt-BR",{weekday:"long"}); const t=todayStr(); if(ds===t) return "Hoje"; return `${w.charAt(0).toUpperCase()+w.slice(1)}, ${d} de ${MESES[m-1]}`; }
function parseMoney(s){ s=String(s||"").trim().replace(/[R$\s]/g,""); if(!s) return NaN; if(s.includes(",")) s=s.replace(/\./g,"").replace(",","."); else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,""); return Math.round(parseFloat(s)*100)/100; }
function fmtInput(v){ if(!(v||v===0)) return ""; const neg = v<0; const [i,d] = Math.abs(v).toFixed(2).split("."); return (neg?"-":"")+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d; }
/* Campos de valor com a vírgula fixa (como no Organizze): digitar 9 → 0,09; 98 → 0,98; 980 → 9,80.
   Vale para todo <input inputmode="numeric|decimal"> com data-money. Apagar tudo deixa o campo vazio. */
function maskMoney(inp){
  const neg = inp.value.includes("-"); const dig = inp.value.replace(/\D/g,"").replace(/^0+/,"");
  inp.value = dig ? fmtInput((neg?-1:1)*Number(dig)/100) : (neg?"-":"");
  try{ const n = inp.value.length; inp.setSelectionRange(n, n); }catch(e){}
}
document.addEventListener("input", e=>{ const t = e.target; if(t && t.matches && t.matches("input[data-money]")) maskMoney(t); }, true); // captura: formata antes de outros ouvintes lerem o valor
document.addEventListener("focusin", e=>{ const t = e.target; if(t && t.matches && t.matches("input[data-money]")) setTimeout(()=>{ try{ const n=t.value.length; t.setSelectionRange(n,n); }catch(_){} }, 0); });
let toastT; function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2600); }

/* ============ Estado ============ */
const PALETTE_EMOJI = ["🍽️","🛒","🏠","🚗","⛽","💊","🎓","🎉","🛍️","📺","💡","📱","🧾","✈️","🐶","👶","🎁","💪","☕","🍺","🔧","💼","💰","📈","↩️","🏦","💳","🧘","📚","🎮","🧴","❓"];
function defaultConfig(){
  const c = (name,kind,icon)=>({id:newId(),name,kind,icon});
  return {
    version:1,
    accounts:[{id:newId(),name:"Conta corrente",type:"corrente",initial:0,icon:"🏦"},{id:newId(),name:"Carteira",type:"dinheiro",initial:0,icon:"👛"}],
    cards:[],
    categories:[
      c("Alimentação","exp","🍽️"),c("Mercado","exp","🛒"),c("Moradia","exp","🏠"),c("Transporte","exp","🚗"),
      c("Saúde","exp","💊"),c("Educação","exp","🎓"),c("Lazer","exp","🎉"),c("Compras","exp","🛍️"),
      c("Assinaturas","exp","📺"),c("Contas da casa","exp","💡"),c("Impostos e taxas","exp","🧾"),c("Viagem","exp","✈️"),c("Outros","exp","❓"),
      c("Salário","inc","💼"),c("Receita PJ","inc","💰"),c("Investimentos","inc","📈"),c("Reembolso","inc","↩️"),c("Outras receitas","inc","🎁")
    ],
    budgets:{},
    invoicePaid:{}
  };
}
const S = { cfg:null, months:{}, month: ymOf(todayStr()), tab:"home", txFilter:"all", txSearch:"", fAcc:new Set(), fCat:new Set(), fRec:new Set(), cardSel:null, cardInv:null, reportTable:false, ready:false, live:false };

/* ============ Consultas ============ */
const acc = id => S.cfg.accounts.find(a=>a.id===id);
const card = id => S.cfg.cards.find(c=>c.id===id);
const cat = id => S.cfg.categories.find(c=>c.id===id);
function allItems(){ const out=[]; for(const ym in S.months) for(const it of S.months[ym]) out.push(it); return out; }
function monthItems(ym){ return (S.months[ym]||[]).slice(); }

function invoiceKey(dateStr, c, inv){
  if(inv) return inv;
  let [y,m,d] = dateStr.split("-").map(Number);
  let key = `${y}-${pad(m)}`;
  if(d >= c.closeDay) key = ymAdd(key,1);          // compra no dia do fechamento ou depois vai p/ a próxima
  if(c.dueDay <= c.closeDay) key = ymAdd(key,1);   // vencimento no mês seguinte ao fechamento
  return key;                                       // fatura identificada pelo mês de vencimento
}
function invoiceDates(key, c){
  const closeYm = c.dueDay <= c.closeDay ? ymAdd(key,-1) : key;
  const [cy,cm] = closeYm.split("-").map(Number); const [dy,dm] = key.split("-").map(Number);
  return { close:`${closeYm}-${pad(Math.min(c.closeDay,daysIn(cy,cm)))}`, due:`${key}-${pad(Math.min(c.dueDay,daysIn(dy,dm)))}` };
}
function invoiceItems(cardId, key){ const c=card(cardId); if(!c) return []; return allItems().filter(i=>i.cardId===cardId && invoiceKey(i.date,c,i.inv)===key).sort((a,b)=>a.date<b.date?-1:1); }
function invoiceTotal(cardId,key){ return invoiceItems(cardId,key).reduce((s,i)=>s+(i.type==="exp"?i.amount:-i.amount),0); }
function invoiceStatus(cardId,key){
  const p = S.cfg.invoicePaid[cardId+"|"+key]; if(p) return {s:"paga",label:"Paga"};
  const {close} = invoiceDates(key, card(cardId));
  return todayStr() >= close ? {s:"fechada",label:"Fechada"} : {s:"aberta",label:"Aberta"};
}
function allInvoiceKeys(cardId){ const c=card(cardId); const ks=new Set(); allItems().forEach(i=>{ if(i.cardId===cardId) ks.add(invoiceKey(i.date,c,i.inv)); }); return [...ks].sort(); }
function cardUsed(cardId){ return allInvoiceKeys(cardId).filter(k=>!S.cfg.invoicePaid[cardId+"|"+k]).reduce((s,k)=>s+invoiceTotal(cardId,k),0); }
function currentInvoiceKey(c){ return invoiceKey(todayStr(), c); }

function accountBalance(accId, opts={}){
  const upto = opts.upto || null; const includeUnpaid = !!opts.projected;
  const a = acc(accId); let b = a ? Number(a.initial)||0 : 0;
  for(const i of allItems()){
    if(i.cardId) continue;
    if(upto && i.date > upto) continue;
    if(!i.paid && !includeUnpaid) continue;
    if((i.type==="inc" || i.type==="rend") && i.accountId===accId) b += i.amount;
    else if(i.type==="exp" && i.accountId===accId) b -= i.amount;
    else if(i.type==="tr"){ if(i.accountId===accId) b -= i.amount; if(i.toAccountId===accId) b += i.amount; }
  }
  for(const k in S.cfg.invoicePaid){ const p=S.cfg.invoicePaid[k]; if(p.accountId===accId && (!upto || p.date<=upto)) b -= p.amount; }
  if(includeUnpaid){ // faturas em aberto que vencem até a data
    for(const c of S.cfg.cards){ if(c.accountId!==accId) continue;
      for(const k of allInvoiceKeys(c.id)){ if(S.cfg.invoicePaid[c.id+"|"+k]) continue; const {due}=invoiceDates(k,c); if(!upto || due<=upto) b -= invoiceTotal(c.id,k); }
    }
  }
  return b;
}
const INV_RE = /aposent|sonho|tranquil|sazona|reserva|invest|caixinha|cofrinho|tesouro|cdb/i;
function accKind(a){ return a.kind || (INV_RE.test(a.name||"") ? "inv" : "dia"); }
const isInv = id => { const a = acc(id); return !!a && accKind(a)==="inv"; };
function totalBalance(opts, kind){ return S.cfg.accounts.filter(a=>!a.archived && (!kind || accKind(a)===kind)).reduce((s,a)=>s+accountBalance(a.id,opts),0); }
function rendIn(ym, accId){ return monthItems(ym).filter(i=>i.type==="rend" && (!accId || i.accountId===accId)).reduce((s,i)=>s+i.amount,0); }
function invFlows(ym, accId){ let ap=0, rs=0; for(const i of monthItems(ym)){ if(i.type!=="tr") continue; const toI = isInv(i.toAccountId), frI = isInv(i.accountId); if(toI && !frI && (!accId || i.toAccountId===accId)) ap+=i.amount; if(frI && !toI && (!accId || i.accountId===accId)) rs+=i.amount; } return {ap, rs}; }
function lastRend(accId){ let d=null; for(const i of allItems()) if(i.type==="rend" && i.accountId===accId && (!d || i.date>d)) d=i.date; return d; }
/* Data considerada para gastos do cartão nos totais (relatórios, limites, resumo do mês):
   "compra" (padrão, como no Organizze): parcelas contam na data da compra original;
   "parcela": cada parcela no seu mês; "fatura": no vencimento da fatura. Lançamentos fora do cartão usam a própria data. */
let dataRev = 0, effCache = null;
const CARD_MODES = [["compra","Compra"],["parcela","Parcela"],["fatura","Fatura"]];
function cardDateMode(){ const m = S.cfg && S.cfg.cardDateMode; return CARD_MODES.some(([k])=>k===m) ? m : "compra"; }
function effDate(i, mode){
  if(!i.cardId) return i.date;
  if(mode==="parcela") return i.date;
  if(mode==="fatura"){ const c = card(i.cardId); return c ? invoiceDates(invoiceKey(i.date, c, i.inv), c).due : i.date; }
  const m = /^(\d+)\/(\d+)$/.exec(i.inst || "");
  return (m && +m[1] > 1) ? dateAddMonths(i.date, -(+m[1]-1)) : i.date;
}
/* A data do cartão escolhida em Relatórios vale só para os relatórios.
   Limites e Entrou/Saiu usam sempre a data da parcela (como o Organizze). */
function effItems(ym, mode="parcela"){
  if(mode==="parcela") return monthItems(ym).filter(i=>i.type==="exp" || i.type==="inc");
  if(!effCache || effCache.rev!==dataRev || effCache.mode!==mode || effCache.months!==S.months){
    const map = {};
    for(const k in S.months) for(const i of S.months[k]){ if(i.type!=="exp" && i.type!=="inc") continue; const e = ymOf(effDate(i, mode)); (map[e] ||= []).push(i); }
    effCache = { rev:dataRev, mode, months:S.months, map };
  }
  return effCache.map[ym] || [];
}
function monthSums(ym, mode){ let inc=0,exp=0; for(const i of effItems(ym, mode)){ if(i.type==="inc") inc+=i.amount; else if(i.type==="exp") exp+=i.amount; } return {inc,exp}; }
function spentByCat(ym, mode){ const m={}; for(const i of effItems(ym, mode)) if(i.type==="exp"){ m[i.catId]=(m[i.catId]||0)+i.amount; } return m; }
function cardModeLabel(){ return {compra:"data da compra", parcela:"data da parcela", fatura:"data da fatura"}[cardDateMode()]; }
function endOfMonth(ym){ const [y,m]=ym.split("-").map(Number); return `${ym}-${pad(daysIn(y,m))}`; }

/* ============ Mutação de lançamentos ============ */
function putItem(it){ const ym=ymOf(it.date); (S.months[ym] ||= []).push(it); return ym; }
function removeItem(id){ for(const ym in S.months){ const ix=S.months[ym].findIndex(i=>i.id===id); if(ix>=0){ S.months[ym].splice(ix,1); return ym; } } return null; }
function findItem(id){ for(const ym in S.months){ const it=S.months[ym].find(i=>i.id===id); if(it) return it; } return null; }
function commit(touched){ [...new Set(touched)].filter(Boolean).forEach(saveMonth); render(); }

/* ============ Logos das instituições (imagem escolhida pelo usuário, guardada nos dados) ============ */
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const safeLogo = s => (typeof s === "string" && s.length < 200000 && LOGO_RE.test(s)) ? s : null;
function accIc(a, fb){ const l = safeLogo(a && a.logo); return l ? `<img class="instlogo" src="${l}" alt="">` : esc((a && a.icon) || fb || "🏦"); }
function cardIc(c){ const l = safeLogo(c && c.logo); return l ? `<img class="instlogo" src="${l}" alt="">` : "💳"; }
function accIcSm(a, fb){ const l = safeLogo(a && a.logo); return l ? `<img class="instlogo sm" src="${l}" alt="">` : esc((a && a.icon) || fb || "🏦"); }
function cardIcSm(c){ const l = safeLogo(c && c.logo); return l ? `<img class="instlogo sm" src="${l}" alt="">` : "💳"; }
async function fileToLogo(file){
  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((res,rej)=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    // Não corta as margens da imagem: ela entra inteira num quadrado (para caber no círculo).
    // Se não for quadrada, o espaço que sobra é preenchido com a cor do canto da própria imagem.
    const N = 160, k = Math.min(N/img.width, N/img.height);
    const w = img.width*k, h = img.height*k;
    const c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d", {willReadFrequently:true});
    g.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1); const bg = g.getImageData(0, 0, 1, 1).data; g.clearRect(0, 0, N, N);
    if(bg[3] >= 16){ g.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`; g.fillRect(0, 0, N, N); }
    g.drawImage(img, (N-w)/2, (N-h)/2, w, h);
    let out = c.toDataURL("image/webp", 0.88); if(!out.startsWith("data:image/webp")) out = c.toDataURL("image/png");
    return safeLogo(out);
  } finally { URL.revokeObjectURL(url); }
}
function logoField(logo){
  return `<div class="f"><span>Logo da instituição <span class="mut">(opcional)</span></span>
    <div class="logopick"><div class="ic">${logo?`<img class="instlogo" src="${logo}" alt="">`:"🖼️"}</div>
    <label class="btn sec sm">Escolher imagem<input type="file" accept="image/*" id="logoIn" hidden></label>
    ${logo?`<button type="button" class="btn sec sm" id="logoRm">Remover</button>`:""}</div>
    <div class="mut" style="font-size:12px;margin-top:4px">Dica: salve o ícone do app do banco (por exemplo, da página dele na Play Store) e escolha aqui.</div></div>`;
}
function bindLogoField(set){
  const inp = $("#logoIn"); if(inp) inp.onchange = async ()=>{ const f = inp.files[0]; if(!f) return; try{ const d = await fileToLogo(f); if(!d) throw 0; set(d); }catch(e){ toast("Não consegui usar essa imagem."); } };
  const rm = $("#logoRm"); if(rm) rm.onclick = ()=>set(null);
}

/* ============ Renderização ============ */
function render(){
  if(!S.ready || locked) return;
  document.body.classList.toggle("nodata", !S.cfg);
  if(!S.cfg){ $("#title").textContent = "Bolso"; $("#title").classList.remove("greet"); $("#view").innerHTML = viewWelcome(); return; }
  document.querySelectorAll("nav.tabs button[data-tab]").forEach(b=>b.classList.toggle("on", b.dataset.tab===S.tab));
  const short = window.innerWidth < 430; const [ly,lm] = S.month.split("-").map(Number);
  $("#monthLbl").textContent = short ? MES3[lm-1].replace(/^./,c=>c.toUpperCase()) + (ly!==new Date().getFullYear()?" "+String(ly).slice(2):"") : ymLabel(S.month);
  $("#monthLbl").title = ymLabel(S.month);
  $("#monthnav").style.visibility = (S.tab==="more") ? "hidden" : "visible";
  const hr = new Date().getHours(); const hi = hr<12?"Bom dia":hr<18?"Boa tarde":"Boa noite";
  $("#title").innerHTML = S.tab==="home" ? `<small>${hi}${S.name?",":""}</small>${S.name?esc(S.name.split(" ")[0]):""}` : {tx:"Lançamentos",cards:"Cartões",more:"Configurações",inv:"Investimentos",rep:"Relatórios",lim:"Limites"}[S.tab];
  $("#title").classList.toggle("greet", S.tab==="home");
  const v = $("#view");
  if(S.tab==="home") v.innerHTML = viewHome();
  else if(S.tab==="tx") v.innerHTML = viewTx();
  else if(S.tab==="cards") v.innerHTML = viewCards();
  else if(S.tab==="more") v.innerHTML = viewMore();
  else if(S.tab==="rep") v.innerHTML = viewReports();
  else if(S.tab==="lim") v.innerHTML = viewLimits();
  else if(S.tab==="inv") v.innerHTML = viewInv();
  if(S.tab==="rep") bindChart();
  if(S.tab==="inv") bindInvChart();
}

function rowTx(i, opts={}){
  const c = cat(i.catId);
  const isTr = i.type==="tr", isRend = i.type==="rend";
  const trKind = isTr ? (isInv(i.toAccountId) && !isInv(i.accountId) ? "Aporte" : (isInv(i.accountId) && !isInv(i.toAccountId) ? "Resgate" : "")) : "";
  const icon = isRend ? "📈" : isTr ? (trKind==="Aporte" ? "⬆️" : trKind==="Resgate" ? "⬇️" : "🔁") : (c?.icon || "❓");
  const where = isRend ? (acc(i.accountId)?.name||"") : isTr ? `${acc(i.accountId)?.name||"?"} → ${acc(i.toAccountId)?.name||"?"}` : (i.cardId ? `💳 ${card(i.cardId)?.name||"Cartão"}` : (acc(i.accountId)?.name||"Sem conta"));
  const tags = [i.inst ? i.inst : "", i.fixed ? "fixo" : ""].filter(Boolean).join(" · ");
  const sign = isRend ? (i.amount>=0?"+":"−") : i.type==="inc" ? "+" : (i.type==="exp" ? "−" : "");
  const cls = isRend ? (i.amount>=0?"inc":"exp") : i.type==="inc" ? "inc" : (i.type==="exp" ? "" : "t2");
  const pending = !i.paid && !i.cardId;
  const sub = opts.showDate ? `${i.date.slice(8)}/${i.date.slice(5,7)}` : (pending ? (i.type==="inc"?"a receber":"a pagar") : "");
  const chk = (pending && !opts.noCheck) ? `<button class="chk" data-act="toggle" data-id="${i.id}" aria-label="Marcar como ${i.type==="inc"?"recebido":"pago"}" title="Marcar como ${i.type==="inc"?"recebido":"pago"}">✓</button>` : "";
  return `<div class="row click ${pending?"pend":""}" data-act="edit" data-id="${i.id}">
    <div class="ic">${icon}</div>
    <div class="mid"><div class="ttl">${esc(i.desc|| (isRend?"Rendimento":trKind) || (c?.name) || "Lançamento")}</div><div class="meta">${trKind?trKind+" · ":""}${esc(where)}${tags?` · ${esc(tags)}`:""}</div></div>
    <div class="amt ${cls}">${sign} ${money(Math.abs(i.amount))}${sub?`<small class="${pending&&!opts.showDate?"warn":""}">${sub}</small>`:""}</div>
    ${chk}
  </div>`;
}

function viewHome(){
  const ym = S.month; const {inc,exp} = monthSums(ym);
  const now = totalBalance({}, "dia"); const proj = totalBalance({projected:true, upto:endOfMonth(ym)}, "dia");
  let h = "";
  h += `<div class="card hero"><div class="lbl">Disponível nas contas</div><div class="big">${money(now)}</div><div class="sub">Previsto no fim de ${ymLabel(ym)}: <b>${money(proj)}</b></div>
    <div class="hio"><div><span>Entrou</span><b>${money(inc)}</b></div><div><span>Saiu</span><b>${money(exp)}</b></div><div><span>Sobra</span><b>${money(inc-exp)}</b></div></div></div>`;

  // pendências
  const pend = monthItems(ym).filter(i=>!i.paid && !i.cardId).sort((a,b)=>a.date<b.date?-1:1);
  const invDue = [];
  S.cfg.cards.forEach(c=>{ const k=ym; const t=invoiceTotal(c.id,k); if(t>0 && !S.cfg.invoicePaid[c.id+"|"+k]) invDue.push({c,k,t,due:invoiceDates(k,c).due}); });
  const toPay = pend.filter(i=>i.type==="exp").reduce((s,i)=>s+i.amount,0) + invDue.reduce((s,x)=>s+x.t,0);
  const toRec = pend.filter(i=>i.type==="inc").reduce((s,i)=>s+i.amount,0);
  const nP = pend.length + invDue.length; const open = pendOpen();
  h += `<div class="card"><button class="colh" data-act="togglePend" aria-expanded="${open}"><span class="ct">Pendências${nP?` <span class="badge">${nP}</span>`:""}</span><span class="t2 csum">${!nP?"":`<span class="exp">−${money(toPay)}</span>${toRec?` · <span class="inc">+${money(toRec)}</span>`:""}`}</span><span class="chev ${open?"up":""}" aria-hidden="true">⌄</span></button>`;
  if(!open){}
  else if(!nP) h += `<div class="mut" style="font-size:14px;margin-top:10px">Tudo em dia neste mês ✓</div>`;
  else {
    invDue.forEach(x=>{ h += `<div class="row click pend" data-act="goinv" data-card="${x.c.id}" data-key="${x.k}"><div class="ic">${cardIc(x.c)}</div><div class="mid"><div class="ttl">Fatura ${esc(x.c.name)}</div><div class="meta">vence ${x.due.slice(8)}/${x.due.slice(5,7)} · ${invoiceStatus(x.c.id,x.k).label.toLowerCase()}</div></div><div class="amt">− ${money(x.t)}</div></div>`; });
    pend.slice(0,5).forEach(i=>h+=rowTx(i,{showDate:true}));
    if(pend.length>5) h += `<button class="more" data-act="tab" data-tab="tx" data-filter="pend">Ver todas as ${pend.length} pendências</button>`;
  }
  h += `</div>`;


  // contas
  const accs = S.cfg.accounts.filter(a=>!a.archived && accKind(a)==="dia");
  h += `<div class="card"><h2>Contas do dia a dia <span class="hbtns"><button class="linkbtn" data-act="reorder" data-what="dia" aria-label="Reordenar contas">⇅ Ordenar</button><button class="linkbtn" data-act="newAccount">+ Nova</button></span></h2>`;
  accs.forEach(a=>{ h += `<div class="row click" data-act="accfilter" data-k="a:${a.id}"><div class="ic">${accIc(a)}</div><div class="mid"><div class="ttl">${esc(a.name)}</div></div><div class="amt">${money(accountBalance(a.id))}</div></div>`; });
  if(!accs.length) h += `<div class="empty">Nenhuma conta ainda.</div>`;
  h += `</div>`;

  // investimentos
  const invs = S.cfg.accounts.filter(a=>!a.archived && accKind(a)==="inv");
  if(invs.length){
    const tot = totalBalance({}, "inv"); const rd = rendIn(ym);
    h += `<div class="card"><h2>Investimentos <span class="hbtns"><button class="linkbtn" data-act="reorder" data-what="inv" aria-label="Reordenar investimentos">⇅ Ordenar</button><button class="linkbtn" data-act="tab" data-tab="inv">Ver tudo</button></span></h2>
      <div class="invtot"><b>${money(tot)}</b>${rd?`<span class="${rd>=0?"inc":"exp"}">${rd>=0?"+":"−"}${money(Math.abs(rd))} de rendimento em ${MES3[+ym.slice(5)-1]}</span>`:""}</div>`;
    invs.forEach(a=>h+=invRow(a,true).replace('data-act="invOpen"', `data-act="accfilter" data-k="a:${a.id}"`));
    h += `<div class="patr">Patrimônio total <b>${money(now + tot)}</b></div></div>`;
  }

  // cartões
  const cards = S.cfg.cards.filter(c=>!c.archived);
  if(cards.length){
    h += `<div class="card"><h2>Cartões <span class="hbtns"><button class="linkbtn" data-act="reorder" data-what="cards" aria-label="Reordenar cartões">⇅ Ordenar</button><button class="linkbtn" data-act="tab" data-tab="cards">Faturas</button></span></h2>`;
    cards.forEach(c=>{ const k=currentInvoiceKey(c); const t=invoiceTotal(c.id,k); const used=cardUsed(c.id); const pct=c.limit?Math.min(100,used/c.limit*100):0; const due=invoiceDates(k,c).due;
      h += `<div class="row click" data-act="accfilter" data-k="c:${c.id}" style="flex-wrap:wrap"><div class="ic">${cardIc(c)}</div><div class="mid"><div class="ttl">${esc(c.name)}</div><div class="meta">vence ${due.slice(8)}/${due.slice(5,7)}${c.limit?` · disponível ${money(c.limit-used)}`:""}</div></div><div class="amt">${money(t)}</div>
      ${c.limit?`<div class="progress thin" style="flex-basis:100%"><i style="width:${pct}%" class="${pct>=90?"over":""}"></i></div>`:""}</div>`; });
    h += `</div>`;
  }

  return h;
}

/* ---- Orçamentos: anéis com marcador de ritmo do mês ---- */
function monthPace(ym){
  const t = todayStr(), cur = ymOf(t);
  if(ym < cur) return 1; if(ym > cur) return 0;
  const [y,m] = ym.split("-").map(Number); return +t.slice(8)/daysIn(y,m);
}
function ring(p, pace, cls, size){
  const r=24, C=2*Math.PI*r, f=Math.min(1,p); size=size||64;
  const ang = pace*2*Math.PI - Math.PI/2; const x1=32+Math.cos(ang)*19, y1=32+Math.sin(ang)*19, x2=32+Math.cos(ang)*30, y2=32+Math.sin(ang)*30;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" style="flex:none">
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
    ${f>0?`<circle cx="32" cy="32" r="${r}" fill="none" class="rg ${cls}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${Math.max(0.01,C*f)} ${C}" transform="rotate(-90 32 32)"/>`:""}
    ${pace>0&&pace<1?`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round"/>`:""}
    <text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${Math.round(p*100)}</text></svg>`;
}

/* Limites: por categoria (cfg.budgets) e combinados (cfg.budgetGroups: [{id,name,catIds,limit}]).
   Uma categoria que está num limite combinado não tem limite individual. */
function budgetGroups(){ return (S.cfg.budgetGroups||[]).map(g=>({...g, catIds:(g.catIds||[]).filter(id=>cat(id))})).filter(g=>g.catIds.length); }
function groupName(g){ return g.name || g.catIds.map(id=>cat(id)?.name).filter(Boolean).join(" + "); }
function groupOfCat(catId){ return budgetGroups().find(g=>g.catIds.includes(catId)); }
function budgetEntries(){
  const out = budgetGroups().filter(g=>g.limit>0).map(g=>({key:"g:"+g.id, group:true, name:groupName(g), icon:cat(g.catIds[0])?.icon||"🧩", catIds:g.catIds, lim:g.limit}));
  for(const [id,v] of Object.entries(S.cfg.budgets||{})) if(v>0 && cat(id) && !groupOfCat(id)) out.push({key:id, group:false, name:cat(id).name, icon:cat(id).icon, catIds:[id], lim:v});
  return out;
}
function budgetView(ym){
  const spent = spentByCat(ym); const bud = budgetEntries().map(e=>[e, e.catIds.reduce((s,id)=>s+(spent[id]||0),0)]);
  if(!bud.length) return `<div class="mut" style="font-size:14px">Defina um limite mensal por categoria para acompanhar seus gastos.</div><button class="btn sec" data-act="budgets" style="margin-top:10px">Definir limites</button>`;
  const pace = monthPace(ym);
  const totB = bud.reduce((s,[e])=>s+e.lim,0), totS = bud.reduce((s,[,sp])=>s+sp,0);
  const left = totB - totS; const t=todayStr();
  let tip = "";
  if(ymOf(t)===ym && left>0){ const [y,m]=ym.split("-").map(Number); const dl = daysIn(y,m) - (+t.slice(8)) + 1; tip = ` · <b>${money(left/dl)}/dia</b> até o fim do mês`; }
  let h = `<div class="budsum"><span class="${left<0?"exp":""}">${left>=0?`<b>${money(left)}</b> disponíveis`:`<b>${money(-left)}</b> acima do total`}</span><span class="mut"> de ${money(totB)}${tip}</span>
    <div class="pacebar"><i class="${totS>totB?"over":(totS/totB>pace+0.05&&pace<1?"warn":"")}" style="width:${Math.min(100,totS/totB*100)}%"></i>${pace>0&&pace<1?`<s style="left:${pace*100}%"></s>`:""}</div></div>`;
  const rows = bud.map(([e,s])=>({e, lim:e.lim, s, p:s/e.lim})).sort((a,b)=>b.p-a.p);
  h += rows.map(r=>{
    const st = r.p>1 ? {cls:"over",t:"estourou",tc:"exp"} : (pace<1 && r.p > pace+0.05 ? {cls:"warn",t:"acima do ritmo",tc:"warn"} : {cls:"",t:"no ritmo",tc:"mut"});
    const disp = r.lim - r.s;
    const sub = r.e.group ? `<div class="meta wrap">${r.e.catIds.map(id=>`${esc(cat(id).name)} ${money(spent[id]||0)}`).join(" · ")}</div>` : "";
    return `<div class="row click brow" data-act="catfilter" ${r.e.group?`data-ids="${r.e.catIds.join(",")}"`:`data-id="${r.e.catIds[0]}"`}>${ring(r.p,pace,st.cls,44)}<div class="mid"><div class="ttl">${r.e.icon} ${esc(r.e.name)}${r.e.group?' <span class="badge">combinado</span>':""}</div>${sub}<div class="meta">${disp>=0?`Disponível <b class="t1">${money(disp)}</b>`:`Passou <b class="exp">${money(-disp)}</b>`} de ${money(r.lim)}</div></div><div class="bst ${st.tc}">${st.cls==="over"?"⚠ ":st.cls==="warn"?"▲ ":""}${st.t}</div></div>`;
  }).join("");
  if(pace>0 && pace<1) h += `<div class="mut" style="font-size:11px;margin-top:8px">O número no anel é o % usado; o tracinho marca onde o gasto deveria estar hoje.</div>`;
  return h;
}

/* ---- Onde foi o dinheiro: treemap ---- */
const SEQ = ["#cde2fb","#9ec5f4","#6da7ec","#3987e5","#256abf","#184f95","#0d366b"];
function squarify(items, x, y, w, h){
  const out = []; const total = items.reduce((s,i)=>s+i.v,0); if(!total) return out;
  let rest = items.map(i=>({...i, a:i.v/total*w*h}));
  while(rest.length){
    const horiz = w >= h; const side = horiz ? h : w; let row=[rest[0]], best=worst(row,side), k=1;
    while(k<rest.length){ const nr=[...row,rest[k]]; const wv=worst(nr,side); if(wv<=best){ row=nr; best=wv; k++; } else break; }
    const sum = row.reduce((s,r)=>s+r.a,0); const thick = sum/side; let off=0;
    row.forEach(r=>{ const len = r.a/thick; if(horiz) out.push({...r,x, y:y+off, w:thick, h:len}); else out.push({...r, x:x+off, y, w:len, h:thick}); off+=len; });
    if(horiz){ x+=thick; w-=thick; } else { y+=thick; h-=thick; }
    rest = rest.slice(row.length);
  }
  return out;
  function worst(row, side){ const s=row.reduce((a,r)=>a+r.a,0); const mx=Math.max(...row.map(r=>r.a)), mn=Math.min(...row.map(r=>r.a)); return Math.max(side*side*mx/(s*s), s*s/(side*side*mn)); }
}
function catRows(ym){ const m = spentByCat(ym, cardDateMode()); return Object.entries(m).map(([id,v])=>({id, c:cat(id), v})).filter(r=>r.v>0).sort((a,b)=>b.v-a.v); }
function treemap(ym, limit){
  let rows = catRows(ym);
  if(!rows.length) return `<div class="mut" style="font-size:14px">Nenhuma despesa em ${ymLabel(ym)}.</div>`;
  const total = rows.reduce((s,r)=>s+r.v,0);
  const prevTotal = catRows(ymAdd(ym,-1)).reduce((s,r)=>s+r.v,0);
  if(rows.length>limit){ const rest=rows.slice(limit-1); rows=rows.slice(0,limit-1); rows.push({id:null, c:{icon:"…",name:`Outras ${rest.length}`}, v:rest.reduce((s,r)=>s+r.v,0), others:rest.map(r=>r.id)}); }
  const W=100, H=62; const tiles = squarify(rows, 0, 0, W, H);
  const max = Math.max(...rows.map(r=>r.v)), min = Math.min(...rows.map(r=>r.v));
  const shade = v => { const t = max===min ? 1 : (Math.log(v)-Math.log(min))/(Math.log(max)-Math.log(min)); return Math.round(1 + t*5); };
  let h = `<div class="tmhead"><div><span class="t2" style="font-size:13px">Total em despesas</span><div style="font-size:22px;font-weight:700">${money(total)}</div></div>`;
  if(prevTotal>0){ const d=(total-prevTotal)/prevTotal; h += `<div class="delta ${d>0?"exp":"inc"}">${d>0?"▲":"▼"} ${Math.abs(Math.round(d*100))}%<br><span class="mut">vs ${MES3[+ymAdd(ym,-1).slice(5)-1]}</span></div>`; }
  h += `</div><div class="tm" style="aspect-ratio:${W}/${H}">`;
  tiles.forEach(t=>{
    const si = t.id ? shade(t.v) : -1; const bg = si<0 ? "var(--surface-2)" : SEQ[si]; const dark = si>=3;
    const area = t.w*t.h; const pct = Math.round(t.v/total*100);
    const showName = t.w>16 && t.h>12, showVal = t.w>30 && t.h>18;
    h += `<button class="tmt" data-act="catfilter" ${t.id?`data-id="${t.id}"`:`data-ids="${(t.others||[]).join(",")}"`} title="${esc(t.c?.name||"")}: ${money(t.v)} (${pct}%)" style="left:${t.x}%;top:${t.y/H*100}%;width:${t.w}%;height:${t.h/H*100}%;background:${bg};color:${si<0?"var(--text)":dark?"#fff":"#0b0b0b"}">
      <span class="tme">${t.c?.icon||"❓"}</span>${showName?`<span class="tmn">${esc(t.c?.name||"Sem categoria")}</span>`:""}${showVal?`<span class="tmv">${money(t.v)} · ${pct}%</span>`:(showName?`<span class="tmv">${pct}%</span>`:"")}</button>`;
  });
  h += `</div><div class="mut" style="font-size:11px;margin-top:6px">Área = valor gasto · toque numa categoria para ver os lançamentos.</div>`;
  return h;
}
function catList(ym){
  const rows = catRows(ym); if(!rows.length) return "";
  const prev = {}; catRows(ymAdd(ym,-1)).forEach(r=>prev[r.id]=r.v); const total = rows.reduce((s,r)=>s+r.v,0);
  return `<table class="t" style="margin-top:12px"><tr><th>Categoria</th><th>Valor</th><th>%</th><th>vs ${MES3[+ymAdd(ym,-1).slice(5)-1]}</th></tr>${rows.map(r=>{ const p=prev[r.id]; const d = p ? (r.v-p)/p : null;
    return `<tr class="click" data-act="catfilter" data-id="${r.id}"><td>${r.c?.icon||"❓"} ${esc(r.c?.name||"Sem categoria")}</td><td>${money(r.v)}</td><td>${Math.round(r.v/total*100)}%</td><td class="${d===null?"mut":d>0?"exp":"inc"}">${d===null?"novo":(d>0?"▲ ":"▼ ")+Math.abs(Math.round(d*100))+"%"}</td></tr>`; }).join("")}</table>`;
}

/* ---- Lançamentos com filtros ---- */
function srcLabel(k){ if(k.startsWith("a:")) return acc(k.slice(2))?.name||"Conta"; return "💳 "+(card(k.slice(2))?.name||"Cartão"); }
function viewTx(){
  let items = monthItems(S.month);
  const f = S.txFilter, q = S.txSearch.trim().toLowerCase();
  if(f==="inc") items = items.filter(i=>i.type==="inc");
  if(f==="exp") items = items.filter(i=>i.type==="exp");
  if(f==="tr") items = items.filter(i=>i.type==="tr");
  if(f==="pend") items = items.filter(i=>!i.paid && !i.cardId);
  if(f==="inv") items = items.filter(i=>i.type==="rend" || (i.type==="tr" && (isInv(i.accountId) || isInv(i.toAccountId))));
  if(S.fAcc.size) items = items.filter(i=> i.cardId ? S.fAcc.has("c:"+i.cardId) : (S.fAcc.has("a:"+i.accountId) || (i.type==="tr" && S.fAcc.has("a:"+i.toAccountId))));
  if(S.fCat.size) items = items.filter(i=>i.catId && S.fCat.has(i.catId));
  if(S.fRec.size) items = items.filter(i=>S.fRec.has(recKind(i)));
  if(q) items = items.filter(i=>(i.desc||"").toLowerCase().includes(q) || (cat(i.catId)?.name||"").toLowerCase().includes(q) || (i.notes||"").toLowerCase().includes(q));
  items.sort((a,b)=> a.date===b.date ? (b.created||0)-(a.created||0) : (a.date<b.date?1:-1));
  const nF = (f!=="all"?1:0) + S.fAcc.size + S.fCat.size + S.fRec.size;
  let h = `<div class="txbar"><input class="search" id="txSearch" type="search" placeholder="🔍  Buscar" value="${esc(S.txSearch)}"><button class="fbtn ${nF?"on":""}" data-act="filters">Filtros${nF?` (${nF})`:""}</button></div>`;
  if(nF){
    const TL = {exp:"Despesas",inc:"Receitas",tr:"Transferências",pend:"Pendentes",inv:"Investimentos"};
    h += `<div class="chips">` + (f!=="all"?`<button class="chip sel" data-act="rmType">${TL[f]} ✕</button>`:"") + [...S.fRec].map(k=>`<button class="chip sel" data-act="rmRec" data-k="${k}">${REC_LABEL[k]} ✕</button>`).join("") + [...S.fAcc].map(k=>`<button class="chip sel" data-act="rmAcc" data-k="${k}">${esc(srcLabel(k))} ✕</button>`).join("") + [...S.fCat].map(id=>`<button class="chip sel" data-act="rmCat" data-k="${id}">${cat(id)?.icon||""} ${esc(cat(id)?.name||"?")} ✕</button>`).join("") + `<button class="chip" data-act="clearF">Limpar</button></div>`;
  }
  if(!items.length) return h + `<div class="empty">Nenhum lançamento${nF||q?" com esses filtros":" neste mês"}.<br>Toque em <b>+</b> para adicionar.</div>`;
  let inc=0,exp=0; items.forEach(i=>{ if(i.type==="inc") inc+=i.amount; if(i.type==="exp") exp+=i.amount; });
  let cur = null;
  items.forEach(i=>{ if(i.date!==cur){ if(cur) h+=`</div>`; cur=i.date; h+=`<div class="dayhead">${dayLabel(i.date)}</div><div class="list">`; } h += rowTx(i); });
  h += `</div><div class="totbar"><span>${items.length} lançamento${items.length>1?"s":""}</span><span><span class="inc">+${money(inc)}</span> · <span class="exp">−${money(exp)}</span></span></div>`;
  return h;
}

/* Fixo, parcelado ou avulso (nem um nem outro) */
const REC_LABEL = {fixo:"Fixos", parc:"Parcelados", avulso:"Avulsos"};
function recKind(i){ return i.inst ? "parc" : (i.fixed ? "fixo" : "avulso"); }
function filtersSheet(){
  let type = S.txFilter; const sa = new Set(S.fAcc), sc = new Set(S.fCat), sr = new Set(S.fRec);
  const used = new Set(monthItems(S.month).map(i=>i.catId));
  const accItems = [...S.cfg.accounts.filter(a=>!a.archived).map(a=>({k:"a:"+a.id, name:a.name, icon:accIcSm(a)})), ...S.cfg.cards.filter(c=>!c.archived).map(c=>({k:"c:"+c.id, name:c.name, icon:cardIcSm(c)}))];
  const catItems = kind => S.cfg.categories.filter(c=>c.kind===kind && (!c.archived || used.has(c.id))).sort((a,b)=>(used.has(b.id)-used.has(a.id)) || a.name.localeCompare(b.name)).map(c=>({k:c.id, name:c.name, icon:c.icon}));
  const pills = (items, set, grp) => `<div class="pills">${items.map(i=>`<button type="button" class="pill ${set.has(i.k)?"on":""}" data-grp="${grp}" data-k="${i.k}">${i.icon} ${esc(i.name)}</button>`).join("")}</div>`;
  const draw = ()=>{
    const st = $("#sheet") ? $("#sheet").scrollTop : 0;
    openSheet(`<h3>Filtros</h3>
      <div class="pgh"><span>Tipo</span></div>
      <div class="pills">${[["all","Todos"],["exp","Despesas"],["inc","Receitas"],["tr","Transferências"],["inv","Investimentos"],["pend","Pendentes"]].map(([k,l])=>`<button type="button" class="pill ${type===k?"on":""}" data-type="${k}">${l}</button>`).join("")}</div>
      <div class="pgh"><span>Repetição</span></div>
      <div class="pills">${Object.entries(REC_LABEL).map(([k,l])=>`<button type="button" class="pill ${sr.has(k)?"on":""}" data-rec="${k}">${l}</button>`).join("")}</div>
      <div class="pgh"><span>Contas e cartões</span>${sa.size?`<button class="linkbtn" data-clr="a">Limpar</button>`:""}</div>${pills(accItems, sa, "a")}
      <div class="pgh"><span>Categorias de despesa</span>${[...sc].some(k=>cat(k)?.kind==="exp")?`<button class="linkbtn" data-clr="e">Limpar</button>`:""}</div>${pills(catItems("exp"), sc, "c")}
      <div class="pgh"><span>Categorias de receita</span>${[...sc].some(k=>cat(k)?.kind==="inc")?`<button class="linkbtn" data-clr="i">Limpar</button>`:""}</div>${pills(catItems("inc"), sc, "c")}
      <div class="btns stickyb"><button class="btn sec" id="pkClear">Limpar tudo</button><button class="btn" id="pkOk">Aplicar</button></div>`);
    $("#sheet").scrollTop = st;
    const sh = $("#sheet");
    sh.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>{ type=b.dataset.type; draw(); });
    sh.querySelectorAll("[data-rec]").forEach(b=>b.onclick=()=>{ sr.has(b.dataset.rec)?sr.delete(b.dataset.rec):sr.add(b.dataset.rec); draw(); });
    sh.querySelectorAll("[data-grp]").forEach(b=>b.onclick=()=>{ const set=b.dataset.grp==="a"?sa:sc; set.has(b.dataset.k)?set.delete(b.dataset.k):set.add(b.dataset.k); draw(); });
    sh.querySelectorAll("[data-clr]").forEach(b=>b.onclick=()=>{ const w=b.dataset.clr; if(w==="a") sa.clear(); else [...sc].forEach(k=>{ if(cat(k)?.kind===(w==="e"?"exp":"inc")) sc.delete(k); }); draw(); });
    $("#pkClear").onclick=()=>{ S.txFilter="all"; S.fAcc=new Set(); S.fCat=new Set(); S.fRec=new Set(); closeSheet(); render(); };
    $("#pkOk").onclick=()=>{ S.txFilter=type; S.fAcc=sa; S.fCat=sc; S.fRec=sr; closeSheet(); render(); window.scrollTo(0,0); };
  };
  draw();
}
function viewCards(){
  if(!S.cfg.cards.length) return `<div class="card"><div class="empty">Você ainda não cadastrou cartões de crédito.</div><button class="btn" data-act="newCard">Adicionar cartão</button></div>`;
  if(!S.cardSel || !card(S.cardSel)) S.cardSel = S.cfg.cards[0].id;
  const c = card(S.cardSel); const key = S.month;
  // todos os cartões numa lista: limite usado de cada um à vista; tocar escolhe a fatura mostrada abaixo
  let h = `<div class="card cardlist">${S.cfg.cards.map(x=>{ const used = cardUsed(x.id); const p = x.limit ? Math.min(1, used/x.limit) : 0; const fat = invoiceTotal(x.id,key);
    return `<button type="button" class="crow ${x.id===c.id?"on":""}" data-act="selcard" data-id="${x.id}"><span class="ic">${cardIc(x)}</span><span class="cmid"><span class="ctop"><b>${esc(x.name)}</b><span class="cfat"><small>fatura</small> ${money(fat)}</span></span>${x.limit?`<span class="cbar"><i class="${p>=.9?"hi":""}" style="width:${(p*100).toFixed(1)}%"></i></span><span class="clim">${money(Math.max(0,x.limit-used))} livres de ${money(x.limit)}</span>`:`<span class="clim">usado ${money(used)} · sem limite cadastrado</span>`}</span></button>`; }).join("")}</div>`;
  const items = invoiceItems(c.id,key); const total = invoiceTotal(c.id,key); const st = invoiceStatus(c.id,key); const d = invoiceDates(key,c);
  const paidInfo = S.cfg.invoicePaid[c.id+"|"+key];
  h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="t2" style="font-size:13px">Fatura de ${ymLabel(key)}</div><div style="font-size:26px;font-weight:700">${money(total)}</div></div><span class="badge ${st.s==="paga"?"paid":st.s==="fechada"?"closed":""}">${st.label}</span></div>
    <div class="mut" style="font-size:13px;margin-top:4px">Fecha ${d.close.slice(8)}/${d.close.slice(5,7)} · vence ${d.due.slice(8)}/${d.due.slice(5,7)}${paidInfo?` · paga com ${esc(acc(paidInfo.accountId)?.name||"conta")}`:""}</div>
    <div class="btns" style="margin-top:12px">
      ${paidInfo?`<button class="btn sec" data-act="unpayinv" data-key="${key}">Reabrir fatura</button>`:(total>0?`<button class="btn" data-act="payinv" data-key="${key}">Pagar fatura</button>`:"")}

    </div></div>`;
  h += `<div class="sectiontitle">Lançamentos da fatura</div>`;
  h += items.length ? `<div class="list">${items.map(i=>rowTx(i,{showDate:true})).join("")}</div>` : `<div class="empty">Sem compras nesta fatura.</div>`;
  return h;
}

function viewReports(){
  const ym = S.month;
  let h = `<div class="cardmode"><span>Gastos do cartão pela data da</span><div class="seg sm">${CARD_MODES.map(([k,l])=>`<button type="button" class="${cardDateMode()===k?"on":""}" data-act="cardMode" data-m="${k}">${l}</button>`).join("")}</div></div>`;
  h += `<div class="card"><h2>Despesas por categoria</h2>${treemap(ym,10)}${catList(ym)}</div>`;
  // 6 meses
  const months = []; for(let k=5;k>=0;k--) months.push(ymAdd(ym,-k));
  const data = months.map(m=>({m,...monthSums(m, cardDateMode())}));
  h += `<div class="card"><h2>Receitas × despesas (6 meses) <button class="linkbtn" data-act="toggleTable">${S.reportTable?"Ver gráfico":"Ver tabela"}</button></h2>`;
  if(S.reportTable){
    h += `<table class="t"><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr>${data.map(d=>`<tr><td>${MES3[+d.m.slice(5)-1]}/${d.m.slice(2,4)}</td><td>${money(d.inc)}</td><td>${money(d.exp)}</td><td class="${d.inc-d.exp>=0?"inc":"exp"}">${money(d.inc-d.exp)}</td></tr>`).join("")}</table>`;
  } else {
    h += `<div class="legend"><span><i style="background:var(--s1)"></i>Receitas</span><span><i style="background:var(--s2)"></i>Despesas</span></div><div class="chartwrap" id="chart">${barChart(data)}<div class="tip" id="tip"></div></div>`;
  }
  h += `</div>`;
  return h;
}

function viewMore(){
  let h = `<div class="sectiontitle" style="margin-top:4px">Cadastros</div><div class="list">
    <div class="row click" data-act="manage" data-what="accounts"><div class="ic">🏦</div><div class="mid"><div class="ttl">Contas</div><div class="meta">${S.cfg.accounts.length} cadastrada(s)</div></div><div class="mut">›</div></div>
    <div class="row click" data-act="manage" data-what="cards"><div class="ic">💳</div><div class="mid"><div class="ttl">Cartões de crédito</div><div class="meta">${S.cfg.cards.length} cadastrado(s)</div></div><div class="mut">›</div></div>
    <div class="row click" data-act="manage" data-what="cats"><div class="ic">🏷️</div><div class="mid"><div class="ttl">Categorias</div><div class="meta">${S.cfg.categories.length} categorias</div></div><div class="mut">›</div></div>
    <div class="row click" data-act="budgets"><div class="ic">🎯</div><div class="mid"><div class="ttl">Orçamentos</div><div class="meta">Limites mensais por categoria</div></div><div class="mut">›</div></div>
  </div>`;
  const ls = Store.lastSync ? new Date(Store.lastSync).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : null;
  h += `<div class="sectiontitle">Google Drive</div><div class="list">
    <div class="row click" data-act="sync"><div class="ic">☁️</div><div class="mid"><div class="ttl">${DEMO?"Modo de demonstração":hasToken()?"Conectado":Store.everConnected?"Sincronizar agora":"Conectar ao Google Drive"}</div><div class="meta">${DEMO?"Nada é salvo":ls?"Última sincronização "+ls:"Os dados ficam no arquivo “"+DRIVE_FILE+"” do seu Drive"}${Store.dirty&&!DEMO?" · há alterações pendentes":""}</div></div><div class="mut">›</div></div>
    ${Store.everConnected&&!DEMO?`<div class="row click" data-act="disconnect"><div class="ic">🔌</div><div class="mid"><div class="ttl">Desconectar deste aparelho</div><div class="meta">Os dados continuam no Drive</div></div><div class="mut">›</div></div>`:""}
  </div>`;
  h += `<div class="sectiontitle">Segurança</div><div class="list">
    <div class="row click" data-act="${lockEnabled()?"lockOff":"lockOn"}"><div class="ic">🔒</div><div class="mid"><div class="ttl">Bloqueio por digital</div><div class="meta">${lockEnabled()?"Ativado: pede a digital ao abrir e após 2 min em segundo plano":"Desativado"}</div></div><div class="mut">${lockEnabled()?"Desativar":"Ativar"}</div></div>
  </div>`;
  h += `<div class="sectiontitle">Dados</div><div class="list">
    <div class="row click" data-act="export" data-fmt="csv"><div class="ic">📄</div><div class="mid"><div class="ttl">Exportar lançamentos (CSV)</div><div class="meta">Arquivo para abrir em planilhas</div></div><div class="mut">›</div></div>
    <div class="row click" data-act="export" data-fmt="json"><div class="ic">💾</div><div class="mid"><div class="ttl">Baixar backup completo</div><div class="meta">Arquivo com todos os dados</div></div><div class="mut">›</div></div>
    <div class="row click" data-act="import"><div class="ic">📥</div><div class="mid"><div class="ttl">Restaurar backup</div><div class="meta">Substitui os dados atuais</div></div><div class="mut">›</div></div>
  </div>`;
  h += `<div class="sectiontitle">Aplicativo</div><div class="list">
    <div class="row click" data-act="checkUpd"><div class="ic">🔄</div><div class="mid"><div class="ttl">Procurar atualização</div><div class="meta">Versão instalada: v${APP_VERSION}</div></div><div class="mut">›</div></div>
    <div class="row click" data-act="forceUpd"><div class="ic">🧹</div><div class="mid"><div class="ttl">Forçar atualização</div><div class="meta">Use se o app não sair de uma versão antiga</div></div><div class="mut">›</div></div>
  </div>`;
  h += `<p class="mut" style="font-size:12px;text-align:center;margin-top:18px">Bolso v${APP_VERSION} · seus dados ficam neste aparelho e no seu Google Drive.</p>`;
  return h;
}

function barChart(data){
  const W=340,H=180,pl=60,pr=6,pt=10,pb=24; const iw=W-pl-pr, ih=H-pt-pb;
  const max = Math.max(1,...data.flatMap(d=>[d.inc,d.exp]));
  const nice = niceMax(max); const gw = iw/data.length; const bw = Math.min(16,(gw-10)/2);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Receitas e despesas dos últimos 6 meses">`;
  [0.5,1].forEach(f=>{ const y=pt+ih-ih*f; s+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${pl-6}" y="${y+3}" font-size="10" text-anchor="end" fill="var(--muted)">${compact(nice*f)}</text>`; });
  s += `<line x1="${pl}" x2="${W-pr}" y1="${pt+ih}" y2="${pt+ih}" stroke="var(--line)"/>`;
  data.forEach((d,ix)=>{
    const cx = pl + gw*ix + gw/2;
    const hi = ih*d.inc/nice, he = ih*d.exp/nice;
    s += bar(cx-bw-1, pt+ih-hi, bw, hi, "var(--s1)");
    s += bar(cx+1, pt+ih-he, bw, he, "var(--s2)");
    const sel = d.m===S.month;
    s += `<text x="${cx}" y="${H-8}" font-size="11" text-anchor="middle" fill="${sel?"var(--text)":"var(--muted)"}" font-weight="${sel?600:400}">${MES3[+d.m.slice(5)-1]}</text>`;
    s += `<rect x="${pl+gw*ix}" y="${pt}" width="${gw}" height="${ih+pb}" fill="transparent" data-tipm="${d.m}" data-inc="${d.inc}" data-exp="${d.exp}" data-cx="${cx}" data-top="${pt+ih-Math.max(hi,he)}"/>`;
  });
  return s + `</svg>`;
}
function bar(x,y,w,h,fill){ if(h<=0) return ""; const r=Math.min(4,h,w/2); return `<path d="M${x},${y+h} V${y+r} Q${x},${y} ${x+r},${y} H${x+w-r} Q${x+w},${y} ${x+w},${y+r} V${y+h} Z" fill="${fill}"/>`; }
function niceMax(v){ const p=Math.pow(10,Math.floor(Math.log10(v))); const n=v/p; return (n<=1?1:n<=2?2:n<=5?5:10)*p; }
function compact(v){ return v>=1000 ? "R$ "+(v/1000).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mil" : "R$ "+Math.round(v); }
function bindChart(){
  const ch = $("#chart"); if(!ch) return; const tip=$("#tip"); const svg=ch.querySelector("svg");
  ch.querySelectorAll("[data-tipm]").forEach(r=>{
    const show = ()=>{ const sc = svg.getBoundingClientRect().width/340; tip.innerHTML = `<b>${ymLabel(r.dataset.tipm)}</b><br>Receitas ${money(+r.dataset.inc)}<br>Despesas ${money(+r.dataset.exp)}<br>Saldo ${money(r.dataset.inc-r.dataset.exp)}`; tip.style.display="block"; const left=Math.max(60,Math.min(svg.getBoundingClientRect().width-60, +r.dataset.cx*sc)); tip.style.left=left+"px"; tip.style.top=Math.max(40,(+r.dataset.top*sc-6))+"px"; };
    r.addEventListener("pointerenter",show); r.addEventListener("pointerdown",show);
    r.addEventListener("pointerleave",()=>tip.style.display="none");
  });
}


/* ============ Investimentos ============ */
function invRow(a, compact){
  const bal = accountBalance(a.id);
  const g = a.goal>0 ? a.goal : null; const p = g ? Math.min(1, Math.max(0, bal/g)) : null;
  let goalTxt = "";
  if(g){
    const falta = g - bal;
    goalTxt = falta<=0 ? `Meta de ${money(g)} atingida 🎉` : `${Math.round(bal/g*100)}% de ${money(g)}`;
    if(falta>0 && a.goalDate){ const now=ymOf(todayStr()); let n=0, k=now; while(k<a.goalDate && n<600){ k=ymAdd(k,1); n++; } goalTxt += n>0 ? ` · ${money(falta/n)}/mês até ${MES3[+a.goalDate.slice(5)-1]}/${a.goalDate.slice(2,4)}` : ` · prazo vencido`; }
  } else if(!compact) goalTxt = "Sem meta definida";
  return `<div class="row click invrow" data-act="invOpen" data-id="${a.id}" style="flex-wrap:wrap"><div class="ic">${accIc(a,"🐷")}</div><div class="mid"><div class="ttl">${esc(a.name)}</div>${goalTxt?`<div class="meta">${goalTxt}</div>`:""}</div><div class="amt">${money(bal)}</div>${p!==null?`<div class="progress thin" style="flex-basis:100%"><i style="width:${p*100}%"></i></div>`:""}</div>`;
}
function viewInv(){
  const ym = S.month;
  const invs = S.cfg.accounts.filter(a=>!a.archived && accKind(a)==="inv");
  if(!invs.length) return `<div class="card"><div class="empty">Nenhuma conta de investimento ainda.<br>Crie uma ou marque uma conta existente como “Investimento”.</div><button class="btn" data-act="newInv">Nova conta de investimento</button></div>`;
  const tot = totalBalance({}, "inv"); const rd = rendIn(ym); const fl = invFlows(ym);
  let h = `<div class="card hero"><div class="lbl">Total investido</div><div class="big">${money(tot)}</div><div class="sub">Patrimônio total: <b>${money(tot + totalBalance({}, "dia"))}</b></div>
    <div class="hio"><div><span>Aportes</span><b>${money(fl.ap)}</b></div><div><span>Resgates</span><b>${money(fl.rs)}</b></div><div><span>Rendimento</span><b>${rd>=0?"":"−"}${money(Math.abs(rd))}</b></div></div></div>`;
  h += `<div class="btns" style="margin-bottom:12px"><button class="btn" data-act="updBal">Atualizar saldos</button><button class="btn sec" data-act="aporte">Aportar</button><button class="btn sec" data-act="resgate">Resgatar</button></div>`;
  h += `<div class="card"><h2>Reservas e metas <button class="linkbtn" data-act="newInv">+ Nova</button></h2>${invs.map(a=>invRow(a,false)).join("")}</div>`;
  // evolução
  const months=[]; for(let k=11;k>=0;k--) months.push(ymAdd(ym,-k));
  const data = months.map(m=>({m, v: invs.reduce((s,a)=>s+accountBalance(a.id,{upto:endOfMonth(m)}),0), r: rendIn(m), ...invFlows(m)}));
  h += `<div class="card"><h2>Evolução do total investido <button class="linkbtn" data-act="toggleInvTable">${S.invTable?"Ver gráfico":"Ver tabela"}</button></h2>`;
  if(S.invTable) h += `<table class="t"><tr><th>Mês</th><th>Aportes</th><th>Resgates</th><th>Rend.</th><th>Saldo</th></tr>${data.slice().reverse().map(d=>`<tr><td>${MES3[+d.m.slice(5)-1]}/${d.m.slice(2,4)}</td><td>${money(d.ap)}</td><td>${money(d.rs)}</td><td class="${d.r>=0?"inc":"exp"}">${money(d.r)}</td><td><b>${money(d.v)}</b></td></tr>`).join("")}</table>`;
  else h += `<div class="chartwrap" id="ichart">${lineChart(data)}<div class="tip" id="itip"></div></div>`;
  const y12 = data.reduce((s,d)=>s+d.r,0), ap12 = data.reduce((s,d)=>s+d.ap-d.rs,0);
  h += `<div class="t2" style="font-size:13px;margin-top:8px">Em 12 meses: <b>${money(ap12)}</b> em aportes líquidos e <b class="${y12>=0?"inc":"exp"}">${money(y12)}</b> de rendimento.</div></div>`;
  // movimentos do mês
  const mv = monthItems(ym).filter(i=>i.type==="rend" || (i.type==="tr" && (isInv(i.accountId)||isInv(i.toAccountId)))).sort((a,b)=>a.date<b.date?1:-1);
  h += `<div class="card"><h2>Movimentos de ${ymLabel(ym)}</h2>${mv.length?mv.map(i=>rowTx(i,{showDate:true})).join(""):`<div class="mut" style="font-size:14px">Nenhum aporte, resgate ou rendimento neste mês.</div>`}</div>`;
  return h;
}
function lineChart(data){
  const W=340,H=170,pl=60,pr=10,pt=12,pb=24, iw=W-pl-pr, ih=H-pt-pb;
  const vals = data.map(d=>d.v); const mx = niceMax(Math.max(1,...vals)); const mn = 0;
  const x = i => pl + (data.length===1 ? iw/2 : iw*i/(data.length-1)); const y = v => pt + ih - ih*(v-mn)/(mx-mn);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Total investido nos últimos 12 meses">`;
  [0,0.5,1].forEach(f=>{ const yy=pt+ih-ih*f; s+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" ${f?'stroke-dasharray="2 3"':""}/><text x="${pl-6}" y="${yy+3}" font-size="10" text-anchor="end" fill="var(--muted)">${compact(mx*f)}</text>`; });
  s += `<path d="${data.map((d,i)=>`${i?"L":"M"}${x(i)},${y(d.v)}`).join(" ")}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>`;
  data.forEach((d,i)=>{ const sel=d.m===S.month; if(i%2===(data.length-1)%2) s+=`<text x="${x(i)}" y="${H-7}" font-size="10" text-anchor="middle" fill="${sel?"var(--text)":"var(--muted)"}" font-weight="${sel?600:400}">${MES3[+d.m.slice(5)-1]}</text>`;
    s += `<circle cx="${x(i)}" cy="${y(d.v)}" r="${sel?5:3.5}" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"/>`;
    s += `<rect x="${x(i)-iw/(data.length-1||1)/2}" y="${pt}" width="${iw/(data.length-1||1)}" height="${ih+pb}" fill="transparent" data-im="${d.m}" data-v="${d.v}" data-r="${d.r}" data-ap="${d.ap}" data-rs="${d.rs}" data-cx="${x(i)}" data-top="${y(d.v)}"/>`; });
  return s + `</svg>`;
}
function bindInvChart(){
  const ch=$("#ichart"); if(!ch) return; const tip=$("#itip"); const svg=ch.querySelector("svg");
  ch.querySelectorAll("[data-im]").forEach(r=>{ const show=()=>{ const sc=svg.getBoundingClientRect().width/340; tip.innerHTML=`<b>${ymLabel(r.dataset.im)}</b><br>Saldo ${money(+r.dataset.v)}<br>Aportes ${money(+r.dataset.ap)} · Resgates ${money(+r.dataset.rs)}<br>Rendimento ${money(+r.dataset.r)}`; tip.style.display="block"; tip.style.left=Math.max(80,Math.min(svg.getBoundingClientRect().width-80,+r.dataset.cx*sc))+"px"; tip.style.top=Math.max(70,(+r.dataset.top*sc-8))+"px"; };
    r.addEventListener("pointerenter",show); r.addEventListener("pointerdown",show); r.addEventListener("pointerleave",()=>tip.style.display="none"); });
}
function invSheet(id){
  const a = acc(id); if(!a) return;
  const mv = allItems().filter(i=>(i.type==="rend" && i.accountId===id) || (i.type==="tr" && (i.accountId===id||i.toAccountId===id))).sort((x,y)=>x.date<y.date?1:-1).slice(0,8);
  openSheet(`<h3>${accIcSm(a,"🐷")} ${esc(a.name)}</h3><div class="list" style="margin-bottom:12px">${invRow(a,false).replace('data-act="invOpen"','')}</div>
    <div class="btns"><button class="btn" data-act="updBal" data-id="${id}">Atualizar saldo</button><button class="btn sec" data-act="aporte" data-id="${id}">Aportar</button><button class="btn sec" data-act="resgate" data-id="${id}">Resgatar</button></div>
    <div class="pgh"><span>Últimos movimentos</span></div>${mv.length?`<div class="list">${mv.map(i=>rowTx(i,{showDate:true})).join("")}</div>`:`<div class="mut" style="font-size:14px">Sem movimentos ainda.</div>`}`);
}
function updBalSheet(onlyId){
  const invs = S.cfg.accounts.filter(a=>!a.archived && accKind(a)==="inv" && (!onlyId || a.id===onlyId));
  const t = todayStr();
  openSheet(`<h3>Atualizar ${onlyId?"saldo":"saldos"}</h3><p class="t2" style="margin-top:-6px;font-size:14px">Abra o app do banco e digite o saldo de hoje. O Bolso calcula o rendimento desde a última atualização. Deixe em branco o que não quiser atualizar.</p>
  <form id="ubf"><label class="f">Data<input type="date" name="date" value="${t}" max="${t}"></label>
  ${invs.map(a=>{ const lr=lastRend(a.id); return `<div class="ubrow"><div class="mid"><div class="ttl">${accIcSm(a,"🐷")} ${esc(a.name)}</div><div class="meta">No Bolso: ${money(accountBalance(a.id,{upto:t}))}${lr?` · atualizado em ${lr.slice(8)}/${lr.slice(5,7)}`:""}</div><div class="meta ubd" id="ubd-${a.id}"></div></div><input name="${a.id}" inputmode="numeric" data-money placeholder="Saldo hoje"></div>`; }).join("")}
  <button class="btn" type="submit">Registrar rendimentos</button></form>`);
  const f=$("#ubf");
  const preview = ()=>{ const d=f.date.value||t; invs.forEach(a=>{ const v=parseMoney(f[a.id].value); const el=$("#ubd-"+a.id); if(isNaN(v)){ el.textContent=""; return; } const diff=Math.round((v-accountBalance(a.id,{upto:d}))*100)/100; el.innerHTML = diff===0?"Sem diferença":`Rendimento: <b class="${diff>0?"inc":"exp"}">${diff>0?"+":"−"}${money(Math.abs(diff))}</b>`; }); };
  f.addEventListener("input", preview);
  f.onsubmit = e=>{ e.preventDefault(); const d=f.date.value||t; const touched=[]; let n=0;
    invs.forEach(a=>{ const v=parseMoney(f[a.id].value); if(isNaN(v)) return; const diff=Math.round((v-accountBalance(a.id,{upto:d}))*100)/100; if(diff===0) return; touched.push(putItem({id:newId(), type:"rend", amount:diff, desc:"Rendimento", date:d, accountId:a.id, paid:true, created:Date.now()})); n++; });
    closeSheet(); commit(touched); toast(n?`${n} rendimento${n>1?"s":""} registrado${n>1?"s":""}.`:"Nenhuma diferença encontrada."); };
}
function rendForm(it){
  openSheet(`<h3>Rendimento</h3><p class="t2" style="margin-top:-6px;font-size:14px">${esc(acc(it.accountId)?.name||"")}. Use valor negativo para perda.</p><form id="rf">
  <div class="two"><label class="f">Valor<input name="amount" inputmode="decimal" data-money value="${(it.amount<0?"-":"")+fmtInput(Math.abs(it.amount))}"></label><label class="f">Data<input type="date" name="date" value="${it.date}"></label></div>
  <button class="btn" type="submit">Salvar</button><button class="btn danger" type="button" id="delR">Excluir</button></form>`);
  $("#rf").onsubmit = e=>{ e.preventDefault(); const raw=$("#rf").amount.value.trim(); const neg=raw.startsWith("-"); const v=parseMoney(raw.replace(/^-/,"")); if(isNaN(v)) return toast("Valor inválido.");
    const old=ymOf(it.date); it.amount = neg?-v:v; it.date=$("#rf").date.value||it.date; const touched=[old]; if(ymOf(it.date)!==old){ removeItem(it.id); putItem(it); touched.push(ymOf(it.date)); } closeSheet(); commit(touched); };
  $("#delR").onclick = ()=>{ const ym=removeItem(it.id); closeSheet(); commit([ym]); toast("Rendimento excluído."); };
}
function moveForm(kind, invId){
  const dias = S.cfg.accounts.filter(a=>!a.archived && accKind(a)==="dia"); const invs = S.cfg.accounts.filter(a=>!a.archived && accKind(a)==="inv");
  if(!dias.length || !invs.length) return toast("Você precisa de uma conta do dia a dia e uma de investimento.");
  const main = dias.find(a=>/ita[uú]/i.test(a.name)) || dias[0];
  const inv = invId || invs[0].id;
  txForm(null, kind==="aporte" ? {type:"tr", accountId:main.id, toAccountId:inv, desc:"Aporte "+(acc(inv)?.name||""), title:"Aportar"} : {type:"tr", accountId:inv, toAccountId:main.id, desc:"Resgate "+(acc(inv)?.name||""), title:"Resgatar"});
}


/* ---- Pendências recolhíveis (preferência deste aparelho) ---- */
function pendOpen(){ try{ return localStorage.getItem("bolso-pend-open") !== "0"; }catch(e){ return true; } }
function togglePend(){ try{ localStorage.setItem("bolso-pend-open", pendOpen() ? "0" : "1"); }catch(e){} render(); }

/* ---- Limites (aba própria) ---- */
function viewLimits(){
  const ym = S.month;
  return `<div class="card"><h2>Limites de ${ymLabel(ym)} <button class="linkbtn" data-act="budgets">Editar</button></h2>${budgetView(ym)}</div>`;
}

/* ---- Reordenar contas e cartões ---- */
function reorderSheet(what){
  const list = what==="cards" ? S.cfg.cards : S.cfg.accounts;
  const keep = x => what==="cards" ? !x.archived : (!x.archived && accKind(x)===what);
  const title = {dia:"Ordenar contas do dia a dia", inv:"Ordenar investimentos", cards:"Ordenar cartões"}[what];
  const draw = ()=>{
    const items = list.filter(keep);
    const st = $("#sheet") ? $("#sheet").scrollTop : 0;
    openSheet(`<h3>${title}</h3><p class="t2" style="margin-top:-6px;font-size:14px">Use as setas para mudar a posição. A ordem vale para a tela inicial, as listas e os seletores.</p>
      <div class="list">${items.map((x,i)=>`<div class="row ordrow"><div class="ic">${what==="cards"?cardIc(x):accIc(x)}</div><div class="mid"><div class="ttl">${esc(x.name)}</div></div>
        <button class="ordbtn" data-mv="${x.id}" data-d="-1" ${i===0?"disabled":""} aria-label="Subir ${esc(x.name)}">↑</button><button class="ordbtn" data-mv="${x.id}" data-d="1" ${i===items.length-1?"disabled":""} aria-label="Descer ${esc(x.name)}">↓</button></div>`).join("")}</div>
      <button class="btn" id="ordOk" style="margin-top:12px">Pronto</button>`);
    $("#sheet").scrollTop = st;
    $("#sheet").querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{
      const items2 = list.filter(keep); const idx = items2.findIndex(x=>x.id===b.dataset.mv); const other = items2[idx + Number(b.dataset.d)];
      if(!other) return; const i = list.indexOf(items2[idx]), j = list.indexOf(other); [list[i], list[j]] = [list[j], list[i]];
      saveCfg(); render(); draw();
    });
    $("#ordOk").onclick = closeSheet;
  };
  draw();
}

/* ---- Seletor de conta/cartão com os mesmos ícones/logos da tela inicial ---- */
// withCards: inclui cartões · withInv: inclui contas de investimento (só transferências: aporte/resgate)
// keepKey: mantém visível a opção já usada por um lançamento existente, mesmo que seja de investimento
function srcItems(withCards, withInv, keepKey){
  const accs = S.cfg.accounts.filter(a=>!a.archived);
  const invs = accs.filter(a=>accKind(a)==="inv" && (withInv || keepKey==="a:"+a.id));
  const it = [...accs.filter(a=>accKind(a)==="dia"), ...invs].map(a=>({k:"a:"+a.id, name:a.name, icon:accIcSm(a), grp:accKind(a)==="inv"?"Investimentos":"Contas"}));
  if(withCards) it.splice(accs.filter(a=>accKind(a)==="dia").length, 0, ...S.cfg.cards.filter(c=>!c.archived).map(c=>({k:"c:"+c.id, name:c.name, icon:cardIcSm(c), grp:"Cartões de crédito"})));
  return it;
}
function chipPicker(name, items, sel){
  if(!items.some(i=>i.k===sel) && items.length) sel = items[0].k;
  const pill = i=>`<button type="button" class="pill ${i.k===sel?"on":""}" data-pk="${i.k}" role="radio" aria-checked="${i.k===sel}">${i.icon} ${esc(i.name)}</button>`;
  // separa por grupo (Contas / Cartões de crédito / Investimentos) quando há mais de um, para não confundir nomes iguais
  const grps = [...new Set(items.map(i=>i.grp||""))];
  const body = grps.length > 1
    ? grps.map(g=>`<div class="pk-grp">${esc(g)}</div><div class="pills">${items.filter(i=>(i.grp||"")===g).map(pill).join("")}</div>`).join("")
    : `<div class="pills">${items.map(pill).join("")}</div>`;
  return `<input type="hidden" name="${name}" value="${esc(sel)}"><div class="srcpick" data-for="${name}" role="radiogroup">${body}</div>`;
}
function bindChipPickers(root, onChange){
  root.querySelectorAll(".srcpick").forEach(g=>{
    const inp = root.querySelector(`input[name="${g.dataset.for}"]`);
    g.querySelectorAll("[data-pk]").forEach(b=>b.onclick=()=>{ inp.value = b.dataset.pk; g.querySelectorAll("[data-pk]").forEach(x=>{ x.classList.toggle("on", x===b); x.setAttribute("aria-checked", x===b); }); onChange && onChange(g.dataset.for, inp.value); });
  });
}

/* ============ Sheets / formulários ============ */
function openSheet(html){ $("#sheet").innerHTML = `<div class="grab"></div>`+html; $("#ov").classList.add("open"); }
/* Volta de um formulário para a lista de onde ele foi aberto (Configurações → Contas → conta → fora = Contas). */
let sheetBack = null, sheetCur = null;
function closeSheet(){ $("#ov").classList.remove("open"); $("#sheet").innerHTML=""; sheetBack = sheetCur = null; }
function sheetDone(){ if(sheetBack){ const b = sheetBack; sheetBack = null; b(); } else closeSheet(); }
$("#ov").addEventListener("click", e=>{ if(e.target.id==="ov") sheetDone(); });

function confirmBox(title, text, buttons){
  return new Promise(res=>{
    openSheet(`<h3>${esc(title)}</h3><p class="t2" style="margin-top:-6px">${esc(text)}</p>${buttons.map((b,i)=>`<button class="btn ${b.cls||""}" data-cb="${i}">${esc(b.label)}</button>`).join("")}<button class="btn sec" data-cb="-1">Cancelar</button>`);
    const keep = [sheetBack, sheetCur];
    $("#sheet").querySelectorAll("[data-cb]").forEach(el=>el.onclick=()=>{ const i=+el.dataset.cb; closeSheet(); [sheetBack, sheetCur] = keep; res(i<0?null:buttons[i].value); });
  });
}

const byName = (a,b)=> a.name.localeCompare(b.name, "pt-BR", {sensitivity:"base"});
function catOptions(kind, sel){ return S.cfg.categories.filter(c=>c.kind===kind && !c.archived).sort(byName).map(c=>`<option value="${c.id}" ${c.id===sel?"selected":""}>${c.icon} ${esc(c.name)}</option>`).join(""); }
function accOptions(sel){ return S.cfg.accounts.filter(a=>!a.archived).sort(byName).map(a=>`<option value="a:${a.id}" ${("a:"+a.id)===sel?"selected":""}>${a.icon||"🏦"} ${esc(a.name)}</option>`).join(""); }
function srcOptions(sel, withCards){ let h = `<optgroup label="Contas">${accOptions(sel)}</optgroup>`; if(withCards && S.cfg.cards.length) h += `<optgroup label="Cartões de crédito">${[...S.cfg.cards].sort(byName).map(c=>`<option value="c:${c.id}" ${("c:"+c.id)===sel?"selected":""}>💳 ${esc(c.name)}</option>`).join("")}</optgroup>`; return h; }

function txForm(existing, preset){
  const it = existing || {type:"exp", date:todayStr(), paid:true, ...(preset||{})};
  if(!S.cfg.accounts.length){ toast("Cadastre uma conta primeiro."); return manageAccounts(); }
  let type = it.type;
  const firstDia = S.cfg.accounts.find(a=>!a.archived && accKind(a)==="dia") || S.cfg.accounts[0];
  let src = it.cardId ? "c:"+it.cardId : "a:"+(it.accountId || firstDia.id);
  let toV = "a:"+(it.toAccountId||(S.cfg.accounts[1]||S.cfg.accounts[0]).id);
  let keep = {}; let showMore = !!(existing && existing.notes);
  const draw = ()=>{
    const f0 = $("#txf"); if(f0){ keep = {amount:f0.amount.value, desc:f0.desc.value, date:f0.date.value, notes:f0.notes.value}; }
    const isTr = type==="tr";
    openSheet(`<h3>${existing?"Editar lançamento":(preset&&preset.title)||"Novo lançamento"}</h3>
    <div class="seg">${[["exp","Despesa","e"],["inc","Receita","i"],["tr","Transferência",""]].map(([k,l,c])=>`<button type="button" class="${type===k?"on":""} ${c}" data-type="${k}" ${existing?"disabled":""}>${l}</button>`).join("")}</div>
    <form id="txf">
      <label class="f">Valor<input class="money" name="amount" inputmode="numeric" data-money placeholder="0,00" value="${keep.amount??(existing?fmtInput(it.amount):"")}" required></label>
      <div class="f sugwrap"><label for="descIn">Descrição</label><input id="descIn" name="desc" placeholder="${isTr?"Ex.: reserva":"Ex.: almoço, aluguel"}" value="${esc(keep.desc??(it.desc||""))}" maxlength="80" autocomplete="off" aria-autocomplete="list" aria-controls="sugList"><div class="sug" id="sugList" role="listbox" hidden></div></div>
      <div class="two">
        <label class="f">Data<input type="date" name="date" value="${keep.date||it.date}" required></label>
        ${isTr?"":`<label class="f">Categoria<select name="cat">${catOptions(type,it.catId)}</select></label>`}
      </div>
      ${isTr?`<div class="f"><span>De</span>${chipPicker("src", srcItems(false, true), src.startsWith("c:")?"a:"+firstDia.id:src)}</div><div class="f"><span>Para</span>${chipPicker("to", srcItems(false, true), toV)}</div>`
            :`<div class="f"><span>${type==="exp"?"Pago com":"Recebido em"}</span>${chipPicker("src", srcItems(type==="exp", false, existing ? src : null), src)}</div>`}
      <div class="switch" id="paidRow"><span>${type==="inc"?"Recebido":"Pago"}</span><input type="checkbox" name="paid" ${it.paid?"checked":""}></div>
      <button type="button" class="linkbtn moreopt" id="moreOpt" ${showMore?'style="display:none"':""}>+ Repetir, parcelar ou observação</button>
      <div id="moreBox" ${showMore?"":'style="display:none"'}>
      ${!existing?`<label class="f">Repetir<select name="rep" id="repSel"><option value="no">Não repete</option>${isTr?"":`<option value="inst">Parcelado</option>`}<option value="fixed">Fixo todo mês</option></select></label>
      <label class="f" id="nRow" style="display:none">Número de parcelas <span class="mut">(o valor acima é o total)</span><input name="n" type="number" min="2" max="72" value="2" inputmode="numeric"></label>`:""}
      <label class="f">Observação<input name="notes" value="${esc(keep.notes??(it.notes||""))}" maxlength="200"></label>
      </div>
      <button class="btn" type="submit">Salvar</button>
      ${existing?`<button class="btn danger" type="button" id="delTx">Excluir</button>`:""}
    </form>`);
    $("#sheet").querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>{ type=b.dataset.type; draw(); });
    const paidRow=$("#paidRow"); const f = $("#txf");
    const upd = ()=>{ paidRow.style.display = (!isTr && f.src.value.startsWith("c:")) ? "none":"flex"; };
    bindChipPickers(f, (n,v)=>{ if(n==="src") src=v; if(n==="to") toV=v; upd(); }); upd();
    bindSuggestions(f, type);
    $("#moreOpt").onclick=()=>{ showMore=true; $("#moreBox").style.display="block"; $("#moreOpt").style.display="none"; };
    const rep=$("#repSel"); if(rep) rep.onchange=()=>{ $("#nRow").style.display = rep.value==="inst"?"block":"none"; };
    const dateIn = $("#txf").date; dateIn.onchange = ()=>{ if(!existing) $("#txf").paid.checked = dateIn.value <= todayStr(); };
    $("#txf").onsubmit = e=>{ e.preventDefault(); saveTx(existing, type, new FormData(e.target)); };
    if(existing) $("#delTx").onclick = ()=>deleteTx(existing);
    if(!existing && !keep.amount) setTimeout(()=>{ const f=$("#txf"); if(f && !f.contains(document.activeElement)) f.amount.focus(); },50); // não rouba o foco de quem já começou a digitar
  };
  draw();
}


/* ---- Sugestões de descrição a partir do histórico ---- */
let sugCache = null;
const normTxt = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+\d+\/\d+$/,"").trim();
function sugIndex(type){
  if(sugCache && sugCache.rev===dataRev && sugCache.type===type && sugCache.months===S.months) return sugCache.list;
  const by = new Map();
  for(const k in S.months) for(const i of S.months[k]){
    if(i.type!==type || !i.desc) continue;
    const key = normTxt(i.desc); if(!key) continue;
    const e = by.get(key);
    if(!e) by.set(key, {key, desc:i.desc.replace(/\s+\d+\/\d+$/,"").trim(), n:1, last:i});
    else { e.n++; if(i.date > e.last.date){ e.last = i; e.desc = i.desc.replace(/\s+\d+\/\d+$/,"").trim(); } }
  }
  const list = [...by.values()];
  sugCache = {rev:dataRev, type, months:S.months, list};
  return list;
}
function bindSuggestions(f, type){
  const inp = f.desc, box = $("#sugList"); if(!inp || !box) return;
  let items = [], active = -1;
  const hide = ()=>{ box.hidden = true; items = []; active = -1; };
  const show = ()=>{
    const q = normTxt(inp.value);
    if(q.length < 2){ hide(); return; }
    items = sugIndex(type).map(e=>({e, s: e.key.startsWith(q) ? 2 : (e.key.includes(q) ? 1 : 0)})).filter(x=>x.s>0 && x.e.key!==q)
      .sort((a,b)=> b.s-a.s || b.e.n-a.e.n || (a.e.last.date<b.e.last.date?1:-1)).slice(0,5).map(x=>x.e);
    if(!items.length){ hide(); return; }
    box.innerHTML = items.map((e,ix)=>{ const l=e.last; const c=cat(l.catId);
      const where = l.type==="tr" ? `${acc(l.accountId)?.name||"?"} → ${acc(l.toAccountId)?.name||"?"}` : (l.cardId ? (card(l.cardId)?.name||"Cartão") : (acc(l.accountId)?.name||""));
      return `<button type="button" class="sugi" role="option" data-ix="${ix}"><span class="sic">${l.type==="tr"?"🔁":esc(c?.icon||"❓")}</span><span class="smid"><b>${esc(e.desc)}</b><small>${esc([c?.name, where].filter(Boolean).join(" · "))}</small></span><span class="samt">${money(l.amount)}</span></button>`; }).join("");
    box.hidden = false; active = -1;
  };
  const pick = ix => {
    const l = items[ix] && items[ix].last; if(!l) return;
    inp.value = items[ix].desc;
    if(type!=="tr" && l.catId && f.cat && [...f.cat.options].some(o=>o.value===l.catId)) f.cat.value = l.catId;
    const choose = (name, key) => { const b = f.querySelector(`.srcpick[data-for="${name}"] [data-pk="${key}"]`); if(b) b.click(); };
    if(type==="tr"){ choose("src", "a:"+l.accountId); choose("to", "a:"+l.toAccountId); }
    else choose("src", l.cardId ? "c:"+l.cardId : "a:"+l.accountId);
    if(!f.amount.value.trim()) f.amount.value = fmtInput(l.amount);
    hide();
  };
  inp.addEventListener("input", show);
  inp.addEventListener("focus", show);
  inp.addEventListener("blur", ()=>setTimeout(hide, 150));
  inp.addEventListener("keydown", e=>{
    if(box.hidden) return;
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); active = (active + (e.key==="ArrowDown"?1:-1) + items.length) % items.length; box.querySelectorAll(".sugi").forEach((b,i)=>b.classList.toggle("on", i===active)); }
    else if(e.key==="Enter" && active>=0){ e.preventDefault(); pick(active); }
    else if(e.key==="Escape") hide();
  });
  box.addEventListener("mousedown", e=>e.preventDefault()); // não tira o foco antes do toque
  box.addEventListener("click", e=>{ const b = e.target.closest(".sugi"); if(b) pick(+b.dataset.ix); });
}

async function saveTx(existing, type, fd){
  const amount = parseMoney(fd.get("amount"));
  if(!(amount>0)) return toast("Informe um valor maior que zero.");
  const date = fd.get("date"); if(!date) return toast("Informe a data.");
  const base = { type, desc:(fd.get("desc")||"").trim(), notes:(fd.get("notes")||"").trim(), date };
  const src = fd.get("src")||"";
  if(type==="tr"){
    base.accountId = src.slice(2); base.toAccountId = (fd.get("to")||"").slice(2);
    if(base.accountId===base.toAccountId) return toast("Escolha contas diferentes.");
  } else {
    base.catId = fd.get("cat");
    if(src.startsWith("c:")){ base.cardId = src.slice(2); base.accountId=null; } else { base.accountId = src.slice(2); base.cardId=null; }
  }
  base.paid = base.cardId ? true : !!fd.get("paid");
  const touched = [];
  if(existing){
    let scope = "one";
    if(existing.group){ scope = await confirmBox(existing.inst?"Lançamento parcelado":"Lançamento fixo","Aplicar a alteração a quais lançamentos? A data só muda neste; o pago/não pago muda nos escolhidos.",[{label:"Somente este",value:"one"},{label:"Este e os próximos",value:"next"},{label:"Todos da série",value:"all"}]); if(!scope) return; }
    const paidChanged = !base.cardId && !!existing.paid !== !!base.paid;
    const apply = (it, isThis)=>{
      const old = ymOf(it.date);
      Object.assign(it, {desc:base.desc, notes:base.notes, catId:base.catId, accountId:base.accountId, cardId:base.cardId, toAccountId:base.toAccountId, amount});
      if(isThis){ it.date = base.date; it.paid = base.paid; }
      else if(paidChanged && !it.cardId) it.paid = base.paid;
      touched.push(old);
      if(ymOf(it.date)!==old){ removeItem(it.id); putItem(it); touched.push(ymOf(it.date)); }
    };
    if(scope!=="one"){ allItems().filter(i=>i.group===existing.group && i.id!==existing.id && (scope==="all" || i.date>=existing.date)).forEach(i=>apply(i,false)); }
    apply(existing,true);
    closeSheet(); commit(touched); toast("Lançamento atualizado.");
    return;
  }
  const rep = fd.get("rep")||"no"; const now = Date.now();
  if(rep==="inst"){
    const n = Math.max(2, Math.min(72, parseInt(fd.get("n"))||2));
    const cents = Math.round(amount*100); const per = Math.floor(cents/n); const rest = cents - per*n;
    const g = newId(); const day = +date.slice(8);
    for(let k=0;k<n;k++){ const d = dateAddMonths(date,k,day); const it = {...base, id:newId(), created:now+k, group:g, inst:`${k+1}/${n}`, amount:(per + (k<rest?1:0))/100, date:d, paid: base.cardId ? true : (k===0 ? base.paid : d<=todayStr())}; touched.push(putItem(it)); }
    toast(`${n} parcelas criadas.`);
  } else if(rep==="fixed"){
    const g = newId(); const day = +date.slice(8);
    for(let k=0;k<24;k++){ const d = dateAddMonths(date,k,day); const it = {...base, id:newId(), created:now+k, group:g, fixed:true, amount, date:d, paid: base.cardId ? true : (k===0 ? base.paid : false)}; touched.push(putItem(it)); }
    toast("Lançamento fixo criado para os próximos 24 meses.");
  } else {
    touched.push(putItem({...base, id:newId(), created:now, amount}));
    toast("Lançamento salvo.");
  }
  closeSheet(); commit(touched);
}

async function deleteTx(it){
  let scope = "one";
  if(it.group){ scope = await confirmBox(it.inst?"Excluir lançamento parcelado":"Excluir lançamento fixo","Quais lançamentos você quer excluir?",[{label:"Somente este",value:"one",cls:"danger"},{label:"Este e os próximos",value:"next",cls:"danger"},{label:"Todos da série",value:"all",cls:"danger"}]); }
  else { scope = await confirmBox("Excluir lançamento", `"${it.desc||cat(it.catId)?.name||"Lançamento"}" de ${money(it.amount)} será excluído.`, [{label:"Excluir",value:"one",cls:"danger"}]); }
  if(!scope) return;
  const touched=[];
  let targets = [it];
  if(scope==="next") targets = allItems().filter(i=>i.group===it.group && i.date>=it.date);
  if(scope==="all") targets = allItems().filter(i=>i.group===it.group);
  targets.forEach(t=>touched.push(removeItem(t.id)));
  closeSheet(); commit(touched); toast(targets.length>1?`${targets.length} lançamentos excluídos.`:"Lançamento excluído.");
}

/* ---- Contas ---- */
function manageAccounts(){
  sheetBack = null;
  openSheet(`<h3>Contas</h3>${[["dia","Dia a dia"],["inv","Investimentos"]].map(([k,l])=>`<div class="pgh"><span>${l}</span></div><div class="list">${S.cfg.accounts.filter(a=>accKind(a)===k).map(a=>`<div class="row click" data-act="editAccount" data-id="${a.id}"><div class="ic">${accIc(a)}</div><div class="mid"><div class="ttl">${esc(a.name)}${a.archived?' <span class="badge">arquivada</span>':""}</div></div><div class="amt">${money(accountBalance(a.id))}</div></div>`).join("")||'<div class="empty">Nenhuma conta.</div>'}</div>`).join("")}<div class="btns" style="margin-top:12px"><button class="btn" data-act="newAccount">Nova do dia a dia</button><button class="btn sec" data-act="newInv">Novo investimento</button></div>`);
  sheetCur = ()=>manageAccounts();
}
function accountForm(a, presetKind){
  if(sheetCur) sheetBack = sheetCur;
  const x = a || {name:"",kind:presetKind||"dia",initial:0,icon:presetKind==="inv"?"🐷":"🏦"}; let icon = x.icon||"🏦"; let kind = a ? accKind(a) : x.kind; let logo = safeLogo(x.logo);
  const icons = ["🏦","👛","💵","🎟️","🐷","📈","🛟","🏖️","👴","🎯","💼","🪙"];
  const draw = ()=>{
    const f0=$("#af"); const keep = f0 ? {name:f0.name.value, initial:f0.initial.value, goal:f0.goal?f0.goal.value:null, goalDate:f0.goalDate?f0.goalDate.value:null} : {};
    openSheet(`<h3>${a?"Editar conta":"Nova conta"}</h3>
    <div class="seg"><button type="button" class="${kind==="dia"?"on":""}" data-k="dia">Dia a dia</button><button type="button" class="${kind==="inv"?"on":""}" data-k="inv">Investimento</button></div>
    <form id="af">
    <label class="f">Nome<input name="name" value="${esc(keep.name??x.name)}" placeholder="${kind==="inv"?"Ex.: Reserva de emergência":"Ex.: Nubank, Itaú"}" required maxlength="40"></label>
    <label class="f">Saldo inicial<input name="initial" inputmode="decimal" data-money value="${keep.initial??fmtInput(Number(x.initial)||0)}"></label>
    ${kind==="inv"?`<div class="two"><label class="f">Meta <span class="mut">(opcional)</span><input name="goal" inputmode="numeric" data-money placeholder="Ex.: 70.000,00" value="${keep.goal??(x.goal?fmtInput(x.goal):"")}"></label>
    <label class="f">Até <span class="mut">(opcional)</span><input name="goalDate" type="month" value="${keep.goalDate??(x.goalDate||"")}"></label></div>`:""}
    ${logoField(logo)}
    ${logo?"":`<label class="f">Ícone<div class="emojis">${icons.map(e=>`<button type="button" class="${e===icon?"on":""}" data-e="${e}">${e}</button>`).join("")}</div></label>`}
    ${a?`<div class="switch"><span>Arquivar (esconder dos saldos)</span><input type="checkbox" name="archived" ${a.archived?"checked":""}></div>`:""}
    <button class="btn" type="submit">Salvar</button>${a?`<button class="btn danger" type="button" id="delA">Excluir conta</button>`:""}</form>`);
    $("#sheet").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ kind=b.dataset.k; draw(); });
    bindLogoField(v=>{ logo=v; draw(); });
    $("#sheet").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{ icon=b.dataset.e; $("#sheet").querySelectorAll("[data-e]").forEach(o=>o.classList.toggle("on",o===b)); });
    $("#af").onsubmit = e=>{ e.preventDefault(); const fd=new FormData(e.target); const ini=parseMoney(fd.get("initial"));
      const obj = {name:fd.get("name").trim(), kind, initial:isNaN(ini)?0:ini, icon, logo, archived:!!fd.get("archived")};
      if(kind==="inv"){ const g=parseMoney(fd.get("goal")); obj.goal = g>0 ? g : null; obj.goalDate = fd.get("goalDate") || null; } else { obj.goal=null; obj.goalDate=null; }
      if(a) Object.assign(a,obj); else S.cfg.accounts.push({id:newId(),...obj});
      saveCfg(); sheetDone(); render(); toast("Conta salva."); };
    if(a) $("#delA").onclick = async ()=>{
      const used = allItems().some(i=>i.accountId===a.id||i.toAccountId===a.id) || S.cfg.cards.some(c=>c.accountId===a.id);
      if(used) return toast("Esta conta tem lançamentos. Use “Arquivar”.");
      if(await confirmBox("Excluir conta",`Excluir "${a.name}"?`,[{label:"Excluir",value:1,cls:"danger"}])){ S.cfg.accounts=S.cfg.accounts.filter(x=>x.id!==a.id); saveCfg(); render(); toast("Conta excluída."); }
      sheetDone();
    };
  };
  draw();
}

/* ---- Cartões ---- */
function manageCards(){
  sheetBack = null;
  openSheet(`<h3>Cartões de crédito</h3><div class="list">${S.cfg.cards.map(c=>`<div class="row click" data-act="editCard" data-id="${c.id}"><div class="ic">${cardIc(c)}</div><div class="mid"><div class="ttl">${esc(c.name)}</div><div class="meta">fecha dia ${c.closeDay} · vence dia ${c.dueDay}</div></div><div class="amt">${c.limit?money(c.limit):""}</div></div>`).join("")||'<div class="empty">Nenhum cartão.</div>'}</div><button class="btn" data-act="newCard" style="margin-top:12px">Novo cartão</button>`);
  sheetCur = ()=>manageCards();
}
function cardForm(c){
  if(sheetCur) sheetBack = sheetCur;
  if(!S.cfg.accounts.length) return toast("Cadastre uma conta primeiro.");
  const x = c || {name:"",limit:0,closeDay:1,dueDay:10,accountId:S.cfg.accounts[0].id};
  let logo = safeLogo(x.logo);
  const draw = ()=>{
  const f0 = $("#cf"); const keep = f0 ? {name:f0.name.value, limit:f0.limit.value, closeDay:f0.closeDay.value, dueDay:f0.dueDay.value, acc:f0.acc.value} : {};
  openSheet(`<h3>${c?"Editar cartão":"Novo cartão"}</h3><form id="cf">
    <label class="f">Nome<input name="name" value="${esc(keep.name??x.name)}" placeholder="Ex.: Nubank Roxinho" required maxlength="40"></label>
    <label class="f">Limite<input name="limit" inputmode="numeric" data-money value="${esc(keep.limit??fmtInput(Number(x.limit)||0))}"></label>
    <div class="two"><label class="f">Dia do fechamento<input name="closeDay" type="number" min="1" max="31" value="${esc(keep.closeDay??x.closeDay)}" required></label>
    <label class="f">Dia do vencimento<input name="dueDay" type="number" min="1" max="31" value="${esc(keep.dueDay??x.dueDay)}" required></label></div>
    <div class="f"><span>Conta usada para pagar</span>${chipPicker("acc", srcItems(false, false, c ? "a:"+x.accountId : null), keep.acc||("a:"+x.accountId))}</div>
    ${logoField(logo)}
    <button class="btn" type="submit">Salvar</button>${c?`<button class="btn danger" type="button" id="delC">Excluir cartão</button>`:""}</form>`);
  bindLogoField(v=>{ logo=v; draw(); });
  bindChipPickers($("#cf"));
  $("#cf").onsubmit = e=>{ e.preventDefault(); const fd=new FormData(e.target); const lim=parseMoney(fd.get("limit"));
    const obj = {name:fd.get("name").trim(), limit:isNaN(lim)?0:lim, closeDay:Math.min(31,Math.max(1,+fd.get("closeDay"))), dueDay:Math.min(31,Math.max(1,+fd.get("dueDay"))), accountId:fd.get("acc").slice(2), logo};
    if(c) Object.assign(c,obj); else { const nc={id:newId(),...obj}; S.cfg.cards.push(nc); S.cardSel=nc.id; }
    saveCfg(); sheetDone(); render(); toast("Cartão salvo."); };
  if(c) $("#delC").onclick = async ()=>{
    if(allItems().some(i=>i.cardId===c.id)) return toast("Este cartão tem compras lançadas e não pode ser excluído.");
    if(await confirmBox("Excluir cartão",`Excluir "${c.name}"?`,[{label:"Excluir",value:1,cls:"danger"}])){ S.cfg.cards=S.cfg.cards.filter(x=>x.id!==c.id); saveCfg(); render(); }
    sheetDone();
  };
  };
  draw();
}

function payInvoice(key){
  const c = card(S.cardSel); const total = invoiceTotal(c.id,key);
  openSheet(`<h3>Pagar fatura de ${ymLabel(key)}</h3><form id="pf">
    <label class="f">Valor<input class="money" name="amount" inputmode="numeric" data-money value="${fmtInput(total)}"></label>
    <div class="two"><label class="f">Data do pagamento<input type="date" name="date" value="${todayStr()}"></label>
    </div><div class="f"><span>Conta</span>${chipPicker("acc", srcItems(false), "a:"+c.accountId)}</div>
    <button class="btn" type="submit">Confirmar pagamento</button></form>`);
  bindChipPickers($("#pf"));
  $("#pf").onsubmit = e=>{ e.preventDefault(); const fd=new FormData(e.target); const v=parseMoney(fd.get("amount")); if(!(v>0)) return toast("Valor inválido.");
    S.cfg.invoicePaid[c.id+"|"+key] = {accountId:fd.get("acc").slice(2), date:fd.get("date"), amount:v}; saveCfg(); closeSheet(); render(); toast("Fatura paga."); };
}

/* ---- Categorias ---- */
function manageCats(kind="exp"){
  sheetBack = null;
  openSheet(`<h3>Categorias</h3><div class="seg"><button class="${kind==="exp"?"on e":""}" data-k="exp">Despesas</button><button class="${kind==="inc"?"on i":""}" data-k="inc">Receitas</button></div>
  <div class="list">${S.cfg.categories.filter(c=>c.kind===kind).map(c=>`<div class="row click" data-act="editCat" data-id="${c.id}"><div class="ic">${c.icon}</div><div class="mid"><div class="ttl">${esc(c.name)}${c.archived?' <span class="badge">arquivada</span>':""}</div></div><div class="mut">›</div></div>`).join("")}</div>
  <button class="btn" id="newCat" style="margin-top:12px">Nova categoria</button>`);
  $("#sheet").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>manageCats(b.dataset.k));
  $("#newCat").onclick = ()=>catForm(null, kind);
  sheetCur = ()=>manageCats(kind);
}
function catForm(c, kind){
  if(sheetCur) sheetBack = sheetCur;
  const x = c || {name:"",kind,icon:"❓"}; let icon=x.icon;
  openSheet(`<h3>${c?"Editar categoria":"Nova categoria"}</h3><form id="kf">
    <label class="f">Nome<input name="name" value="${esc(x.name)}" required maxlength="30"></label>
    <label class="f">Ícone<div class="emojis">${PALETTE_EMOJI.map(e=>`<button type="button" class="${e===icon?"on":""}" data-e="${e}">${e}</button>`).join("")}</div></label>
    ${c?`<div class="switch"><span>Arquivar</span><input type="checkbox" name="archived" ${c.archived?"checked":""}></div>`:""}
    <button class="btn" type="submit">Salvar</button>${c?`<button class="btn danger" type="button" id="delK">Excluir</button>`:""}</form>`);
  $("#sheet").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{ icon=b.dataset.e; $("#sheet").querySelectorAll("[data-e]").forEach(o=>o.classList.toggle("on",o===b)); });
  $("#kf").onsubmit = e=>{ e.preventDefault(); const fd=new FormData(e.target); const obj={name:fd.get("name").trim(), icon, archived:!!fd.get("archived")};
    if(c) Object.assign(c,obj); else S.cfg.categories.push({id:newId(),kind:x.kind,...obj}); saveCfg(); render(); manageCats(x.kind); };
  if(c) $("#delK").onclick = async ()=>{
    if(allItems().some(i=>i.catId===c.id)) return toast("Categoria em uso. Use “Arquivar”.");
    if(await confirmBox("Excluir categoria",`Excluir "${c.name}"?`,[{label:"Excluir",value:1,cls:"danger"}])){ S.cfg.categories=S.cfg.categories.filter(k=>k.id!==c.id); delete S.cfg.budgets[c.id]; (S.cfg.budgetGroups||[]).forEach(x=>{ x.catIds=(x.catIds||[]).filter(id=>id!==c.id); }); saveCfg(); render(); manageCats(c.kind); }
  };
}

/* ---- Orçamentos ---- */
function budgetsForm(){
  const spent = spentByCat(S.month);
  const groups = budgetGroups();
  const cats = S.cfg.categories.filter(c=>c.kind==="exp" && !c.archived).sort(byName);
  openSheet(`<h3>Limites mensais</h3><p class="t2" style="margin-top:-6px;font-size:14px">Deixe em branco o que não quiser acompanhar. Gasto em ${ymLabel(S.month)} ao lado.</p><form id="bf">
  <div class="pgh"><span>Limites combinados</span><button type="button" class="linkbtn" data-grp-new>+ Combinar categorias</button></div>
  ${groups.length ? groups.map(g=>`<div class="f budrow"><span class="bname">${cat(g.catIds[0])?.icon||"🧩"} ${esc(groupName(g))}<br><span class="mut" style="font-size:12px">${g.catIds.map(id=>esc(cat(id).name)).join(" + ")} · gasto ${money(g.catIds.reduce((s,id)=>s+(spent[id]||0),0))}</span><br><button type="button" class="linkbtn" data-grp-edit="${g.id}">Editar</button></span><input name="g:${g.id}" inputmode="numeric" data-money placeholder="—" value="${g.limit?fmtInput(g.limit):""}"></div>`).join("") : `<p class="mut" style="font-size:13px;margin:0 0 8px">Some duas ou mais categorias num limite só, por exemplo Saúde + Cuidados pessoais. Elas continuam separadas nos lançamentos e relatórios.</p>`}
  <div class="pgh"><span>Por categoria</span></div>
  ${cats.map(c=>{ const g = groupOfCat(c.id); return `<div class="f budrow"><span class="bname">${c.icon} ${esc(c.name)}<br><span class="mut" style="font-size:12px">${g?`no limite “${esc(groupName(g))}”`:`gasto ${money(spent[c.id]||0)}`}</span></span>${g?`<span class="budin">combinado</span>`:`<input name="${c.id}" inputmode="numeric" data-money placeholder="—" value="${S.cfg.budgets[c.id]?fmtInput(S.cfg.budgets[c.id]):""}">`}</div>`; }).join("")}
  <button class="btn" type="submit">Salvar limites</button></form>`);
  const collect = ()=>{ const fd = new FormData($("#bf")); const b = {}; const gl = {};
    for(const [k,v] of fd.entries()){ const n = parseMoney(v); if(k.startsWith("g:")) gl[k.slice(2)] = n>0 ? n : 0; else if(n>0) b[k] = n; }
    return {b, gl}; };
  const apply = ({b, gl})=>{ S.cfg.budgets = b; (S.cfg.budgetGroups||[]).forEach(g=>{ if(g.id in gl) g.limit = gl[g.id]; }); };
  $("#bf").onsubmit = e=>{ e.preventDefault(); apply(collect()); saveCfg(); closeSheet(); render(); toast("Limites salvos."); };
  // abrir o editor de grupo guarda antes o que já foi digitado
  $("#sheet").querySelector("[data-grp-new]").onclick = ()=>{ apply(collect()); groupForm(null); };
  $("#sheet").querySelectorAll("[data-grp-edit]").forEach(btn=>btn.onclick=()=>{ apply(collect()); groupForm((S.cfg.budgetGroups||[]).find(g=>g.id===btn.dataset.grpEdit)); });
}
function groupForm(g){
  const others = new Set(budgetGroups().filter(x=>!g || x.id!==g.id).flatMap(x=>x.catIds));
  const cats = S.cfg.categories.filter(c=>c.kind==="exp" && !c.archived && !others.has(c.id)).sort(byName);
  const sel = new Set(g ? g.catIds : []);
  const draw = ()=>{
    const f0 = $("#gf"); const keep = f0 ? {name:f0.gname.value, limit:f0.glimit.value} : {};
    openSheet(`<h3>${g?"Editar limite combinado":"Combinar categorias"}</h3><form id="gf">
      <div class="f gcats"><span>Categorias (escolha duas ou mais)</span><div class="pills" style="margin-top:6px">${cats.map(c=>`<button type="button" class="pill ${sel.has(c.id)?"on":""}" data-c="${c.id}">${c.icon} ${esc(c.name)}</button>`).join("")}</div></div>
      <label class="f">Nome <span class="mut">(opcional)</span><input name="gname" maxlength="40" placeholder="${esc([...sel].map(id=>cat(id)?.name).join(" + ") || "Ex.: Saúde e cuidados")}" value="${esc(keep.name??(g?.name||""))}"></label>
      <label class="f">Limite mensal<input name="glimit" inputmode="numeric" data-money placeholder="0,00" value="${esc(keep.limit??(g&&g.limit?fmtInput(g.limit):""))}"></label>
      <button class="btn" type="submit">Salvar</button>
      ${g?`<button class="btn danger" type="button" id="gDel">Desfazer combinação</button>`:""}
      <button class="btn sec" type="button" id="gBack">Voltar</button></form>`);
    $("#sheet").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{ sel.has(b.dataset.c) ? sel.delete(b.dataset.c) : sel.add(b.dataset.c); draw(); });
    $("#gBack").onclick = budgetsForm;
    if(g) $("#gDel").onclick = async ()=>{ if(!await confirmBox("Desfazer combinação",`As categorias voltam a ficar sem limite próprio.`,[{label:"Desfazer",value:1,cls:"danger"}])) return budgetsForm(); S.cfg.budgetGroups = (S.cfg.budgetGroups||[]).filter(x=>x.id!==g.id); saveCfg(); render(); budgetsForm(); };
    $("#gf").onsubmit = e=>{ e.preventDefault();
      if(sel.size < 2) return toast("Escolha pelo menos duas categorias.");
      const lim = parseMoney($("#gf").glimit.value); const ids = [...sel];
      const obj = {name:$("#gf").gname.value.trim(), catIds:ids, limit: lim>0 ? lim : 0};
      S.cfg.budgetGroups = S.cfg.budgetGroups || [];
      if(g) Object.assign(S.cfg.budgetGroups.find(x=>x.id===g.id), obj); else S.cfg.budgetGroups.push({id:newId(), ...obj});
      ids.forEach(id=>{ delete S.cfg.budgets[id]; }); // a categoria passa a contar só no limite combinado
      saveCfg(); render(); budgetsForm(); toast("Limite combinado salvo.");
    };
  };
  draw();
}

/* ---- Exportar / restaurar ---- */
function exportData(fmt){
  const stamp = todayStr();
  if(fmt==="csv"){
    const rows=[["data","tipo","descricao","categoria","conta","cartao","valor","pago","parcela","observacao"]];
    allItems().sort((a,b)=>a.date<b.date?-1:1).forEach(i=>rows.push([i.date, {exp:"despesa",inc:"receita",tr:"transferencia",rend:"rendimento"}[i.type], i.desc, cat(i.catId)?.name||"", i.type==="tr"?`${acc(i.accountId)?.name||""} > ${acc(i.toAccountId)?.name||""}`:(acc(i.accountId)?.name||""), card(i.cardId)?.name||"", String(i.type==="exp"?-i.amount:i.amount).replace(".",","), i.paid?"sim":"não", i.inst||"", i.notes||""]));
    downloadFile(`bolso-lancamentos-${stamp}.csv`, "﻿"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
  } else downloadFile(`bolso-backup-${stamp}.json`, JSON.stringify(snapshot()), "application/json");
  toast("Arquivo baixado.");
}
function importForm(){
  openSheet(`<h3>Restaurar backup</h3><p class="t2" style="margin-top:-6px;font-size:14px">Escolha o arquivo de backup ou cole o conteúdo dele. <b>Isto substitui todos os dados atuais.</b></p>
  <label class="f">Arquivo<input type="file" id="impFile" accept="application/json,.json"></label>
  <label class="f">Ou cole o conteúdo<textarea id="imp" rows="5" style="font-size:12px"></textarea></label><button class="btn" id="doImp">Restaurar</button>`);
  $("#doImp").onclick = async ()=>{
    let text = $("#imp").value.trim(); const f = $("#impFile").files[0];
    if(f) text = await f.text();
    let d; try{ d = JSON.parse(text); }catch(e){ return toast("Backup inválido."); }
    if(!validBackup(d)) return toast("Este não parece um backup do Bolso.");
    if(S.cfg && !await confirmBox("Substituir dados?","Todos os dados atuais serão trocados pelos do backup.",[{label:"Restaurar",value:1,cls:"danger"}])) return;
    closeSheet(); applyData(d); markChanged(); S.month = ymOf(todayStr()); S.tab = "home"; render(); toast("Backup restaurado.");
  };
}



/* ============ Configuração ============ */
const APP_VERSION = "1.4.10";
const GOOGLE_CLIENT_ID = "157023250608-ke632c5rqisp7v3nkpqupru6caj9nulf.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILE = "bolso-dados.json";
const DEMO = new URLSearchParams(location.search).has("demo");
const LOCK_AFTER_MS = 2 * 60 * 1000;

/* ============ Dados: aparelho (IndexedDB) + Google Drive ============ */
const Store = { fileId:null, remoteVersion:null, folderId:null, copiesId:null, organized:false, dirty:false, lastBackup:null, everConnected:false, token:null, tokenExp:0, syncing:false, error:null, lastSync:null };
let idbP = null;
function idb(){ return idbP ||= new Promise((res,rej)=>{ const r=indexedDB.open("bolso",1); r.onupgradeneeded=()=>r.result.createObjectStore("kv"); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function kvGet(k){ const db=await idb(); return new Promise((res,rej)=>{ const q=db.transaction("kv").objectStore("kv").get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }
async function kvSet(k,v){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction("kv","readwrite"); tx.objectStore("kv").put(v,k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }

function snapshot(){ return {app:"bolso", schema:1, savedAt:new Date().toISOString(), appVersion:APP_VERSION, config:S.cfg, months:S.months}; }
function syncMeta(){ return {fileId:Store.fileId, remoteVersion:Store.remoteVersion, folderId:Store.folderId, copiesId:Store.copiesId, organized:Store.organized, dirty:Store.dirty, lastBackup:Store.lastBackup, everConnected:Store.everConnected, lastSync:Store.lastSync}; }
let persistT = null;
function persistLocal(now){
  if(DEMO || !S.cfg) return;
  clearTimeout(persistT);
  const run = async ()=>{ try{ await kvSet("data", snapshot()); await kvSet("sync", syncMeta()); }catch(e){ toast("Não foi possível salvar neste aparelho."); } };
  if(now) return run(); persistT = setTimeout(run, 200);
}
function markChanged(){ dataRev++; Store.dirty = true; persistLocal(); renderSync(); scheduleSync(); }
function saveCfg(){ markChanged(); }
function saveMonth(){ markChanged(); }

function normalizeCfg(c){ c.accounts=c.accounts||[]; c.cards=c.cards||[]; c.categories=c.categories||[]; c.budgets=c.budgets||{}; c.invoicePaid=c.invoicePaid||{}; return c; }
function migrateInv(){
  if(S.cfg.invV1) return;
  S.cfg.invV1 = true;
  S.cfg.accounts.forEach(a=>{ if(!a.kind) a.kind = accKind(a); if(a.kind==="inv" && (!a.icon || a.icon==="🏦")) a.icon="🐷"; });
  for(const ym in S.months) for(const i of S.months[ym]){
    if(i.type==="inc" && !i.cardId && isInv(i.accountId) && /invest|rendim/i.test(cat(i.catId)?.name||"")){ i.type="rend"; i.desc = i.desc || "Rendimento"; delete i.catId; i.paid = true; }
  }
  markChanged();
}
function validBackup(d){ return d && d.app==="bolso" && d.config && typeof d.config==="object" && (!d.months || typeof d.months==="object"); }
/* Lançamentos fixos e parcelados que chegaram sem "group" (ex.: importados) ganham um,
   para que editar/excluir possa perguntar "somente este / este e os próximos / todos".
   Parcelas: mesma conta/cartão, categoria, descrição, total de parcelas e mês da 1ª parcela.
   Fixos: mesma conta/cartão, categoria, descrição e tipo. Guarda uma cópia antes de mudar. */
function migrateGroups(){
  if(S.cfg.grpV1) return;
  const before = DEMO ? null : JSON.stringify(snapshot());
  const series = {}; let changed = 0;
  for(const ym in S.months) for(const i of S.months[ym]){
    if(i.group || (i.type!=="exp" && i.type!=="inc")) continue;
    const who = (i.cardId?"c:"+i.cardId:"a:"+i.accountId)+"|"+(i.catId||"")+"|"+i.type+"|"+normTxt(i.desc||"");
    let key = null; const m = /^(\d+)\/(\d+)$/.exec(i.inst||"");
    if(m) key = "p|"+who+"|"+m[2]+"|"+ymAdd(ymOf(i.date), -(+m[1]-1));
    else if(i.fixed) key = "f|"+who;
    if(!key) continue;
    (series[key] ||= []).push(i);
  }
  for(const k in series){ const list = series[k]; if(list.length < 2) continue; const g = newId(); list.forEach(i=>{ i.group = g; changed++; }); }
  S.cfg.grpV1 = true;
  if(before && changed) kvSet("antes-series-"+todayStr(), JSON.parse(before)).catch(()=>{});
  markChanged();
}
function applyData(d){ dataRev++; S.cfg = normalizeCfg(d.config); S.months = d.months || {}; migrateInv(); migrateGroups(); }

async function initStore(){
  if(DEMO){ const d = demoData(); S.cfg = d.config; S.months = d.months; S.name = "Visitante"; S.ready = true; render(); renderSync(); return; }
  let d=null, m=null;
  try{ d = await kvGet("data"); m = await kvGet("sync"); }catch(e){ setBanner("Este navegador não permite guardar dados. Use o Chrome atualizado, fora da aba anônima."); }
  if(m) Object.assign(Store, m);
  try{ S.name = localStorage.getItem("bolso-name") || ""; }catch(e){}
  if(validBackup(d)) applyData(d);
  S.ready = true; render(); renderSync();
}

/* ---- Login Google (somente acesso aos arquivos criados pelo próprio app) ---- */
let tokenClient = null;
function initGoogle(){
  if(DEMO) return;
  const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
  s.onload = ()=>{ try{ tokenClient = google.accounts.oauth2.initTokenClient({ client_id:GOOGLE_CLIENT_ID, scope:DRIVE_SCOPE, callback:onToken, error_callback:()=>{ Store.error="login"; renderSync(); } }); }catch(e){ Store.error="login"; } renderSync(); };
  s.onerror = ()=>{ Store.error = navigator.onLine ? "login" : "offline"; renderSync(); };
  document.head.appendChild(s);
}
function connectDrive(){
  if(DEMO) return toast("No modo de demonstração nada é salvo.");
  if(!navigator.onLine) return toast("Sem internet. Suas alterações ficam guardadas neste aparelho.");
  if(!tokenClient) return toast("O login do Google ainda está carregando. Tente em instantes.");
  tokenClient.requestAccessToken({ prompt: Store.everConnected ? "" : "consent" });
}
function onToken(r){
  if(!r || r.error){ Store.error = "login"; renderSync(); return; }
  if(!google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)){ Store.error="scope"; renderSync(); toast("Para salvar no Drive, permita o acesso aos arquivos do Bolso."); return; }
  Store.token = r.access_token; Store.tokenExp = Date.now() + (Number(r.expires_in||3600) - 120) * 1000; Store.everConnected = true; Store.error = null;
  loadName(); syncNow();
}
const hasToken = ()=> !!Store.token && Date.now() < Store.tokenExp;
async function loadName(){ try{ const r = await gfetch(`${DAPI}/about?fields=user(displayName)`); const j = await r.json(); const n = j.user && j.user.displayName; if(n){ S.name = n; try{ localStorage.setItem("bolso-name", n); }catch(e){} render(); } }catch(e){} }
function disconnectDrive(){
  if(Store.token){ try{ google.accounts.oauth2.revoke(Store.token, ()=>{}); }catch(e){} }
  Store.token = null; Store.tokenExp = 0; Store.everConnected = false; persistLocal(); renderSync(); render();
  toast("Google Drive desconectado deste aparelho.");
}

/* ---- Google Drive API ---- */
const DAPI = "https://www.googleapis.com/drive/v3", UAPI = "https://www.googleapis.com/upload/drive/v3";
async function gfetch(url, opts={}){
  const r = await fetch(url, {...opts, headers:{ Authorization:"Bearer "+Store.token, ...(opts.headers||{}) }});
  if(r.status===401 || r.status===403 && /insufficient|auth/i.test(await r.clone().text())){ Store.token = null; throw {code:"auth"}; }
  if(!r.ok) throw {code:"http", status:r.status};
  return r;
}
/* Tudo fica na pasta "Bolso" do Drive: bolso-dados.json na pasta e as cópias (backups mensais e
   conflitos) em "Bolso/Cópias". Com o escopo drive.file o app só enxerga o que ele mesmo criou.
   "Mudou no Drive?" é decidido pelo conteúdo (md5Checksum), não pelo número de versão: o Drive às vezes
   aumenta a versão sem mudar o conteúdo, o que gerava avisos de conflito falsos. */
const FOLDER = "Bolso", COPIES = "Cópias", FOLDER_MIME = "application/vnd.google-apps.folder";
const qs = s => s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
async function driveList(q, fields="files(id,name,parents)"){ const r = await gfetch(`${DAPI}/files?q=${encodeURIComponent(q+" and trashed=false")}&spaces=drive&orderBy=modifiedTime desc&pageSize=200&fields=${fields}`); return (await r.json()).files || []; }
async function driveFind(name, parent){ return (await driveList(`name='${qs(name)}'`+(parent?` and '${parent}' in parents`:""), "files(id,version,md5Checksum)"))[0] || null; }
async function driveMeta(id){ const r = await gfetch(`${DAPI}/files/${id}?fields=id,version,md5Checksum,trashed,parents`); return r.json(); }
async function driveRead(id){ const r = await gfetch(`${DAPI}/files/${id}?alt=media`); return r.json(); }
async function driveCreate(name, obj, parent){
  const b = "bolso" + Math.random().toString(36).slice(2);
  const meta = {name, mimeType:"application/json"}; if(parent) meta.parents = [parent];
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(obj)}\r\n--${b}--`;
  const r = await gfetch(`${UAPI}/files?uploadType=multipart&fields=id,version,md5Checksum`, {method:"POST", headers:{"Content-Type":`multipart/related; boundary=${b}`}, body});
  return r.json();
}
async function driveUpdate(id, obj){ const r = await gfetch(`${UAPI}/files/${id}?uploadType=media&fields=id,version,md5Checksum`, {method:"PATCH", headers:{"Content-Type":"application/json; charset=UTF-8"}, body:JSON.stringify(obj)}); return r.json(); }
async function driveFolder(name, parent){
  const f = (await driveList(`name='${qs(name)}' and mimeType='${FOLDER_MIME}'`+(parent?` and '${parent}' in parents`:"")))[0];
  if(f) return f.id;
  const r = await gfetch(`${DAPI}/files?fields=id`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name, mimeType:FOLDER_MIME, ...(parent?{parents:[parent]}:{})})});
  return (await r.json()).id;
}
async function driveMove(id, to){
  const m = await driveMeta(id); const from = (m.parents||[]).filter(p=>p!==to);
  if((m.parents||[]).includes(to) && !from.length) return;
  await gfetch(`${DAPI}/files/${id}?addParents=${to}${from.length?`&removeParents=${from.join(",")}`:""}&fields=id`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:"{}"});
}
async function ensureFolders(){
  if(Store.folderId){ const m = await driveMeta(Store.folderId).catch(()=>({trashed:true})); if(m.trashed) Store.folderId = Store.copiesId = null; }
  if(!Store.folderId) Store.folderId = await driveFolder(FOLDER);
  if(!Store.copiesId) Store.copiesId = await driveFolder(COPIES, Store.folderId);
}
// Uma vez por aparelho: leva para as pastas os arquivos do Bolso que ficaram soltos (versões até 1.4.7).
async function organizeDrive(){
  if(Store.organized) return;
  for(const f of await driveList(`name contains 'bolso-' and mimeType='application/json'`)){
    const to = f.name===DRIVE_FILE ? Store.folderId : (/^bolso-(backup|conflito)-/.test(f.name) ? Store.copiesId : null);
    if(to && !(f.parents||[]).includes(to)) await driveMove(f.id, to).catch(()=>{});
  }
  Store.organized = true;
}
const sameData = (a,b)=> JSON.stringify({c:a.config,m:a.months}) === JSON.stringify({c:b.config,m:b.months});

/* ---- Sincronização ---- */
let syncT = null;
function scheduleSync(){ clearTimeout(syncT); syncT = setTimeout(()=>{ if(hasToken()) syncNow(); }, 2500); }
async function syncNow(){
  if(DEMO || Store.syncing) return;
  if(!navigator.onLine){ renderSync(); return; }
  if(!hasToken()){ renderSync(); return; }
  Store.syncing = true; renderSync();
  try{
    await ensureFolders();
    if(Store.fileId){ const m = await driveMeta(Store.fileId).catch(e=>{ if(e.code==="http" && e.status===404) return {trashed:true}; throw e; }); if(m.trashed){ Store.fileId = null; Store.remoteVersion = null; } }
    if(!Store.fileId){ const f = await driveFind(DRIVE_FILE); if(f){ Store.fileId = f.id; Store.remoteVersion = null; } }
    await organizeDrive();
    if(!Store.fileId){
      if(!S.cfg){ S.cfg = defaultConfig(); S.months = {}; }
      const c = await driveCreate(DRIVE_FILE, snapshot(), Store.folderId); Store.fileId = c.id; Store.remoteVersion = c.md5Checksum; Store.dirty = false;
    } else {
      const m = await driveMeta(Store.fileId);
      const old = /^\d+$/.test(String(Store.remoteVersion||"")); // salvo pela versão antiga do app (número de versão)
      let remoteChanged = old ? m.version !== Store.remoteVersion : m.md5Checksum !== Store.remoteVersion;
      let d = null;
      if(remoteChanged && Store.dirty && S.cfg){ d = await driveRead(Store.fileId); if(validBackup(d) && sameData(d, snapshot())){ remoteChanged = false; Store.dirty = false; } }
      if(remoteChanged && (!Store.dirty || !S.cfg)){
        d = d || await driveRead(Store.fileId);
        if(!validBackup(d)) throw {code:"badfile"};
        applyData(d); Store.dirty = false; render();
      } else if(remoteChanged && Store.dirty){
        await resolveConflict(m);
      } else if(Store.dirty){
        const u = await driveUpdate(Store.fileId, snapshot()); m.md5Checksum = u.md5Checksum; Store.dirty = false;
      }
      if(!Store.dirty) Store.remoteVersion = m.md5Checksum;
    }
    await monthlyBackup();
    Store.lastSync = Date.now(); Store.error = null;
  }catch(e){
    Store.error = e && e.code==="auth" ? "auth" : e && e.code==="badfile" ? "badfile" : (navigator.onLine ? "net" : "offline");
  }finally{
    Store.syncing = false; persistLocal(); renderSync();
  }
}
async function resolveConflict(m){
  Store.syncing = false; renderSync();
  const choice = await confirmBox("Dados alterados em outro aparelho",
    "O arquivo no Drive mudou desde a última sincronização, e este aparelho também tem alterações. Qual versão você quer manter? A outra fica salva como cópia no seu Drive.",
    [{label:"Usar a versão do Drive", value:"remote"},{label:"Manter a deste aparelho", value:"local"}]);
  Store.syncing = true; renderSync();
  if(!choice) return;
  const stamp = new Date().toISOString().slice(0,16).replace(/[-:T]/g,"");
  if(choice==="remote"){
    await driveCreate(`bolso-conflito-${stamp}-aparelho.json`, snapshot(), Store.copiesId);
    const d = await driveRead(Store.fileId); if(!validBackup(d)) throw {code:"badfile"};
    applyData(d); Store.dirty = false; render();
  } else {
    const d = await driveRead(Store.fileId); await driveCreate(`bolso-conflito-${stamp}-drive.json`, d, Store.copiesId);
    const u = await driveUpdate(Store.fileId, snapshot()); m.md5Checksum = u.md5Checksum; Store.dirty = false;
  }
}
async function monthlyBackup(){
  const ym = ymOf(todayStr());
  if(!S.cfg || Store.lastBackup === ym) return;
  const name = `bolso-backup-${ym}.json`;
  if(!await driveFind(name, Store.copiesId)) await driveCreate(name, snapshot(), Store.copiesId); // um por mês, mesmo com vários aparelhos
  Store.lastBackup = ym;
}

function renderSync(){
  const b = $("#sync"); if(!b) return;
  let cls = "", label = "", title = "";
  if(DEMO){ cls="demo"; label="Demo"; title="Modo de demonstração: nada é salvo"; }
  else if(!navigator.onLine){ cls="off"; label="Offline"; title="Sem internet. As alterações ficam neste aparelho e vão para o Drive depois."; }
  else if(Store.syncing){ cls="busy"; label="Salvando"; title="Sincronizando com o Google Drive"; }
  else if(!hasToken()){ cls = Store.dirty ? "warn" : ""; label = Store.everConnected ? "Sincronizar" : "Conectar"; title = Store.everConnected ? "Toque para sincronizar com o Google Drive" : "Toque para conectar ao Google Drive"; }
  else if(Store.error){ cls="warn"; label="Tentar de novo"; title="Não foi possível sincronizar"; }
  else if(Store.dirty){ cls="busy"; label="Pendente"; title="Alterações aguardando envio"; }
  else { cls="ok"; label="Salvo"; title="Tudo salvo no Google Drive"; }
  b.className = "sync " + cls; b.querySelector("span").textContent = label; b.title = title; b.setAttribute("aria-label", title);
  const nb = $("#banner");
  if(nb && !DEMO && S.cfg && Store.dirty && !hasToken() && navigator.onLine) nb.innerHTML = `<button class="banner bannerbtn" data-act="sync">☁️ Alterações só neste aparelho. <b>Toque para salvar no Drive</b></button>`;
  else if(nb && nb.querySelector(".bannerbtn")) nb.innerHTML = "";
}
function setBanner(t){ $("#banner").innerHTML = t ? `<div class="banner">${esc(t)}</div>` : ""; }

/* ============ Bloqueio por digital (WebAuthn, só neste aparelho) ============ */
const LOCK_KEY = "bolso-lock";
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64d = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
function lockInfo(){ try{ return JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); }catch(e){ return null; } }
const lockEnabled = ()=> !DEMO && !!(lockInfo() && lockInfo().credId);
async function lockAvailable(){ try{ return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }catch(e){ return false; } }
async function enableLock(){
  if(!await lockAvailable()) return toast("Este aparelho não oferece desbloqueio por digital para sites.");
  try{
    const cred = await navigator.credentials.create({ publicKey:{
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name:"Bolso" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name:"bolso", displayName:"Bolso" },
      pubKeyCredParams: [{type:"public-key", alg:-7},{type:"public-key", alg:-257}],
      authenticatorSelection: { authenticatorAttachment:"platform", userVerification:"required", residentKey:"discouraged" },
      attestation: "none", timeout: 60000 }});
    localStorage.setItem(LOCK_KEY, JSON.stringify({credId: b64e(cred.rawId)}));
    toast("Bloqueio por digital ativado."); render();
  }catch(e){ toast("Bloqueio não ativado."); }
}
async function disableLock(){
  if(!await confirmBox("Desativar bloqueio","O Bolso vai abrir sem pedir a digital neste aparelho.",[{label:"Desativar",value:1,cls:"danger"}])) return;
  try{ localStorage.removeItem(LOCK_KEY); }catch(e){} render(); toast("Bloqueio desativado.");
}
let locked = false, hiddenAt = 0;
// Lembra, só nesta aba e por pouco tempo, que o app estava desbloqueado.
// Assim, puxar para atualizar (recarregar a página) não pede a digital de novo;
// fechar o app ou ficar fora mais que LOCK_AFTER_MS continua bloqueando.
const UNLOCK_KEY = "bolso-unlocked-at";
function markUnlocked(){ try{ sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); }catch(e){} }
function recentlyUnlocked(){ try{ const t = Number(sessionStorage.getItem(UNLOCK_KEY) || 0); return t > 0 && Date.now() - t < LOCK_AFTER_MS; }catch(e){ return false; } }
function showLock(){ locked = true; try{ sessionStorage.removeItem(UNLOCK_KEY); }catch(e){} document.body.classList.add("locked"); $("#lockMsg").textContent = ""; }
async function unlock(){
  const info = lockInfo(); if(!info){ hideLock(); return; }
  try{
    await navigator.credentials.get({ publicKey:{ challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials:[{type:"public-key", id:b64d(info.credId)}], userVerification:"required", timeout:60000 }});
    hideLock();
  }catch(e){ $("#lockMsg").textContent = "Não foi possível confirmar. Tente de novo."; }
}
function hideLock(){ locked = false; markUnlocked(); document.body.classList.remove("locked"); render(); renderSync(); if(hasToken()) syncNow(); }
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden){ hiddenAt = Date.now(); if(!locked) markUnlocked(); persistLocal(true); return; }
  if(lockEnabled() && !locked && hiddenAt && Date.now()-hiddenAt > LOCK_AFTER_MS){ showLock(); return; }
  if(!locked && hasToken()) syncNow();
  checkUpdate();
});
window.addEventListener("online", ()=>{ renderSync(); scheduleSync(); });
window.addEventListener("offline", renderSync);
let resizeT; window.addEventListener("resize", ()=>{ clearTimeout(resizeT); resizeT = setTimeout(render, 150); });
window.addEventListener("pagehide", ()=>{ if(!locked) markUnlocked(); persistLocal(true); });

/* ============ Boas-vindas (sem dados ainda) ============ */
function viewWelcome(){
  return `<div class="card hero welcome"><div class="big" style="font-size:24px">Bem-vindo ao Bolso</div><div class="sub">Seus dados ficam neste aparelho e num arquivo no seu Google Drive. Só você tem acesso.</div></div>
  <div class="card"><h2>1. Conectar ao Google Drive</h2><p class="t2" style="margin:0 0 10px;font-size:14px">Se você já usa o Bolso em outro aparelho, os dados aparecem aqui. Se não, criamos um arquivo novo.</p><button class="btn" data-act="sync">Conectar ao Google Drive</button></div>
  <div class="card"><h2>2. Ou trazer um backup</h2><p class="t2" style="margin:0 0 10px;font-size:14px">Use o “Backup completo” gerado na versão anterior do Bolso.</p><button class="btn sec" data-act="import">Restaurar backup</button></div>
  <div class="card"><h2>3. Ou começar do zero</h2><button class="btn sec" data-act="startEmpty">Começar com contas e categorias padrão</button></div>`;
}

/* ============ Demonstração (dados fictícios, nada é salvo) ============ */
function demoData(){
  const cfg = defaultConfig(); cfg.invV1 = true; cfg.grpV1 = true;
  const acc0 = cfg.accounts[0]; acc0.name = "Banco Exemplo"; acc0.initial = 3200;
  cfg.accounts.push({id:"inv1", name:"Reserva", kind:"inv", initial:5000, icon:"🛟", goal:12000, goalDate:ymAdd(ymOf(todayStr()),12)});
  cfg.accounts.push({id:"inv2", name:"Viagem", kind:"inv", initial:800, icon:"🏖️"});
  cfg.cards.push({id:"cd1", name:"Cartão Exemplo", limit:5000, closeDay:5, dueDay:12, accountId:acc0.id});
  const byName = n => cfg.categories.find(c=>c.name===n).id;
  cfg.budgets[byName("Mercado")] = 900; cfg.budgets[byName("Lazer")] = 400; cfg.budgets[byName("Transporte")] = 300;
  const months = {}; const add = it => (months[ymOf(it.date)] ||= []).push({paid:true, created:0, ...it, id:newId()});
  for(let k=2;k>=0;k--){
    const ym = ymAdd(ymOf(todayStr()), -k);
    add({type:"inc", amount:6000, desc:"Salário", date:ym+"-05", catId:byName("Salário"), accountId:acc0.id});
    add({type:"exp", amount:1500, desc:"Aluguel", date:ym+"-10", catId:byName("Moradia"), accountId:acc0.id, paid:k>0});
    add({type:"exp", amount:420.5, desc:"Mercado do mês", date:ym+"-08", catId:byName("Mercado"), accountId:acc0.id});
    add({type:"exp", amount:89.9, desc:"Cinema", date:ym+"-03", catId:byName("Lazer"), cardId:"cd1", accountId:null});
    add({type:"exp", amount:120, desc:"Combustível", date:ym+"-06", catId:byName("Transporte"), cardId:"cd1", accountId:null});
    add({type:"tr", amount:500, desc:"Aporte Reserva", date:ym+"-06", accountId:acc0.id, toAccountId:"inv1"});
    add({type:"rend", amount:45.3, desc:"Rendimento", date:ym+"-28", accountId:"inv1"});
  }
  return {config:cfg, months};
}

/* ============ Atualizações do app ============ */
let swReg = null;
function setupSW(){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { updateViaCache:"none" }).then(reg=>{
    swReg = reg;
    const track = w => { if(!w) return; if(w.state==="installed" && navigator.serviceWorker.controller) showUpdate(); w.addEventListener("statechange", ()=>{ if(w.state==="installed" && navigator.serviceWorker.controller) showUpdate(); }); };
    if(reg.waiting && navigator.serviceWorker.controller) showUpdate();
    track(reg.installing); // uma atualização pode já estar baixando quando o app abre
    reg.addEventListener("updatefound", ()=>track(reg.installing));
    reg.update().catch(()=>{});
    setInterval(()=>{ if(!document.hidden) reg.update().catch(()=>{}); }, 30*60*1000);
  }).catch(()=>{});
  let reloading = false;
  // Só recarrega quando o usuário pediu a atualização (na primeira instalação o SW também assume o controle).
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{ if(!updateRequested || reloading) return; reloading = true; location.reload(); });
}
function checkUpdate(){ if(swReg) swReg.update().catch(()=>{}); }
async function manualUpdateCheck(){
  if(!swReg && "serviceWorker" in navigator){ try{ swReg = await navigator.serviceWorker.getRegistration() || null; }catch(e){} }
  if(!swReg){ return toast("Atualizações indisponíveis neste navegador."); }
  toast("Procurando atualização…");
  try{ await swReg.update(); }catch(e){ return toast(navigator.onLine ? "Não foi possível verificar agora." : "Sem internet."); }
  if(swReg.waiting){ showUpdate(); return toast("Nova versão pronta. Toque em Atualizar no topo."); }
  if(swReg.installing){ toast("Baixando a nova versão…"); return; }
  toast(`Você já está na versão mais recente (v${APP_VERSION}).`);
}
async function forceUpdate(){
  if(!await confirmBox("Forçar atualização","O app vai baixar de novo a versão mais recente. Seus dados e o bloqueio por digital continuam como estão.",[{label:"Forçar atualização",value:1}])) return;
  try{
    await persistLocal(true);
    const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister()));
    const keys = await caches.keys(); await Promise.all(keys.filter(k=>k.startsWith("bolso-")).map(k=>caches.delete(k)));
  }catch(e){}
  location.reload();
}
function showUpdate(){ $("#update").hidden = false; }
let updateRequested = false;
function applyUpdate(){ updateRequested = true; persistLocal(true); if(swReg && swReg.waiting) swReg.waiting.postMessage("skipWaiting"); }

/* ============ Arquivos ============ */
function downloadFile(name, text, type){
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

/* ============ Eventos ============ */
document.addEventListener("click", e=>{
  const t = e.target.closest("[data-act],[data-tab]"); if(!t) return;
  if(t.dataset.tab && !t.dataset.act){ S.tab=t.dataset.tab; render(); window.scrollTo(0,0); return; }
  const a = t.dataset.act, id = t.dataset.id;
  if(a==="toggle"){ e.stopPropagation(); const it=findItem(id); if(it){ it.paid=!it.paid; commit([ymOf(it.date)]); } return; }
  if(a==="edit"){ const it=findItem(id); if(it) (it.type==="rend" ? rendForm(it) : txForm(it)); }
  else if(a==="tab"){ S.tab=t.dataset.tab; if(t.dataset.filter){ S.txFilter=t.dataset.filter; S.fAcc.clear(); S.fCat.clear(); S.fRec.clear(); } render(); window.scrollTo(0,0); }
  else if(a==="filter"){ S.txFilter=t.dataset.f; render(); }
  else if(a==="filters") filtersSheet();
  else if(a==="togglePend") togglePend();
  else if(a==="cardMode"){ if(cardDateMode()!==t.dataset.m){ S.cfg.cardDateMode = t.dataset.m; saveCfg(); render(); } }
  else if(a==="checkUpd") manualUpdateCheck();
  else if(a==="forceUpd") forceUpdate();
  else if(a==="reorder") reorderSheet(t.dataset.what);
  else if(a==="invOpen") invSheet(id);
  else if(a==="updBal") updBalSheet(id||null);
  else if(a==="aporte"){ closeSheet(); moveForm("aporte", id); }
  else if(a==="resgate"){ closeSheet(); moveForm("resgate", id); }
  else if(a==="newInv") accountForm(null, "inv");
  else if(a==="toggleInvTable"){ S.invTable=!S.invTable; render(); }
  else if(a==="rmType"){ S.txFilter="all"; render(); }
  else if(a==="rmAcc"){ S.fAcc.delete(t.dataset.k); render(); }
  else if(a==="rmCat"){ S.fCat.delete(t.dataset.k); render(); }
  else if(a==="rmRec"){ S.fRec.delete(t.dataset.k); render(); }
  else if(a==="clearF"){ S.fAcc.clear(); S.fCat.clear(); S.fRec.clear(); S.txFilter="all"; render(); }
  else if(a==="accfilter"){ S.fAcc=new Set([t.dataset.k]); S.fCat.clear(); S.fRec.clear(); S.txFilter="all"; S.txSearch=""; S.tab="tx"; render(); window.scrollTo(0,0); }
  else if(a==="catfilter"){ const ids = t.dataset.id ? [t.dataset.id] : (t.dataset.ids||"").split(",").filter(Boolean); S.fCat=new Set(ids); S.fAcc.clear(); S.fRec.clear(); S.txFilter="all"; S.txSearch=""; S.tab="tx"; render(); window.scrollTo(0,0); }
  else if(a==="goinv"){ S.tab="cards"; S.cardSel=t.dataset.card; S.cardInv=t.dataset.key; S.month=t.dataset.key; render(); window.scrollTo(0,0); }
  else if(a==="selcard"){ S.cardSel=id; render(); }
  else if(a==="payinv") payInvoice(t.dataset.key);
  else if(a==="unpayinv"){ confirmBox("Reabrir fatura","O pagamento registrado será removido.",[{label:"Reabrir",value:1,cls:"danger"}]).then(ok=>{ if(ok){ delete S.cfg.invoicePaid[S.cardSel+"|"+t.dataset.key]; saveCfg(); render(); } }); }
  else if(a==="newAccount") accountForm(null);
  else if(a==="editAccount") accountForm(acc(id));
  else if(a==="newCard") cardForm(null);
  else if(a==="editCard") cardForm(card(id));
  else if(a==="editCat") catForm(cat(id));
  else if(a==="manage"){ ({accounts:manageAccounts,cards:manageCards,cats:()=>manageCats("exp")})[t.dataset.what](); }
  else if(a==="budgets") budgetsForm();
  else if(a==="toggleTable"){ S.reportTable=!S.reportTable; render(); }
  else if(a==="export") exportData(t.dataset.fmt);
  else if(a==="import") importForm();
  else if(a==="sync"){ if(hasToken()) syncNow(); else connectDrive(); }
  else if(a==="disconnect") disconnectDrive();
  else if(a==="lockOn") enableLock();
  else if(a==="lockOff") disableLock();
  else if(a==="startEmpty"){ S.cfg = defaultConfig(); S.cfg.invV1 = true; S.cfg.grpV1 = true; S.months = {}; markChanged(); render(); }
});
document.addEventListener("input", e=>{ if(e.target.id==="txSearch"){ S.txSearch=e.target.value; const pos=e.target.selectionStart; render(); const s=$("#txSearch"); s.focus(); s.setSelectionRange(pos,pos); } });
$("#fab").onclick = ()=>{ if(S.ready && S.cfg) txForm(null); };
$("#unlockBtn").onclick = unlock;
$("#updBtn").onclick = applyUpdate;
$("#prevM").onclick = ()=>{ S.month=ymAdd(S.month,-1); if(S.tab==="cards") S.cardInv=S.month; render(); };
$("#nextM").onclick = ()=>{ S.month=ymAdd(S.month,1); if(S.tab==="cards") S.cardInv=S.month; render(); };


/* ============ Início ============ */
if(lockEnabled() && !recentlyUnlocked()) showLock();
initStore().then(()=>{ if(lockEnabled() && locked) unlock(); });
initGoogle();
setupSW();
