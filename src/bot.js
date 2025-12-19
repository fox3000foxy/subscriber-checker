const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DatabaseManager = require('./database/DatabaseManager');
const YouTubeService = require('./services/YouTubeService');
const TwitchService = require('./services/TwitchService');
const axios = require('axios');
require('dotenv').config();

class DiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.db = new DatabaseManager();
        this.youtubeService = new YouTubeService();
        this.twitchService = new TwitchService(
            process.env.TWITCH_CLIENT_ID,
            process.env.TWITCH_CLIENT_SECRET
        );

        this.webUrl = `http://${process.env.WEB_HOST || 'localhost'}:${process.env.WEB_PORT || 3000}`;
        
        this.setupEventListeners();
        this.registerCommands();
    }

    setupEventListeners() {
        this.client.once('ready', () => {
            console.log(`🤖 Bot Discord connecté en tant que ${this.client.user.tag}`);
            console.log(`🌐 Interface web disponible sur: ${this.webUrl}`);
            
            // Nettoyer les tokens expirés au démarrage
            this.cleanupExpiredTokens();
            
            // Nettoyer les tokens expirés toutes les heures
            setInterval(() => {
                this.cleanupExpiredTokens();
            }, 60 * 60 * 1000);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const content = message.content.toLowerCase();
            
            if (content.startsWith('!verify') || content.startsWith('!check')) {
                await this.handleVerifyCommand(message);
            } else if (content.startsWith('!oauth') || content.startsWith('!auth')) {
                await this.handleOAuthCommand(message);
            } else if (content.startsWith('!status')) {
                await this.handleStatusCommand(message);
            } else if (content.startsWith('!help')) {
                await this.handleHelpCommand(message);
            } else if (content.startsWith('!disconnect')) {
                await this.handleDisconnectCommand(message);
            }
        });

        this.client.on('error', (error) => {
            console.error('❌ Erreur Discord:', error);
        });
    }

    async registerCommands() {
        // Enregistrer les commandes slash si nécessaire
        // Cette partie peut être étendue pour utiliser les interactions Discord
    }

    async handleVerifyCommand(message) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🔍 Vérification des Abonnements')
            .setDescription('Vérification de vos abonnements YouTube et Twitch...')
            .setTimestamp();

        const loadingMsg = await message.reply({ embeds: [embed] });

        try {
            const discordId = message.author.id;
            const user = this.db.getUser(discordId);

            if (!user) {
                embed.setColor('#e74c3c')
                    .setDescription('❌ Vous devez d\'abord vous authentifier avec `!oauth`');
                return await loadingMsg.edit({ embeds: [embed] });
            }

            // Vérifier YouTube
            const youtubeResult = await this.checkYouTubeSubscription(discordId);
            
            // Vérifier Twitch
            const twitchFollowResult = await this.checkTwitchFollow(discordId);
            const twitchSubResult = await this.checkTwitchSubscription(discordId);

            // Construire l'embed de résultat
            embed.setColor('#27ae60')
                .setTitle('✅ Résultats de Vérification')
                .setDescription(`Vérification terminée pour <@${message.author.id}>`)
                .addFields(
                    {
                        name: '📺 YouTube',
                        value: youtubeResult.subscribed ? 
                            '✅ Abonné à la chaîne' : 
                            (youtubeResult.needsAuth ? '🔒 Authentification requise' : '❌ Non abonné'),
                        inline: true
                    },
                    {
                        name: '📱 Twitch Follow',
                        value: twitchFollowResult.following ? 
                            '✅ Suit la chaîne' : 
                            (twitchFollowResult.needsAuth ? '🔒 Authentification requise' : '❌ Ne suit pas'),
                        inline: true
                    },
                    {
                        name: '💎 Twitch Sub',
                        value: twitchSubResult.subscribed ? 
                            `✅ Abonné (Tier ${twitchSubResult.tier || 'N/A'})` : 
                            (twitchSubResult.needsAuth ? '🔒 Authentification requise' : '❌ Non abonné'),
                        inline: true
                    }
                );

            // Ajouter des boutons d'action si nécessaire
            const row = new ActionRowBuilder();
            
            if (youtubeResult.needsAuth || twitchFollowResult.needsAuth || twitchSubResult.needsAuth) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('🔐 S\'authentifier')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${this.webUrl}`)
                );
            }

            const components = row.components.length > 0 ? [row] : [];
            await loadingMsg.edit({ embeds: [embed], components });

        } catch (error) {
            console.error('Erreur lors de la vérification:', error);
            embed.setColor('#e74c3c')
                .setDescription('❌ Erreur lors de la vérification des abonnements');
            await loadingMsg.edit({ embeds: [embed] });
        }
    }

    async handleOAuthCommand(message) {
        const discordId = message.author.id;
        const discordUsername = `${message.author.username}#${message.author.discriminator}`;

        // Créer ou mettre à jour l'utilisateur
        this.db.createUser(discordId, discordUsername);

        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🔐 Authentification OAuth2')
            .setDescription('Choisissez les plateformes avec lesquelles vous souhaitez vous authentifier :')
            .addFields(
                {
                    name: '📺 YouTube',
                    value: 'Permet de vérifier vos abonnements YouTube',
                    inline: false
                },
                {
                    name: '📱 Twitch',
                    value: 'Permet de vérifier vos follows et abonnements Twitch',
                    inline: false
                }
            )
            .setFooter({ text: 'Les liens sont sécurisés et utilisent OAuth2 officiel' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 YouTube OAuth')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${this.webUrl}/auth/youtube?discord_id=${discordId}&discord_username=${encodeURIComponent(discordUsername)}`),
                new ButtonBuilder()
                    .setLabel('🔗 Twitch OAuth')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${this.webUrl}/auth/twitch?discord_id=${discordId}&discord_username=${encodeURIComponent(discordUsername)}`)
            );

        await message.reply({ embeds: [embed], components: [row] });
    }

    async handleStatusCommand(message) {
        const discordId = message.author.id;
        const user = this.db.getUser(discordId);

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📊 Statut de votre Compte')
            .setTimestamp();

        if (!user) {
            embed.setDescription('❌ Aucun compte trouvé. Utilisez `!oauth` pour vous authentifier.');
            return await message.reply({ embeds: [embed] });
        }

        const youtubeToken = this.db.getYouTubeToken(user.id);
        const twitchToken = this.db.getTwitchToken(user.id);

        embed.setDescription(`Statut pour <@${message.author.id}>`)
            .addFields(
                {
                    name: '📺 YouTube',
                    value: youtubeToken ? 
                        (this.isTokenExpired(youtubeToken) ? '🟡 Token expiré' : '🟢 Connecté') : 
                        '🔴 Non connecté',
                    inline: true
                },
                {
                    name: '📱 Twitch',
                    value: twitchToken ? 
                        (this.isTokenExpired(twitchToken) ? '🟡 Token expiré' : '🟢 Connecté') : 
                        '🔴 Non connecté',
                    inline: true
                },
                {
                    name: '📅 Compte créé',
                    value: new Date(user.created_at).toLocaleDateString('fr-FR'),
                    inline: true
                }
            );

        // Historique récent
        const history = this.db.getVerificationHistory(user.id, 5);
        if (history.length > 0) {
            const historyText = history.map(h => 
                `${h.platform} ${h.verification_type}: ${h.result} (${new Date(h.checked_at).toLocaleDateString('fr-FR')})`
            ).join('\n');
            
            embed.addFields({
                name: '📋 Vérifications Récentes',
                value: historyText.substring(0, 1024) || 'Aucune vérification récente',
                inline: false
            });
        }

        await message.reply({ embeds: [embed] });
    }

    async handleHelpCommand(message) {
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🤖 Aide - Bot de Vérification OAuth')
            .setDescription('Commandes disponibles :')
            .addFields(
                {
                    name: '`!oauth` ou `!auth`',
                    value: 'Obtenir les liens d\'authentification YouTube/Twitch',
                    inline: false
                },
                {
                    name: '`!verify` ou `!check`',
                    value: 'Vérifier vos abonnements YouTube et Twitch',
                    inline: false
                },
                {
                    name: '`!status`',
                    value: 'Voir le statut de votre compte et l\'historique',
                    inline: false
                },
                {
                    name: '`!disconnect`',
                    value: 'Déconnecter un compte (youtube/twitch/all)',
                    inline: false
                },
                {
                    name: '`!help`',
                    value: 'Afficher cette aide',
                    inline: false
                }
            )
            .setFooter({ text: 'Interface web disponible sur ' + this.webUrl });

        await message.reply({ embeds: [embed] });
    }

    async handleDisconnectCommand(message) {
        const args = message.content.split(' ');
        const platform = args[1]?.toLowerCase();

        if (!platform || !['youtube', 'twitch', 'all'].includes(platform)) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Usage Incorrect')
                .setDescription('Usage: `!disconnect <youtube|twitch|all>`')
                .addFields({
                    name: 'Exemples',
                    value: '• `!disconnect youtube`\n• `!disconnect twitch`\n• `!disconnect all`'
                });
            
            return await message.reply({ embeds: [embed] });
        }

        const discordId = message.author.id;
        const user = this.db.getUser(discordId);

        if (!user) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription('❌ Aucun compte trouvé.');
            return await message.reply({ embeds: [embed] });
        }

        try {
            if (platform === 'all' || platform === 'youtube') {
                const stmt = this.db.db.prepare('DELETE FROM youtube_tokens WHERE user_id = ?');
                stmt.run(user.id);
            }

            if (platform === 'all' || platform === 'twitch') {
                const stmt = this.db.db.prepare('DELETE FROM twitch_tokens WHERE user_id = ?');
                stmt.run(user.id);
            }

            const embed = new EmbedBuilder()
                .setColor('#27ae60')
                .setTitle('✅ Déconnexion Réussie')
                .setDescription(`Votre compte ${platform === 'all' ? 'YouTube et Twitch ont été' : platform + ' a été'} déconnecté avec succès.`);

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription('❌ Erreur lors de la déconnexion');
            await message.reply({ embeds: [embed] });
        }
    }

    async checkYouTubeSubscription(discordId) {
        try {
            const response = await axios.get(`${this.webUrl}/api/youtube/subscription/${discordId}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                return error.response.data;
            }
            return { subscribed: false, error: 'Erreur de connexion au service de vérification' };
        }
    }

    async checkTwitchFollow(discordId) {
        try {
            const response = await axios.get(`${this.webUrl}/api/twitch/follow/${discordId}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                return error.response.data;
            }
            return { following: false, error: 'Erreur de connexion au service de vérification' };
        }
    }

    async checkTwitchSubscription(discordId) {
        try {
            const response = await axios.get(`${this.webUrl}/api/twitch/subscription/${discordId}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                return error.response.data;
            }
            return { subscribed: false, error: 'Erreur de connexion au service de vérification' };
        }
    }

    isTokenExpired(token) {
        if (!token.expires_at) return false;
        return new Date(token.expires_at) <= new Date();
    }

    cleanupExpiredTokens() {
        try {
            const result = this.db.cleanExpiredTokens();
            if (result.youtube > 0 || result.twitch > 0) {
                console.log(`🧹 Tokens expirés nettoyés: ${result.youtube} YouTube, ${result.twitch} Twitch`);
            }
        } catch (error) {
            console.error('Erreur lors du nettoyage des tokens:', error);
        }
    }

    async start() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Erreur lors du démarrage du bot:', error);
            process.exit(1);
        }
    }

    async stop() {
        console.log('⏹️ Arrêt du bot Discord...');
        await this.client.destroy();
        this.db.close();
        console.log('✅ Bot Discord arrêté');
    }
}

// Démarrage du bot
if (require.main === module) {
    const bot = new DiscordBot();
    
    // Gestion propre de l'arrêt
    process.on('SIGTERM', async () => {
        await bot.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        await bot.stop();
        process.exit(0);
    });

    bot.start();
}

module.exports = DiscordBot;