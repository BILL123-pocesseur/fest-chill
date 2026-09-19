// ============================================================
// FEST&CHILL — Client Supabase partagé
// Inclure sur CHAQUE page APRÈS le script CDN supabase-js, ex :
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
//   <script src="js/supabase-client.js"></script>
// ============================================================

// ⚠️ À REMPLACER avec tes propres identifiants
// Supabase → Project Settings → API
const SUPABASE_URL = "https://cmrzqfcumwpxltdhdpqh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_w5IDWcWmiiVGJAaG-N0F5w_k5B9NU8a";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// PHOTOS RÉELLES PAR CATÉGORIE (Unsplash) — libres de droits,
// avec attribution obligatoire au photographe (règles Unsplash).
// Mise en cache dans category_photos pour ne pas rappeler l'API
// à chaque visite (limite gratuite : 50 requêtes/heure).
// ------------------------------------------------------------
const UNSPLASH_ACCESS_KEY = 'TMziHRVjMdDhLAgPv2GZe7Xx2--P45Dv10gpbJ5Py-c';
const CATEGORY_PHOTO_QUERIES = {
  'Concert / Musique': 'live concert stage lights crowd silhouette',
  'Conférence': 'business conference audience professional stage',
  'Soirée / Club': 'nightclub party neon lights dancing crowd',
  'Sport': 'stadium crowd sports fans cheering',
  'Théâtre / Art': 'theater stage dramatic lighting performance',
  'Autre': 'festival crowd celebration confetti lights',
};

async function fcGetCategoryPhoto(eventType) {
  // 1. Déjà en cache ?
  const { data: cached } = await supa.from('category_photos').select('*').eq('event_type', eventType).maybeSingle();
  if (cached) return cached;

  // 2. Sinon, on va chercher une photo chez Unsplash
  const query = CATEGORY_PHOTO_QUERIES[eventType] || CATEGORY_PHOTO_QUERIES['Autre'];
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape&order_by=relevant&content_filter=high&client_id=${UNSPLASH_ACCESS_KEY}`);
    if (!res.ok) {
      const errBody = await res.text();
      console.error('Unsplash a refusé la requête :', res.status, errBody);
      window.__fcLastPhotoError = `Unsplash ${res.status} : ${errBody}`;
      return null;
    }
    const data = await res.json();
    // Parmi les meilleurs résultats, on prend le 2e plutôt que le tout
    // premier — souvent plus intéressant visuellement que le résultat
    // le plus "évident" renvoyé en premier par la recherche.
    const results = data?.results || [];
    const photo = results[1] || results[0];
    if (!photo) {
      console.error('Unsplash : aucune photo trouvée pour', query, data);
      window.__fcLastPhotoError = `Aucun résultat Unsplash pour "${query}"`;
      return null;
    }

    const record = {
      event_type: eventType,
      photo_url: photo.urls.regular,
      thumb_url: photo.urls.small,
      photographer_name: photo.user?.name || 'Unsplash',
      photographer_url: (photo.user?.links?.html || 'https://unsplash.com') + '?utm_source=festchill&utm_medium=referral',
    };
    const { error: upsertErr } = await supa.from('category_photos').upsert(record);
    if (upsertErr) console.error('Erreur enregistrement photo en cache :', upsertErr);
    return record;
  } catch (e) {
    console.error('Erreur réseau en cherchant la photo Unsplash :', e);
    window.__fcLastPhotoError = 'Erreur réseau : ' + e.message;
    return null; // pas grave, l'illustration de secours reste affichée
  }
}

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------

// Connexion organisateur via Google
async function fcSignInWithGoogle() {
  const { error } = await supa.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/festchill-dashboard.html" }
  });
  if (error) alert("Erreur de connexion : " + error.message);
}

// Inscription par email/mot de passe
async function fcSignUpWithEmail(email, password, fullName) {
  const { data, error } = await supa.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  return { data, error };
}

// Connexion par email/mot de passe
async function fcSignInWithEmail(email, password) {
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function fcSignOut() {
  await supa.auth.signOut();
  window.location.href = "festchill-landing.html";
}

// Retourne la session courante (ou null)
async function fcGetSession() {
  const { data: { session } } = await supa.auth.getSession();
  return session;
}

// Retourne le profil (table profiles) de l'utilisateur connecté
async function fcGetProfile() {
  const session = await fcGetSession();
  if (!session) return null;
  const { data, error } = await supa
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

// À appeler en haut des pages privées (dashboard, scanner, admin, wallet...)
// Redirige vers la landing si personne n'est connecté.
async function fcRequireAuth({ adminOnly = false } = {}) {
  const session = await fcGetSession();
  if (!session) {
    window.location.href = "festchill-landing.html";
    return null;
  }
  const profile = await fcGetProfile();
  if (adminOnly && profile?.role !== "admin") {
    // On explique pourquoi (sinon ça ressemble à un bug plutôt qu'à un accès refusé).
    sessionStorage.setItem('fc-redirect-notice', "Accès administrateur requis pour cette page.");
    window.location.href = "festchill-dashboard.html";
    return null;
  }
  fcApplyProfilePrefs(profile);
  fcRecordSession(session.user.id); // ne bloque pas le rendu de la page
  return profile;
}

// ------------------------------------------------------------
// SESSIONS ACTIVES — une ligne réelle par navigateur/appareil connecté,
// mise à jour à chaque page vue. Un identifiant est gardé dans
// sessionStorage (propre à cet onglet/navigateur) pour reconnaître
// "cette" session d'une fois sur l'autre.
// ------------------------------------------------------------

function fcDeviceLabel() {
  const ua = navigator.userAgent;
  let browser = 'Navigateur inconnu';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  let os = 'Appareil inconnu';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'Mac';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} · ${os}`;
}

async function fcRecordSession(userId) {
  try {
    let sid = sessionStorage.getItem('fc-session-id');
    const now = new Date().toISOString();

    if (sid) {
      // Session déjà connue sur cet onglet : on met juste à jour "vu pour la dernière fois".
      const { data } = await supa.from('user_sessions').select('id').eq('id', sid).eq('revoked', false).single();
      if (data) {
        await supa.from('user_sessions').update({ last_seen: now }).eq('id', sid);
        return;
      }
      // La session a été révoquée entre-temps (déconnexion forcée depuis un autre appareil) : on en recrée une.
      sid = null;
    }

    const { data: inserted, error } = await supa.from('user_sessions').insert({
      user_id: userId,
      device_label: fcDeviceLabel(),
      browser_hint: navigator.userAgent,
    }).select('id').single();

    if (!error && inserted) {
      sessionStorage.setItem('fc-session-id', inserted.id);
    }
  } catch (e) {
    console.error('fcRecordSession', e);
  }
}

