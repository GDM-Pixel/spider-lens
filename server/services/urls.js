// Adresse affichée dans les listes.
// url = chemin seul (pages groupées) ; query = paramètres après le « ? » (NULL sinon).
// Une erreur ou une redirection se corrige adresse par adresse : on montre l'adresse exacte.
// Une page servie (2xx) reste groupée par chemin, pour ne pas éparpiller ?utm_source & co.

/** Adresse exacte : chemin + « ?paramètres » s'il y en a. `a` = préfixe de table ('l.', 'le.' ou ''). */
export function sqlUrlComplete(a = '') {
  return `(${a}url || COALESCE('?' || ${a}query, ''))`
}

/** Adresse exacte pour les codes >= 300, chemin seul pour les 2xx. */
export function sqlUrlAffichee(a = '') {
  return `(CASE WHEN ${a}status_code >= 300 THEN ${sqlUrlComplete(a)} ELSE ${a}url END)`
}

/** Échappe une adresse avant de l'écrire dans un mail HTML (les paramètres viennent du visiteur). */
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
