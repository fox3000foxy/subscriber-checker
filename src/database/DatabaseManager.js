const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor(dbPath = './data/database.db') {
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.initTables();
    }

    initTables() {
        return new Promise((resolve, reject) => {
            // Table des utilisateurs avec leurs tokens OAuth
            this.db.serialize(() => {
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        discord_id TEXT UNIQUE NOT NULL,
                        discord_username TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Table des tokens YouTube
                this.db.run(`
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
                this.db.run(`
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
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS verification_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        platform TEXT NOT NULL,
                        verification_type TEXT NOT NULL,
                        result TEXT NOT NULL,
                        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `);

                // Table des configurations de serveurs
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS guild_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        guild_id TEXT UNIQUE NOT NULL,
                        guild_name TEXT NOT NULL,
                        youtube_channel_id TEXT,
                        twitch_channel_name TEXT,
                        verified_role_id TEXT,
                        admin_role_id TEXT,
                        auto_assign_role BOOLEAN DEFAULT 1,
                        require_youtube BOOLEAN DEFAULT 1,
                        require_twitch_follow BOOLEAN DEFAULT 1,
                        require_twitch_sub BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('✅ Base de données initialisée avec succès');
                        resolve();
                    }
                });
            });
        });
    }

    // Gestion des utilisateurs
    createUser(discordId, discordUsername) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO users (discord_id, discord_username, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [discordId, discordUsername], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getUser(discordId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Gestion des tokens YouTube
    saveYouTubeToken(userId, tokenData) {
        return new Promise((resolve, reject) => {
            const expiresAt = tokenData.expires_in ? 
                new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
            
            this.db.run(`
                INSERT OR REPLACE INTO youtube_tokens 
                (user_id, access_token, refresh_token, token_type, expires_at, scope, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                userId,
                tokenData.access_token,
                tokenData.refresh_token,
                tokenData.token_type || 'Bearer',
                expiresAt,
                tokenData.scope
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getYouTubeToken(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM youtube_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Gestion des tokens Twitch
    saveTwitchToken(userId, tokenData) {
        return new Promise((resolve, reject) => {
            const expiresAt = tokenData.expires_in ? 
                new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
            
            this.db.run(`
                INSERT OR REPLACE INTO twitch_tokens 
                (user_id, access_token, refresh_token, token_type, expires_at, scope, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                userId,
                tokenData.access_token,
                tokenData.refresh_token,
                tokenData.token_type || 'bearer',
                expiresAt,
                tokenData.scope
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getTwitchToken(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM twitch_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Logs de vérification
    logVerification(userId, platform, verificationType, result) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO verification_logs (user_id, platform, verification_type, result)
                VALUES (?, ?, ?, ?)
            `, [userId, platform, verificationType, result], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getVerificationHistory(userId, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM verification_logs 
                WHERE user_id = ? 
                ORDER BY checked_at DESC 
                LIMIT ?
            `, [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Nettoyage des tokens expirés
    cleanExpiredTokens() {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            let ytDeleted = 0;
            let twitchDeleted = 0;
            
            this.db.serialize(() => {
                this.db.run('DELETE FROM youtube_tokens WHERE expires_at < ?', [now], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    ytDeleted = this.changes;
                });
                
                this.db.run('DELETE FROM twitch_tokens WHERE expires_at < ?', [now], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    twitchDeleted = this.changes;
                    resolve({ youtube: ytDeleted, twitch: twitchDeleted });
                });
            });
        });
    }

    // Gestion des configurations de serveurs
    createOrUpdateGuildConfig(guildId, guildName, config) {
        return new Promise((resolve, reject) => {
            const {
                youtube_channel_id,
                twitch_channel_name,
                verified_role_id,
                admin_role_id,
                auto_assign_role = true,
                require_youtube = true,
                require_twitch_follow = true,
                require_twitch_sub = false
            } = config;
            
            this.db.run(`
                INSERT OR REPLACE INTO guild_configs 
                (guild_id, guild_name, youtube_channel_id, twitch_channel_name, 
                 verified_role_id, admin_role_id, auto_assign_role, require_youtube, 
                 require_twitch_follow, require_twitch_sub, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                guildId, guildName, youtube_channel_id, twitch_channel_name,
                verified_role_id, admin_role_id, auto_assign_role, require_youtube,
                require_twitch_follow, require_twitch_sub
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getGuildConfig(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM guild_configs WHERE guild_id = ?', [guildId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getAllGuildConfigs() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM guild_configs ORDER BY guild_name', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    deleteGuildConfig(guildId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM guild_configs WHERE guild_id = ?', [guildId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;