# 🤖 Bot Discord OAuth2 - YouTube & Twitch

Un bot Discord complet avec interface web pour la gestion d'authentifications OAuth2 YouTube et Twitch, permettant la vérification d'abonnements et de follows.

## 🚀 Fonctionnalités

### YouTube
- ✅ Vérification d'abonnements à une chaîne
- 🔄 Gestion automatique des tokens de rafraîchissement
- 📊 Historique des vérifications

### Twitch  
- ✅ Vérification des follows de chaîne
- 💎 Vérification des abonnements avec détection du tier (Tier 1, 2, 3)
- 🎁 Détection des sub gifted
- 🔄 Gestion automatique des tokens

### Discord Bot
- 📱 Commandes interactives avec embeds
- 🔐 Boutons OAuth2 intégrés
- 📈 Système de statut et historique
- 🛡️ Gestion sécurisée des tokens

## 📦 Installation

1. **Cloner et installer les dépendances**
```bash
npm install
```

2. **Configuration des variables d'environnement**
```bash
cp .env.example .env
```

3. **Éditer le fichier `.env`** avec vos configurations :

```env
# Bot Discord
DISCORD_TOKEN=votre_token_discord
DISCORD_CLIENT_ID=votre_client_id_discord
GUILD_ID=votre_guild_id

# OAuth2 Google/YouTube  
GOOGLE_CLIENT_ID=votre_google_client_id
GOOGLE_CLIENT_SECRET=votre_google_client_secret
YOUTUBE_CHANNEL_ID=UCExempleChannelId

# OAuth2 Twitch
TWITCH_CLIENT_ID=votre_twitch_client_id
TWITCH_CLIENT_SECRET=votre_twitch_client_secret
TWITCH_CHANNEL_NAME=votre_nom_chaine_twitch

# Serveur web
WEB_PORT=8458
SESSION_SECRET=votre_session_secret_aleatoire
```

## 🔧 Configuration OAuth2

### Google/YouTube
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un projet ou sélectionner un projet existant
3. Activer l'API YouTube Data API v3
4. Créer des identifiants OAuth 2.0
5. Ajouter `http://localhost:8458/auth/youtube/callback` aux URIs de redirection

### Twitch
1. Aller sur [Twitch Developers](https://dev.twitch.tv/console/apps)
2. Créer une nouvelle application
3. Ajouter `http://localhost:8458/auth/twitch/callback` aux URIs de redirection OAuth
4. Noter le Client ID et générer un Client Secret

### Discord Bot
1. Aller sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créer une nouvelle application
3. Créer un bot et noter le token
4. Inviter le bot sur votre serveur avec les permissions :
   - Envoyer des messages
   - Utiliser les commandes slash
   - Lire l'historique des messages
   - Utiliser les liens externes

## 🚀 Démarrage

### Démarrage du bot seul
```bash
npm start
```

### Démarrage du serveur web seul
```bash
npm run web
```

### Mode développement (avec nodemon)
```bash
npm run dev
```

## 📱 Commandes Discord

| Commande | Description |
|----------|------------|
| `!oauth` ou `!auth` | Obtenir les liens d'authentification |
| `!verify` ou `!check` | Vérifier les abonnements/follows |
| `!status` | Voir le statut du compte et historique |
| `!disconnect <platform>` | Déconnecter un compte (youtube/twitch/all) |
| `!help` | Afficher l'aide |

## 🌐 Interface Web

L'interface web est accessible sur `http://localhost:8458` et propose :
- Page d'accueil avec informations sur le système
- Endpoints OAuth2 pour YouTube et Twitch
- API REST pour les vérifications
- Interface de gestion des tokens

### Endpoints API

#### Authentification
- `GET /auth/youtube` - Initier OAuth YouTube
- `GET /auth/twitch` - Initier OAuth Twitch
- `DELETE /auth/:platform/:discordId` - Déconnecter un compte

#### Vérifications
- `GET /api/youtube/subscription/:discordId` - Vérifier abonnement YouTube
- `GET /api/twitch/follow/:discordId` - Vérifier follow Twitch
- `GET /api/twitch/subscription/:discordId` - Vérifier abonnement Twitch
- `GET /api/check-all/:discordId` - Vérification complète
- `GET /api/history/:discordId` - Historique des vérifications

## 💾 Base de Données

Le système utilise SQLite avec les tables suivantes :
- `users` - Informations des utilisateurs Discord
- `youtube_tokens` - Tokens d'accès YouTube
- `twitch_tokens` - Tokens d'accès Twitch  
- `verification_logs` - Historique des vérifications

## 🔒 Sécurité

- Tokens chiffrés et stockés localement
- États OAuth2 avec validation CSRF
- Nettoyage automatique des tokens expirés
- Sessions sécurisées avec secrets aléatoires
- Validation des permissions d'API stricte

## 🛠️ Architecture

```
src/
├── bot.js                 # Bot Discord principal
├── database/
│   └── DatabaseManager.js # Gestion base de données SQLite
├── services/
│   ├── YouTubeService.js  # Service API YouTube
│   └── TwitchService.js   # Service API Twitch
└── web/
    ├── server.js          # Serveur Express
    ├── routes/
    │   ├── auth.js        # Routes OAuth2
    │   └── verification.js # Routes API vérification
    └── public/
        └── index.html     # Interface web
```

## 📊 Logs et Monitoring

Le système log automatiquement :
- Connexions/déconnexions OAuth2
- Vérifications d'abonnements/follows
- Erreurs d'API et tokens expirés
- Statistiques d'utilisation

## 🚨 Résolution de Problèmes

### Token expiré
Les tokens sont automatiquement rafraîchis. Si le problème persiste :
1. Utiliser `!disconnect` puis `!oauth` pour réauthentifier
2. Vérifier les permissions d'API dans les consoles développeur

### Erreur de vérification
- Vérifier que les IDs de chaîne sont corrects dans `.env`
- S'assurer que l'utilisateur a bien les permissions sur ses comptes
- Consulter les logs du serveur pour plus de détails

## 📝 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request