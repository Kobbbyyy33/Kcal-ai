# KCAL AI - Cal AI inspired PWA

PWA Next.js mobile-first pour tracker calories et macros:

- Auth email/password (Supabase Auth)
- Analyse photo repas via OpenAI Vision
- Scan code-barres Open Food Facts
- Saisie manuelle + recherche OFF
- Dashboard journalier + stats sur 7 jours
- Edition / suppression / copie de repas
- Reglages objectifs (calories, proteines, glucides, lipides)
- Theme clair/sombre

## Stack

- Next.js 14 (App Router) + TypeScript strict
- Tailwind CSS
- Supabase (Auth + Postgres + Storage)
- OpenAI API (analyse photo)
- Vercel (deploy)

## Setup rapide

1. Installer dependances
   - Windows PowerShell: `npm.cmd install`
   - macOS/Linux: `npm install`

2. Creer `.env.local` depuis `.env.example` puis remplir:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Demarrer:
   - `npm.cmd run dev`

## Supabase

1. Executer `supabase/schema.sql` dans SQL Editor.
2. Creer bucket Storage `meal-images` (public read).
3. Activer provider Auth Email/Password.

## Fonctions principales

### Dashboard

- Vue jour courant + navigation par date
- Progression objectifs calories/macros
- Stats 7 jours (moyenne + pic)
- CRUD repas + copie vers une autre date

### Ajouter un repas

- Methode Photo: upload + analyse IA + edition avant sauvegarde
- Methode Code-barres: scan camera ou saisie code, quantite en grammes
- Fallback manuel directement disponible si produit OFF introuvable
- Methode Manuelle: recherche OFF + formulaire libre

### Reglages

- Edition des objectifs journaliers
- Theme toggle
- Rappels hydratation (dashboard)
- Streak hebdo (jours actifs)
- Onboarding intelligent (objectifs auto calories/macros)
- Connexion OAuth Google + Apple
- Notifications push PWA (hydratation/repas)

## API routes

- `app/api/analyze-meal/route.ts`
  - Appel OpenAI Vision cote serveur
  - Parsing JSON robuste + normalisation des numeriques
- `app/api/search-food/route.ts`
  - Proxy recherche Open Food Facts + tags intelligents (`high_protein`, `low_kcal`, `post_workout`)
- `app/api/food-compare/route.ts`
  - Comparateur A/B par code-barres avec recommendation automatique
- `app/api/coach/route.ts`
  - Coach IA du jour + suggestions repas (fallback heuristique si OpenAI indisponible)
- `app/api/push/subscribe/route.ts`
  - Enregistrement de la subscription push du device
- `app/api/push/unsubscribe/route.ts`
  - Suppression de la subscription push
- `app/api/push/remind/route.ts`
  - Envoi de notifications push hydratation/repas

## PWA

- Config: `next.config.js` + `public/manifest.json`
- Icons: routes `app/icons/icon-192.png/route.ts`, `app/icons/icon-512.png/route.ts`, `app/icons/maskable-512.png/route.ts`
- Comportement:
  - Production: PWA active par defaut.
  - Developpement: PWA desactivee par defaut (pour eviter les effets de cache du service worker).
  - Pour activer la PWA en dev, definir `NEXT_PUBLIC_PWA_DEV=true`:
    - Windows PowerShell: `$env:NEXT_PUBLIC_PWA_DEV="true"; npm.cmd run dev`
    - macOS/Linux: `NEXT_PUBLIC_PWA_DEV=true npm run dev`

## Debug rapide

- Si `npm install` echoue avec `ENOENT package-lock.json` dans `Documents`, c'est souvent un blocage ecriture Windows Defender (Controlled folder access). Deplacer le projet vers `C:\dev\kcal-ai` ou autoriser `node.exe`.
- Si login boucle vers `/login`, verifier `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et policies SQL appliquees.
- Si photo IA echoue, verifier `OPENAI_API_KEY` et credits API.
- Si tu vois `Could not find the table 'public.profiles' in the schema cache` ou `Erreur chargement historique`, execute `supabase/schema.sql` dans Supabase SQL Editor (sur le bon projet), puis reconnecte-toi.

## OAuth Google (Supabase)

1. Supabase Dashboard -> Authentication -> Providers -> Google -> Enable.
2. Ajouter les Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - URL de prod equivalente (ex: `https://ton-domaine.com/auth/callback`)
3. Les ecrans Login/Signup proposent ensuite "Continuer avec Google".

## OAuth Apple (Supabase)

1. Supabase Dashboard -> Authentication -> Providers -> Apple -> Enable.
2. Apple Developer:
   - Creer une `Service ID` et activer `Sign in with Apple`.
   - Ajouter la `Return URL` Supabase: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
   - Creer une `Key` (Sign in with Apple) et noter `Key ID`, `Team ID`, `Client ID` (Service ID) et la cle privee `.p8`.
3. Reporter ces valeurs dans Supabase (Provider Apple).
4. Supabase Dashboard -> Authentication -> URL Configuration -> ajouter en Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - URL de prod equivalente, ex: `https://ton-domaine.com/auth/callback`
5. Les boutons Login/Signup utilisent maintenant un `redirectTo` explicite vers `/auth/callback`.

## Push PWA (VAPID)

1. Generer des clefs VAPID (ex: avec `npx web-push generate-vapid-keys`).
2. Renseigner dans `.env.local`:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (mailto)
3. Reexecuter `supabase/schema.sql` pour creer `public.push_subscriptions`.
4. En prod (ou dev avec PWA active), activer Push depuis le dashboard.
