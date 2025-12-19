const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor(dbPath = './data/database.db') {
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.initTables();
    }

    initTables() {
        // Table des utilisateurs avec leurs tokens OAuth
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_id TEXT UNIQUE NOT NULL,
                discord_username TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table des tokens YouTube
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS youtube_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_type TEXT DEFAULT 'Bearer',
                expires_at DATETIME,
                scope TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        // Table des tokens Twitch
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS twitch_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_type TEXT DEFAULT 'bearer',
                expires_at DATETIME,
                scope TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        // Table des vérifications d'abonnements/follows
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS verification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                platform TEXT NOT NULL, -- 'youtube' or 'twitch'
                verification_type TEXT NOT NULL, -- 'subscription', 'follow', 'tier'
                result TEXT NOT NULL, -- 'subscribed', 'not_subscribed', 'followed', 'not_followed', 'tier_1', etc.
                checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Base de données initialisée avec succès');
    }

    // Gestion des utilisateurs
    createUser(discordId, discordUsername) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO users (discord_id, discord_username, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(discordId, discordUsername);
    }

    getUser(discordId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE discord_id = ?');
        return stmt.get(discordId);
    }

    getUserById(id) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id);
    }

    // Gestion des tokens YouTube
    saveYouTubeToken(userId, tokenData) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO youtube_tokens 
            (user_id, access_token, refresh_token, token_type, expires_at, scope, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const expiresAt = tokenData.expires_in ? 
            new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
        
        return stmt.run(
            userId,
            tokenData.access_token,
            tokenData.refresh_token,
            tokenData.token_type || 'Bearer',
            expiresAt,
            tokenData.scope
        );
    }

    getYouTubeToken(userId) {
        const stmt = this.db.prepare('SELECT * FROM youtube_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        return stmt.get(userId);
    }

    // Gestion des tokens Twitch
    saveTwitchToken(userId, tokenData) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO twitch_tokens 
            (user_id, access_token, refresh_token, token_type, expires_at, scope, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const expiresAt = tokenData.expires_in ? 
            new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
        
        return stmt.run(
            userId,
            tokenData.access_token,
            tokenData.refresh_token,
            tokenData.token_type || 'bearer',
            expiresAt,
            tokenData.scope
        );
    }

    getTwitchToken(userId) {
        const stmt = this.db.prepare('SELECT * FROM twitch_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        return stmt.get(userId);
    }

    // Logs de vérification
    logVerification(userId, platform, verificationType, result) {
        const stmt = this.db.prepare(`
            INSERT INTO verification_logs (user_id, platform, verification_type, result)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(userId, platform, verificationType, result);
    }

    getVerificationHistory(userId, limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM verification_logs 
            WHERE user_id = ? 
            ORDER BY checked_at DESC 
            LIMIT ?
        `);
        return stmt.all(userId, limit);
    }

    // Nettoyage des tokens expirés
    cleanExpiredTokens() {
        const now = new Date().toISOString();
        
        const ytStmt = this.db.prepare('DELETE FROM youtube_tokens WHERE expires_at < ?');
        const twitchStmt = this.db.prepare('DELETE FROM twitch_tokens WHERE expires_at < ?');
        
        const ytDeleted = ytStmt.run(now).changes;
        const twitchDeleted = twitchStmt.run(now).changes;
        
        return { youtube: ytDeleted, twitch: twitchDeleted };
    }

    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;