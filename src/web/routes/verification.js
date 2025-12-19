const express = require('express');
const DatabaseManager = require('../../database/DatabaseManager');
const YouTubeService = require('../../services/YouTubeService');
const TwitchService = require('../../services/TwitchService');

const router = express.Router();
const db = new DatabaseManager();

// Initialiser les services
const youtubeService = new YouTubeService();
const twitchService = new TwitchService(
    process.env.TWITCH_CLIENT_ID,
    process.env.TWITCH_CLIENT_SECRET
);

/**
 * Vérifier l'abonnement YouTube d'un utilisateur
 */
router.get('/youtube/subscription/:guildId/:discordId', async (req, res) => {
    const { guildId, discordId } = req.params;
    
    try {
        // Récupérer la configuration du serveur
        const guildConfig = await db.getGuildConfig(guildId);
        if (!guildConfig || !guildConfig.youtube_channel_id) {
            return res.status(400).json({ 
                error: 'Aucune chaîne YouTube configurée pour ce serveur',
                subscribed: false
            });
        }
        
        const channelId = guildConfig.youtube_channel_id;

        const user = await db.getUser(discordId);
        if (!user) {
            return res.status(404).json({ 
                error: 'Utilisateur non trouvé',
                subscribed: false 
            });
        }

        const token = await db.getYouTubeToken(user.id);
        if (!token) {
            return res.status(400).json({ 
                error: 'Aucun token YouTube trouvé pour cet utilisateur',
                subscribed: false,
                needsAuth: true
            });
        }

        // Vérifier si le token est expiré
        if (token.expires_at && new Date(token.expires_at) <= new Date()) {
            return res.status(401).json({ 
                error: 'Token YouTube expiré',
                subscribed: false,
                needsAuth: true
            });
        }

        // Vérifier l'abonnement
        const result = await youtubeService.checkSubscription(token.access_token, channelId);
        
        // Log de la vérification
        await db.logVerification(
            user.id, 
            'youtube', 
            'subscription', 
            result.subscribed ? 'subscribed' : 'not_subscribed'
        );

        res.json({
            subscribed: result.subscribed,
            error: result.error,
            channelId: channelId,
            checkedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erreur vérification YouTube:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la vérification de l\'abonnement YouTube',
            subscribed: false
        });
    }
});

/**
 * Vérifier le follow Twitch d'un utilisateur
 */
router.get('/twitch/follow/:guildId/:discordId', async (req, res) => {
    const { guildId, discordId } = req.params;
    
    try {
        // Récupérer la configuration du serveur
        const guildConfig = await db.getGuildConfig(guildId);
        if (!guildConfig || !guildConfig.twitch_channel_name) {
            return res.status(400).json({ 
                error: 'Aucune chaîne Twitch configurée pour ce serveur',
                following: false
            });
        }
        
        const channelName = guildConfig.twitch_channel_name;

        const user = await db.getUser(discordId);
        if (!user) {
            return res.status(404).json({ 
                error: 'Utilisateur non trouvé',
                following: false 
            });
        }

        const token = await db.getTwitchToken(user.id);
        if (!token) {
            return res.status(400).json({ 
                error: 'Aucun token Twitch trouvé pour cet utilisateur',
                following: false,
                needsAuth: true
            });
        }

        // Vérifier si le token est expiré
        if (token.expires_at && new Date(token.expires_at) <= new Date()) {
            return res.status(401).json({ 
                error: 'Token Twitch expiré',
                following: false,
                needsAuth: true
            });
        }

        // Obtenir les infos de la chaîne
        const channelInfo = await twitchService.getChannelInfo(channelName);
        if (!channelInfo) {
            return res.status(404).json({ 
                error: 'Chaîne Twitch non trouvée',
                following: false
            });
        }

        // Vérifier le follow
        const result = await twitchService.checkFollow(token.access_token, channelInfo.id);
        
        // Log de la vérification
        await db.logVerification(
            user.id, 
            'twitch', 
            'follow', 
            result.following ? 'followed' : 'not_followed'
        );

        res.json({
            following: result.following,
            error: result.error,
            channelName: channelName,
            channelId: channelInfo.id,
            checkedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erreur vérification Twitch follow:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la vérification du follow Twitch',
            following: false
        });
    }
});

/**
 * Vérifier l'abonnement Twitch d'un utilisateur
 */