async function fcListSessions() {
  const session = await fcGetSession();
  if (!session) return [];
  const { data, error } = await supa
    .from('user_sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('revoked', false)
    .order('last_seen', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

// Déconnecte réellement TOUTES les autres sessions (fonctionnalité native
// Supabase : invalide les jetons de connexion des autres appareils).
// Limite honnête : impossible de cibler UNE seule ancienne session précise
// sans clé serveur — c'est "toutes les autres" ou rien.
async function fcSignOutOtherSessions() {
  const session = await fcGetSession();
  const { error } = await supa.auth.signOut({ scope: 'others' });
  if (error) throw error;
  const currentSid = sessionStorage.getItem('fc-session-id');
  if (session) {
    let query = supa.from('user_sessions').update({ revoked: true }).eq('user_id', session.user.id);
    if (currentSid) query = query.neq('id', currentSid);
    await query;
  }
}

// ------------------------------------------------------------
// 2FA — numéro choisi par l'utilisateur (envoi réel du SMS de code
// à brancher plus tard sur un fournisseur SMS externe).
// ------------------------------------------------------------
async function fcSaveMfaSettings(phone, enabled) {
  await fcSaveProfilePref({ mfa_phone: phone, mfa_enabled: enabled });
}

// ------------------------------------------------------------
// VÉRIFICATION DE PIÈCE D'IDENTITÉ
// ------------------------------------------------------------
async function fcGetLatestIdentityVerification() {
  const session = await fcGetSession();
  if (!session) return null;
  const { data, error } = await supa
    .from('identity_verifications')
    .select('*')
    .eq('organizer_id', session.user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

async function fcSubmitIdentityVerification({ fullLegalName, idType, idNumber, file }) {
  const session = await fcGetSession();
  if (!session) throw new Error('Non connecté');

  let documentPath = null;
  if (file) {
    const ext = file.name.split('.').pop();
    documentPath = `${session.user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supa.storage.from('identity-documents').upload(documentPath, file, { upsert: false });
    if (upErr) throw upErr;
  }

  const { error } = await supa.from('identity_verifications').insert({
    organizer_id: session.user.id,
    full_legal_name: fullLegalName,
    id_type: idType,
    id_number: idNumber,
    document_path: documentPath,
  });
  if (error) throw error;
}

// ------------------------------------------------------------
// HELPERS DIVERS
// ------------------------------------------------------------

function fcFormatFCFA(n) {
  return Number(n || 0).toLocaleString("fr-FR") + " FCFA";
}

function fcSlugify(str) {
  return str.toString().toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ------------------------------------------------------------
// THÈME (clair / sombre / auto) — appliqué immédiatement et
// mémorisé dans le navigateur (localStorage), sur toutes les pages.
// ------------------------------------------------------------

function fcGetTheme() {
  return localStorage.getItem('fc-theme') || 'dark';
}

function fcSetTheme(mode, persist = true) {
  localStorage.setItem('fc-theme', mode);
  const light = mode === 'light' || (mode === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  if (light) {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  if (persist) fcSaveProfilePref({ theme: mode });
}

// ------------------------------------------------------------
// COULEUR D'ACCENTUATION — appliquée immédiatement (variables CSS),
// mémorisée dans le navigateur, et poussée sur le compte Supabase.
// Changer la couleur fait automatiquement varier tous les éléments
// du design qui utilisent l'accent (boutons, liens actifs, badges…).
// ------------------------------------------------------------

function fcHexToRgb(hex) {
  hex = (hex || '#0EA5A0').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function fcMix(rgb, targetRgb, amount) {
  return {
    r: Math.round(rgb.r + (targetRgb.r - rgb.r) * amount),
    g: Math.round(rgb.g + (targetRgb.g - rgb.g) * amount),
    b: Math.round(rgb.b + (targetRgb.b - rgb.b) * amount),
  };
}

function fcRgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function fcGetAccent() {
  return localStorage.getItem('fc-accent') || '#0EA5A0';
}

// Applique la couleur choisie aux variables CSS du thème (--purple/--violet/--glow/--accent-rgb),
// ce qui recolore automatiquement boutons, liens actifs, badges, alertes, etc. sur toute la plateforme.
function fcApplyAccent(hex) {
  const rgb = fcHexToRgb(hex);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const violet = fcMix(rgb, { r: 0, g: 0, b: 0 }, 0.28);
  const glow = isLight ? fcMix(rgb, { r: 0, g: 0, b: 0 }, 0.18) : fcMix(rgb, { r: 255, g: 255, b: 255 }, 0.32);
  const root = document.documentElement.style;
  root.setProperty('--purple', hex);
  root.setProperty('--violet', fcRgbToHex(violet));
  root.setProperty('--glow', fcRgbToHex(glow));
  root.setProperty('--accent-rgb', `${rgb.r},${rgb.g},${rgb.b}`);
}

function fcSetAccent(hex, persist = true) {
  localStorage.setItem('fc-accent', hex);
  fcApplyAccent(hex);
  if (persist) fcSaveProfilePref({ accent_color: hex });
}

// ------------------------------------------------------------
// LANGUE DE L'INTERFACE — mémorisée et appliquée au compte,
// utile pour les organisateurs anglophones.
// ------------------------------------------------------------

const FC_I18N = {
  fr: {
    'settings.account_security': 'Sécurité du compte',
    'settings.account_suspended': 'Compte suspendu.',
    'settings.active_f': 'Active',
    'settings.active_sessions': 'Sessions actives',
    'settings.all_sessions_disconnected': 'Toutes les autres sessions déconnectées !',
    'settings.before_deleting': 'Avant de supprimer ton compte',
    'settings.before_deleting_text': 'Assure-toi d\'avoir retiré tout ton argent disponible. Les tickets déjà vendus resteront valides jusqu\'à la date de l\'événement. Les données ne peuvent pas être récupérées après suppression.',
    'settings.bio': 'Bio / Description',
    'settings.bio_placeholder': 'Décris-toi en quelques mots...',
    'settings.block': 'Bloquer',
    'settings.by_email': 'Par email',
    'settings.by_sms': 'Par SMS',
    'settings.change': 'Changer',
    'settings.city': 'Ville',
    'settings.city_bio_hint': 'Ville et bio arrivent bientôt sur les pages publiques — pour l\'instant, seuls le nom et le téléphone sont enregistrés.',
    'settings.city_placeholder': 'Ex: Cotonou, Bénin',
    'settings.color_applied': 'Couleur appliquée !',
    'settings.coming_soon_notify': 'Bientôt disponible ! On te notifiera.',
    'settings.confirm_delete': 'Es-tu sûr de vouloir supprimer définitivement ton compte ? Cette action est irréversible.',
    'settings.confirm_suspend': 'Suspendre temporairement ton compte ? Tu pourras le réactiver en te reconnectant.',
    'settings.current_f': 'Actuelle',
    'settings.current_plan': 'Plan actuel',
    'settings.current_session': 'Cotonou, Bénin · Session actuelle · Il y a 2 min',
    'settings.delete': 'Supprimer',
    'settings.delete_account': 'Supprimer définitivement mon compte',
    'settings.delete_account_sub': 'Cette action est irréversible. Envoie une demande à notre support pour confirmer.',
    'settings.delete_request_sent': 'Demande envoyée à notre support pour confirmation.',
    'settings.disconnect': 'Déconnecter',
    'settings.disconnect_all': 'Déconnecter toutes les autres sessions',
    'settings.email': 'Email',
    'settings.email_verified': 'Email vérifié',
    'settings.enabled': 'Activée',
    'settings.export_data': 'Exporter mes données',
    'settings.export_data_sub': 'Télécharger toutes tes données (événements, tickets, transactions) en CSV',
    'settings.export_in_progress': 'Export en cours... Tu recevras un email',
    'settings.firefox_unknown': 'Firefox · Inconnu',
    'settings.free_account': 'Compte Gratuit',
    'settings.full_name': 'Nom complet *',
    'settings.id_document': 'Pièce d\'identité',
    'settings.id_not_verified': 'Non vérifiée — Requis pour les grands retraits',
    'settings.important': 'Important',
    'settings.in_app': 'Dans l\'application',
    'settings.manage_in_wallet': 'Gérer dans le Portefeuille',
    'settings.mm_headline': 'Tes revenus, sans friction',
    'settings.mm_headline_sub': 'Ajoute un ou plusieurs numéros Mobile Money — tes retraits y arrivent en quelques minutes.',
    'settings.mm_important_text': 'Assure-toi que tes numéros Mobile Money sont actifs et correspondent à ton nom. Les retraits sont envoyés directement sur ces numéros.',
    'settings.mm_used_for': 'Utilisés pour recevoir tes retraits.',
    'settings.name_required': 'Le nom est requis',
    'settings.notif_daily_sub': 'Résumé de tes ventes envoyé chaque soir à 20h',
    'settings.notif_daily_title': 'Rapport quotidien des ventes',
    'settings.notif_failed_sub': 'SMS quand un acheteur a un problème de paiement',
    'settings.notif_failed_title': 'Paiement échoué',
    'settings.notif_headline': 'Reste informé, sans être noyé',
    'settings.notif_headline_sub': 'Choisis précisément ce qui mérite un SMS, un e-mail ou juste une notification push.',
    'settings.notif_inapp_sub': 'Notifications en temps réel dans le tableau de bord',
    'settings.notif_inapp_title': 'Toutes les notifications in-app',
    'settings.notif_news_sub': 'Mises à jour de la plateforme Fest&Chill',
    'settings.notif_news_title': 'Actualités et nouvelles fonctionnalités',
    'settings.notif_prefs_sub': 'Choisis comment et quand tu veux être notifié.',
    'settings.notif_prefs_title': 'Préférences de notifications',
    'settings.notif_sale_sub': 'Recevoir un SMS à chaque ticket vendu',
    'settings.notif_sale_title': 'Vente de ticket',
    'settings.notif_saved': 'Préférences de notification sauvegardées !',
    'settings.notif_security_sub': 'Connexion depuis un nouvel appareil, tentatives suspectes',
    'settings.notif_security_title': 'Alertes de sécurité',
    'settings.notif_sound_sub': 'Jouer un son à chaque nouvelle vente',
    'settings.notif_sound_title': 'Son de notification',
    'settings.notif_weekly_sub': 'Bilan de la semaine tous les lundis matin',
    'settings.notif_weekly_title': 'Rapport hebdomadaire',
    'settings.notif_withdraw_sub': 'SMS quand ton argent est envoyé sur Mobile Money',
    'settings.notif_withdraw_title': 'Retrait confirmé',
    'settings.password': 'Mot de passe',
    'settings.password_last_changed': 'Dernière modification il y a 3 mois',
    'settings.phone': 'Téléphone *',
    'settings.plan_f1': 'Création de compte gratuite',
    'settings.plan_f2': 'Événements illimités (avec frais par publication)',
    'settings.plan_f3': 'Tickets numérotés avec QR codes',
    'settings.plan_f4': 'Paiement MTN Mobile Money',
    'settings.plan_f5': 'Tableau de bord basique',
    'settings.plan_f6': 'Scanner QR intégré',
    'settings.premium_f1': 'Statistiques avancées',
    'settings.premium_f2': 'Graphiques détaillés',
    'settings.premium_f3': 'Affiche IA illimitée',
    'settings.premium_f4': 'Commission réduite',
    'settings.premium_f5': 'Support prioritaire',
    'settings.premium_f6': 'Rapports PDF auto',
    'settings.premium_f7': 'Multi-organisateurs',
    'settings.premium_f8': 'API access',
    'settings.profile_info': 'Informations du profil',
    'settings.profile_info_sub': 'Ces informations apparaissent sur tes événements.',
    'settings.profile_updated': 'Profil mis à jour avec succès !',
    'settings.protect_account': 'Protège ton compte et tes données.',
    'settings.reset_email_sent': 'Email de réinitialisation envoyé !',
    'settings.save_profile': 'Sauvegarder le profil',
    'settings.sec_headline': 'Ton compte, bien protégé',
    'settings.sec_headline_sub': 'Mot de passe, double authentification et sessions actives — tout au même endroit.',
    'settings.session_2': 'Cotonou, Bénin · Il y a 3 heures',
    'settings.session_3': 'Lagos, Nigeria · Il y a 2 jours — Suspect ?',
    'settings.session_blocked': 'Session suspecte bloquée !',
    'settings.session_disconnected': 'Session déconnectée !',
    'settings.sms_to': 'SMS vers',
    'settings.suspend_account': 'Suspendre mon compte',
    'settings.suspend_account_sub': 'Désactiver temporairement ton compte. Tu pourras le réactiver à tout moment.',
    'settings.tbd': 'À définir',
    'settings.two_fa': 'Authentification à deux facteurs (2FA)',
    'settings.unlock_features': 'Débloque toutes les fonctionnalités avancées',
    'settings.upgrade_cta': 'Passer au Premium — Bientôt disponible',
    'settings.upgrade_premium': 'Passer au Plan Premium',
    'settings.using_free_version': 'Tu utilises la version gratuite de Fest&Chill.',
    'settings.verif_form_opened': 'Formulaire de vérification ouvert',
    'settings.lang_switched': 'Interface passée en',
    'settings.appearance_saved': "Préférences d'apparence sauvegardées !",
    'admin.account_blocked': 'Compte bloqué !',
    'admin.account_reactivated': 'Compte réactivé !',
    'admin.account_verified': 'Compte vérifié !',
    'admin.active_events': 'Événements actifs',
    'admin.commission': 'Commission',
    'admin.commission_cumulated': 'Commission cumulée',
    'admin.commissions_cumulated': 'Commissions cumulées',
    'admin.config_saved': 'Configuration sauvegardée !',
    'admin.confirmed_withdrawals': 'retraits confirmés',
    'admin.currently_selling': 'en vente actuellement',
    'admin.default_organizer': 'Organisateur',
    'admin.event_republished': 'Événement republié',
    'admin.event_singular': 'événement',
    'admin.event_suspended': 'Événement suspendu',
    'admin.events_plural': 'événements',
    'admin.export_csv_ready': 'Export CSV prêt',
    'admin.export_full_ready': 'Export complet prêt',
    'admin.gross_revenue': 'Chiffre d\'affaires brut',
    'admin.last_update': 'Mise à jour',
    'admin.new_unverified_organizer': 'Nouvel organisateur non vérifié',
    'admin.no_name': 'Sans nom',
    'admin.no_orders_yet': 'Aucune commande pour l\'instant',
    'admin.no_organizers_yet': 'Aucun organisateur pour l\'instant',
    'admin.not_verified': 'Non vérifié',
    'admin.operator': 'Opérateur',
    'admin.organizer': 'Organisateur',
    'admin.paid_orders': 'commandes payées',
    'admin.pending_verification': 'en attente de vérification',
    'admin.pending_withdrawal': 'Retrait en attente',
    'admin.platform_config': 'Configuration plateforme',
    'admin.rate_label': 'Taux',
    'admin.reactivate': 'Réactiver',
    'admin.recent_organizers': 'Organisateurs récents',
    'admin.recent_transactions': 'Transactions récentes',
    'admin.registered_on': 'Inscrit le',
    'admin.republish': 'Republier',
    'admin.revenue': 'Revenus',
    'admin.revenue_30d': 'Revenus plateforme (30j)',
    'admin.see_all': 'Voir tous',
    'admin.stat_events': 'Événements en cours',
    'admin.stat_organizers': 'Organisateurs actifs',
    'admin.stat_revenue': 'Revenus plateforme',
    'admin.suspend': 'Suspendre',
    'admin.tickets': 'Tickets',
    'admin.title': 'Administrateur',
    'admin.top_organizers': 'Top organisateurs',
    'admin.total_paid_out': 'Total reversé aux org.',
    'admin.total_registered': 'Total inscrits',
    'admin.verified': 'Vérifié',
    'admin.verify': 'Vérifier',
    'admin.withdrawal_request_of': 'Demande de retrait de',
    'common.add_short': '+ Ajouter',
    'common.amount': 'Montant',
    'common.cancel': 'Annuler',
    'common.copy': 'Copier',
    'common.create_event_btn': '+ Créer un événement',
    'common.date': 'Date',
    'common.error_prefix': 'Erreur :',
    'common.event': 'Événement',
    'common.export': 'Export',
    'common.loading': 'Chargement…',
    'common.retry': 'Réessayer',
    'common.search': 'Rechercher...',
    'common.status': 'Statut',
    'common.ticket': 'Ticket',
    'common.view_all': 'Voir tout',
    'common.withdrawal': 'Retrait',
    'create.cat_name': 'Nom',
    'create.cat_price': 'Prix (FCFA)',
    'create.cat_quota': 'Quota',
    'create.categories_sub': 'Ajoute au moins une catégorie (ex: Normal, VIP, VVIP)',
    'create.categories_title': 'Catégories de tickets',
    'create.date_label': 'Date *',
    'create.description_label': 'Description',
    'create.description_placeholder': 'Décris ton événement...',
    'create.error_category': 'Ajoute au moins une catégorie de ticket valide (nom + quota).',
    'create.error_created_but_categories': 'Événement créé mais erreur sur les catégories :',
    'create.error_required': 'Titre, date et lieu sont obligatoires.',
    'create.event_info': 'Informations de l\'événement',
    'create.event_info_sub': 'Ces infos seront visibles sur ta page de vente publique.',
    'create.location_label': 'Lieu *',
    'create.location_placeholder': 'Ex: Palais des Congrès, Cotonou',
    'create.publish': 'Publier l\'événement',
    'create.publishing': 'Publication...',
    'create.save_draft': 'Enregistrer en brouillon',
    'create.time_label': 'Heure',
    'create.title_label': 'Titre de l\'événement *',
    'create.title_placeholder': 'Ex: Concert Afrobeat Cotonou',
    'create.type_concert': '🎵 Concert / Musique',
    'create.type_conference': '🎤 Conférence',
    'create.type_label': 'Type d\'événement',
    'create.type_other': '✨ Autre',
    'create.type_party': '🎉 Soirée / Club',
    'create.type_sport': '⚽ Sport',
    'create.type_theatre': '🎭 Théâtre / Art',
    'dashboard.all_categories': 'toutes catégories',
    'dashboard.all_categories_cap': 'Toutes catégories',
    'dashboard.create_first': 'Créer mon premier événement',
    'dashboard.greeting_hi': 'Salut',
    'dashboard.greeting_you': 'toi',
    'dashboard.no_events': 'Aucun événement pour l\'instant.',
    'dashboard.no_sales': 'Aucune vente pour l\'instant',
    'dashboard.recent_events': '📅 Mes événements récents',
    'dashboard.recent_sales': '💳 Dernières ventes',
    'dashboard.stat_balance': 'Solde disponible',
    'dashboard.stat_events': 'Événements',
    'dashboard.stat_revenue': 'Revenus (net)',
    'dashboard.stat_revenue_sub': 'après commission',
    'dashboard.subtitle': 'Voici un aperçu de ton activité sur Fest&Chill.',
    'dashboard.upcoming_suffix': 'à venir',
    'dashboard.withdraw_link': 'Retirer →',
    'event_detail.after_commission': 'Après commission Fest&Chill',
    'event_detail.ago': 'Il y a',
    'event_detail.available': 'disponibles',
    'event_detail.available_revenue': 'Revenus disponibles',
    'event_detail.copy_failed': 'Copie automatique impossible — le lien est sélectionné, copie-le avec Ctrl/Cmd+C',
    'event_detail.copy_link_btn': 'Copier lien',
    'event_detail.copy_link_btn2': 'Copier le lien',
    'event_detail.download': 'Télécharger',
    'event_detail.generating': 'Génération…',
    'event_detail.go_to_wallet': 'Aller au portefeuille pour retirer',
    'event_detail.just_now': 'À l\'instant',
    'event_detail.link_copied': 'Lien copié dans le presse-papier !',
    'event_detail.link_not_ready': 'Lien pas encore prêt, réessaie dans un instant',
    'event_detail.no_activity_yet': 'Aucune activité pour l\'instant — les ventes apparaîtront ici dès qu\'un fan achète un ticket.',
    'event_detail.no_tickets_yet': 'Aucun ticket vendu pour l\'instant',
    'event_detail.out_of': 'sur',
    'event_detail.payment_failed': 'Paiement échoué',
    'event_detail.payment_pending': 'Paiement en attente',
    'event_detail.print': 'Imprimer',
    'event_detail.qr_gen_failed': 'Échec de génération.',
    'event_detail.qr_not_ready': 'QR pas encore prêt',
    'event_detail.qr_printed': 'QR Code imprimé !',
    'event_detail.qr_unavailable': 'QR indisponible (connexion).',
    'event_detail.recent_activity': 'Activité récente',
    'event_detail.sales_progress': 'Progression des ventes',
    'event_detail.scan_at_entry': 'Scanner à l\'entrée',
    'event_detail.share_event': 'Partager l\'événement',
    'event_detail.share_hint': 'Partage ce lien pour que les gens puissent acheter leurs tickets.',
    'event_detail.sold': 'vendu',
    'event_detail.sold_pct': 'vendu',
    'events.filter_all': 'Tous',
    'events.filter_draft': 'Brouillons',
    'events.filter_ended': 'Terminés',
    'events.filter_suspended': 'Suspendus',
    'events.no_events_category': 'Aucun événement dans cette catégorie.',
    'events.sold_label': 'vendus',
    'menu.account': 'Mon compte',
    'menu.logout': 'Se déconnecter',
    'menu.manage_account': 'Gérer le compte',
    'menu.view_profile': 'Voir le profil',
    'nav.admin': 'Administration',
    'nav.all_events': 'Tous les événements',
    'nav.all_tickets': 'Tous les tickets',
    'nav.commissions': 'Commissions',
    'nav.config': 'Configuration',
    'nav.create_event': 'Créer un événement',
    'nav.dashboard': 'Dashboard',
    'nav.dashboard_admin': 'Dashboard Admin',
    'nav.group_admin': 'Admin',
    'nav.group_finance': 'Finances',
    'nav.group_main': 'Principal',
    'nav.group_tools': 'Outils',
    'nav.my_events': 'Mes événements',
    'nav.organizer_view': 'Vue organisateur',
    'nav.organizers': 'Organisateurs',
    'nav.payouts': 'Reversements',
    'nav.platform_revenue': 'Revenus plateforme',
    'nav.scanner': 'Scanner QR',
    'nav.settings': 'Paramètres',
    'nav.support': 'Support client',
    'nav.tickets_sold': 'Tickets vendus',
    'nav.transactions': 'Transactions',
    'nav.wallet': 'Portefeuille',
    'scanner.access_denied': 'ACCÈS REFUSÉ',
    'scanner.active_event': 'Événement actif',
    'scanner.already_scanned': 'Ce ticket a déjà été scanné — entrée refusée',
    'scanner.already_used': 'DÉJÀ UTILISÉ',
    'scanner.camera_access_error': 'Impossible d\'accéder à la caméra',
    'scanner.camera_active_waiting': 'Caméra active — En attente de QR code...',
    'scanner.camera_disabled': 'Caméra désactivée',
    'scanner.camera_inactive': 'Caméra inactive',
    'scanner.check': 'Vérifier',
    'scanner.click_start': 'Clique sur "Démarrer" pour activer',
    'scanner.entry_authorized': 'ENTRÉE AUTORISÉE',
    'scanner.holder': 'Titulaire',
    'scanner.invalid_code': 'Code invalide',
    'scanner.invalid_ticket': 'TICKET INVALIDE',
    'scanner.no_event': 'Aucun événement',
    'scanner.not_recognized': 'Non reconnu',
    'scanner.or_manual': 'Ou entrer le code manuellement',
    'scanner.other_organizer_ticket': 'Ce ticket appartient à un autre organisateur',
    'scanner.paste_code': 'Coller le code QR ici',
    'scanner.qr_not_recognized': 'Ce QR code n\'est pas reconnu — entrée refusée',
    'scanner.ready': 'Prêt à scanner',
    'scanner.scan_time': 'Heure scan',
    'scanner.scanned_code': 'Code scanné',
    'scanner.scanned_on': 'Scanné le',
    'scanner.scans_tonight': 'scans ce soir',
    'scanner.start_camera': 'Démarrer la caméra',
    'scanner.stop': 'Arrêter',
    'scanner.ticket_no': 'N° Ticket',
    'scanner.title': 'Scanner de tickets',
    'scanner.valid_first_use': 'Ticket valide — première utilisation',
    'settings.accent_hint': 'Le design de la plateforme (boutons, liens actifs, badges…) s\'adapte automatiquement à la couleur choisie.',
    'settings.accent_label': 'Couleur d\'accentuation',
    'settings.lang_label': 'Langue de l\'interface',
    'settings.save': 'Sauvegarder',
    'settings.tab_appearance': 'Apparence',
    'settings.tab_danger': 'Zone de danger',
    'settings.tab_mobile': 'Mobile Money',
    'settings.tab_notifs': 'Notifications',
    'settings.tab_plan': 'Mon abonnement',
    'settings.tab_profile': 'Mon profil',
    'settings.tab_security': 'Sécurité',
    'settings.theme_auto': 'Auto',
    'settings.theme_dark': 'Sombre',
    'settings.theme_label': 'Thème de l\'interface',
    'settings.theme_light': 'Clair',
    'settings.tz_label': 'Fuseau horaire',
    'status.active': 'Actif',
    'status.cancelled': 'Annulé',
    'status.confirmed': 'Confirmé',
    'status.draft': 'Brouillon',
    'status.ended': 'Terminé',
    'status.failed': 'Échoué',
    'status.inactive': 'Désactivé',
    'status.paid': 'Réussi',
    'status.pending': 'En attente',
    'status.published': 'En vente',
    'status.suspended': 'Suspendu',
    'status.used': 'Scanné',
    'status.valid': 'Valide',
    'tickets.all_events': 'Tous les événements',
    'tickets.col_buyer': 'Acheteur',
    'tickets.col_category': 'Catégorie',
    'tickets.col_number': 'N° Ticket',
    'tickets.none_found': 'Aucun ticket trouvé',
    'tickets.search_placeholder': 'Rechercher (nom, N°...)',
    'tickets.title': 'Tous les tickets',
    'topbar.admin': 'Administration Fest&Chill',
    'topbar.create_event': 'Créer un événement',
    'topbar.dashboard': 'Tableau de bord',
    'topbar.event_detail': 'Gestion de l\'événement',
    'topbar.my_events': 'Mes événements',
    'topbar.scanner': 'Scanner QR Code',
    'topbar.settings': 'Paramètres',
    'topbar.tickets_sold': 'Tickets vendus',
    'topbar.transactions': 'Transactions',
    'topbar.wallet': 'Portefeuille',
    'transactions.col_detail': 'Détail',
    'transactions.col_type': 'Type',
    'transactions.filter_all': 'Tout',
    'transactions.filter_sales': 'Ventes',
    'transactions.filter_withdrawals': 'Retraits',
    'transactions.history_title': 'Historique complet',
    'transactions.none_found': 'Aucune transaction',
    'transactions.none_yet': 'Aucune transaction pour l\'instant',
    'transactions.requests_suffix': 'demandes',
    'transactions.stat_commission': 'Commission plateforme',
    'transactions.stat_gross': 'Total encaissé',
    'transactions.stat_withdrawn': 'Total retiré',
    'transactions.type_sale': 'Vente',
    'transactions.type_withdrawal': 'Retrait vers',
    'transactions.withdrawn_suffix': 'prélevé',
    'wallet.activate': 'Activer',
    'wallet.add_number': '+ Ajouter un numéro',
    'wallet.add_number_first': 'Ajoute d\'abord un numéro Mobile Money actif',
    'wallet.add_number_sub': 'Ce numéro pourra recevoir tes retraits une fois activé.',
    'wallet.add_number_title': 'Ajouter un numéro',
    'wallet.add_one': 'Ajoute-en un',
    'wallet.all_transactions': 'Toutes les transactions',
    'wallet.amount_to_withdraw': 'Montant à retirer (FCFA)',
    'wallet.arrival_hint': 'L\'argent arrive sur ton Mobile Money en 5 à 10 minutes.',
    'wallet.before_withdrawing': 'avant de retirer.',
    'wallet.commission_charged': 'Commission prélevée',
    'wallet.deactivate': 'Désactiver',
    'wallet.export_done': 'Export CSV téléchargé !',
    'wallet.insufficient_balance': 'Solde insuffisant',
    'wallet.invalid_number': 'Numéro invalide',
    'wallet.keep_one_active': 'Il faut garder au moins un numéro actif',
    'wallet.min_amount': 'Montant minimum : 1 000 FCFA',
    'wallet.mm_number_label': 'Numéro Mobile Money',
    'wallet.mobile_money_title': 'Mon Mobile Money',
    'wallet.next_withdraw_min': 'Prochain retrait min.',
    'wallet.no_active_number': 'Tu n\'as aucun numéro actif.',
    'wallet.no_high_minimum': 'Pas de minimum élevé',
    'wallet.no_numbers': 'Aucun numéro pour l\'instant — ajoute ton numéro Mobile Money pour pouvoir retirer tes gains.',
    'wallet.no_withdrawals': 'Aucun retrait pour l\'instant',
    'wallet.number_activated': 'Numéro activé',
    'wallet.number_added': 'Numéro ajouté !',
    'wallet.number_deactivated': 'Numéro désactivé',
    'wallet.numbers_hint': 'Tes numéros liés reçoivent tes paiements automatiquement, sans délai.',
    'wallet.operator_label': 'Opérateur',
    'wallet.payment_received': 'Paiement reçu',
    'wallet.primary': 'Principal (compte)',
    'wallet.ready_withdraw': 'Prêt à retirer',
    'wallet.receiving_number': 'Numéro de réception',
    'wallet.revenue_30d': 'Revenus des 30 derniers jours',
    'wallet.sales_today': 'Ventes aujourd\'hui',
    'wallet.secondary': 'Secondaire',
    'wallet.this_week': 'Cette semaine',
    'wallet.ticket_sale': 'Vente ticket',
    'wallet.total_earned': 'Total encaissé (net, tout temps)',
    'wallet.withdraw_money': 'Retirer de l\'argent',
    'wallet.withdraw_now': 'Retirer maintenant',
    'wallet.withdrawal_history': 'Historique des retraits',
    'wallet.withdrawal_sent': 'Demande de retrait envoyée !',
  },
  en: {
    'settings.account_security': 'Account security',
    'settings.account_suspended': 'Account suspended.',
    'settings.active_f': 'Active',
    'settings.active_sessions': 'Active sessions',
    'settings.all_sessions_disconnected': 'All other sessions disconnected!',
    'settings.before_deleting': 'Before deleting your account',
    'settings.before_deleting_text': 'Make sure you have withdrawn all your available funds. Tickets already sold will remain valid until the event date. Data cannot be recovered after deletion.',
    'settings.bio': 'Bio / Description',
    'settings.bio_placeholder': 'Describe yourself in a few words...',
    'settings.block': 'Block',
    'settings.by_email': 'By email',
    'settings.by_sms': 'By SMS',
    'settings.change': 'Change',
    'settings.city': 'City',
    'settings.city_bio_hint': 'City and bio are coming soon to public pages — for now, only the name and phone number are saved.',
    'settings.city_placeholder': 'E.g.: Cotonou, Benin',
    'settings.color_applied': 'Color applied!',
    'settings.coming_soon_notify': 'Coming soon! We\'ll notify you.',
    'settings.confirm_delete': 'Are you sure you want to permanently delete your account? This action is irreversible.',
    'settings.confirm_suspend': 'Temporarily suspend your account? You can reactivate it by logging back in.',
    'settings.current_f': 'Current',
    'settings.current_plan': 'Current plan',
    'settings.current_session': 'Cotonou, Benin · Current session · 2 min ago',
    'settings.delete': 'Delete',
    'settings.delete_account': 'Permanently delete my account',
    'settings.delete_account_sub': 'This action is irreversible. Send a request to our support team to confirm.',
    'settings.delete_request_sent': 'Request sent to our support team for confirmation.',
    'settings.disconnect': 'Disconnect',
    'settings.disconnect_all': 'Disconnect all other sessions',
    'settings.email': 'Email',
    'settings.email_verified': 'Email verified',
    'settings.enabled': 'Enabled',
    'settings.export_data': 'Export my data',
    'settings.export_data_sub': 'Download all your data (events, tickets, transactions) as CSV',
    'settings.export_in_progress': 'Export in progress... You will receive an email',
    'settings.firefox_unknown': 'Firefox · Unknown',
    'settings.free_account': 'Free Account',
    'settings.full_name': 'Full name *',
    'settings.id_document': 'ID document',
    'settings.id_not_verified': 'Not verified — Required for large withdrawals',
    'settings.important': 'Important',
    'settings.in_app': 'In the app',
    'settings.manage_in_wallet': 'Manage in Wallet',
    'settings.mm_headline': 'Your earnings, without friction',
    'settings.mm_headline_sub': 'Add one or more Mobile Money numbers — your withdrawals arrive there within minutes.',
    'settings.mm_important_text': 'Make sure your Mobile Money numbers are active and match your name. Withdrawals are sent directly to these numbers.',
    'settings.mm_used_for': 'Used to receive your withdrawals.',
    'settings.name_required': 'Name is required',
    'settings.notif_daily_sub': 'Summary of your sales sent every evening at 8pm',
    'settings.notif_daily_title': 'Daily sales report',
    'settings.notif_failed_sub': 'SMS when a buyer has a payment issue',
    'settings.notif_failed_title': 'Payment failed',
    'settings.notif_headline': 'Stay informed, without being overwhelmed',
    'settings.notif_headline_sub': 'Choose exactly what deserves an SMS, an email, or just a push notification.',
    'settings.notif_inapp_sub': 'Real-time notifications in the dashboard',
    'settings.notif_inapp_title': 'All in-app notifications',
    'settings.notif_news_sub': 'Fest&Chill platform updates',
    'settings.notif_news_title': 'News and new features',
    'settings.notif_prefs_sub': 'Choose how and when you want to be notified.',
    'settings.notif_prefs_title': 'Notification preferences',
    'settings.notif_sale_sub': 'Receive an SMS for every ticket sold',
    'settings.notif_sale_title': 'Ticket sale',
    'settings.notif_saved': 'Notification preferences saved!',
    'settings.notif_security_sub': 'Login from a new device, suspicious attempts',
    'settings.notif_security_title': 'Security alerts',
    'settings.notif_sound_sub': 'Play a sound for every new sale',
    'settings.notif_sound_title': 'Notification sound',
    'settings.notif_weekly_sub': 'Weekly summary every Monday morning',
    'settings.notif_weekly_title': 'Weekly report',
    'settings.notif_withdraw_sub': 'SMS when your money is sent to Mobile Money',
    'settings.notif_withdraw_title': 'Withdrawal confirmed',
    'settings.password': 'Password',
    'settings.password_last_changed': 'Last changed 3 months ago',
    'settings.phone': 'Phone *',
    'settings.plan_f1': 'Free account creation',
    'settings.plan_f2': 'Unlimited events (with a fee per publication)',
    'settings.plan_f3': 'Numbered tickets with QR codes',
    'settings.plan_f4': 'MTN Mobile Money payment',
    'settings.plan_f5': 'Basic dashboard',
    'settings.plan_f6': 'Built-in QR scanner',
    'settings.premium_f1': 'Advanced statistics',
    'settings.premium_f2': 'Detailed charts',
    'settings.premium_f3': 'Unlimited AI poster',
    'settings.premium_f4': 'Reduced commission',
    'settings.premium_f5': 'Priority support',
    'settings.premium_f6': 'Automatic PDF reports',
    'settings.premium_f7': 'Multi-organizer',
    'settings.premium_f8': 'API access',
    'settings.profile_info': 'Profile information',
    'settings.profile_info_sub': 'This information appears on your events.',
    'settings.profile_updated': 'Profile updated successfully!',
    'settings.protect_account': 'Protect your account and your data.',
    'settings.reset_email_sent': 'Reset email sent!',
    'settings.save_profile': 'Save profile',
    'settings.sec_headline': 'Your account, well protected',
    'settings.sec_headline_sub': 'Password, two-factor authentication and active sessions — all in one place.',
    'settings.session_2': 'Cotonou, Benin · 3 hours ago',
    'settings.session_3': 'Lagos, Nigeria · 2 days ago — Suspicious?',
    'settings.session_blocked': 'Suspicious session blocked!',
    'settings.session_disconnected': 'Session disconnected!',
    'settings.sms_to': 'SMS to',
    'settings.suspend_account': 'Suspend my account',
    'settings.suspend_account_sub': 'Temporarily deactivate your account. You can reactivate it at any time.',
    'settings.tbd': 'TBD',
    'settings.two_fa': 'Two-factor authentication (2FA)',
    'settings.unlock_features': 'Unlock all advanced features',
    'settings.upgrade_cta': 'Upgrade to Premium — Coming soon',
    'settings.upgrade_premium': 'Upgrade to Premium Plan',
    'settings.using_free_version': 'You\'re using the free version of Fest&Chill.',
    'settings.verif_form_opened': 'Verification form opened',
    'settings.lang_switched': 'Interface switched to',
    'settings.appearance_saved': 'Appearance preferences saved!',
    'admin.account_blocked': 'Account blocked!',
    'admin.account_reactivated': 'Account reactivated!',
    'admin.account_verified': 'Account verified!',
    'admin.active_events': 'Active events',
    'admin.commission': 'Commission',
    'admin.commission_cumulated': 'Cumulative commission',
    'admin.commissions_cumulated': 'Cumulative commissions',
    'admin.config_saved': 'Configuration saved!',
    'admin.confirmed_withdrawals': 'confirmed withdrawals',
    'admin.currently_selling': 'currently on sale',
    'admin.default_organizer': 'Organizer',
    'admin.event_republished': 'Event republished',
    'admin.event_singular': 'event',
    'admin.event_suspended': 'Event suspended',
    'admin.events_plural': 'events',
    'admin.export_csv_ready': 'CSV export ready',
    'admin.export_full_ready': 'Full export ready',
    'admin.gross_revenue': 'Gross revenue',
    'admin.last_update': 'Updated',
    'admin.new_unverified_organizer': 'New unverified organizer',
    'admin.no_name': 'No name',
    'admin.no_orders_yet': 'No orders yet',
    'admin.no_organizers_yet': 'No organizers yet',
    'admin.not_verified': 'Not verified',
    'admin.operator': 'Operator',
    'admin.organizer': 'Organizer',
    'admin.paid_orders': 'paid orders',
    'admin.pending_verification': 'pending verification',
    'admin.pending_withdrawal': 'Pending withdrawal',
    'admin.platform_config': 'Platform configuration',
    'admin.rate_label': 'Rate',
    'admin.reactivate': 'Reactivate',
    'admin.recent_organizers': 'Recent organizers',
    'admin.recent_transactions': 'Recent transactions',
    'admin.registered_on': 'Registered on',
    'admin.republish': 'Republish',
    'admin.revenue': 'Revenue',
    'admin.revenue_30d': 'Platform revenue (30d)',
    'admin.see_all': 'See all',
    'admin.stat_events': 'Ongoing events',
    'admin.stat_organizers': 'Active organizers',
    'admin.stat_revenue': 'Platform revenue',
    'admin.suspend': 'Suspend',
    'admin.tickets': 'Tickets',
    'admin.title': 'Administrator',
    'admin.top_organizers': 'Top organizers',
    'admin.total_paid_out': 'Total paid to organizers',
    'admin.total_registered': 'Total registered',
    'admin.verified': 'Verified',
    'admin.verify': 'Verify',
    'admin.withdrawal_request_of': 'Withdrawal request of',
    'common.add_short': '+ Add',
    'common.amount': 'Amount',
    'common.cancel': 'Cancel',
    'common.copy': 'Copy',
    'common.create_event_btn': '+ Create an event',
    'common.date': 'Date',
    'common.error_prefix': 'Error:',
    'common.event': 'Event',
    'common.export': 'Export',
    'common.loading': 'Loading…',
    'common.retry': 'Retry',
    'common.search': 'Search...',
    'common.status': 'Status',
    'common.ticket': 'Ticket',
    'common.view_all': 'View all',
    'common.withdrawal': 'Withdrawal',
    'create.cat_name': 'Name',
    'create.cat_price': 'Price (FCFA)',
    'create.cat_quota': 'Quota',
    'create.categories_sub': 'Add at least one category (e.g.: Normal, VIP, VVIP)',
    'create.categories_title': 'Ticket categories',
    'create.date_label': 'Date *',
    'create.description_label': 'Description',
    'create.description_placeholder': 'Describe your event...',
    'create.error_category': 'Add at least one valid ticket category (name + quota).',
    'create.error_created_but_categories': 'Event created but an error occurred with the categories:',
    'create.error_required': 'Title, date and location are required.',
    'create.event_info': 'Event information',
    'create.event_info_sub': 'This information will be visible on your public sales page.',
    'create.location_label': 'Location *',
    'create.location_placeholder': 'E.g.: Convention Center, Cotonou',
    'create.publish': 'Publish event',
    'create.publishing': 'Publishing...',
    'create.save_draft': 'Save as draft',
    'create.time_label': 'Time',
    'create.title_label': 'Event title *',
    'create.title_placeholder': 'E.g.: Afrobeat Concert Cotonou',
    'create.type_concert': '🎵 Concert / Music',
    'create.type_conference': '🎤 Conference',
    'create.type_label': 'Event type',
    'create.type_other': '✨ Other',
    'create.type_party': '🎉 Party / Club',
    'create.type_sport': '⚽ Sport',
    'create.type_theatre': '🎭 Theatre / Art',
    'dashboard.all_categories': 'all categories',
    'dashboard.all_categories_cap': 'All categories',
    'dashboard.create_first': 'Create my first event',
    'dashboard.greeting_hi': 'Hi',
    'dashboard.greeting_you': 'there',
    'dashboard.no_events': 'No events yet.',
    'dashboard.no_sales': 'No sales yet',
    'dashboard.recent_events': '📅 My recent events',
    'dashboard.recent_sales': '💳 Latest sales',
    'dashboard.stat_balance': 'Available balance',
    'dashboard.stat_events': 'Events',
    'dashboard.stat_revenue': 'Revenue (net)',
    'dashboard.stat_revenue_sub': 'after commission',
    'dashboard.subtitle': 'Here\'s an overview of your activity on Fest&Chill.',
    'dashboard.upcoming_suffix': 'upcoming',
    'dashboard.withdraw_link': 'Withdraw →',
    'event_detail.after_commission': 'After Fest&Chill commission',
    'event_detail.ago': 'ago',
    'event_detail.available': 'available',
    'event_detail.available_revenue': 'Available revenue',
    'event_detail.copy_failed': 'Automatic copy failed — the link is selected, copy it with Ctrl/Cmd+C',
    'event_detail.copy_link_btn': 'Copy link',
    'event_detail.copy_link_btn2': 'Copy the link',
    'event_detail.download': 'Download',
    'event_detail.generating': 'Generating…',
    'event_detail.go_to_wallet': 'Go to wallet to withdraw',
    'event_detail.just_now': 'Just now',
    'event_detail.link_copied': 'Link copied to clipboard!',
    'event_detail.link_not_ready': 'Link not ready yet, try again in a moment',
    'event_detail.no_activity_yet': 'No activity yet — sales will appear here as soon as a fan buys a ticket.',
    'event_detail.no_tickets_yet': 'No tickets sold yet',
    'event_detail.out_of': 'out of',
    'event_detail.payment_failed': 'Payment failed',
    'event_detail.payment_pending': 'Payment pending',
    'event_detail.print': 'Print',
    'event_detail.qr_gen_failed': 'Generation failed.',
    'event_detail.qr_not_ready': 'QR not ready yet',
    'event_detail.qr_printed': 'QR Code printed!',
    'event_detail.qr_unavailable': 'QR unavailable (connection).',
    'event_detail.recent_activity': 'Recent activity',
    'event_detail.sales_progress': 'Sales progress',
    'event_detail.scan_at_entry': 'Scan at entry',
    'event_detail.share_event': 'Share the event',
    'event_detail.share_hint': 'Share this link so people can buy their tickets.',
    'event_detail.sold': 'sold',
    'event_detail.sold_pct': 'sold',
    'events.filter_all': 'All',
    'events.filter_draft': 'Drafts',
    'events.filter_ended': 'Ended',
    'events.filter_suspended': 'Suspended',
    'events.no_events_category': 'No events in this category.',
    'events.sold_label': 'sold',
    'menu.account': 'My account',
    'menu.logout': 'Log out',
    'menu.manage_account': 'Manage account',
    'menu.view_profile': 'View profile',
    'nav.admin': 'Administration',
    'nav.all_events': 'All events',
    'nav.all_tickets': 'All tickets',
    'nav.commissions': 'Commissions',
    'nav.config': 'Configuration',
    'nav.create_event': 'Create an event',
    'nav.dashboard': 'Dashboard',
    'nav.dashboard_admin': 'Admin dashboard',
    'nav.group_admin': 'Admin',
    'nav.group_finance': 'Finance',
    'nav.group_main': 'Main',
    'nav.group_tools': 'Tools',
    'nav.my_events': 'My events',
    'nav.organizer_view': 'Organizer view',
    'nav.organizers': 'Organizers',
    'nav.payouts': 'Payouts',
    'nav.platform_revenue': 'Platform revenue',
    'nav.scanner': 'QR Scanner',
    'nav.settings': 'Settings',
    'nav.support': 'Customer support',
    'nav.tickets_sold': 'Tickets sold',
    'nav.transactions': 'Transactions',
    'nav.wallet': 'Wallet',
    'scanner.access_denied': 'ACCESS DENIED',
    'scanner.active_event': 'Active event',
    'scanner.already_scanned': 'This ticket has already been scanned — entry denied',
    'scanner.already_used': 'ALREADY USED',
    'scanner.camera_access_error': 'Unable to access the camera',
    'scanner.camera_active_waiting': 'Camera active — Waiting for QR code...',
    'scanner.camera_disabled': 'Camera disabled',
    'scanner.camera_inactive': 'Camera inactive',
    'scanner.check': 'Check',
    'scanner.click_start': 'Click "Start" to enable',
    'scanner.entry_authorized': 'ENTRY AUTHORIZED',
    'scanner.holder': 'Holder',
    'scanner.invalid_code': 'Invalid code',
    'scanner.invalid_ticket': 'INVALID TICKET',
    'scanner.no_event': 'No event',
    'scanner.not_recognized': 'Not recognized',
    'scanner.or_manual': 'Or enter the code manually',
    'scanner.other_organizer_ticket': 'This ticket belongs to another organizer',
    'scanner.paste_code': 'Paste the QR code here',
    'scanner.qr_not_recognized': 'This QR code is not recognized — entry denied',
    'scanner.ready': 'Ready to scan',
    'scanner.scan_time': 'Scan time',
    'scanner.scanned_code': 'Scanned code',
    'scanner.scanned_on': 'Scanned on',
    'scanner.scans_tonight': 'scans tonight',
    'scanner.start_camera': 'Start camera',
    'scanner.stop': 'Stop',
    'scanner.ticket_no': 'Ticket No',
    'scanner.title': 'Ticket scanner',
    'scanner.valid_first_use': 'Valid ticket — first use',
    'settings.accent_hint': 'The platform\'s design (buttons, active links, badges…) automatically adapts to the color you choose.',
    'settings.accent_label': 'Accent color',
    'settings.lang_label': 'Interface language',
    'settings.save': 'Save',
    'settings.tab_appearance': 'Appearance',
    'settings.tab_danger': 'Danger zone',
    'settings.tab_mobile': 'Mobile Money',
    'settings.tab_notifs': 'Notifications',
    'settings.tab_plan': 'My subscription',
    'settings.tab_profile': 'My profile',
    'settings.tab_security': 'Security',
    'settings.theme_auto': 'Auto',
    'settings.theme_dark': 'Dark',
    'settings.theme_label': 'Interface theme',
    'settings.theme_light': 'Light',
    'settings.tz_label': 'Time zone',
    'status.active': 'Active',
    'status.cancelled': 'Cancelled',
    'status.confirmed': 'Confirmed',
    'status.draft': 'Draft',
    'status.ended': 'Ended',
    'status.failed': 'Failed',
    'status.inactive': 'Disabled',
    'status.paid': 'Successful',
    'status.pending': 'Pending',
    'status.published': 'On sale',
    'status.suspended': 'Suspended',
    'status.used': 'Scanned',
    'status.valid': 'Valid',
    'tickets.all_events': 'All events',
    'tickets.col_buyer': 'Buyer',
    'tickets.col_category': 'Category',
    'tickets.col_number': 'Ticket No',
    'tickets.none_found': 'No tickets found',
    'tickets.search_placeholder': 'Search (name, No...)',
    'tickets.title': 'All tickets',
    'topbar.admin': 'Fest&Chill administration',
    'topbar.create_event': 'Create an event',
    'topbar.dashboard': 'Dashboard',
    'topbar.event_detail': 'Event management',
    'topbar.my_events': 'My events',
    'topbar.scanner': 'QR Scanner',
    'topbar.settings': 'Settings',
    'topbar.tickets_sold': 'Tickets sold',
    'topbar.transactions': 'Transactions',
    'topbar.wallet': 'Wallet',
    'transactions.col_detail': 'Detail',
    'transactions.col_type': 'Type',
    'transactions.filter_all': 'All',
    'transactions.filter_sales': 'Sales',
    'transactions.filter_withdrawals': 'Withdrawals',
    'transactions.history_title': 'Full history',
    'transactions.none_found': 'No transactions',
    'transactions.none_yet': 'No transactions yet',
    'transactions.requests_suffix': 'requests',
    'transactions.stat_commission': 'Platform commission',
    'transactions.stat_gross': 'Total collected',
    'transactions.stat_withdrawn': 'Total withdrawn',
    'transactions.type_sale': 'Sale',
    'transactions.type_withdrawal': 'Withdrawal to',
    'transactions.withdrawn_suffix': 'deducted',
    'wallet.activate': 'Activate',
    'wallet.add_number': '+ Add a number',
    'wallet.add_number_first': 'First add an active Mobile Money number',
    'wallet.add_number_sub': 'Once activated, this number will be able to receive your withdrawals.',
    'wallet.add_number_title': 'Add a number',
    'wallet.add_one': 'Add one',
    'wallet.all_transactions': 'All transactions',
    'wallet.amount_to_withdraw': 'Amount to withdraw (FCFA)',
    'wallet.arrival_hint': 'The money arrives in your Mobile Money account within 5 to 10 minutes.',
    'wallet.before_withdrawing': 'before withdrawing.',
    'wallet.commission_charged': 'Commission charged',
    'wallet.deactivate': 'Deactivate',
    'wallet.export_done': 'CSV export downloaded!',
    'wallet.insufficient_balance': 'Insufficient balance',
    'wallet.invalid_number': 'Invalid number',
    'wallet.keep_one_active': 'You must keep at least one active number',
    'wallet.min_amount': 'Minimum amount: 1,000 FCFA',
    'wallet.mm_number_label': 'Mobile Money number',
    'wallet.mobile_money_title': 'My Mobile Money',
    'wallet.next_withdraw_min': 'Next withdrawal min.',
    'wallet.no_active_number': 'You have no active number.',
    'wallet.no_high_minimum': 'No high minimum',
    'wallet.no_numbers': 'No numbers yet — add your Mobile Money number so you can withdraw your earnings.',
    'wallet.no_withdrawals': 'No withdrawals yet',
    'wallet.number_activated': 'Number activated',
    'wallet.number_added': 'Number added!',
    'wallet.number_deactivated': 'Number deactivated',
    'wallet.numbers_hint': 'Your linked numbers receive your payments automatically, with no delay.',
    'wallet.operator_label': 'Operator',
    'wallet.payment_received': 'Payment received',
    'wallet.primary': 'Primary (account)',
    'wallet.ready_withdraw': 'Ready to withdraw',
    'wallet.receiving_number': 'Receiving number',
    'wallet.revenue_30d': 'Revenue for the last 30 days',
    'wallet.sales_today': 'Sales today',
    'wallet.secondary': 'Secondary',
    'wallet.this_week': 'This week',
    'wallet.ticket_sale': 'Ticket sale',
    'wallet.total_earned': 'Total earned (net, all time)',
    'wallet.withdraw_money': 'Withdraw money',
    'wallet.withdraw_now': 'Withdraw now',
    'wallet.withdrawal_history': 'Withdrawal history',
    'wallet.withdrawal_sent': 'Withdrawal request sent!',
  },
  es: {
    'settings.account_security': 'Seguridad de la cuenta',
    'settings.account_suspended': 'Cuenta suspendida.',
    'settings.active_f': 'Activa',
    'settings.active_sessions': 'Sesiones activas',
    'settings.all_sessions_disconnected': '¡Todas las demás sesiones desconectadas!',
    'settings.before_deleting': 'Antes de eliminar tu cuenta',
    'settings.before_deleting_text': 'Asegúrate de haber retirado todo tu dinero disponible. Las entradas ya vendidas seguirán siendo válidas hasta la fecha del evento. Los datos no se pueden recuperar después de la eliminación.',
    'settings.bio': 'Biografía / Descripción',
    'settings.bio_placeholder': 'Descríbete en pocas palabras...',
    'settings.block': 'Bloquear',
    'settings.by_email': 'Por correo',
    'settings.by_sms': 'Por SMS',
    'settings.change': 'Cambiar',
    'settings.city': 'Ciudad',
    'settings.city_bio_hint': 'La ciudad y la biografía llegarán pronto a las páginas públicas — por ahora, solo se guardan el nombre y el teléfono.',
    'settings.city_placeholder': 'Ej: Cotonú, Benín',
    'settings.color_applied': '¡Color aplicado!',
    'settings.coming_soon_notify': '¡Próximamente! Te avisaremos.',
    'settings.confirm_delete': '¿Seguro que quieres eliminar tu cuenta permanentemente? Esta acción es irreversible.',
    'settings.confirm_suspend': '¿Suspender temporalmente tu cuenta? Podrás reactivarla al volver a iniciar sesión.',
    'settings.current_f': 'Actual',
    'settings.current_plan': 'Plan actual',
    'settings.current_session': 'Cotonú, Benín · Sesión actual · Hace 2 min',
    'settings.delete': 'Eliminar',
    'settings.delete_account': 'Eliminar mi cuenta permanentemente',
    'settings.delete_account_sub': 'Esta acción es irreversible. Envía una solicitud a nuestro soporte para confirmar.',
    'settings.delete_request_sent': 'Solicitud enviada a nuestro soporte para confirmación.',
    'settings.disconnect': 'Desconectar',
    'settings.disconnect_all': 'Desconectar todas las demás sesiones',
    'settings.email': 'Correo electrónico',
    'settings.email_verified': 'Correo verificado',
    'settings.enabled': 'Activada',
    'settings.export_data': 'Exportar mis datos',
    'settings.export_data_sub': 'Descargar todos tus datos (eventos, entradas, transacciones) en CSV',
    'settings.export_in_progress': 'Exportación en curso... Recibirás un correo',
    'settings.firefox_unknown': 'Firefox · Desconocido',
    'settings.free_account': 'Cuenta Gratuita',
    'settings.full_name': 'Nombre completo *',
    'settings.id_document': 'Documento de identidad',
    'settings.id_not_verified': 'No verificado — Requerido para retiros grandes',
    'settings.important': 'Importante',
    'settings.in_app': 'En la aplicación',
    'settings.manage_in_wallet': 'Gestionar en la Billetera',
    'settings.mm_headline': 'Tus ingresos, sin fricción',
    'settings.mm_headline_sub': 'Añade uno o varios números de Mobile Money — tus retiros llegan en minutos.',
    'settings.mm_important_text': 'Asegúrate de que tus números de Mobile Money estén activos y coincidan con tu nombre. Los retiros se envían directamente a estos números.',
    'settings.mm_used_for': 'Usados para recibir tus retiros.',
    'settings.name_required': 'El nombre es obligatorio',
    'settings.notif_daily_sub': 'Resumen de tus ventas enviado cada noche a las 20h',
    'settings.notif_daily_title': 'Informe diario de ventas',
    'settings.notif_failed_sub': 'SMS cuando un comprador tiene un problema de pago',
    'settings.notif_failed_title': 'Pago fallido',
    'settings.notif_headline': 'Mantente informado, sin saturarte',
    'settings.notif_headline_sub': 'Elige exactamente qué merece un SMS, un correo o solo una notificación push.',
    'settings.notif_inapp_sub': 'Notificaciones en tiempo real en el panel',
    'settings.notif_inapp_title': 'Todas las notificaciones en la app',
    'settings.notif_news_sub': 'Actualizaciones de la plataforma Fest&Chill',
    'settings.notif_news_title': 'Noticias y nuevas funciones',
    'settings.notif_prefs_sub': 'Elige cómo y cuándo quieres ser notificado.',
    'settings.notif_prefs_title': 'Preferencias de notificación',
    'settings.notif_sale_sub': 'Recibir un SMS por cada entrada vendida',
    'settings.notif_sale_title': 'Venta de entrada',
    'settings.notif_saved': '¡Preferencias de notificación guardadas!',
    'settings.notif_security_sub': 'Inicio de sesión desde un nuevo dispositivo, intentos sospechosos',
    'settings.notif_security_title': 'Alertas de seguridad',
    'settings.notif_sound_sub': 'Reproducir un sonido en cada nueva venta',
    'settings.notif_sound_title': 'Sonido de notificación',
    'settings.notif_weekly_sub': 'Resumen semanal cada lunes por la mañana',
    'settings.notif_weekly_title': 'Informe semanal',
    'settings.notif_withdraw_sub': 'SMS cuando tu dinero se envía a Mobile Money',
    'settings.notif_withdraw_title': 'Retiro confirmado',
    'settings.password': 'Contraseña',
    'settings.password_last_changed': 'Última modificación hace 3 meses',
    'settings.phone': 'Teléfono *',
    'settings.plan_f1': 'Creación de cuenta gratuita',
    'settings.plan_f2': 'Eventos ilimitados (con tarifa por publicación)',
    'settings.plan_f3': 'Entradas numeradas con códigos QR',
    'settings.plan_f4': 'Pago con MTN Mobile Money',
    'settings.plan_f5': 'Panel básico',
    'settings.plan_f6': 'Escáner QR integrado',
    'settings.premium_f1': 'Estadísticas avanzadas',
    'settings.premium_f2': 'Gráficos detallados',
    'settings.premium_f3': 'Cartel IA ilimitado',
    'settings.premium_f4': 'Comisión reducida',
    'settings.premium_f5': 'Soporte prioritario',
    'settings.premium_f6': 'Informes PDF automáticos',
    'settings.premium_f7': 'Multi-organizadores',
    'settings.premium_f8': 'Acceso a la API',
    'settings.profile_info': 'Información del perfil',
    'settings.profile_info_sub': 'Esta información aparece en tus eventos.',
    'settings.profile_updated': '¡Perfil actualizado con éxito!',
    'settings.protect_account': 'Protege tu cuenta y tus datos.',
    'settings.reset_email_sent': '¡Correo de restablecimiento enviado!',
    'settings.save_profile': 'Guardar perfil',
    'settings.sec_headline': 'Tu cuenta, bien protegida',
    'settings.sec_headline_sub': 'Contraseña, autenticación de dos factores y sesiones activas — todo en un solo lugar.',
    'settings.session_2': 'Cotonú, Benín · Hace 3 horas',
    'settings.session_3': 'Lagos, Nigeria · Hace 2 días — ¿Sospechoso?',
    'settings.session_blocked': '¡Sesión sospechosa bloqueada!',
    'settings.session_disconnected': '¡Sesión desconectada!',
    'settings.sms_to': 'SMS al',
    'settings.suspend_account': 'Suspender mi cuenta',
    'settings.suspend_account_sub': 'Desactiva temporalmente tu cuenta. Podrás reactivarla en cualquier momento.',
    'settings.tbd': 'Por definir',
    'settings.two_fa': 'Autenticación de dos factores (2FA)',
    'settings.unlock_features': 'Desbloquea todas las funciones avanzadas',
    'settings.upgrade_cta': 'Pasar a Premium — Próximamente',
    'settings.upgrade_premium': 'Pasar al Plan Premium',
    'settings.using_free_version': 'Estás usando la versión gratuita de Fest&Chill.',
    'settings.verif_form_opened': 'Formulario de verificación abierto',
    'settings.lang_switched': 'Interfaz cambiada a',
    'settings.appearance_saved': '¡Preferencias de apariencia guardadas!',
    'admin.account_blocked': '¡Cuenta bloqueada!',
    'admin.account_reactivated': '¡Cuenta reactivada!',
    'admin.account_verified': '¡Cuenta verificada!',
    'admin.active_events': 'Eventos activos',
    'admin.commission': 'Comisión',
    'admin.commission_cumulated': 'Comisión acumulada',
    'admin.commissions_cumulated': 'Comisiones acumuladas',
    'admin.config_saved': '¡Configuración guardada!',
    'admin.confirmed_withdrawals': 'retiros confirmados',
    'admin.currently_selling': 'a la venta actualmente',
    'admin.default_organizer': 'Organizador',
    'admin.event_republished': 'Evento vuelto a publicar',
    'admin.event_singular': 'evento',
    'admin.event_suspended': 'Evento suspendido',
    'admin.events_plural': 'eventos',
    'admin.export_csv_ready': 'Exportación CSV lista',
    'admin.export_full_ready': 'Exportación completa lista',
    'admin.gross_revenue': 'Ingresos brutos',
    'admin.last_update': 'Actualizado',
    'admin.new_unverified_organizer': 'Nuevo organizador no verificado',
    'admin.no_name': 'Sin nombre',
    'admin.no_orders_yet': 'Aún no hay pedidos',
    'admin.no_organizers_yet': 'Aún no hay organizadores',
    'admin.not_verified': 'No verificado',
    'admin.operator': 'Operador',
    'admin.organizer': 'Organizador',
    'admin.paid_orders': 'pedidos pagados',
    'admin.pending_verification': 'pendiente de verificación',
    'admin.pending_withdrawal': 'Retiro pendiente',
    'admin.platform_config': 'Configuración de la plataforma',
    'admin.rate_label': 'Tasa',
    'admin.reactivate': 'Reactivar',
    'admin.recent_organizers': 'Organizadores recientes',
    'admin.recent_transactions': 'Transacciones recientes',
    'admin.registered_on': 'Registrado el',
    'admin.republish': 'Volver a publicar',
    'admin.revenue': 'Ingresos',
    'admin.revenue_30d': 'Ingresos de la plataforma (30d)',
    'admin.see_all': 'Ver todos',
    'admin.stat_events': 'Eventos en curso',
    'admin.stat_organizers': 'Organizadores activos',
    'admin.stat_revenue': 'Ingresos de la plataforma',
    'admin.suspend': 'Suspender',
    'admin.tickets': 'Entradas',
    'admin.title': 'Administrador',
    'admin.top_organizers': 'Mejores organizadores',
    'admin.total_paid_out': 'Total pagado a organizadores',
    'admin.total_registered': 'Total registrados',
    'admin.verified': 'Verificado',
    'admin.verify': 'Verificar',
    'admin.withdrawal_request_of': 'Solicitud de retiro de',
    'common.add_short': '+ Añadir',
    'common.amount': 'Monto',
    'common.cancel': 'Cancelar',
    'common.copy': 'Copiar',
    'common.create_event_btn': '+ Crear un evento',
    'common.date': 'Fecha',
    'common.error_prefix': 'Error:',
    'common.event': 'Evento',
    'common.export': 'Exportar',
    'common.loading': 'Cargando…',
    'common.retry': 'Reintentar',
    'common.search': 'Buscar...',
    'common.status': 'Estado',
    'common.ticket': 'Entrada',
    'common.view_all': 'Ver todo',
    'common.withdrawal': 'Retiro',
    'create.cat_name': 'Nombre',
    'create.cat_price': 'Precio (FCFA)',
    'create.cat_quota': 'Cupo',
    'create.categories_sub': 'Añade al menos una categoría (ej: Normal, VIP, VVIP)',
    'create.categories_title': 'Categorías de entradas',
    'create.date_label': 'Fecha *',
    'create.description_label': 'Descripción',
    'create.description_placeholder': 'Describe tu evento...',
    'create.error_category': 'Añade al menos una categoría de entrada válida (nombre + cupo).',
    'create.error_created_but_categories': 'Evento creado pero hubo un error con las categorías:',
    'create.error_required': 'El título, la fecha y el lugar son obligatorios.',
    'create.event_info': 'Información del evento',
    'create.event_info_sub': 'Esta información será visible en tu página de venta pública.',
    'create.location_label': 'Lugar *',
    'create.location_placeholder': 'Ej: Palacio de Congresos, Cotonú',
    'create.publish': 'Publicar evento',
    'create.publishing': 'Publicando...',
    'create.save_draft': 'Guardar como borrador',
    'create.time_label': 'Hora',
    'create.title_label': 'Título del evento *',
    'create.title_placeholder': 'Ej: Concierto Afrobeat Cotonou',
    'create.type_concert': '🎵 Concierto / Música',
    'create.type_conference': '🎤 Conferencia',
    'create.type_label': 'Tipo de evento',
    'create.type_other': '✨ Otro',
    'create.type_party': '🎉 Fiesta / Club',
    'create.type_sport': '⚽ Deporte',
    'create.type_theatre': '🎭 Teatro / Arte',
    'dashboard.all_categories': 'todas las categorías',
    'dashboard.all_categories_cap': 'Todas las categorías',
    'dashboard.create_first': 'Crear mi primer evento',
    'dashboard.greeting_hi': 'Hola',
    'dashboard.greeting_you': 'ti',
    'dashboard.no_events': 'Aún no hay eventos.',
    'dashboard.no_sales': 'Aún no hay ventas',
    'dashboard.recent_events': '📅 Mis eventos recientes',
    'dashboard.recent_sales': '💳 Últimas ventas',
    'dashboard.stat_balance': 'Saldo disponible',
    'dashboard.stat_events': 'Eventos',
    'dashboard.stat_revenue': 'Ingresos (netos)',
    'dashboard.stat_revenue_sub': 'después de la comisión',
    'dashboard.subtitle': 'Aquí tienes un resumen de tu actividad en Fest&Chill.',
    'dashboard.upcoming_suffix': 'próximos',
    'dashboard.withdraw_link': 'Retirar →',
    'event_detail.after_commission': 'Después de la comisión de Fest&Chill',
    'event_detail.ago': 'hace',
    'event_detail.available': 'disponibles',
    'event_detail.available_revenue': 'Ingresos disponibles',
    'event_detail.copy_failed': 'No se pudo copiar automáticamente — el enlace está seleccionado, cópialo con Ctrl/Cmd+C',
    'event_detail.copy_link_btn': 'Copiar enlace',
    'event_detail.copy_link_btn2': 'Copiar el enlace',
    'event_detail.download': 'Descargar',
    'event_detail.generating': 'Generando…',
    'event_detail.go_to_wallet': 'Ir a la billetera para retirar',
    'event_detail.just_now': 'Justo ahora',
    'event_detail.link_copied': '¡Enlace copiado al portapapeles!',
    'event_detail.link_not_ready': 'El enlace aún no está listo, inténtalo de nuevo en un momento',
    'event_detail.no_activity_yet': 'Aún no hay actividad — las ventas aparecerán aquí en cuanto un fan compre una entrada.',
    'event_detail.no_tickets_yet': 'Aún no se han vendido entradas',
    'event_detail.out_of': 'de',
    'event_detail.payment_failed': 'Pago fallido',
    'event_detail.payment_pending': 'Pago pendiente',
    'event_detail.print': 'Imprimir',
    'event_detail.qr_gen_failed': 'Error al generar.',
    'event_detail.qr_not_ready': 'QR aún no está listo',
    'event_detail.qr_printed': '¡Código QR impreso!',
    'event_detail.qr_unavailable': 'QR no disponible (conexión).',
    'event_detail.recent_activity': 'Actividad reciente',
    'event_detail.sales_progress': 'Progreso de ventas',
    'event_detail.scan_at_entry': 'Escanear en la entrada',
    'event_detail.share_event': 'Compartir el evento',
    'event_detail.share_hint': 'Comparte este enlace para que la gente pueda comprar sus entradas.',
    'event_detail.sold': 'vendido',
    'event_detail.sold_pct': 'vendido',
    'events.filter_all': 'Todos',
    'events.filter_draft': 'Borradores',
    'events.filter_ended': 'Finalizados',
    'events.filter_suspended': 'Suspendidos',
    'events.no_events_category': 'No hay eventos en esta categoría.',
    'events.sold_label': 'vendidas',
    'menu.account': 'Mi cuenta',
    'menu.logout': 'Cerrar sesión',
    'menu.manage_account': 'Gestionar cuenta',
    'menu.view_profile': 'Ver perfil',
    'nav.admin': 'Administración',
    'nav.all_events': 'Todos los eventos',
    'nav.all_tickets': 'Todas las entradas',
    'nav.commissions': 'Comisiones',
    'nav.config': 'Configuración',
    'nav.create_event': 'Crear un evento',
    'nav.dashboard': 'Panel',
    'nav.dashboard_admin': 'Panel de administración',
    'nav.group_admin': 'Admin',
    'nav.group_finance': 'Finanzas',
    'nav.group_main': 'Principal',
    'nav.group_tools': 'Herramientas',
    'nav.my_events': 'Mis eventos',
    'nav.organizer_view': 'Vista organizador',
    'nav.organizers': 'Organizadores',
    'nav.payouts': 'Pagos',
    'nav.platform_revenue': 'Ingresos de la plataforma',
    'nav.scanner': 'Escáner QR',
    'nav.settings': 'Ajustes',
    'nav.support': 'Soporte al cliente',
    'nav.tickets_sold': 'Entradas vendidas',
    'nav.transactions': 'Transacciones',
    'nav.wallet': 'Billetera',
    'scanner.access_denied': 'ACCESO DENEGADO',
    'scanner.active_event': 'Evento activo',
    'scanner.already_scanned': 'Esta entrada ya fue escaneada — entrada denegada',
    'scanner.already_used': 'YA UTILIZADA',
    'scanner.camera_access_error': 'No se pudo acceder a la cámara',
    'scanner.camera_active_waiting': 'Cámara activa — Esperando código QR...',
    'scanner.camera_disabled': 'Cámara desactivada',
    'scanner.camera_inactive': 'Cámara inactiva',
    'scanner.check': 'Verificar',
    'scanner.click_start': 'Haz clic en "Iniciar" para activar',
    'scanner.entry_authorized': 'ENTRADA AUTORIZADA',
    'scanner.holder': 'Titular',
    'scanner.invalid_code': 'Código no válido',
    'scanner.invalid_ticket': 'ENTRADA NO VÁLIDA',
    'scanner.no_event': 'Sin eventos',
    'scanner.not_recognized': 'No reconocido',
    'scanner.or_manual': 'O introduce el código manualmente',
    'scanner.other_organizer_ticket': 'Esta entrada pertenece a otro organizador',
    'scanner.paste_code': 'Pega el código QR aquí',
    'scanner.qr_not_recognized': 'Este código QR no es reconocido — entrada denegada',
    'scanner.ready': 'Listo para escanear',
    'scanner.scan_time': 'Hora de escaneo',
    'scanner.scanned_code': 'Código escaneado',
    'scanner.scanned_on': 'Escaneado el',
    'scanner.scans_tonight': 'escaneos esta noche',
    'scanner.start_camera': 'Iniciar cámara',
    'scanner.stop': 'Detener',
    'scanner.ticket_no': 'N.º de entrada',
    'scanner.title': 'Escáner de entradas',
    'scanner.valid_first_use': 'Entrada válida — primer uso',
    'settings.accent_hint': 'El diseño de la plataforma (botones, enlaces activos, insignias…) se adapta automáticamente al color elegido.',
    'settings.accent_label': 'Color de acento',
    'settings.lang_label': 'Idioma de la interfaz',
    'settings.save': 'Guardar',
    'settings.tab_appearance': 'Apariencia',
    'settings.tab_danger': 'Zona de peligro',
    'settings.tab_mobile': 'Mobile Money',
    'settings.tab_notifs': 'Notificaciones',
    'settings.tab_plan': 'Mi suscripción',
    'settings.tab_profile': 'Mi perfil',
    'settings.tab_security': 'Seguridad',
    'settings.theme_auto': 'Auto',
    'settings.theme_dark': 'Oscuro',
    'settings.theme_label': 'Tema de la interfaz',
    'settings.theme_light': 'Claro',
    'settings.tz_label': 'Zona horaria',
    'status.active': 'Activo',
    'status.cancelled': 'Cancelado',
    'status.confirmed': 'Confirmado',
    'status.draft': 'Borrador',
    'status.ended': 'Finalizado',
    'status.failed': 'Fallido',
    'status.inactive': 'Desactivado',
    'status.paid': 'Exitoso',
    'status.pending': 'Pendiente',
    'status.published': 'A la venta',
    'status.suspended': 'Suspendido',
    'status.used': 'Escaneado',
    'status.valid': 'Válido',
    'tickets.all_events': 'Todos los eventos',
    'tickets.col_buyer': 'Comprador',
    'tickets.col_category': 'Categoría',
    'tickets.col_number': 'N.º de entrada',
    'tickets.none_found': 'No se encontraron entradas',
    'tickets.search_placeholder': 'Buscar (nombre, N.º...)',
    'tickets.title': 'Todas las entradas',
    'topbar.admin': 'Administración Fest&Chill',
    'topbar.create_event': 'Crear un evento',
    'topbar.dashboard': 'Panel',
    'topbar.event_detail': 'Gestión del evento',
    'topbar.my_events': 'Mis eventos',
    'topbar.scanner': 'Escáner de código QR',
    'topbar.settings': 'Ajustes',
    'topbar.tickets_sold': 'Entradas vendidas',
    'topbar.transactions': 'Transacciones',
    'topbar.wallet': 'Billetera',
    'transactions.col_detail': 'Detalle',
    'transactions.col_type': 'Tipo',
    'transactions.filter_all': 'Todo',
    'transactions.filter_sales': 'Ventas',
    'transactions.filter_withdrawals': 'Retiros',
    'transactions.history_title': 'Historial completo',
    'transactions.none_found': 'Sin transacciones',
    'transactions.none_yet': 'Aún no hay transacciones',
    'transactions.requests_suffix': 'solicitudes',
    'transactions.stat_commission': 'Comisión de la plataforma',
    'transactions.stat_gross': 'Total cobrado',
    'transactions.stat_withdrawn': 'Total retirado',
    'transactions.type_sale': 'Venta',
    'transactions.type_withdrawal': 'Retiro a',
    'transactions.withdrawn_suffix': 'deducido',
    'wallet.activate': 'Activar',
    'wallet.add_number': '+ Añadir un número',
    'wallet.add_number_first': 'Primero añade un número de Mobile Money activo',
    'wallet.add_number_sub': 'Este número podrá recibir tus retiros una vez activado.',
    'wallet.add_number_title': 'Añadir un número',
    'wallet.add_one': 'Añade uno',
    'wallet.all_transactions': 'Todas las transacciones',
    'wallet.amount_to_withdraw': 'Monto a retirar (FCFA)',
    'wallet.arrival_hint': 'El dinero llega a tu Mobile Money en 5 a 10 minutos.',
    'wallet.before_withdrawing': 'antes de retirar.',
    'wallet.commission_charged': 'Comisión cobrada',
    'wallet.deactivate': 'Desactivar',
    'wallet.export_done': '¡Exportación CSV descargada!',
    'wallet.insufficient_balance': 'Saldo insuficiente',
    'wallet.invalid_number': 'Número no válido',
    'wallet.keep_one_active': 'Debes mantener al menos un número activo',
    'wallet.min_amount': 'Monto mínimo: 1.000 FCFA',
    'wallet.mm_number_label': 'Número de Mobile Money',
    'wallet.mobile_money_title': 'Mi Mobile Money',
    'wallet.next_withdraw_min': 'Próximo retiro mín.',
    'wallet.no_active_number': 'No tienes ningún número activo.',
    'wallet.no_high_minimum': 'Sin mínimo elevado',
    'wallet.no_numbers': 'Aún no hay números — añade tu número de Mobile Money para poder retirar tus ganancias.',
    'wallet.no_withdrawals': 'Aún no hay retiros',
    'wallet.number_activated': 'Número activado',
    'wallet.number_added': '¡Número añadido!',
    'wallet.number_deactivated': 'Número desactivado',
    'wallet.numbers_hint': 'Tus números vinculados reciben tus pagos automáticamente, sin demora.',
    'wallet.operator_label': 'Operador',
    'wallet.payment_received': 'Pago recibido',
    'wallet.primary': 'Principal (cuenta)',
    'wallet.ready_withdraw': 'Listo para retirar',
    'wallet.receiving_number': 'Número de recepción',
    'wallet.revenue_30d': 'Ingresos de los últimos 30 días',
    'wallet.sales_today': 'Ventas de hoy',
    'wallet.secondary': 'Secundario',
    'wallet.this_week': 'Esta semana',
    'wallet.ticket_sale': 'Venta de entrada',
    'wallet.total_earned': 'Total ganado (neto, histórico)',
    'wallet.withdraw_money': 'Retirar dinero',
    'wallet.withdraw_now': 'Retirar ahora',
    'wallet.withdrawal_history': 'Historial de retiros',
    'wallet.withdrawal_sent': '¡Solicitud de retiro enviada!',
  },
  ar: {
    'settings.account_security': 'أمان الحساب',
    'settings.account_suspended': 'تم إيقاف الحساب.',
    'settings.active_f': 'نشطة',
    'settings.active_sessions': 'الجلسات النشطة',
    'settings.all_sessions_disconnected': 'تم قطع اتصال جميع الجلسات الأخرى!',
    'settings.before_deleting': 'قبل حذف حسابك',
    'settings.before_deleting_text': 'تأكد من سحب جميع أموالك المتاحة. ستبقى التذاكر المباعة صالحة حتى تاريخ الفعالية. لا يمكن استرجاع البيانات بعد الحذف.',
    'settings.bio': 'نبذة / وصف',
    'settings.bio_placeholder': 'صف نفسك بكلمات قليلة...',
    'settings.block': 'حظر',
    'settings.by_email': 'عبر البريد الإلكتروني',
    'settings.by_sms': 'عبر الرسائل النصية',
    'settings.change': 'تغيير',
    'settings.city': 'المدينة',
    'settings.city_bio_hint': 'ستتوفر المدينة والنبذة قريبًا في الصفحات العامة — حاليًا يتم حفظ الاسم والهاتف فقط.',
    'settings.city_placeholder': 'مثال: كوتونو، بنين',
    'settings.color_applied': 'تم تطبيق اللون!',
    'settings.coming_soon_notify': 'قريبًا! سنُعلمك.',
    'settings.confirm_delete': 'هل أنت متأكد من رغبتك في حذف حسابك نهائيًا؟ هذا الإجراء لا رجعة فيه.',
    'settings.confirm_suspend': 'هل تريد إيقاف حسابك مؤقتًا؟ يمكنك إعادة تفعيله بتسجيل الدخول مرة أخرى.',
    'settings.current_f': 'الحالية',
    'settings.current_plan': 'الخطة الحالية',
    'settings.current_session': 'كوتونو، بنين · الجلسة الحالية · منذ دقيقتين',
    'settings.delete': 'حذف',
    'settings.delete_account': 'حذف حسابي نهائيًا',
    'settings.delete_account_sub': 'هذا الإجراء لا رجعة فيه. أرسل طلبًا إلى الدعم للتأكيد.',
    'settings.delete_request_sent': 'تم إرسال الطلب إلى الدعم للتأكيد.',
    'settings.disconnect': 'قطع الاتصال',
    'settings.disconnect_all': 'قطع اتصال جميع الجلسات الأخرى',
    'settings.email': 'البريد الإلكتروني',
    'settings.email_verified': 'البريد الإلكتروني موثّق',
    'settings.enabled': 'مفعّلة',
    'settings.export_data': 'تصدير بياناتي',
    'settings.export_data_sub': 'تنزيل جميع بياناتك (الفعاليات، التذاكر، المعاملات) بصيغة CSV',
    'settings.export_in_progress': 'التصدير جارٍ... ستتلقى بريدًا إلكترونيًا',
    'settings.firefox_unknown': 'Firefox · غير معروف',
    'settings.free_account': 'حساب مجاني',
    'settings.full_name': '* الاسم الكامل',
    'settings.id_document': 'وثيقة الهوية',
    'settings.id_not_verified': 'غير موثّقة — مطلوبة للسحوبات الكبيرة',
    'settings.important': 'مهم',
    'settings.in_app': 'داخل التطبيق',
    'settings.manage_in_wallet': 'إدارتها من المحفظة',
    'settings.mm_headline': 'أرباحك، دون عوائق',
    'settings.mm_headline_sub': 'أضف رقمًا واحدًا أو أكثر للدفع عبر الهاتف — تصل سحوباتك إليه خلال دقائق.',
    'settings.mm_important_text': 'تأكد من أن أرقام الدفع عبر الهاتف نشطة ومطابقة لاسمك. تُرسل السحوبات مباشرة إلى هذه الأرقام.',
    'settings.mm_used_for': 'تُستخدم لاستلام سحوباتك.',
    'settings.name_required': 'الاسم مطلوب',
    'settings.notif_daily_sub': 'ملخص مبيعاتك يُرسل كل مساء الساعة 8',
    'settings.notif_daily_title': 'تقرير المبيعات اليومي',
    'settings.notif_failed_sub': 'رسالة نصية عند وجود مشكلة دفع لدى المشتري',
    'settings.notif_failed_title': 'فشل الدفع',
    'settings.notif_headline': 'ابقَ على اطلاع دون أن تُغرق بالإشعارات',
    'settings.notif_headline_sub': 'اختر بدقة ما يستحق رسالة نصية أو بريدًا إلكترونيًا أو مجرد إشعار فوري.',
    'settings.notif_inapp_sub': 'إشعارات فورية في لوحة التحكم',
    'settings.notif_inapp_title': 'جميع الإشعارات داخل التطبيق',
    'settings.notif_news_sub': 'تحديثات منصة Fest&Chill',
    'settings.notif_news_title': 'الأخبار والميزات الجديدة',
    'settings.notif_prefs_sub': 'اختر كيف ومتى تريد أن يتم إشعارك.',
    'settings.notif_prefs_title': 'تفضيلات الإشعارات',
    'settings.notif_sale_sub': 'استلام رسالة نصية عند بيع كل تذكرة',
    'settings.notif_sale_title': 'بيع تذكرة',
    'settings.notif_saved': 'تم حفظ تفضيلات الإشعارات!',
    'settings.notif_security_sub': 'تسجيل دخول من جهاز جديد، محاولات مشبوهة',
    'settings.notif_security_title': 'تنبيهات الأمان',
    'settings.notif_sound_sub': 'تشغيل صوت عند كل عملية بيع جديدة',
    'settings.notif_sound_title': 'صوت الإشعار',
    'settings.notif_weekly_sub': 'ملخص الأسبوع كل يوم اثنين صباحًا',
    'settings.notif_weekly_title': 'التقرير الأسبوعي',
    'settings.notif_withdraw_sub': 'رسالة نصية عند إرسال أموالك إلى الدفع عبر الهاتف',
    'settings.notif_withdraw_title': 'تأكيد السحب',
    'settings.password': 'كلمة المرور',
    'settings.password_last_changed': 'آخر تعديل منذ 3 أشهر',
    'settings.phone': '* الهاتف',
    'settings.plan_f1': 'إنشاء حساب مجاني',
    'settings.plan_f2': 'فعاليات غير محدودة (برسوم لكل نشر)',
    'settings.plan_f3': 'تذاكر مرقّمة برموز QR',
    'settings.plan_f4': 'الدفع عبر MTN Mobile Money',
    'settings.plan_f5': 'لوحة تحكم أساسية',
    'settings.plan_f6': 'ماسح QR مدمج',
    'settings.premium_f1': 'إحصائيات متقدمة',
    'settings.premium_f2': 'رسوم بيانية مفصلة',
    'settings.premium_f3': 'ملصق بالذكاء الاصطناعي غير محدود',
    'settings.premium_f4': 'عمولة مخفّضة',
    'settings.premium_f5': 'دعم ذو أولوية',
    'settings.premium_f6': 'تقارير PDF تلقائية',
    'settings.premium_f7': 'منظمون متعددون',
    'settings.premium_f8': 'الوصول إلى واجهة برمجة التطبيقات',
    'settings.profile_info': 'معلومات الملف الشخصي',
    'settings.profile_info_sub': 'تظهر هذه المعلومات في فعالياتك.',
    'settings.profile_updated': 'تم تحديث الملف الشخصي بنجاح!',
    'settings.protect_account': 'احمِ حسابك وبياناتك.',
    'settings.reset_email_sent': 'تم إرسال بريد إعادة التعيين!',
    'settings.save_profile': 'حفظ الملف الشخصي',
    'settings.sec_headline': 'حسابك محمي جيدًا',
    'settings.sec_headline_sub': 'كلمة المرور، المصادقة الثنائية، والجلسات النشطة — كلها في مكان واحد.',
    'settings.session_2': 'كوتونو، بنين · منذ 3 ساعات',
    'settings.session_3': 'لاغوس، نيجيريا · منذ يومين — مشبوهة؟',
    'settings.session_blocked': 'تم حظر الجلسة المشبوهة!',
    'settings.session_disconnected': 'تم قطع الجلسة!',
    'settings.sms_to': 'رسالة نصية إلى',
    'settings.suspend_account': 'إيقاف حسابي',
    'settings.suspend_account_sub': 'تعطيل حسابك مؤقتًا. يمكنك إعادة تفعيله في أي وقت.',
    'settings.tbd': 'سيُحدد لاحقًا',
    'settings.two_fa': 'المصادقة الثنائية (2FA)',
    'settings.unlock_features': 'افتح جميع الميزات المتقدمة',
    'settings.upgrade_cta': 'الترقية إلى المميز — قريبًا',
    'settings.upgrade_premium': 'الترقية إلى الخطة المميزة',
    'settings.using_free_version': 'أنت تستخدم النسخة المجانية من Fest&Chill.',
    'settings.verif_form_opened': 'تم فتح نموذج التوثيق',
    'settings.lang_switched': 'تم تغيير الواجهة إلى',
    'settings.appearance_saved': 'تم حفظ تفضيلات المظهر!',
    'admin.account_blocked': 'تم حظر الحساب!',
    'admin.account_reactivated': 'تمت إعادة تفعيل الحساب!',
    'admin.account_verified': 'تم توثيق الحساب!',
    'admin.active_events': 'الفعاليات النشطة',
    'admin.commission': 'العمولة',
    'admin.commission_cumulated': 'العمولة التراكمية',
    'admin.commissions_cumulated': 'العمولات التراكمية',
    'admin.config_saved': 'تم حفظ الإعدادات!',
    'admin.confirmed_withdrawals': 'سحوبات مؤكدة',
    'admin.currently_selling': 'معروضة للبيع حاليًا',
    'admin.default_organizer': 'منظم',
    'admin.event_republished': 'تمت إعادة نشر الفعالية',
    'admin.event_singular': 'فعالية',
    'admin.event_suspended': 'تم إيقاف الفعالية',
    'admin.events_plural': 'فعاليات',
    'admin.export_csv_ready': 'ملف CSV جاهز',
    'admin.export_full_ready': 'التصدير الكامل جاهز',
    'admin.gross_revenue': 'الإيرادات الإجمالية',
    'admin.last_update': 'آخر تحديث',
    'admin.new_unverified_organizer': 'منظم جديد غير موثّق',
    'admin.no_name': 'بدون اسم',
    'admin.no_orders_yet': 'لا توجد طلبات حتى الآن',
    'admin.no_organizers_yet': 'لا يوجد منظمون حتى الآن',
    'admin.not_verified': 'غير موثّق',
    'admin.operator': 'المشغل',
    'admin.organizer': 'المنظم',
    'admin.paid_orders': 'طلبات مدفوعة',
    'admin.pending_verification': 'بانتظار التوثيق',
    'admin.pending_withdrawal': 'سحب قيد الانتظار',
    'admin.platform_config': 'إعدادات المنصة',
    'admin.rate_label': 'المعدل',
    'admin.reactivate': 'إعادة التفعيل',
    'admin.recent_organizers': 'المنظمون الجدد',
    'admin.recent_transactions': 'المعاملات الأخيرة',
    'admin.registered_on': 'مسجل في',
    'admin.republish': 'إعادة النشر',
    'admin.revenue': 'الإيرادات',
    'admin.revenue_30d': 'إيرادات المنصة (30 يومًا)',
    'admin.see_all': 'عرض الكل',
    'admin.stat_events': 'الفعاليات الجارية',
    'admin.stat_organizers': 'المنظمون النشطون',
    'admin.stat_revenue': 'إيرادات المنصة',
    'admin.suspend': 'إيقاف',
    'admin.tickets': 'التذاكر',
    'admin.title': 'مسؤول',
    'admin.top_organizers': 'أفضل المنظمين',
    'admin.total_paid_out': 'إجمالي المدفوع للمنظمين',
    'admin.total_registered': 'إجمالي المسجلين',
    'admin.verified': 'موثّق',
    'admin.verify': 'توثيق',
    'admin.withdrawal_request_of': 'طلب سحب بقيمة',
    'common.add_short': '+ إضافة',
    'common.amount': 'المبلغ',
    'common.cancel': 'إلغاء',
    'common.copy': 'نسخ',
    'common.create_event_btn': '+ إنشاء فعالية',
    'common.date': 'التاريخ',
    'common.error_prefix': 'خطأ:',
    'common.event': 'الفعالية',
    'common.export': 'تصدير',
    'common.loading': 'جارٍ التحميل…',
    'common.retry': 'إعادة المحاولة',
    'common.search': 'بحث...',
    'common.status': 'الحالة',
    'common.ticket': 'تذكرة',
    'common.view_all': 'عرض الكل',
    'common.withdrawal': 'سحب',
    'create.cat_name': 'الاسم',
    'create.cat_price': 'السعر (فرنك أفريقي)',
    'create.cat_quota': 'الحصة',
    'create.categories_sub': 'أضف فئة واحدة على الأقل (مثال: عادية، VIP، VVIP)',
    'create.categories_title': 'فئات التذاكر',
    'create.date_label': '* التاريخ',
    'create.description_label': 'الوصف',
    'create.description_placeholder': 'صف فعاليتك...',
    'create.error_category': 'أضف فئة تذكرة واحدة صالحة على الأقل (اسم + حصة).',
    'create.error_created_but_categories': 'تم إنشاء الفعالية لكن حدث خطأ في الفئات:',
    'create.error_required': 'العنوان والتاريخ والمكان مطلوبة.',
    'create.event_info': 'معلومات الفعالية',
    'create.event_info_sub': 'ستكون هذه المعلومات مرئية في صفحة البيع العامة الخاصة بك.',
    'create.location_label': '* المكان',
    'create.location_placeholder': 'مثال: قصر المؤتمرات، كوتونو',
    'create.publish': 'نشر الفعالية',
    'create.publishing': 'جارٍ النشر...',
    'create.save_draft': 'حفظ كمسودة',
    'create.time_label': 'الوقت',
    'create.title_label': '* عنوان الفعالية',
    'create.title_placeholder': 'مثال: حفلة أفروبيت كوتونو',
    'create.type_concert': '🎵 حفلة / موسيقى',
    'create.type_conference': '🎤 مؤتمر',
    'create.type_label': 'نوع الفعالية',
    'create.type_other': '✨ أخرى',
    'create.type_party': '🎉 حفلة / نادي',
    'create.type_sport': '⚽ رياضة',
    'create.type_theatre': '🎭 مسرح / فن',
    'dashboard.all_categories': 'جميع الفئات',
    'dashboard.all_categories_cap': 'جميع الفئات',
    'dashboard.create_first': 'إنشاء فعاليتي الأولى',
    'dashboard.greeting_hi': 'مرحبًا',
    'dashboard.greeting_you': 'بك',
    'dashboard.no_events': 'لا توجد فعاليات حتى الآن.',
    'dashboard.no_sales': 'لا توجد مبيعات حتى الآن',
    'dashboard.recent_events': '📅 فعالياتي الأخيرة',
    'dashboard.recent_sales': '💳 آخر المبيعات',
    'dashboard.stat_balance': 'الرصيد المتاح',
    'dashboard.stat_events': 'الفعاليات',
    'dashboard.stat_revenue': 'الإيرادات (صافي)',
    'dashboard.stat_revenue_sub': 'بعد العمولة',
    'dashboard.subtitle': 'إليك نظرة عامة على نشاطك في Fest&Chill.',
    'dashboard.upcoming_suffix': 'قادمة',
    'dashboard.withdraw_link': 'سحب ←',
    'event_detail.after_commission': 'بعد عمولة Fest&Chill',
    'event_detail.ago': 'منذ',
    'event_detail.available': 'متاحة',
    'event_detail.available_revenue': 'الإيرادات المتاحة',
    'event_detail.copy_failed': 'تعذّر النسخ التلقائي — تم تحديد الرابط، انسخه باستخدام Ctrl/Cmd+C',
    'event_detail.copy_link_btn': 'نسخ الرابط',
    'event_detail.copy_link_btn2': 'نسخ الرابط',
    'event_detail.download': 'تنزيل',
    'event_detail.generating': 'جارٍ الإنشاء…',
    'event_detail.go_to_wallet': 'انتقل إلى المحفظة للسحب',
    'event_detail.just_now': 'الآن',
    'event_detail.link_copied': 'تم نسخ الرابط إلى الحافظة!',
    'event_detail.link_not_ready': 'الرابط غير جاهز بعد، حاول مرة أخرى بعد قليل',
    'event_detail.no_activity_yet': 'لا يوجد نشاط حتى الآن — ستظهر المبيعات هنا بمجرد أن يشتري أحد المعجبين تذكرة.',
    'event_detail.no_tickets_yet': 'لم يتم بيع أي تذاكر حتى الآن',
    'event_detail.out_of': 'من أصل',
    'event_detail.payment_failed': 'فشل الدفع',
    'event_detail.payment_pending': 'الدفع قيد الانتظار',
    'event_detail.print': 'طباعة',
    'event_detail.qr_gen_failed': 'فشل الإنشاء.',
    'event_detail.qr_not_ready': 'رمز QR غير جاهز بعد',
    'event_detail.qr_printed': 'تمت طباعة رمز QR!',
    'event_detail.qr_unavailable': 'رمز QR غير متاح (اتصال).',
    'event_detail.recent_activity': 'النشاط الأخير',
    'event_detail.sales_progress': 'تقدم المبيعات',
    'event_detail.scan_at_entry': 'المسح عند الدخول',
    'event_detail.share_event': 'مشاركة الفعالية',
    'event_detail.share_hint': 'شارك هذا الرابط حتى يتمكن الأشخاص من شراء تذاكرهم.',
    'event_detail.sold': 'تم بيعها',
    'event_detail.sold_pct': 'مباع',
    'events.filter_all': 'الكل',
    'events.filter_draft': 'المسودات',
    'events.filter_ended': 'المنتهية',
    'events.filter_suspended': 'الموقوفة',
    'events.no_events_category': 'لا توجد فعاليات في هذه الفئة.',
    'events.sold_label': 'مباعة',
    'menu.account': 'حسابي',
    'menu.logout': 'تسجيل الخروج',
    'menu.manage_account': 'إدارة الحساب',
    'menu.view_profile': 'عرض الملف الشخصي',
    'nav.admin': 'الإدارة',
    'nav.all_events': 'جميع الفعاليات',
    'nav.all_tickets': 'جميع التذاكر',
    'nav.commissions': 'العمولات',
    'nav.config': 'الإعدادات العامة',
    'nav.create_event': 'إنشاء فعالية',
    'nav.dashboard': 'لوحة التحكم',
    'nav.dashboard_admin': 'لوحة تحكم الإدارة',
    'nav.group_admin': 'الإدارة',
    'nav.group_finance': 'المالية',
    'nav.group_main': 'الرئيسية',
    'nav.group_tools': 'الأدوات',
    'nav.my_events': 'فعالياتي',
    'nav.organizer_view': 'عرض المنظم',
    'nav.organizers': 'المنظمون',
    'nav.payouts': 'المدفوعات',
    'nav.platform_revenue': 'إيرادات المنصة',
    'nav.scanner': 'ماسح QR',
    'nav.settings': 'الإعدادات',
    'nav.support': 'دعم العملاء',
    'nav.tickets_sold': 'التذاكر المباعة',
    'nav.transactions': 'المعاملات',
    'nav.wallet': 'المحفظة',
    'scanner.access_denied': 'تم رفض الدخول',
    'scanner.active_event': 'الفعالية النشطة',
    'scanner.already_scanned': 'تم مسح هذه التذكرة مسبقًا — تم رفض الدخول',
    'scanner.already_used': 'تم استخدامها بالفعل',
    'scanner.camera_access_error': 'تعذّر الوصول إلى الكاميرا',
    'scanner.camera_active_waiting': 'الكاميرا نشطة — بانتظار رمز QR...',
    'scanner.camera_disabled': 'الكاميرا معطّلة',
    'scanner.camera_inactive': 'الكاميرا غير نشطة',
    'scanner.check': 'تحقق',
    'scanner.click_start': 'انقر على "بدء" للتفعيل',
    'scanner.entry_authorized': 'الدخول مصرّح به',
    'scanner.holder': 'الحامل',
    'scanner.invalid_code': 'رمز غير صالح',
    'scanner.invalid_ticket': 'تذكرة غير صالحة',
    'scanner.no_event': 'لا توجد فعالية',
    'scanner.not_recognized': 'غير معروف',
    'scanner.or_manual': 'أو أدخل الرمز يدويًا',
    'scanner.other_organizer_ticket': 'هذه التذكرة تعود لمنظم آخر',
    'scanner.paste_code': 'الصق رمز QR هنا',
    'scanner.qr_not_recognized': 'رمز QR هذا غير معروف — تم رفض الدخول',
    'scanner.ready': 'جاهز للمسح',
    'scanner.scan_time': 'وقت المسح',
    'scanner.scanned_code': 'الرمز الممسوح',
    'scanner.scanned_on': 'تم المسح في',
    'scanner.scans_tonight': 'عمليات مسح الليلة',
    'scanner.start_camera': 'تشغيل الكاميرا',
    'scanner.stop': 'إيقاف',
    'scanner.ticket_no': 'رقم التذكرة',
    'scanner.title': 'ماسح التذاكر',
    'scanner.valid_first_use': 'تذكرة صالحة — أول استخدام',
    'settings.accent_hint': 'يتكيف تصميم المنصة (الأزرار، الروابط النشطة، الشارات...) تلقائيًا مع اللون الذي تختاره.',
    'settings.accent_label': 'لون التمييز',
    'settings.lang_label': 'لغة الواجهة',
    'settings.save': 'حفظ',
    'settings.tab_appearance': 'المظهر',
    'settings.tab_danger': 'منطقة الخطر',
    'settings.tab_mobile': 'الدفع عبر الهاتف',
    'settings.tab_notifs': 'الإشعارات',
    'settings.tab_plan': 'اشتراكي',
    'settings.tab_profile': 'ملفي الشخصي',
    'settings.tab_security': 'الأمان',
    'settings.theme_auto': 'تلقائي',
    'settings.theme_dark': 'داكن',
    'settings.theme_label': 'مظهر الواجهة',
    'settings.theme_light': 'فاتح',
    'settings.tz_label': 'المنطقة الزمنية',
    'status.active': 'نشط',
    'status.cancelled': 'ملغى',
    'status.confirmed': 'مؤكد',
    'status.draft': 'مسودة',
    'status.ended': 'منتهٍ',
    'status.failed': 'فشل',
    'status.inactive': 'معطّل',
    'status.paid': 'ناجح',
    'status.pending': 'قيد الانتظار',
    'status.published': 'معروض للبيع',
    'status.suspended': 'موقوف',
    'status.used': 'تم مسحه',
    'status.valid': 'صالح',
    'tickets.all_events': 'جميع الفعاليات',
    'tickets.col_buyer': 'المشتري',
    'tickets.col_category': 'الفئة',
    'tickets.col_number': 'رقم التذكرة',
    'tickets.none_found': 'لم يتم العثور على تذاكر',
    'tickets.search_placeholder': 'بحث (الاسم، الرقم...)',
    'tickets.title': 'جميع التذاكر',
    'topbar.admin': 'إدارة Fest&Chill',
    'topbar.create_event': 'إنشاء فعالية',
    'topbar.dashboard': 'لوحة التحكم',
    'topbar.event_detail': 'إدارة الفعالية',
    'topbar.my_events': 'فعالياتي',
    'topbar.scanner': 'ماسح رمز QR',
    'topbar.settings': 'الإعدادات',
    'topbar.tickets_sold': 'التذاكر المباعة',
    'topbar.transactions': 'المعاملات',
    'topbar.wallet': 'المحفظة',
    'transactions.col_detail': 'التفاصيل',
    'transactions.col_type': 'النوع',
    'transactions.filter_all': 'الكل',
    'transactions.filter_sales': 'المبيعات',
    'transactions.filter_withdrawals': 'السحوبات',
    'transactions.history_title': 'السجل الكامل',
    'transactions.none_found': 'لا توجد معاملات',
    'transactions.none_yet': 'لا توجد معاملات حتى الآن',
    'transactions.requests_suffix': 'طلبات',
    'transactions.stat_commission': 'عمولة المنصة',
    'transactions.stat_gross': 'إجمالي المحصّل',
    'transactions.stat_withdrawn': 'إجمالي المسحوب',
    'transactions.type_sale': 'بيع',
    'transactions.type_withdrawal': 'سحب إلى',
    'transactions.withdrawn_suffix': 'مقتطع',
    'wallet.activate': 'تفعيل',
    'wallet.add_number': '+ إضافة رقم',
    'wallet.add_number_first': 'أضف أولاً رقم دفع عبر الهاتف نشطًا',
    'wallet.add_number_sub': 'سيتمكن هذا الرقم من استقبال سحوباتك بمجرد تفعيله.',
    'wallet.add_number_title': 'إضافة رقم',
    'wallet.add_one': 'أضف واحدًا',
    'wallet.all_transactions': 'جميع المعاملات',
    'wallet.amount_to_withdraw': 'المبلغ المراد سحبه (فرنك أفريقي)',
    'wallet.arrival_hint': 'تصل الأموال إلى حسابك في الدفع عبر الهاتف خلال 5 إلى 10 دقائق.',
    'wallet.before_withdrawing': 'قبل السحب.',
    'wallet.commission_charged': 'العمولة المقتطعة',
    'wallet.deactivate': 'تعطيل',
    'wallet.export_done': 'تم تنزيل ملف CSV!',
    'wallet.insufficient_balance': 'الرصيد غير كافٍ',
    'wallet.invalid_number': 'رقم غير صالح',
    'wallet.keep_one_active': 'يجب الاحتفاظ برقم واحد نشط على الأقل',
    'wallet.min_amount': 'الحد الأدنى للمبلغ: 1000 فرنك أفريقي',
    'wallet.mm_number_label': 'رقم الدفع عبر الهاتف',
    'wallet.mobile_money_title': 'حسابي في الدفع عبر الهاتف',
    'wallet.next_withdraw_min': 'الحد الأدنى للسحب القادم',
    'wallet.no_active_number': 'ليس لديك أي رقم نشط.',
    'wallet.no_high_minimum': 'لا حد أدنى مرتفع',
    'wallet.no_numbers': 'لا توجد أرقام حتى الآن — أضف رقم الدفع عبر الهاتف الخاص بك لتتمكن من سحب أرباحك.',
    'wallet.no_withdrawals': 'لا توجد سحوبات حتى الآن',
    'wallet.number_activated': 'تم تفعيل الرقم',
    'wallet.number_added': 'تمت إضافة الرقم!',
    'wallet.number_deactivated': 'تم تعطيل الرقم',
    'wallet.numbers_hint': 'أرقامك المرتبطة تستقبل مدفوعاتك تلقائيًا وبدون تأخير.',
    'wallet.operator_label': 'المشغل',
    'wallet.payment_received': 'تم استلام الدفع',
    'wallet.primary': 'أساسي (الحساب)',
    'wallet.ready_withdraw': 'جاهز للسحب',
    'wallet.receiving_number': 'رقم الاستلام',
    'wallet.revenue_30d': 'الإيرادات لآخر 30 يومًا',
    'wallet.sales_today': 'مبيعات اليوم',
    'wallet.secondary': 'ثانوي',
    'wallet.this_week': 'هذا الأسبوع',
    'wallet.ticket_sale': 'بيع تذكرة',
    'wallet.total_earned': 'إجمالي المكتسب (صافٍ، منذ البداية)',
    'wallet.withdraw_money': 'سحب الأموال',
    'wallet.withdraw_now': 'اسحب الآن',
    'wallet.withdrawal_history': 'سجل السحوبات',
    'wallet.withdrawal_sent': 'تم إرسال طلب السحب!',
  }
};

function fcGetLang() {
  return localStorage.getItem('fc-lang') || 'fr';
}

function fcT(key) {
  const lang = fcGetLang();
  return (FC_I18N[lang] && FC_I18N[lang][key]) || FC_I18N.fr[key] || key;
}

// Traduit tous les éléments [data-i18n] présents sur la page courante (chrome partagé :
// sidebar, topbar, menu du compte). Le contenu propre à l'utilisateur (titres d'événements,
// noms, montants...) n'est pas traduit automatiquement.
function fcApplyI18n() {
  const lang = fcGetLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = fcT(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', fcT(el.getAttribute('data-i18n-placeholder')));
  });
}

function fcSetLang(code, persist = true) {
  localStorage.setItem('fc-lang', code);
  fcApplyI18n();
  if (persist) fcSaveProfilePref({ language: code });
}

// ------------------------------------------------------------
// FUSEAU HORAIRE — mémorisé, appliqué au compte, et utilisé par
// les helpers fcFormatDate/fcFormatTime/fcFormatDateTime pour que
// toutes les dates affichées sur la plateforme respectent l'heure
// locale de l'utilisateur (et non celle du serveur/navigateur).
// ------------------------------------------------------------

function fcGetTimezone() {
  return localStorage.getItem('fc-tz') || 'Africa/Porto-Novo';
}

function fcSetTimezone(tz, persist = true) {
  localStorage.setItem('fc-tz', tz);
  if (persist) fcSaveProfilePref({ timezone: tz });
}

function fcFormatDate(date = new Date(), opts = {}) {
  const locale = fcGetLang() === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(date).toLocaleDateString(locale, { timeZone: fcGetTimezone(), ...opts });
}

function fcFormatTime(date = new Date(), opts = {}) {
  const locale = fcGetLang() === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(date).toLocaleTimeString(locale, { timeZone: fcGetTimezone(), ...opts });
}

function fcFormatDateTime(date = new Date(), opts = {}) {
  const locale = fcGetLang() === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(date).toLocaleString(locale, { timeZone: fcGetTimezone(), ...opts });
}

// ------------------------------------------------------------
// Sauvegarde une préférence sur le profil Supabase de l'utilisateur
// connecté, en tâche de fond (n'empêche jamais l'UI de réagir).
// ------------------------------------------------------------
async function fcSaveProfilePref(fields) {
  try {
    const session = await fcGetSession();
    if (!session) return;
    await supa.from('profiles').update(fields).eq('id', session.user.id);
  } catch (e) {
    console.error('Préférence non sauvegardée :', e);
  }
}

// À appeler une fois le profil chargé (dans boot()/fcRequireAuth) : synchronise
// les préférences du COMPTE (theme/accent_color/language/timezone) vers ce
// navigateur, puis les applique. Permet de retrouver ses préférences sur un
// nouvel appareil, tout en gardant une réaction instantanée localement.
function fcApplyProfilePrefs(profile) {
  if (!profile) return;
  if (profile.theme) fcSetTheme(profile.theme, false);
  if (profile.accent_color) fcSetAccent(profile.accent_color, false);
  if (profile.language) fcSetLang(profile.language, false);
  if (profile.timezone) fcSetTimezone(profile.timezone, false);
  fcApplyI18n();
}

// ------------------------------------------------------------
// NUMÉROS MOBILE MONEY (payout_methods) — utilisés pour recevoir
// les retraits. Un organisateur peut en enregistrer plusieurs,
// un seul est "principal" à la fois.
// ------------------------------------------------------------

async function fcListPayoutMethods() {
  const session = await fcGetSession();
  if (!session) return [];
  const { data, error } = await supa
    .from('payout_methods')
    .select('*')
    .eq('organizer_id', session.user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function fcAddPayoutMethod(operator, phone) {
  const session = await fcGetSession();
  if (!session) throw new Error('Non connecté');
  const existing = await fcListPayoutMethods();
  const { error } = await supa.from('payout_methods').insert({
    organizer_id: session.user.id,
    operator, phone,
    is_primary: existing.length === 0, // le tout premier devient principal automatiquement
  });
  if (error) throw error;
}

async function fcUpdatePayoutMethod(id, fields) {
  const { error } = await supa.from('payout_methods').update(fields).eq('id', id);
  if (error) throw error;
}

async function fcSetPrimaryPayoutMethod(id) {
  const session = await fcGetSession();
  if (!session) throw new Error('Non connecté');
  // On désactive d'abord tous les autres, puis on active celui choisi.
  const { error: e1 } = await supa.from('payout_methods').update({ is_primary: false }).eq('organizer_id', session.user.id);
  if (e1) throw e1;
  const { error: e2 } = await supa.from('payout_methods').update({ is_primary: true }).eq('id', id);
  if (e2) throw e2;
}

async function fcDeletePayoutMethod(id) {
  // Sécurité : un organisateur doit toujours garder au moins un numéro
  // Mobile Money enregistré (nécessaire pour recevoir ses retraits).
  const existing = await fcListPayoutMethods();
  if (existing.length <= 1) {
    throw new Error('Impossible de supprimer : il te faut au moins un numéro Mobile Money enregistré.');
  }
  const { error } = await supa.from('payout_methods').delete().eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------
// PHOTO DE PROFIL (avatar) — bucket public "avatars", voir
// schema-update-10.sql. Une image par utilisateur (upsert), donc
// re-uploader remplace simplement l'ancienne.
// ------------------------------------------------------------
async function fcUploadAvatar(file) {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${session.user.id}/avatar.${ext}`;

  const { error: upErr } = await supa.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (upErr) throw upErr;

  const { data: pub } = supa.storage.from('avatars').getPublicUrl(path);
  // Casse le cache navigateur/CDN à chaque nouvelle photo
  const url = pub.publicUrl + '?v=' + Date.now();

  const { error: updErr } = await supa.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
  if (updErr) throw updErr;

  return url;
}

// ------------------------------------------------------------
// CODE PIN DE RETRAIT — voir schema-update-9.sql. Le PIN n'est
// jamais stocké ni manipulé en clair : ces fonctions passent
// toujours par des RPC Postgres qui font le hachage côté serveur.
// ------------------------------------------------------------

// Est-ce que l'organisateur connecté a déjà activé un code PIN ?
async function fcHasWithdrawalPin() {
  const { data, error } = await supa.rpc('fc_has_withdrawal_pin');
  if (error) throw error;
  return !!data;
}

// Définir ou remplacer le code PIN (5 chiffres)
async function fcSetWithdrawalPin(pin) {
  const { error } = await supa.rpc('fc_set_withdrawal_pin', { p_pin: pin });
  if (error) throw error;
}

// Désactiver le code PIN (il faut le PIN actuel)
async function fcDisableWithdrawalPin(pin) {
  const { error } = await supa.rpc('fc_disable_withdrawal_pin', { p_pin: pin });
  if (error) throw error;
}

// ------------------------------------------------------------
// PAIEMENT RÉEL (FedaPay) — voir supabase/functions/fedapay-create-transaction
// et fedapay-webhook. Réutilise purchase_ticket() (déjà existant, crée la
// commande + le ticket en statut "pending") puis fait payer réellement
// via FedaPay au lieu d'attendre une confirmation manuelle.
// ------------------------------------------------------------

// Crée la transaction FedaPay pour une commande déjà réservée
// (order_id renvoyé par purchase_ticket) et renvoie l'URL de paiement
// vers laquelle rediriger l'acheteur.
async function fcCreateFedaPayTransaction(orderId, returnUrl) {
  const { data, error } = await supa.functions.invoke('fedapay-create-transaction', {
    body: { order_id: orderId, return_url: returnUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data; // { payment_url, token }
}

// Demande de retrait — vérifie le PIN côté serveur si activé, crée la
// demande, puis déclenche le vrai envoi d'argent via FedaPay.
async function fcRequestWithdrawal(amount, operator, phone, pin) {
  const { data: withdrawalId, error } = await supa.rpc('fc_request_withdrawal', {
    p_amount: amount, p_operator: operator, p_phone: phone, p_pin: pin || null,
  });
  if (error) throw error;

  const { data, error: payoutError } = await supa.functions.invoke('fedapay-payout', {
    body: { withdrawal_id: withdrawalId },
  });
  if (payoutError) throw payoutError;
  if (data?.error) throw new Error(data.error);
  return withdrawalId;
}

// Aperçu brut / commission / net avant de confirmer un retrait
// (commission plateforme prélevée au moment du retrait, voir
// schema : fonction fc_preview_withdrawal).
async function fcPreviewWithdrawal(amount) {
  const { data, error } = await supa.rpc('fc_preview_withdrawal', { p_amount: amount });
  if (error) throw error;
  return data[0]; // { gross, commission, net, rate }
}

// ------------------------------------------------------------
// COMPTE COMMISSION DE LA PLATEFORME (admin uniquement) — voir
// migration "withdrawal_commission_system".
// ------------------------------------------------------------
async function fcGetAdminCommissionBalance() {
  const { data, error } = await supa.rpc('fc_get_admin_commission_balance');
  if (error) throw error;
  return data;
}

async function fcRequestAdminWithdrawal(amount, operator, phone, pin) {
  const { data: withdrawalId, error } = await supa.rpc('fc_request_admin_withdrawal', {
    p_amount: amount, p_operator: operator, p_phone: phone, p_pin: pin || null,
  });
  if (error) throw error;

  const { data, error: payoutError } = await supa.functions.invoke('fedapay-payout', {
    body: { withdrawal_id: withdrawalId },
  });
  if (payoutError) throw payoutError;
  if (data?.error) throw new Error(data.error);
  return withdrawalId;
}

// ------------------------------------------------------------
// PRÉFÉRENCES DE NOTIFICATIONS — stockées sur profiles.notif_prefs (jsonb).
// ------------------------------------------------------------

const FC_NOTIF_DEFAULTS = {
  sms_sale: true, sms_withdraw: true, sms_failed: false,
  email_daily: true, email_weekly: true, email_security: true, email_news: false,
  inapp_all: true, inapp_sound: true,
};

async function fcGetNotifPrefs() {
  const session = await fcGetSession();
  if (!session) return { ...FC_NOTIF_DEFAULTS };
  const { data, error } = await supa.from('profiles').select('notif_prefs').eq('id', session.user.id).single();
  if (error || !data) return { ...FC_NOTIF_DEFAULTS };
  return { ...FC_NOTIF_DEFAULTS, ...(data.notif_prefs || {}) };
}

async function fcSaveNotifPrefs(prefs) {
  await fcSaveProfilePref({ notif_prefs: prefs });
}

// Remplit automatiquement la sidebar (#side-avatar / #side-name) et
// branche le petit menu compte (email / profil / déconnexion),
// sur toute page qui a fait fcRequireAuth().
async function fcMountSidebar(profile) {
  const nameEl = document.getElementById('side-name');
  const avatarEl = document.getElementById('side-avatar');
  if (nameEl) nameEl.textContent = profile.full_name || 'Organisateur';
  if (avatarEl) {
    avatarEl.textContent = (profile.full_name || '??').slice(0, 2).toUpperCase();
    if (profile.avatar_url) avatarEl.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  }

  // Le lien "Administration" (et son étiquette de groupe "Admin") est codé en dur dans
  // le HTML de chaque page, donc visible même par un simple organisateur — qui se
  // retrouve alors renvoyé sans explication vers le dashboard en cliquant dessus
  // (accès refusé, comme prévu, mais perçu comme un bug). On le masque ici pour
  // quiconque n'a pas le rôle admin, un seul endroit à corriger pour toutes les pages.
  if (profile.role !== 'admin') {
    const adminLink = document.querySelector('.sidebar-nav a[href="festchill-admin.html"], nav a[href="festchill-admin.html"]');
    if (adminLink) {
      const label = adminLink.previousElementSibling;
      if (label && label.classList.contains('nav-label')) label.remove();
      adminLink.remove();
    }
  }

  const footer = document.querySelector('.sidebar-footer');
  const pill = document.querySelector('.user-pill');
  if (!footer || !pill) return;

  // Nettoie un éventuel ancien handler direct (déconnexion immédiate au clic)
  pill.removeAttribute('onclick');
  pill.style.cursor = 'pointer';
  pill.title = fcT('menu.account');

  const session = await fcGetSession();
  const email = session?.user?.email || '';

  footer.style.position = 'relative';

  let menu = document.getElementById('fc-user-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'fc-user-menu';
    menu.style.cssText = `
      display:none;position:absolute;left:12px;right:12px;bottom:calc(100% + 6px);
      background:var(--deep);border:1px solid var(--border);border-radius:var(--r);
      box-shadow:0 12px 28px rgba(0,0,0,.35);overflow:hidden;z-index:60;
      font-family:var(--fb);
    `;
    menu.innerHTML = `
      <div id="fc-user-menu-email" style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:.76rem;color:var(--muted);word-break:break-all;"></div>
      <a href="festchill-settings.html?panel=securite" data-i18n="menu.manage_account" style="display:block;padding:10px 14px;font-size:.85rem;color:var(--white);text-decoration:none;">Gérer le compte</a>
      <a href="festchill-settings.html?panel=profil" data-i18n="menu.view_profile" style="display:block;padding:10px 14px;font-size:.85rem;color:var(--white);text-decoration:none;">Voir le profil</a>
      <button id="fc-user-menu-logout" data-i18n="menu.logout" style="display:block;width:100%;text-align:left;padding:10px 14px;font-size:.85rem;border:none;border-top:1px solid var(--border);background:none;cursor:pointer;color:var(--red);font-family:inherit;">Se déconnecter</button>
    `;
    footer.appendChild(menu);
    document.getElementById('fc-user-menu-logout').onclick = fcSignOut;
    document.addEventListener('click', (e) => {
      if (!footer.contains(e.target)) menu.style.display = 'none';
    });
  }

  document.getElementById('fc-user-menu-email').textContent = email;
  fcApplyI18n();

  pill.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
  };
}
