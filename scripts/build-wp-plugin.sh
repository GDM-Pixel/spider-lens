#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Spider-Lens — Build du plugin WordPress installable
#
# Usage :
#   bash scripts/build-wp-plugin.sh
#   bash scripts/build-wp-plugin.sh --skip-build   (si dist/ existe déjà)
#
# Résultat : spider-lens-wp-x.x.x.zip dans dist/
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PLUGIN_DIR="wp-plugin"
DIST_DIR="dist"
VERSION=$(grep "Version:" "$PLUGIN_DIR/spider-lens.php" | head -1 | sed "s/.*Version: *//;s/ *$//")
ZIP_NAME="spider-lens-wp-${VERSION}.zip"
TMP_DIR=$(mktemp -d)
SKIP_BUILD=false

# ── Args ──────────────────────────────────────────────────────
for arg in "$@"; do
  [[ "$arg" == "--skip-build" ]] && SKIP_BUILD=true
done

echo ""
echo "🕷️  Spider-Lens WP Plugin — Build v${VERSION}"
echo "────────────────────────────────────────────"

# ── 1. Build React ────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo "▶ Installation des dépendances npm…"
  (cd "$PLUGIN_DIR/admin" && npm ci --silent)

  echo "▶ Build React (Vite)…"
  (cd "$PLUGIN_DIR/admin" && npm run build)
  echo "✓ Build terminé"
else
  echo "⏭ Build React ignoré (--skip-build)"
fi

# Vérifier que le build existe
if [ ! -d "$PLUGIN_DIR/admin/dist" ]; then
  echo "✗ Erreur : wp-plugin/admin/dist/ introuvable. Lancez le build d'abord."
  exit 1
fi

# ── 2. Copie dans le dossier temporaire ───────────────────────
echo "▶ Préparation du dossier plugin…"
STAGING="$TMP_DIR/spider-lens"
mkdir -p "$STAGING"

# Fichiers PHP du plugin
cp "$PLUGIN_DIR/spider-lens.php" "$STAGING/"
cp -r "$PLUGIN_DIR/includes"     "$STAGING/"

# Build React compilé (sans les sources)
mkdir -p "$STAGING/admin"
cp -r "$PLUGIN_DIR/admin/dist"   "$STAGING/admin/"

# Langues (si présent)
[ -d "$PLUGIN_DIR/languages" ] && cp -r "$PLUGIN_DIR/languages" "$STAGING/"

echo "✓ Fichiers copiés"

# ── 3. Nettoyage des fichiers inutiles dans le zip ────────────
find "$STAGING" -name ".DS_Store"    -delete 2>/dev/null || true
find "$STAGING" -name "*.map"        -delete 2>/dev/null || true
find "$STAGING" -name "Thumbs.db"    -delete 2>/dev/null || true

# ── 4. Création du zip ────────────────────────────────────────
mkdir -p "$DIST_DIR"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "▶ Création du zip…"
(cd "$TMP_DIR" && zip -r9 - "spider-lens") > "$ZIP_PATH"

# Nettoyage
rm -rf "$TMP_DIR"

# ── 5. Résumé ─────────────────────────────────────────────────
SIZE=$(du -sh "$ZIP_PATH" | cut -f1)
echo ""
echo "✅ Plugin prêt : $ZIP_PATH ($SIZE)"
echo ""
echo "📦 Pour installer :"
echo "   WordPress Admin → Extensions → Ajouter → Téléverser une extension"
echo "   Sélectionner : $ZIP_NAME"
echo ""