router.get('/twitch/subscription/:guildId/:discordId', async (req, res) => {
    const { guildId, discordId } = req.params;
    
    try {
        // Récupérer la configuration du serveur
        const guildConfig = await db.getGuildConfig(guildId);
        if (!guildConfig || !guildConfig.twitch_channel_name) {
            return res.status(400).json({ 
                error: 'Aucune chaîne Twitch configurée pour ce serveur',
                subscribed: false
            });
        }
        
        const channelName = guildConfig.twitch_channel_name;

        const user = await db.getUser(discordId);
        if (!user) {
            return res.status(404).json({ 
                error: 'Utilisateur non trouvé',
                subscribed: false 
            });
        }

        const token = await db.getTwitchToken(user.id);
        if (!token) {
            return res.status(400).json({ 
                error: 'Aucun token Twitch trouvé pour cet utilisateur',
                subscribed: false,
                needsAuth: true
            });
        }

        // Vérifier si le token est expiré
        if (token.expires_at && new Date(token.expires_at) <= new Date()) {
            return res.status(401).json({ 
                error: 'Token Twitch expiré',
                subscribed: false,
                needsAuth: true
            });
        }

        // Obtenir les infos de la chaîne
        const channelInfo = await twitchService.getChannelInfo(channelName);
        if (!channelInfo) {
            return res.status(404).json({ 
                error: 'Chaîne Twitch non trouvée',
                subscribed: false
            });
        }

        // Vérifier l'abonnement
        const result = await twitchService.checkSubscription(token.access_token, channelInfo.id);
        
        // Log de la vérification
        const logResult = result.subscribed ? 
            `subscribed_tier_${result.tier || 'unknown'}` : 'not_subscribed';
        
        await db.logVerification(user.id, 'twitch', 'subscription', logResult);

        res.json({
            subscribed: result.subscribed,
            tier: result.tier,
            planName: result.planName,
            isGift: result.isGift,
            error: result.error,
            channelName: channelName,
            channelId: channelInfo.id,
            checkedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erreur vérification Twitch subscription:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la vérification de l\'abonnement Twitch',
            subscribed: false
        });
    }
});

/**
 * Vérification complète d'un utilisateur (YouTube + Twitch)
 */
router.get('/check-all/:guildId/:discordId', async (req, res) => {
    const { guildId, discordId } = req.params;
    
    try {
        // Récupérer la configuration du serveur
        const guildConfig = await db.getGuildConfig(guildId);
        if (!guildConfig) {
            return res.status(400).json({ error: 'Configuration du serveur non trouvée' });
        }
        
        const user = await db.getUser(discordId);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const results = {
            guild: {
                guildId: guildConfig.guild_id,
                guildName: guildConfig.guild_name
            },
            user: {
                discordId: user.discord_id,
                username: user.discord_username
            },
            youtube: {
                required: guildConfig.require_youtube,
                hasToken: false,
                subscribed: false,
                error: null
            },
            twitch: {
                followRequired: guildConfig.require_twitch_follow,
                subRequired: guildConfig.require_twitch_sub,
                hasToken: false,
                following: false,
                subscribed: false,
                tier: null,
                error: null
            },
            checkedAt: new Date().toISOString()
        };

        // Vérification YouTube
        if (guildConfig.require_youtube && guildConfig.youtube_channel_id) {
            const youtubeToken = await db.getYouTubeToken(user.id);
            if (youtubeToken && (!youtubeToken.expires_at || new Date(youtubeToken.expires_at) > new Date())) {
                results.youtube.hasToken = true;
                try {
                    const ytResult = await youtubeService.checkSubscription(
                        youtubeToken.access_token, 
                        guildConfig.youtube_channel_id
                    );
                    results.youtube.subscribed = ytResult.subscribed;
                    results.youtube.error = ytResult.error;
                } catch (error) {
                    results.youtube.error = 'Erreur lors de la vérification YouTube';
                }
            }
        }

        // Vérification Twitch
        if ((guildConfig.require_twitch_follow || guildConfig.require_twitch_sub) && guildConfig.twitch_channel_name) {
            const twitchToken = await db.getTwitchToken(user.id);
            if (twitchToken && (!twitchToken.expires_at || new Date(twitchToken.expires_at) > new Date())) {
                results.twitch.hasToken = true;
                
                const channelInfo = await twitchService.getChannelInfo(guildConfig.twitch_channel_name);
                if (channelInfo) {
                    try {
                        // Vérifier le follow si requis
                        if (guildConfig.require_twitch_follow) {
                            const followResult = await twitchService.checkFollow(twitchToken.access_token, channelInfo.id);
                            results.twitch.following = followResult.following;
                            if (followResult.error) results.twitch.error = followResult.error;
                        }
                        
                        // Vérifier l'abonnement si requis
                        if (guildConfig.require_twitch_sub) {
                            const subResult = await twitchService.checkSubscription(twitchToken.access_token, channelInfo.id);
                            results.twitch.subscribed = subResult.subscribed;
                            results.twitch.tier = subResult.tier;
                            if (subResult.error && !results.twitch.error) results.twitch.error = subResult.error;
                        }
                    } catch (error) {
                        results.twitch.error = 'Erreur lors de la vérification Twitch';
                    }
                }
            }
        }

        res.json(results);

    } catch (error) {
        console.error('Erreur vérification complète:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification complète' });
    }
});

/**
 * Obtenir l'historique des vérifications d'un utilisateur
 */
router.get('/history/:discordId', async (req, res) => {
    const { discordId } = req.params;
    const { limit = 20 } = req.query;

    try {
        const user = await db.getUser(discordId);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const history = await db.getVerificationHistory(user.id, parseInt(limit));
        
        res.json({
            user: {
                discordId: user.discord_id,
                username: user.discord_username
            },
            history: history
        });

    } catch (error) {
        console.error('Erreur récupération historique:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
    }
});

module.exports = router;