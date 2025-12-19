const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../../database/DatabaseManager');

const router = express.Router();
const db = new DatabaseManager();

// État des sessions OAuth (en mémoire pour la démo, en production utiliser Redis)
const oauthStates = new Map();

// Configuration OAuth URLs
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TWITCH_OAUTH_URL = 'https://id.twitch.tv/oauth2/authorize';

/**
 * Route d'initiation OAuth YouTube
 */
router.get('/youtube', (req, res) => {
    const { discord_id, discord_username } = req.query;
    
    if (!discord_id || !discord_username) {
        return res.status(400).json({ 
            error: 'discord_id et discord_username sont requis' 
        });
    }

    // Générer un état unique pour la sécurité
    const state = uuidv4();
    oauthStates.set(state, { 
        discord_id, 
        discord_username,
        platform: 'youtube',
        timestamp: Date.now()
    });

    // Nettoyer les anciens états (plus de 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of oauthStates.entries()) {
        if (value.timestamp < tenMinutesAgo) {
            oauthStates.delete(key);
        }
    }

    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.readonly',
        state: state,
        access_type: 'offline',
        prompt: 'consent'
    });

    res.redirect(`${GOOGLE_OAUTH_URL}?${params.toString()}`);
});

/**
 * Route de callback OAuth YouTube
 */
router.get('/youtube/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.status(400).json({ error: `OAuth Error: ${error}` });
    }

    if (!state || !oauthStates.has(state)) {
        return res.status(400).json({ error: 'État OAuth invalide ou expiré' });
    }

    const stateData = oauthStates.get(state);
    oauthStates.delete(state);

    try {
        // Échanger le code contre un token d'accès
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            grant_type: 'authorization_code',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
            code: code
        });

        const tokenData = tokenResponse.data;

        // Créer ou récupérer l'utilisateur
        await db.createUser(stateData.discord_id, stateData.discord_username);
        const user = await db.getUser(stateData.discord_id);

        // Sauvegarder le token YouTube
        await db.saveYouTubeToken(user.id, tokenData);

        res.send(`
            <html>
                <head>
                    <title>Authentification YouTube Réussie</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .success { color: #28a745; }
                        .container { max-width: 500px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2 class="success">✅ Authentification YouTube Réussie!</h2>
                        <p>Votre compte YouTube a été lié avec succès.</p>
                        <p>Vous pouvez fermer cette fenêtre et retourner sur Discord.</p>
                        <script>
                            setTimeout(() => window.close()2000);
                        </script>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('Erreur callback YouTube:', error.response?.data || error.message);
        res.status(500).json({ error: 'Erreur lors de l\'échange du code OAuth' });
    }
});

/**
 * Route d'initiation OAuth Twitch
 */
router.get('/twitch', (req, res) => {
    const { discord_id, discord_username } = req.query;
    
    if (!discord_id || !discord_username) {
        return res.status(400).json({ 
            error: 'discord_id et discord_username sont requis' 
        });
    }

    // Générer un état unique pour la sécurité
    const state = uuidv4();
    oauthStates.set(state, { 
        discord_id, 
        discord_username,
        platform: 'twitch',
        timestamp: Date.now()
    });

    const params = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        redirect_uri: process.env.TWITCH_REDIRECT_URI,
        response_type: 'code',
        scope: 'user:read:follows user:read:subscriptions',
        state: state,
        force_verify: 'true'
    });

    res.redirect(`${TWITCH_OAUTH_URL}?${params.toString()}`);
});

/**
 * Route de callback OAuth Twitch
 */
router.get('/twitch/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.status(400).json({ error: `OAuth Error: ${error}` });
    }

    if (!state || !oauthStates.has(state)) {
        return res.status(400).json({ error: 'État OAuth invalide ou expiré' });
    }

    const stateData = oauthStates.get(state);
    oauthStates.delete(state);

    try {
        // Échanger le code contre un token d'accès
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', {
            grant_type: 'authorization_code',
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            redirect_uri: process.env.TWITCH_REDIRECT_URI,
            code: code
        });

        const tokenData = tokenResponse.data;

        // Créer ou récupérer l'utilisateur
        await db.createUser(stateData.discord_id, stateData.discord_username);
        const user = await db.getUser(stateData.discord_id);

        // Sauvegarder le token Twitch
        await db.saveTwitchToken(user.id, tokenData);

        res.send(`
            <html>
                <head>
                    <title>Authentification Twitch Réussie</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .success { color: #9146ff; }
                        .container { max-width: 500px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2 class="success">✅ Authentification Twitch Réussie!</h2>
                        <p>Votre compte Twitch a été lié avec succès.</p>
                        <p>Vous pouvez fermer cette fenêtre et retourner sur Discord.</p>
                        <script>
                            setTimeout(() => window.close()2000);
                        </script>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('Erreur callback Twitch:', error.response?.data || error.message);
        res.status(500).json({ error: 'Erreur lors de l\'échange du code OAuth' });
    }
});

/**
 * Route pour déconnecter un compte
 */
router.delete('/:platform/:discordId', async (req, res) => {
    const { platform, discordId } = req.params;

    try {
        const user = await db.getUser(discordId);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        return new Promise((resolve) => {
            if (platform === 'youtube') {
                // Supprimer les tokens YouTube
                db.db.run('DELETE FROM youtube_tokens WHERE user_id = ?', [user.id], (err) => {
                    if (err) throw err;
                    resolve();
                });
            } else if (platform === 'twitch') {
                // Supprimer les tokens Twitch
                db.db.run('DELETE FROM twitch_tokens WHERE user_id = ?', [user.id], (err) => {
                    if (err) throw err;
                    resolve();
                });
            } else {
                return res.status(400).json({ error: 'Plateforme non supportée' });
            }
        }).then(() => {
            res.json({ success: true, message: `Compte ${platform} déconnecté avec succès` });
        });

    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
});

module.exports = router;