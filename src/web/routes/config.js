const express = require('express');
const DatabaseManager = require('../../database/DatabaseManager');

const router = express.Router();
const db = new DatabaseManager();

/**
 * Obtenir la configuration d'un serveur
 */
router.get('/guild/:guildId', async (req, res) => {
    const { guildId } = req.params;

    try {
        const config = await db.getGuildConfig(guildId);
        
        if (!config) {
            return res.json({
                exists: false,
                guildId: guildId,
                message: 'Aucune configuration trouvée pour ce serveur'
            });
        }

        // Ne pas exposer les IDs internes
        const { id, ...publicConfig } = config;
        
        res.json({
            exists: true,
            config: publicConfig
        });

    } catch (error) {
        console.error('Erreur lors de la récupération de la configuration:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Créer ou mettre à jour la configuration d'un serveur
 */
router.post('/guild/:guildId', async (req, res) => {
    const { guildId } = req.params;
    const {
        guild_name,
        youtube_channel_id,
        twitch_channel_name,
        verified_role_id,
        admin_role_id,
        auto_assign_role = true,
        require_youtube = true,
        require_twitch_follow = true,
        require_twitch_sub = false
    } = req.body;

    // Validation des données requises
    if (!guild_name) {
        return res.status(400).json({ error: 'Le nom du serveur est requis' });
    }

    if (!verified_role_id) {
        return res.status(400).json({ error: 'L\'ID du rôle de vérification est requis' });
    }

    try {
        await db.createOrUpdateGuildConfig(guildId, guild_name, {
            youtube_channel_id,
            twitch_channel_name,
            verified_role_id,
            admin_role_id,
            auto_assign_role,
            require_youtube,
            require_twitch_follow,
            require_twitch_sub
        });

        const updatedConfig = await db.getGuildConfig(guildId);
        const { id, ...publicConfig } = updatedConfig;

        res.json({
            success: true,
            message: 'Configuration mise à jour avec succès',
            config: publicConfig
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de la configuration:', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde de la configuration' });
    }
});

/**
 * Supprimer la configuration d'un serveur
 */
router.delete('/guild/:guildId', async (req, res) => {
    const { guildId } = req.params;

    try {
        const result = await db.deleteGuildConfig(guildId);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Configuration non trouvée' });
        }

        res.json({
            success: true,
            message: 'Configuration supprimée avec succès'
        });

    } catch (error) {
        console.error('Erreur lors de la suppression de la configuration:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

/**
 * Lister toutes les configurations de serveurs
 */
router.get('/guilds', async (req, res) => {
    try {
        const configs = await db.getAllGuildConfigs();
        
        // Masquer les IDs internes
        const publicConfigs = configs.map(config => {
            const { id, ...publicConfig } = config;
            return publicConfig;
        });

        res.json({
            success: true,
            count: publicConfigs.length,
            guilds: publicConfigs
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des configurations:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Valider une configuration de serveur
 */
router.post('/guild/:guildId/validate', async (req, res) => {
    const { guildId } = req.params;

    try {
        const config = await db.getGuildConfig(guildId);
        
        if (!config) {
            return res.json({
                valid: false,
                errors: ['Configuration non trouvée']
            });
        }

        const errors = [];
        const warnings = [];

        // Vérifications obligatoires
        if (!config.verified_role_id) {
            errors.push('Rôle de vérification manquant');
        }

        // Vérifications conditionnelles
        if (config.require_youtube && !config.youtube_channel_id) {
            errors.push('Chaîne YouTube requise mais non configurée');
        }

        if ((config.require_twitch_follow || config.require_twitch_sub) && !config.twitch_channel_name) {
            errors.push('Chaîne Twitch requise mais non configurée');
        }

        // Avertissements
        if (!config.admin_role_id) {
            warnings.push('Aucun rôle d\'administrateur configuré');
        }

        if (!config.require_youtube && !config.require_twitch_follow && !config.require_twitch_sub) {
            warnings.push('Aucune vérification requise - tous les utilisateurs auront le rôle');
        }

        res.json({
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            config: {
                guild_id: config.guild_id,
                guild_name: config.guild_name,
                verified_role_id: config.verified_role_id,
                auto_assign_role: config.auto_assign_role
            }
        });

    } catch (error) {
        console.error('Erreur lors de la validation:', error);
        res.status(500).json({ error: 'Erreur lors de la validation' });
    }
});

module.exports = router;