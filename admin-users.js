/* ============================================================
   FEST&CHILL — ADMIN : gestion des utilisateurs
   Une liste simple + une fenêtre « Gérer » avec de gros boutons expliqués.
   Chaque action est revérifiée côté serveur (fonctions fc_admin_*).
   ============================================================ */
(function () {
  'use strict';
  const root = document.getElementById('users-root');
  if (!root || typeof supa === 'undefined') return;

  const esc = (v) => fcEscapeHtml(v == null ? '' : String(v));
  const when = (d) => (d ? fcFormatDateTime(new Date(d)) : 'jamais');
  const toast = (m, ok) => { try { showToast(m, ok === false ? FCI['x-circle'] : FCI['check-circle']); } catch (e) { fcAlert(m); } };
  let users = [], filter = 'all', query = '';

  const isPinLocked = (u) => !!u.u_pin_locked_until;
  // Pastille ronde : photo de profil si elle existe (clic = agrandir), sinon les initiales
  const avatarHtml = (u) => '<div class="u-av" style="position:relative;overflow:hidden"' + (u.u_avatar ? ' data-avatar="' + esc(u.u_avatar) + '" data-name="' + esc(u.u_name || '') + '"' : '') + '>'
    + esc(initials(u)) + (u.u_avatar ? '<img src="' + esc(u.u_avatar) + '" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;cursor:zoom-in" onerror="this.remove()">' : '') + '</div>';
  const initials = (u) => (u.u_name || u.u_email || '??').trim().slice(0, 2).toUpperCase();

  root.innerHTML = '<div class="section-card" style="margin-bottom:16px">'
    + '<div class="u-toolbar"><input class="u-search" id="u-q" placeholder="🔎 Chercher un nom, un e-mail ou un téléphone…">'
    + '<div id="u-chips" style="display:flex;gap:6px;flex-wrap:wrap"></div></div>'
    + '<div id="u-count" style="padding:10px 18px;font-size:.78rem;color:var(--muted)"></div>'
    + '<div id="u-list"><div style="padding:24px;text-align:center;color:var(--muted)">Chargement…</div></div></div>';

  document.getElementById('u-q').addEventListener('input', (e) => { query = e.target.value.toLowerCase().trim(); render(); });

  async function load() {
    try { users = await fcAdminListUsers(); render(); }
    catch (e) { document.getElementById('u-list').innerHTML = '<div style="padding:24px;color:var(--red)">Erreur : ' + esc(e.message) + '</div>'; }
  }

  function matches(u) {
    if (filter === 'organizer' && u.u_role !== 'organizer') return false;
    if (filter === 'pin' && !isPinLocked(u)) return false;
    if (filter === 'blocked' && u.u_status !== 'blocked') return false;
    if (!query) return true;
    return [u.u_name, u.u_email, u.u_phone].some(v => (v || '').toLowerCase().includes(query));
  }

  function render() {
    const nPin = users.filter(isPinLocked).length, nBlocked = users.filter(u => u.u_status === 'blocked').length;
    const chips = [['all', 'Tous (' + users.length + ')'], ['organizer', 'Organisateurs'], ['pin', '🔒 PIN bloqué (' + nPin + ')'], ['blocked', '🚫 Comptes bloqués (' + nBlocked + ')']];
    document.getElementById('u-chips').innerHTML = chips.map(([k, l]) => '<button class="u-chip' + (filter === k ? ' on' : '') + '" data-f="' + k + '">' + l + '</button>').join('');
    document.querySelectorAll('#u-chips .u-chip').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });

    const rows = users.filter(matches);
    document.getElementById('u-count').textContent = rows.length + ' compte(s) affiché(s)';
    document.getElementById('u-list').innerHTML = rows.map(u => {
      const admin = u.u_role === 'admin';
      const status = u.u_status === 'blocked' ? '<span class="badge b-red">🚫 Compte bloqué</span>'
        : u.u_status === 'suspended' ? '<span class="badge b-gold">Suspendu par lui-même</span>' : '<span class="badge b-green">Actif</span>';
      const pin = isPinLocked(u) ? '<span class="badge b-red">🔒 PIN bloqué jusqu\'au ' + esc(when(u.u_pin_locked_until)) + '</span>'
        : u.u_pin_enabled ? '<span class="badge b-green">PIN activé</span>' : '<span class="badge b-gray">PIN non créé</span>';
      const comm = u.u_commission != null ? '<span class="badge b-gold">Commission perso : ' + esc(u.u_commission) + ' %</span>' : '';
      const acts = admin ? '<span class="badge b-gray">Administrateur (protégé)</span>'
        : (isPinLocked(u) ? '<button class="btn btn-danger btn-sm" data-a="pin" data-id="' + esc(u.u_id) + '">🔓 Débloquer le PIN</button>' : '')
          + '<button class="btn btn-primary btn-sm" data-a="manage" data-id="' + esc(u.u_id) + '">Gérer ▸</button>';
      return '<div class="u-row">' + avatarHtml(u)
        + '<div class="u-main"><div class="u-name">' + esc(u.u_name || 'Sans nom') + (admin ? ' <span class="badge b-gray">Admin</span>' : '') + '</div>'
        + '<div class="u-sub">' + esc(u.u_email || '') + (u.u_phone ? ' · ' + esc(u.u_phone) : '') + '</div>'
        + '<div class="u-sub">' + esc(u.u_events) + ' événement(s) · dernière connexion : ' + esc(when(u.u_last_sign_in)) + ' · ' + esc(u.u_active_sessions) + ' appareil(s)</div>'
        + '<div class="u-badges">' + status + pin + comm + '</div></div>'
        + '<div class="u-acts">' + acts + '</div></div>';
    }).join('') || '<div style="padding:24px;text-align:center;color:var(--muted)">Aucun compte ne correspond.</div>';
    document.querySelectorAll('#u-list [data-avatar]').forEach(a => a.onclick = () => fcOpenPhotoViewer(a.dataset.avatar, a.dataset.name));
    document.querySelectorAll('#u-list [data-a]').forEach(b => b.onclick = () => {
      if (b.dataset.a === 'pin') doAction('pin', b.dataset.id); else openManage(b.dataset.id);
    });
  }

  /* ---------- Fenêtre « Gérer » ---------- */
  function closeModal() { const m = document.getElementById('u-modal'); if (m) m.remove(); }
  function openManage(id) {
    const u = users.find(x => x.u_id === id); if (!u) return;
    closeModal();
    const ov = document.createElement('div'); ov.className = 'm-ov'; ov.id = 'u-modal';
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
    const blocked = u.u_status === 'blocked';
    const act = (icon, title, text, key, label, cls) =>
      '<div class="m-act"><div style="font-size:1.4rem">' + icon + '</div><div class="m-t"><b>' + title + '</b><span>' + text + '</span></div>'
      + '<button class="btn ' + cls + ' btn-sm" data-do="' + key + '">' + label + '</button></div>';
    ov.innerHTML = '<div class="m-box"><div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">' + avatarHtml(u)
      + '<div style="flex:1;min-width:0"><div class="u-name" style="font-size:1.05rem">' + esc(u.u_name || 'Sans nom') + '</div><div class="u-sub">' + esc(u.u_email || '') + (u.u_phone ? ' · ' + esc(u.u_phone) : '') + '</div></div>'
      + '<button class="btn btn-ghost btn-sm" data-do="close">✕</button></div>'
      + '<div style="margin:8px 0 4px;font-size:.74rem;color:var(--muted);text-transform:uppercase;font-weight:800">Sécurité du compte</div>'
      + act('🔓', 'Supprimer le code PIN', isPinLocked(u) ? 'Son PIN est actuellement <b>bloqué</b>. Cette action lève le blocage et efface le PIN : il en créera un nouveau.' : 'Efface son PIN de retrait. Il devra en créer un nouveau avant son prochain retrait.', 'pin', 'Supprimer le PIN', isPinLocked(u) ? 'btn-danger' : 'btn-ghost')
      + act('🔑', 'Supprimer le mot de passe', 'L\'ancien mot de passe ne marche plus. Il devra cliquer « Mot de passe oublié » pour en créer un nouveau (il est aussi déconnecté).', 'password', 'Supprimer', 'btn-ghost')
      + act('🚪', 'Déconnecter de tous les appareils', 'Ferme toutes ses sessions ouvertes. Il peut se reconnecter normalement.', 'logout', 'Déconnecter', 'btn-ghost')
      + act(blocked ? '✅' : '🚫', blocked ? 'Débloquer le compte' : 'Bloquer le compte', blocked ? 'Il pourra de nouveau se connecter.' : 'Il est déconnecté tout de suite et ne peut plus se connecter. Ses données sont conservées.', blocked ? 'unblock' : 'block', blocked ? 'Débloquer' : 'Bloquer', blocked ? 'btn-success' : 'btn-danger')
      + '<div style="margin:14px 0 4px;font-size:.74rem;color:var(--muted);text-transform:uppercase;font-weight:800">Argent</div>'
      + act('💰', 'Commission personnalisée', (u.u_commission != null ? 'Actuellement : <b>' + esc(u.u_commission) + ' %</b>. ' : 'Taux normal de la plateforme. ') + 'Pourcentage prélevé sur ses retraits (0 à 30 %).', 'commission', 'Modifier', 'btn-ghost')
      + '<div style="margin:14px 0 4px;font-size:.74rem;color:var(--muted);text-transform:uppercase;font-weight:800">Informations</div>'
      + act('📱', 'Voir ses connexions', 'Appareils et dates de ses dernières connexions.', 'sessions', 'Afficher', 'btn-ghost')
      + '<div id="u-sess"></div>'
      + '<div style="margin:14px 0 4px;font-size:.74rem;color:var(--muted);text-transform:uppercase;font-weight:800">Affichage (langue, thème, couleur)</div>'
      + act('🌐', 'Voir / changer son affichage', 'Choisis sa langue, son thème et sa couleur, puis enregistre.', 'viewprefs', 'Afficher', 'btn-ghost')
      + '<div id="u-prefs"></div>'
      + act('🔄', 'Réinitialiser langue, thème et couleur', 'Remet le site en français, thème clair et couleur par défaut. Utile si la personne a choisi l\'arabe et que son écran ne répond plus. Elle retrouve un affichage normal à sa prochaine ouverture du site.', 'prefs', 'Réinitialiser', 'btn-ghost')
      + '<div style="margin:14px 0 4px;font-size:.74rem;color:var(--red);text-transform:uppercase;font-weight:800">Zone dangereuse</div>'
      + act('🗑️', 'Supprimer le compte', 'Définitif. Refusé si le compte a des ventes ou des retraits : bloque-le plutôt pour garder l\'historique.', 'delete', 'Supprimer', 'btn-danger')
      + '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-do]').forEach(b => b.onclick = () => {
      const k = b.dataset.do;
      if (k === 'close') closeModal(); else if (k === 'sessions') showSessions(id); else if (k === 'viewprefs') showPrefs(id); else doAction(k, id);
    });
  }

  async function showPrefs(id) {
    const box = document.getElementById('u-prefs'); box.innerHTML = '<div class="u-sub" style="padding:8px 0">Chargement…</div>';
    try {
      const p = await fcAdminGetPreferences(id);
      if (!p) { box.innerHTML = '<div class="u-sub">Aucune donnée.</div>'; return; }
      const fld = 'padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface,#fff);color:inherit;font-size:.85rem;font-family:inherit';
      const opt = (v, label, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>';
      const swatches = ['#0EA5A0', '#34D399', '#FF8A3D', '#FF5A5F', '#3B82F6'].map(c =>
        '<button type="button" class="pf-sw" data-c="' + c + '" aria-label="Couleur ' + c + '" style="width:28px;height:28px;border-radius:50%;background:' + c + ';border:2px solid var(--border);cursor:pointer;padding:0"></button>').join('');
      box.innerHTML = '<div class="u-sub" style="padding:10px 0;border-top:1px dashed var(--border);display:grid;gap:10px">'
        + '<label style="display:grid;gap:4px">Langue<select id="pf-lang" style="' + fld + '">' + opt('fr', 'Français', p.p_language) + opt('en', 'English', p.p_language) + opt('ar', 'العربية (arabe)', p.p_language) + '</select></label>'
        + '<label style="display:grid;gap:4px">Thème<select id="pf-theme" style="' + fld + '">' + opt('light', 'Clair', p.p_theme) + opt('dark', 'Sombre', p.p_theme) + opt('auto', 'Automatique', p.p_theme) + '</select></label>'
        + '<div style="display:grid;gap:4px">Couleur<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + swatches
        + '<input type="color" id="pf-accent" value="' + esc(/^#[0-9A-Fa-f]{6}$/.test(p.p_accent || '') ? p.p_accent : '#0EA5A0') + '" aria-label="Couleur personnalisée" style="width:40px;height:32px;border:none;background:none;cursor:pointer;padding:0"></div></div>'
        + '<div>Fuseau : <b>' + esc(p.p_timezone || '—') + '</b> · Photo : <b>' + (p.p_avatar ? '<a href="' + esc(p.p_avatar) + '" target="_blank" rel="noopener">voir</a>' : 'aucune') + '</b></div>'
        + (p.p_language === 'ar' ? '<div style="color:var(--red);font-weight:700">Langue arabe : c\'est peut-être la cause de son problème d\'affichage.</div>' : '')
        + '<button class="btn btn-gold btn-sm" id="pf-save" type="button">Enregistrer ces choix</button></div>';
      box.querySelectorAll('.pf-sw').forEach(b => b.onclick = () => { document.getElementById('pf-accent').value = b.dataset.c; });
      document.getElementById('pf-save').onclick = async () => {
        const btn = document.getElementById('pf-save'); btn.disabled = true; btn.textContent = 'Enregistrement…';
        try {
          await fcAdminSetPreferences(id, document.getElementById('pf-lang').value, document.getElementById('pf-theme').value, document.getElementById('pf-accent').value);
          toast('Affichage enregistré. La personne le verra à sa prochaine ouverture du site.');
          showPrefs(id);
        } catch (e) { toast('Erreur : ' + (e.message || e), false); btn.disabled = false; btn.textContent = 'Enregistrer ces choix'; }
      };
    } catch (e) { box.innerHTML = '<div class="u-sub" style="color:var(--red)">' + esc(e.message) + '</div>'; }
  }

  async function showSessions(id) {
    const box = document.getElementById('u-sess'); box.innerHTML = '<div class="u-sub" style="padding:8px 0">Chargement…</div>';
    try {
      const rows = await fcAdminListSessions(id, 15);
      box.innerHTML = rows.length ? rows.map(r => '<div class="u-sub" style="padding:6px 0;border-top:1px dashed var(--border)">' + esc(r.s_device || '—') + ' · ' + esc(r.s_browser || '')
        + '<br>' + esc(when(r.s_last_seen)) + (r.s_revoked ? ' · <b>révoquée</b>' : ' · <b style="color:var(--green)">active</b>') + '</div>').join('') : '<div class="u-sub">Aucune connexion enregistrée.</div>';
    } catch (e) { box.innerHTML = '<div class="u-sub" style="color:var(--red)">' + esc(e.message) + '</div>'; }
  }

  async function doAction(kind, id) {
    const u = users.find(x => x.u_id === id); if (!u) return;
    const name = u.u_name || u.u_email || 'cet utilisateur';
    const ask = {
      pin: 'Supprimer le code PIN de ' + name + ' et lever son blocage ? Il pourra en créer un nouveau.',
      password: 'Supprimer le mot de passe de ' + name + ' ? Il devra utiliser « Mot de passe oublié » pour en créer un nouveau.',
      logout: 'Déconnecter ' + name + ' de tous ses appareils ?',
      block: 'Bloquer le compte de ' + name + ' ? Il sera déconnecté et ne pourra plus se connecter.',
      unblock: 'Débloquer le compte de ' + name + ' ?',
      prefs: 'Remettre le site de ' + name + ' en français, thème clair et couleur par défaut ?',
      delete: 'SUPPRIMER DÉFINITIVEMENT le compte de ' + name + ' et ses événements ? Cette action est irréversible.'
    };
    try {
      if (kind === 'commission') {
        const a = await fcPrompt('Commission personnalisée pour ' + name + ' (en %, de 0 à 30). Laisse vide pour revenir au taux normal de la plateforme.', u.u_commission != null ? u.u_commission : '', { title: 'Commission', ok: 'Enregistrer', type: 'number' });
        if (a === null) return;
        const rate = a.trim() === '' ? null : Number(a.replace(',', '.'));
        if (rate !== null && (isNaN(rate) || rate < 0 || rate > 30)) { toast('Taux invalide (de 0 à 30)', false); return; }
        const { error } = await supa.rpc('fc_admin_set_commission', { p_user_id: id, p_rate: rate });
        if (error) throw error;
        toast(rate === null ? 'Taux normal rétabli' : 'Commission de ' + rate + ' % enregistrée');
      } else {
        const danger = ['block', 'delete', 'pin', 'password'].includes(kind);
        if (!await fcConfirm(ask[kind], { title: 'Confirmer', ok: 'Oui, continuer', danger })) return;
        if (kind === 'delete' && !await fcConfirm('Dernière confirmation : supprimer ' + name + ' ?', { title: 'Suppression définitive', ok: 'Supprimer', danger: true })) return;
        if (kind === 'pin') await fcAdminResetPin(id);
        else if (kind === 'password') await fcAdminInvalidatePassword(id);
        else if (kind === 'logout') await fcAdminRevokeSessions(id);
        else if (kind === 'block') await fcAdminSetBlocked(id, true);
        else if (kind === 'unblock') await fcAdminSetBlocked(id, false);
        else if (kind === 'prefs') await fcAdminResetPreferences(id, 'fr');
        else if (kind === 'delete') await fcAdminDeleteAccount(id);
        toast({ pin: 'PIN supprimé : il pourra en créer un nouveau', password: 'Mot de passe supprimé', logout: 'Utilisateur déconnecté', block: 'Compte bloqué', unblock: 'Compte débloqué', delete: 'Compte supprimé', prefs: 'Affichage remis en français (thème clair)' }[kind]);
      }
      closeModal(); await load();
    } catch (e) { toast('Erreur : ' + (e.message || e), false); }
  }

  // On attend que l'accès administrateur soit confirmé avant de charger les comptes
  (function wait(n) {
    if (document.documentElement.classList.contains('fc-ok')) return load();
    if (n < 150) setTimeout(() => wait(n + 1), 100);
  })(0);
})();
