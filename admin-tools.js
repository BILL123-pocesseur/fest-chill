/* ============================================================
   FEST&CHILL — OUTILS ADMINISTRATEUR (chargé par festchill-admin.html)
   Ajoute : tableau de bord, file de retraits, remboursements, exports,
   modération des événements, détection de fraude, annonces, recherche.
   Chaque action est revérifiée côté serveur (fonctions fc_admin_*).
   ============================================================ */
(function () {
  'use strict';
  if (typeof supa === 'undefined') return;

  const esc = (v) => fcEscapeHtml(v == null ? '' : String(v));
  const money = (n) => Number(n || 0).toLocaleString('fr-FR') + ' F';
  const when = (d) => (d ? fcFormatDateTime(new Date(d)) : '—');
  const toast = (m, ok) => { try { showToast(m, ok === false ? FCI['x-circle'] : FCI['check-circle']); } catch (e) { alert(m); } };
  const TH = 'text-align:left;padding:8px 12px;font-size:.7rem;color:var(--muted);text-transform:uppercase;white-space:nowrap';
  const TD = 'padding:9px 12px;font-size:.8rem;border-top:1px solid var(--border);vertical-align:middle';
  const loaded = {};
  const FCAdmin = window.FCAdmin = {};   // déclaré tout de suite : utilisé par les chargements paresseux ci-dessous

  async function rpc(name, args) {
    const { data, error } = await supa.rpc(name, args || {});
    if (error) throw error;
    return data;
  }
  function table(headers, rowsHtml, empty) {
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'
      + headers.map(h => '<th style="' + TH + '">' + h + '</th>').join('') + '</tr></thead><tbody>'
      + (rowsHtml || '<tr><td colspan="' + headers.length + '" style="' + TD + ';text-align:center;color:var(--muted)">' + (empty || 'Rien à afficher') + '</td></tr>')
      + '</tbody></table></div>';
  }
  function card(id, title, extraHead, bodyId) {
    return '<div class="section-card" id="' + id + '" style="margin-bottom:16px">'
      + '<div class="section-head" style="padding:14px 18px;flex-wrap:wrap;gap:10px"><span class="section-head-title">' + title + '</span>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + (extraHead || '') + '</div></div>'
      + '<div id="' + bodyId + '"><div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem">Chargement…</div></div></div>';
  }
  function fail(el, e) { el.innerHTML = '<div style="padding:20px;color:var(--red);font-size:.85rem">Erreur : ' + esc(e.message || e) + '</div>'; }

  /* ---------- Cartes (chaque page admin place des emplacements data-slot) ---------- */
  const btn = (label, cls, attrs) => '<button class="btn ' + cls + ' btn-sm" ' + attrs + '>' + label + '</button>';
  const DEFS = {
    'sec-dashboard': ['📈 Tableau de bord', btn('Actualiser', 'btn-ghost', 'onclick="FCAdmin.dash()"'), 'dash-body', () => FCAdmin.dash()],
    'sec-withdrawals': ['💸 File de retraits',
      '<select id="wd-filter" onchange="FCAdmin.withdrawals()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)">'
      + '<option value="">Tous</option><option value="pending">En attente</option><option value="failed">Échoués</option><option value="confirmed">Envoyés</option></select>', 'wd-body', () => FCAdmin.withdrawals()],
    'sec-refunds': ['↩️ Remboursements à effectuer', '', 'refunds-body', () => FCAdmin.refunds()],
    'sec-exports': ['📤 Exports Excel / CSV', '', 'exports-body', () => FCAdmin.exportsInit()],
    'sec-moderation': ['🛡️ Modération des événements',
      '<input id="mod-search" placeholder="Rechercher un événement…" oninput="FCAdmin.moderationRender()" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)">', 'mod-body', () => FCAdmin.moderation()],
    'sec-featured': ['⭐ Mise en avant payante', btn('Actualiser', 'btn-ghost', 'onclick="FCAdmin.featured()"'), 'feat-body', () => FCAdmin.featured()],
    'sec-fraud': ['🚨 Détection de fraude', btn('Actualiser', 'btn-ghost', 'onclick="FCAdmin.fraud()"'), 'fraud-body', () => FCAdmin.fraud()],
    'sec-sessions': ['📱 Connexions récentes', btn('Actualiser', 'btn-ghost', 'onclick="FCAdmin.sessions()"'), 'sess-body', () => FCAdmin.sessions()],
    'sec-audit': ['📜 Journal des actions admin', btn('Actualiser', 'btn-ghost', 'onclick="FCAdmin.audit()"'), 'audit-body', () => FCAdmin.audit()],
    'sec-announce': ['📢 Annonces aux organisateurs', '', 'announce-body', () => FCAdmin.announce()],
    'sec-search': ['🔎 Recherche d\'un ticket ou d\'un acheteur', '', 'search-body', () => FCAdmin.searchInit()]
  };
  function mountSlots() {
    document.querySelectorAll('[data-slot]').forEach(slot => {
      const d = DEFS[slot.dataset.slot];
      if (!d) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = card(slot.dataset.slot, d[0], d[1], d[2]);
      slot.replaceWith(wrap.firstElementChild);
      d[3]();
    });
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  /* ---------- 1. Tableau de bord ---------- */
  FCAdmin.dash = async function () {
    const el = document.getElementById('dash-body');
    try {
      const d = await rpc('fc_admin_dashboard');
      const kpi = (label, o) => '<div style="flex:1 1 150px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--card)">'
        + '<div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;font-weight:700">' + label + '</div>'
        + '<div style="font-size:1.35rem;font-weight:800;margin-top:4px">' + money(o.amount) + '</div>'
        + '<div style="font-size:.75rem;color:var(--muted)">' + o.count + ' ticket(s)</div></div>';
      const series = d.series || [];
      const max = Math.max(1, ...series.map(s => s.amount));
      const bw = 600 / Math.max(1, series.length);
      const bars = series.map((s, i) => {
        const h = Math.round((s.amount / max) * 120);
        return '<rect x="' + (i * bw + 2).toFixed(1) + '" y="' + (140 - h) + '" width="' + Math.max(2, bw - 4).toFixed(1) + '" height="' + Math.max(h, s.amount ? 2 : 0) + '" rx="3" fill="var(--glow)" opacity="' + (s.amount ? '.9' : '.15') + '"><title>'
          + esc(s.d) + ' — ' + money(s.amount) + ' (' + s.count + ' ticket(s))</title></rect>';
      }).join('');
      const al = d.alerts || {};
      const chip = (n, label, href, danger) => '<a href="' + href + '" '
        + 'style="display:inline-flex;gap:6px;align-items:center;padding:8px 12px;border-radius:100px;font-size:.78rem;font-weight:700;text-decoration:none;color:inherit;border:1px solid '
        + (n > 0 && danger ? 'rgba(255,90,95,.5);background:rgba(255,90,95,.12)' : n > 0 ? 'rgba(245,158,11,.5);background:rgba(245,158,11,.12)' : 'var(--border);background:transparent;opacity:.65') + '">'
        + '<b>' + n + '</b> ' + label + '</a>';
      const top = (d.top_events || []).map((e, i) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--border);font-size:.82rem"><span>'
        + (i + 1) + '. ' + esc(e.title) + '</span><b style="white-space:nowrap">' + money(e.amount) + ' · ' + e.tickets + ' 🎟️</b></div>').join('') || '<div style="color:var(--muted);font-size:.82rem">Pas encore de ventes.</div>';
      const p = d.platform || {};
      let featRev = 0;
      try { const fr = await supa.from('feature_orders').select('amount').eq('status', 'paid'); featRev = (fr.data || []).reduce((s, o) => s + o.amount, 0); } catch (e) {}
      el.innerHTML = '<div style="padding:16px 18px">'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' + kpi('Aujourd\'hui', d.today) + kpi('7 derniers jours', d.week) + kpi('30 derniers jours', d.month) + kpi('Depuis le début', d.total) + '</div>'
        + '<div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px">Ventes des 30 derniers jours</div>'
        + '<svg viewBox="0 0 600 150" preserveAspectRatio="none" style="width:100%;height:150px">' + bars + '</svg>'
        + '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-bottom:16px"><span>' + esc((series[0] || {}).d || '') + '</span><span>' + esc((series[series.length - 1] || {}).d || '') + '</span></div>'
        + '<div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px">À surveiller</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">'
        + chip(al.pending_withdrawals || 0, 'retrait(s) en attente', 'festchill-admin-finance.html#sec-withdrawals', false)
        + chip(al.failed_withdrawals || 0, 'retrait(s) échoué(s)', 'festchill-admin-finance.html#sec-withdrawals', true)
        + chip(al.fraud || 0, 'alerte(s) fraude', 'festchill-admin-security.html', true)
        + chip(al.locked_pins || 0, 'PIN bloqué(s)', 'festchill-admin-users.html', false)
        + chip(al.blocked_accounts || 0, 'compte(s) bloqué(s)', 'festchill-admin-users.html', false)
        + chip(al.flagged_events || 0, 'événement(s) signalé(s)', 'festchill-admin-events.html', true)
        + chip(al.refunds_to_pay || 0, 'remboursement(s) à payer', 'festchill-admin-finance.html#sec-refunds', true) + '</div>'
        + '<div style="display:flex;gap:24px;flex-wrap:wrap"><div style="flex:1 1 280px"><div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px">Top 5 événements</div>' + top + '</div>'
        + '<div style="flex:1 1 220px"><div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px">Plateforme</div>'
        + '<div style="font-size:.85rem;line-height:1.9">👥 ' + (p.organizers || 0) + ' organisateurs<br>🎪 ' + (p.events_published || 0) + ' événements en vente<br>🎟️ ' + (p.tickets_sold || 0) + ' tickets vendus<br>💰 ' + money(p.commissions) + ' de commissions<br>⭐ ' + money(featRev) + ' de mises en avant</div></div></div></div>';
    } catch (e) { fail(el, e); }
  };

  /* ---------- 2. File de retraits ---------- */
  FCAdmin.withdrawals = async function () {
    const el = document.getElementById('wd-body');
    try {
      const st = document.getElementById('wd-filter').value || null;
      const rows = await rpc('fc_admin_list_withdrawals', { p_status: st });
      const badge = (s) => s === 'confirmed' ? '<span class="badge b-green">Envoyé</span>' : s === 'failed' ? '<span class="badge b-red">Échoué</span>' : '<span class="badge b-gold">En attente</span>';
      el.innerHTML = table(['Date', 'Organisateur', 'Montant net', 'Commission', 'Mobile Money', 'Statut', 'Actions'], rows.map(w => {
        let acts = '';
        if (w.w_status === 'pending' && !w.w_started_at) acts = btn('Bloquer', 'btn-danger', 'onclick="FCAdmin.wdBlock(\'' + w.w_id + '\')"');
        else if (w.w_status === 'pending') acts = '<span class="badge b-gray">En cours de traitement</span>';
        if (w.w_status === 'failed') acts = btn('Relancer', 'btn-success', 'onclick="FCAdmin.wdRetry(\'' + w.w_id + '\')"');
        return '<tr><td style="' + TD + ';white-space:nowrap">' + esc(when(w.w_created_at)) + '</td>'
          + '<td style="' + TD + '"><b>' + esc(w.w_name || '—') + '</b>' + (w.w_is_platform ? ' <span class="badge b-gray">Commissions</span>' : '') + '<div style="color:var(--muted);font-size:.72rem">' + esc(w.w_email || '') + '</div></td>'
          + '<td style="' + TD + '"><b>' + money(w.w_net) + '</b></td><td style="' + TD + '">' + money(w.w_commission) + '</td>'
          + '<td style="' + TD + '">' + esc((w.w_operator || '').toUpperCase()) + '<div style="color:var(--muted);font-size:.72rem">' + esc(w.w_phone) + '</div></td>'
          + '<td style="' + TD + '">' + badge(w.w_status) + '</td><td style="' + TD + '">' + acts + '</td></tr>';
      }).join(''), 'Aucun retrait');
    } catch (e) { fail(el, e); }
  };
  FCAdmin.wdBlock = async function (id) {
    if (!confirm('Bloquer ce retrait suspect ? Il ne sera pas envoyé et l\'argent redevient disponible pour l\'organisateur.')) return;
    try { await rpc('fc_admin_block_withdrawal', { p_id: id }); toast('Retrait bloqué'); FCAdmin.withdrawals(); } catch (e) { toast(e.message, false); }
  };
  FCAdmin.wdRetry = async function (id) {
    if (!confirm('Relancer ce retrait ? L\'argent sera envoyé de nouveau par Mobile Money.')) return;
    try {
      await rpc('fc_admin_retry_withdrawal', { p_id: id });
      const { data, error } = await supa.functions.invoke('fedapay-payout', { body: { withdrawal_id: id } });
      if (error || (data && data.error)) throw new Error((data && data.error) || error.message);
      toast('Retrait relancé et envoyé');
    } catch (e) { toast('Relance : ' + (e.message || e), false); }
    FCAdmin.withdrawals();
  };

  /* ---------- 3. Remboursements ---------- */
  FCAdmin.refunds = async function () {
    const el = document.getElementById('refunds-body');
    try {
      const rows = await rpc('fc_admin_list_refunds');
      el.innerHTML = '<div style="padding:12px 18px;font-size:.78rem;color:var(--muted)">Quand tu rembourses un ticket (page Recherche), le ticket est annulé tout de suite. L\'argent, lui, se rend à l\'acheteur par Mobile Money : fais-le puis clique « Marquer remboursé ».</div>'
        + table(['Date', 'Acheteur', 'Événement', 'Montant', 'Motif', 'Statut', ''], rows.map(r =>
          '<tr><td style="' + TD + ';white-space:nowrap">' + esc(when(r.r_created_at)) + '</td><td style="' + TD + '"><b>' + esc(r.r_buyer) + '</b><div style="color:var(--muted);font-size:.72rem">' + esc(r.r_phone) + '</div></td>'
          + '<td style="' + TD + '">' + esc(r.r_event) + '</td><td style="' + TD + '"><b>' + money(r.r_amount) + '</b></td><td style="' + TD + '">' + esc(r.r_reason || '—') + '</td>'
          + '<td style="' + TD + '">' + (r.r_status === 'done' ? '<span class="badge b-green">Remboursé</span>' : '<span class="badge b-red">À payer</span>') + '</td>'
          + '<td style="' + TD + '">' + (r.r_status === 'to_pay' ? btn('Marquer remboursé', 'btn-success', 'onclick="FCAdmin.refundDone(\'' + r.r_id + '\')"') : '') + '</td></tr>').join(''), 'Aucun remboursement');
    } catch (e) { fail(el, e); }
  };
  FCAdmin.refundDone = async function (id) {
    if (!confirm('Confirmer que l\'acheteur a bien reçu son remboursement par Mobile Money ?')) return;
    try { await rpc('fc_admin_mark_refund_done', { p_id: id }); toast('Remboursement marqué comme payé'); FCAdmin.refunds(); } catch (e) { toast(e.message, false); }
  };

  /* ---------- 4. Exports ---------- */
  FCAdmin.exportsInit = function () {
    const el = document.getElementById('exports-body');
    el.innerHTML = '<div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><label style="font-size:.8rem">Du <input type="date" id="ex-from" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)"></label>'
      + '<label style="font-size:.8rem">au <input type="date" id="ex-to" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)"></label>'
      + btn('📥 Exporter les ventes', 'btn-success', 'onclick="FCAdmin.exportSales()"') + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + btn('📥 Exporter les organisateurs', 'btn-ghost', 'onclick="FCAdmin.exportUsers()"') + btn('📥 Exporter les commissions', 'btn-ghost', 'onclick="FCAdmin.exportCommissions()"') + '</div>'
      + '<div style="font-size:.75rem;color:var(--muted)">Les fichiers s\'ouvrent directement dans Excel (accents et colonnes corrects).</div></div>';
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  FCAdmin.exportSales = async function () {
    try {
      const from = document.getElementById('ex-from').value || null, to = document.getElementById('ex-to').value || null;
      const rows = await rpc('fc_admin_export_sales', { p_from: from, p_to: to });
      fcDownloadCsv('ventes-festchill-' + stamp() + '.csv', ['Date', 'Événement', 'Organisateur', 'Catégorie', 'N° ticket', 'Acheteur', 'Téléphone', 'Montant (F)', 'Réduction (F)', 'Opérateur', 'Statut', 'Commande'],
        rows.map(r => [fcFormatDateTime(new Date(r.x_date)), r.x_event, r.x_organizer, r.x_category, r.x_ticket, r.x_buyer, r.x_phone, r.x_amount, r.x_discount, r.x_operator, r.x_status === 'refunded' ? 'remboursé' : 'payé', r.x_order]));
      toast(rows.length + ' vente(s) exportée(s)');
    } catch (e) { toast(e.message, false); }
  };
  FCAdmin.exportUsers = async function () {
    try {
      const rows = await rpc('fc_admin_list_users');
      fcDownloadCsv('utilisateurs-festchill-' + stamp() + '.csv', ['Nom', 'E-mail', 'Téléphone', 'Rôle', 'Statut', 'Certifié', 'Commission perso (%)', 'Événements', 'Inscrit le', 'Dernière connexion'],
        rows.map(u => [u.u_name, u.u_email, u.u_phone, u.u_role, u.u_status, u.u_certified ? 'oui' : 'non', u.u_commission == null ? '' : u.u_commission, u.u_events,
          fcFormatDateTime(new Date(u.u_created_at)), u.u_last_sign_in ? fcFormatDateTime(new Date(u.u_last_sign_in)) : '']));
      toast(rows.length + ' utilisateur(s) exporté(s)');
    } catch (e) { toast(e.message, false); }
  };
  FCAdmin.exportCommissions = async function () {
    try {
      const rows = await rpc('fc_admin_export_commissions');
      fcDownloadCsv('commissions-festchill-' + stamp() + '.csv', ['Date', 'Organisateur', 'Taux (%)', 'Commission (F)', 'Net versé (F)', 'Opérateur', 'Statut du retrait', 'Retrait'],
        rows.map(r => [fcFormatDateTime(new Date(r.x_date)), r.x_organizer, r.x_rate, r.x_commission, r.x_net, r.x_operator, r.x_status, r.x_withdrawal]));
      toast(rows.length + ' commission(s) exportée(s)');
    } catch (e) { toast(e.message, false); }
  };

  /* ---------- 5. Modération ---------- */
  let modData = [];
  FCAdmin.moderation = async function () {
    const el = document.getElementById('mod-body');
    try { modData = await rpc('fc_admin_list_events'); FCAdmin.moderationRender(); } catch (e) { fail(el, e); }
  };
  FCAdmin.moderationRender = function () {
    const el = document.getElementById('mod-body');
    const q = (document.getElementById('mod-search').value || '').toLowerCase().trim();
    const rows = modData.filter(e => !q || (e.e_title || '').toLowerCase().includes(q) || (e.e_organizer || '').toLowerCase().includes(q));
    el.innerHTML = table(['Événement', 'Statut', 'Ventes', 'Actions'], rows.map(e => {
      const tags = [];
      if (e.e_hidden) tags.push('<span class="badge b-red">Masqué</span>');
      if (e.e_featured && e.e_featured_until && new Date(e.e_featured_until) < new Date()) tags.push('<span class="badge b-gray">⭐ Une expirée</span>'); else if (e.e_featured) tags.push('<span class="badge b-gold">⭐ À la une' + (e.e_featured_until ? ' jusqu\'au ' + esc(new Date(e.e_featured_until).toLocaleDateString('fr-FR')) : '') + '</span>');
      if (e.e_flagged) tags.push('<span class="badge b-red" title="' + esc(e.e_flag_reason || '') + '">🚩 Signalé</span>');
      tags.push('<span class="badge b-gray">' + esc(e.e_status) + '</span>');
      const id = e.e_id;
      return '<tr><td style="' + TD + '"><b>' + esc(e.e_title) + '</b><div style="color:var(--muted);font-size:.72rem">' + esc(e.e_organizer || '—') + ' · ' + esc(e.e_date ? new Date(e.e_date).toLocaleDateString('fr-FR') : '') + '</div>'
        + (e.e_flag_reason ? '<div style="color:var(--red);font-size:.72rem">🚩 ' + esc(e.e_flag_reason) + '</div>' : '') + '</td>'
        + '<td style="' + TD + '"><div style="display:flex;gap:4px;flex-wrap:wrap">' + tags.join('') + '</div></td>'
        + '<td style="' + TD + ';white-space:nowrap">' + e.e_sold + '/' + e.e_quota + '<div style="color:var(--muted);font-size:.72rem">' + money(e.e_revenue) + '</div></td>'
        + '<td style="' + TD + '"><div style="display:flex;gap:4px;flex-wrap:wrap">'
        + btn(e.e_hidden ? 'Afficher' : 'Masquer', e.e_hidden ? 'btn-success' : 'btn-ghost', 'onclick="FCAdmin.modAct(\'' + id + '\',\'' + (e.e_hidden ? 'unhide' : 'hide') + '\')"')
        + btn(e.e_featured ? 'Retirer de la une' : '⭐ Mettre à la une', 'btn-ghost', 'onclick="FCAdmin.modAct(\'' + id + '\',\'' + (e.e_featured ? 'unfeature' : 'feature') + '\')"')
        + btn(e.e_flagged ? 'Retirer le signalement' : '🚩 Signaler', 'btn-ghost', 'onclick="FCAdmin.modAct(\'' + id + '\',\'' + (e.e_flagged ? 'unflag' : 'flag') + '\')"')
        + '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="festchill-buy-ticket.html?event=' + encodeURIComponent(e.e_slug) + '">Voir</a>'
        + btn('Supprimer', 'btn-danger', 'onclick="FCAdmin.modDelete(\'' + id + '\')"') + '</div></td></tr>';
    }).join(''), 'Aucun événement');
  };
  FCAdmin.modAct = async function (id, action) {
    let text = null, days = null;
    if (action === 'flag') { text = prompt('Pourquoi signaler cet événement ? (visible seulement par les admins)'); if (text === null) return; }
    if (action === 'feature') {
      const a = prompt('Mettre à la une pendant combien de jours ?\n(laisse vide = sans limite de durée)', '7');
      if (a === null) return; days = a.trim() === '' ? null : parseInt(a, 10);
      if (a.trim() !== '' && (!(days > 0) || days > 365)) { toast('Nombre de jours invalide', false); return; }
    }
    if (action === 'hide' && !confirm('Masquer cet événement ? Il disparaît de la liste publique et la vente est bloquée. L\'organisateur le voit toujours.')) return;
    try { await rpc('fc_admin_event_action', { p_event: id, p_action: action, p_text: text, p_days: days }); toast('Action effectuée'); FCAdmin.moderation(); } catch (e) { toast(e.message, false); }
  };
  FCAdmin.modDelete = async function (id) {
    if (!confirm('SUPPRIMER définitivement cet événement ? (refusé s\'il a déjà des ventes)')) return;
    try { await rpc('fc_admin_delete_event', { p_event: id }); toast('Événement supprimé'); FCAdmin.moderation(); } catch (e) { toast(e.message, false); }
  };


  /* ---------- Mise en avant payante : tarifs + achats ---------- */
  FCAdmin.featured = async function () {
    const el = document.getElementById('feat-body');
    try {
      const [plansRes, ordersRes] = await Promise.all([
        supa.from('featured_plans').select('*').order('days', { ascending: true }),
        supa.from('feature_orders').select('id, amount, plan_days, status, created_at, paid_at, events(title), profiles(full_name)').order('created_at', { ascending: false }).limit(60)
      ]);
      if (plansRes.error) throw plansRes.error;
      if (ordersRes.error) throw ordersRes.error;
      const paid = (ordersRes.data || []).filter(o => o.status === 'paid');
      const total = paid.reduce((s, o) => s + o.amount, 0);
      const inp = 'padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);width:100px';
      const planRows = (plansRes.data || []).map(p => '<tr><td style="' + TD + '"><input id="pl-d-' + p.id + '" type="number" min="1" max="90" value="' + p.days + '" style="' + inp + ';width:70px"> jour(s)</td>'
        + '<td style="' + TD + '"><input id="pl-p-' + p.id + '" type="number" min="100" step="100" value="' + p.price + '" style="' + inp + '"> F</td>'
        + '<td style="' + TD + '">' + (p.active ? '<span class="badge b-green">Active</span>' : '<span class="badge b-gray">Désactivée</span>') + '</td>'
        + '<td style="' + TD + '"><div style="display:flex;gap:4px;flex-wrap:wrap">' + btn('Enregistrer', 'btn-success', 'onclick="FCAdmin.planSave(\'' + p.id + '\')"')
        + btn(p.active ? 'Désactiver' : 'Activer', 'btn-ghost', 'onclick="FCAdmin.planToggle(\'' + p.id + '\',' + (!p.active) + ')"')
        + btn('Supprimer', 'btn-danger', 'onclick="FCAdmin.planDelete(\'' + p.id + '\')"') + '</div></td></tr>').join('');
      const st = { paid: '<span class="badge b-green">Payé</span>', pending: '<span class="badge b-gold">En attente</span>', failed: '<span class="badge b-red">Échoué</span>' };
      el.innerHTML = '<div style="padding:14px 18px;font-size:.8rem;color:var(--muted)">Les organisateurs achètent eux-mêmes une mise à la une depuis la page de leur événement. Les prix ci-dessous s\'appliquent tout de suite.</div>'
        + '<div style="padding:0 18px 6px;font-weight:700;font-size:.82rem">Tarifs</div>'
        + table(['Durée', 'Prix', 'État', ''], planRows, 'Aucune offre')
        + '<div style="padding:12px 18px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--border)"><span style="font-size:.8rem">Nouvelle offre :</span>'
        + '<input id="pl-new-d" type="number" min="1" max="90" placeholder="Jours" style="' + inp + ';width:80px"><input id="pl-new-p" type="number" min="100" step="100" placeholder="Prix (F)" style="' + inp + '">'
        + btn('Ajouter', 'btn-success', 'onclick="FCAdmin.planAdd()"') + '</div>'
        + '<div style="padding:14px 18px 6px;font-weight:700;font-size:.82rem">Achats récents — ' + paid.length + ' payé(s), <span style="color:var(--green)">' + money(total) + '</span> encaissés</div>'
        + table(['Date', 'Organisateur', 'Événement', 'Offre', 'Montant', 'État'], (ordersRes.data || []).map(o =>
          '<tr><td style="' + TD + ';white-space:nowrap">' + esc(when(o.created_at)) + '</td><td style="' + TD + '">' + esc(o.profiles && o.profiles.full_name || '—') + '</td>'
          + '<td style="' + TD + '">' + esc(o.events && o.events.title || '—') + '</td><td style="' + TD + '">' + o.plan_days + ' jour(s)</td>'
          + '<td style="' + TD + '"><b>' + money(o.amount) + '</b></td><td style="' + TD + '">' + (st[o.status] || '') + '</td></tr>').join(''), 'Aucun achat pour le moment');
    } catch (e) { fail(el, e); }
  };
  FCAdmin.planSave = async function (id) {
    const days = parseInt(document.getElementById('pl-d-' + id).value, 10), price = parseInt(document.getElementById('pl-p-' + id).value, 10);
    if (!(days >= 1 && days <= 90) || !(price >= 100)) { toast('Durée : 1 à 90 jours. Prix : 100 F minimum.', false); return; }
    const { error } = await supa.from('featured_plans').update({ days, price }).eq('id', id);
    if (error) toast(error.message, false); else { toast('Offre enregistrée'); FCAdmin.featured(); }
  };
  FCAdmin.planToggle = async function (id, active) {
    const { error } = await supa.from('featured_plans').update({ active }).eq('id', id);
    if (error) toast(error.message, false); else FCAdmin.featured();
  };
  FCAdmin.planDelete = async function (id) {
    if (!confirm('Supprimer cette offre ?')) return;
    const { error } = await supa.from('featured_plans').delete().eq('id', id);
    if (error) toast(error.message, false); else FCAdmin.featured();
  };
  FCAdmin.planAdd = async function () {
    const days = parseInt(document.getElementById('pl-new-d').value, 10), price = parseInt(document.getElementById('pl-new-p').value, 10);
    if (!(days >= 1 && days <= 90) || !(price >= 100)) { toast('Durée : 1 à 90 jours. Prix : 100 F minimum.', false); return; }
    const { error } = await supa.from('featured_plans').insert({ days, price });
    if (error) toast(error.message, false); else { toast('Offre ajoutée'); FCAdmin.featured(); }
  };


  /* ---------- Connexions et journal ---------- */
  FCAdmin.sessions = async function () {
    const el = document.getElementById('sess-body');
    try {
      const rows = await rpc('fc_admin_list_sessions', { p_user_id: null, p_limit: 300 });
      el.innerHTML = table(['Utilisateur', 'Appareil', 'Première connexion', 'Dernière activité', 'État'], rows.map(r =>
        '<tr><td style="' + TD + '"><b>' + esc(r.s_name || 'Sans nom') + '</b><div style="color:var(--muted);font-size:.72rem">' + esc(r.s_email || '') + '</div></td>'
        + '<td style="' + TD + '">' + esc(r.s_device || '—') + '<div style="color:var(--muted);font-size:.72rem">' + esc(r.s_browser || '') + '</div></td>'
        + '<td style="' + TD + ';white-space:nowrap">' + esc(when(r.s_created_at)) + '</td><td style="' + TD + ';white-space:nowrap">' + esc(when(r.s_last_seen)) + '</td>'
        + '<td style="' + TD + '">' + (r.s_revoked ? '<span class="badge b-gray">Révoquée</span>' : '<span class="badge b-green">Active</span>') + '</td></tr>').join(''), 'Aucune connexion');
    } catch (e) { fail(el, e); }
  };
  const ACTION_LABELS = {
    reset_pin: 'PIN supprimé / débloqué', block_account: 'Compte bloqué', unblock_account: 'Compte débloqué', invalidate_password: 'Mot de passe supprimé',
    revoke_sessions: 'Déconnexion forcée', delete_account: 'Compte supprimé', set_commission: 'Commission modifiée', block_withdrawal: 'Retrait bloqué',
    retry_withdrawal: 'Retrait relancé', event_hide: 'Événement masqué', event_unhide: 'Événement affiché', event_feature: 'Événement mis à la une',
    event_unfeature: 'Mise à la une retirée', event_flag: 'Événement signalé', event_unflag: 'Signalement retiré', event_delete: 'Événement supprimé',
    announcement_create: 'Annonce publiée', announcement_delete: 'Annonce supprimée', refund_ticket: 'Ticket remboursé', refund_paid: 'Remboursement payé'
  };
  FCAdmin.audit = async function () {
    const el = document.getElementById('audit-body');
    try {
      const rows = await rpc('fc_admin_list_audit', { p_limit: 200 });
      el.innerHTML = table(['Date', 'Admin', 'Action', 'Utilisateur concerné'], rows.map(a =>
        '<tr><td style="' + TD + ';white-space:nowrap">' + esc(when(a.a_created_at)) + '</td><td style="' + TD + '">' + esc(a.a_admin || '—') + '</td>'
        + '<td style="' + TD + '">' + esc(ACTION_LABELS[a.a_action] || a.a_action) + '</td><td style="' + TD + '">' + esc(a.a_target || (a.a_details && a.a_details.name) || '—') + '</td></tr>').join(''), 'Aucune action enregistrée');
    } catch (e) { fail(el, e); }
  };

  /* ---------- 6. Fraude ---------- */
  FCAdmin.fraud = async function () {
    const el = document.getElementById('fraud-body');
    try {
      const rows = await rpc('fc_admin_fraud_alerts');
      const sev = { high: '<span class="badge b-red">Élevé</span>', medium: '<span class="badge b-gold">Moyen</span>', low: '<span class="badge b-gray">Faible</span>' };
      el.innerHTML = table(['Gravité', 'Alerte', 'Détail', 'Date', 'Actions'], rows.map(a => {
        let acts = '';
        if (a.a_kind === 'pin_attempts' && a.a_user_id) acts += btn('Débloquer le PIN', 'btn-ghost', 'onclick="FCAdmin.fraudAct(\'pin\',\'' + a.a_user_id + '\')"');
        if (a.a_user_id) acts += ' ' + btn('Bloquer le compte', 'btn-danger', 'onclick="FCAdmin.fraudAct(\'block\',\'' + a.a_user_id + '\')"');
        if (a.a_event_id && a.a_kind !== 'pin_attempts') acts += ' ' + btn('Masquer l\'événement', 'btn-ghost', 'onclick="FCAdmin.fraudAct(\'hide\',\'' + a.a_event_id + '\')"');
        return '<tr><td style="' + TD + '">' + (sev[a.a_severity] || '') + '</td><td style="' + TD + '"><b>' + esc(a.a_title) + '</b></td><td style="' + TD + '">' + esc(a.a_detail) + '</td>'
          + '<td style="' + TD + ';white-space:nowrap">' + esc(when(a.a_at)) + '</td><td style="' + TD + '"><div style="display:flex;gap:4px;flex-wrap:wrap">' + acts + '</div></td></tr>';
      }).join(''), '✅ Aucune alerte pour le moment');
    } catch (e) { fail(el, e); }
  };
  FCAdmin.fraudAct = async function (kind, id) {
    try {
      if (kind === 'pin') { if (!confirm('Supprimer le PIN de cet utilisateur et lever son blocage ?')) return; await fcAdminResetPin(id); }
      else if (kind === 'block') { if (!confirm('Bloquer ce compte ? Il sera déconnecté.')) return; await fcAdminSetBlocked(id, true); }
      else if (kind === 'hide') { if (!confirm('Masquer cet événement ?')) return; await rpc('fc_admin_event_action', { p_event: id, p_action: 'hide' }); }
      toast('Action effectuée'); FCAdmin.fraud();
    } catch (e) { toast(e.message, false); }
  };

  /* ---------- 7. Annonces ---------- */
  FCAdmin.announce = async function () {
    const el = document.getElementById('announce-body');
    try {
      const [list, users] = await Promise.all([rpc('fc_admin_list_announcements'), rpc('fc_admin_list_users')]);
      const opts = '<option value="">Tous les organisateurs</option>' + users.filter(u => u.u_role !== 'admin').map(u => '<option value="' + esc(u.u_id) + '">' + esc(u.u_name || u.u_email) + '</option>').join('');
      const inp = 'width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);box-sizing:border-box;margin-bottom:8px';
      el.innerHTML = '<div style="padding:16px 18px;border-bottom:1px solid var(--border)">'
        + '<input id="an-title" maxlength="120" placeholder="Titre de l\'annonce" style="' + inp + '">'
        + '<textarea id="an-body" maxlength="1000" rows="3" placeholder="Ton message…" style="' + inp + ';resize:vertical"></textarea>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="an-target" style="' + inp.replace('width:100%', 'width:auto').replace('margin-bottom:8px', 'margin-bottom:0') + '">' + opts + '</select>'
        + '<select id="an-days" style="' + inp.replace('width:100%', 'width:auto').replace('margin-bottom:8px', 'margin-bottom:0') + '"><option value="3">Visible 3 jours</option><option value="7" selected>Visible 7 jours</option><option value="30">Visible 30 jours</option><option value="">Sans limite</option></select>'
        + btn('Publier l\'annonce', 'btn-success', 'onclick="FCAdmin.announcePublish()"') + '</div>'
        + '<div style="font-size:.74rem;color:var(--muted);margin-top:8px">Elle apparaît en haut des pages de chaque organisateur, jusqu\'à ce qu\'il clique « J\'ai compris ».</div></div>'
        + table(['Date', 'Annonce', 'Pour', 'Lue par', ''], list.map(n =>
          '<tr><td style="' + TD + ';white-space:nowrap">' + esc(when(n.n_created_at)) + '</td><td style="' + TD + '"><b>' + esc(n.n_title) + '</b><div style="color:var(--muted);font-size:.74rem">' + esc(n.n_body) + '</div></td>'
          + '<td style="' + TD + '">' + esc(n.n_target_name || 'Tous') + '</td><td style="' + TD + '">' + n.n_reads + '</td>'
          + '<td style="' + TD + '">' + btn('Supprimer', 'btn-danger', 'onclick="FCAdmin.announceDelete(\'' + n.n_id + '\')"') + '</td></tr>').join(''), 'Aucune annonce');
    } catch (e) { fail(el, e); }
  };
  FCAdmin.announcePublish = async function () {
    const title = document.getElementById('an-title').value.trim(), body = document.getElementById('an-body').value.trim();
    if (title.length < 2 || body.length < 2) { toast('Écris un titre et un message', false); return; }
    const target = document.getElementById('an-target').value || null, d = document.getElementById('an-days').value;
    try { await rpc('fc_admin_create_announcement', { p_title: title, p_body: body, p_target: target, p_days: d === '' ? null : parseInt(d, 10) }); toast('Annonce publiée'); FCAdmin.announce(); } catch (e) { toast(e.message, false); }
  };
  FCAdmin.announceDelete = async function (id) {
    if (!confirm('Supprimer cette annonce ?')) return;
    try { await rpc('fc_admin_delete_announcement', { p_id: id }); toast('Annonce supprimée'); FCAdmin.announce(); } catch (e) { toast(e.message, false); }
  };

  /* ---------- 8. Recherche + remboursement ---------- */
  FCAdmin.searchInit = function () {
    const el = document.getElementById('search-body');
    el.innerHTML = '<div style="padding:16px 18px;display:flex;gap:8px;flex-wrap:wrap"><input id="sr-q" placeholder="Numéro de téléphone, nom de l\'acheteur, code QR ou n° de commande" '
      + 'style="flex:1 1 260px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)" onkeydown="if(event.key===\'Enter\')FCAdmin.search()">'
      + btn('Rechercher', 'btn-success', 'onclick="FCAdmin.search()"') + '</div><div id="sr-res"></div>';
  };
  FCAdmin.search = async function () {
    const q = document.getElementById('sr-q').value.trim(), res = document.getElementById('sr-res');
    if (q.length < 3) { res.innerHTML = '<div style="padding:0 18px 16px;color:var(--muted);font-size:.82rem">Tape au moins 3 caractères.</div>'; return; }
    try {
      const rows = await rpc('fc_admin_search', { p_query: q });
      const tb = { valid: '<span class="badge b-green">Valide</span>', used: '<span class="badge b-gray">Déjà scanné</span>', pending: '<span class="badge b-gold">En attente</span>', cancelled: '<span class="badge b-red">Annulé</span>' };
      const ob = { paid: 'payé', pending: 'en attente', failed: 'échoué', refunded: 'remboursé' };
      res.innerHTML = table(['Acheteur', 'Événement', 'Ticket', 'Commande', 'Actions'], rows.map(r =>
        '<tr><td style="' + TD + '"><b>' + esc(r.s_buyer) + '</b><div style="color:var(--muted);font-size:.72rem">' + esc(r.s_phone) + '</div></td>'
        + '<td style="' + TD + '">' + esc(r.s_event) + '<div style="color:var(--muted);font-size:.72rem">' + esc(r.s_organizer || '') + ' · ' + esc(r.s_category || '') + '</div></td>'
        + '<td style="' + TD + '">N°' + esc(r.s_number) + ' ' + (tb[r.s_ticket_status] || '') + '</td>'
        + '<td style="' + TD + '">' + money(r.s_amount) + ' · ' + esc(ob[r.s_order_status] || r.s_order_status) + '<div style="color:var(--muted);font-size:.72rem">' + esc(when(r.s_created_at)) + '</div></td>'
        + '<td style="' + TD + '">' + (r.s_order_status === 'paid' && r.s_ticket_status !== 'used' ? btn('↩️ Rembourser', 'btn-danger', 'onclick="FCAdmin.refund(\'' + r.s_ticket + '\')"') : '') + '</td></tr>').join(''), 'Aucun résultat');
    } catch (e) { fail(res, e); }
  };
  FCAdmin.refund = async function (ticketId) {
    const reason = prompt('Motif du remboursement ? (ex : doublon, événement annulé)');
    if (reason === null) return;
    if (!confirm('Rembourser ce ticket ? Il sera annulé immédiatement (la place est remise en vente). Tu devras ensuite renvoyer l\'argent à l\'acheteur par Mobile Money.')) return;
    try {
      const r = await rpc('fc_admin_refund_ticket', { p_ticket_id: ticketId, p_reason: reason });
      alert('Ticket remboursé.\n\nÀ FAIRE : envoyer ' + money(r.amount) + ' au ' + r.phone + ' par Mobile Money, puis cliquer « Marquer remboursé » dans Finances → Remboursements.'
        + (r.warning ? '\n\n' + r.warning : ''));
      loaded['sec-refunds'] = false; FCAdmin.search();
    } catch (e) { toast(e.message, false); }
  };

  // Les pages admin déposent leurs emplacements : on les remplit une fois toutes les fonctions prêtes
  mountSlots();
})();
