# BOTI SMART IMPORT (prototype v0.1)
Conversion locale (navigateur) de fichiers Excel scolaires vers un modèle Boti. Aucune API, aucune clé, aucune donnée envoyée.

## Installation
- Tests : `npm install && npm test` (Node ≥ 18)
- Application : `python3 -m http.server 8000` puis http://localhost:8000 (SheetJS est déjà dans `vendor/`).

## Utilisation
1. Choisir le fichier source et le modèle Boti officiel, cliquer **Analyser**.
2. Vérifier/corriger le **mapping** (liste déroulante par colonne ; « nom_complet » déclenche la segmentation).
3. Corriger les valeurs dans la prévisualisation (filtre par statut, recherche), puis **Télécharger le fichier Boti** (écrit dans le modèle, en-têtes intacts) et le **rapport**.

## Structure
`js/engine.js` (lecture/fusions, en-têtes, reconnaissance, segmentation, transformations, validation, scores, export, rapport) · `data/dictionaries.json` · `test/run.js` (27 tests, fichiers fictifs générés à la volée).

## Limites connues
Dictionnaires volontairement petits (à étendre) ; segmentation par heuristiques + scoring, jamais certaine : les cas ambigus sont signalés. Non implémenté : édition des dictionnaires dans l'UI, multi-modèles via Paramètres, relations élèves/parents, comparaison des doublons côte à côte, seuils configurables dans l'UI, glisser-déposer, ZIP de fichiers de démo.
