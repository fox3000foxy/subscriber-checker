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
        this.dbReady = this.db.initTables(); // Attendre que la DB soit prête
        this.youtubeService = new YouTubeService();
        this.twitchService = new TwitchService(
            process.env.TWITCH_CLIENT_ID,
            process.env.TWITCH_CLIENT_SECRET
        );

        this.webUrl = `http://${process.env.WEB_HOST || 'localhost'}:${process.env.WEB_PORT || 8458}`;
        
        this.setupEventListeners();
        this.registerCommands();
    }

    setupEventListeners() {
        this.client.once('ready', async () => {
            console.log(`🤖 Bot Discord connecté en tant que ${this.client.user.tag}`);
            console.log(`🌐 Interface web disponible sur: ${this.webUrl}`);
            
            // Attendre que la base de données soit prête
            await this.dbReady;
            
            // Nettoyer les tokens expirés au démarrage
            await this.cleanupExpiredTokens();
            
            // Nettoyer les tokens expirés toutes les heures
            setInterval(async () => {
                await this.cleanupExpiredTokens();
            }, 60 * 60 * 1000);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const content = message.content.toLowerCase();
            
            // Commandes d'administration (require permissions)
            if (content.startsWith('!setup') || content.startsWith('!config')) {
                await this.handleSetupCommand(message);
            } else if (content.startsWith('!admin')) {
                await this.handleAdminCommand(message);
            }
            // Commandes utilisateur
            else if (content.startsWith('!verify') || content.startsWith('!check')) {
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
            const guildId = message.guild?.id;
            
            if (!guildId) {
                embed.setColor('#e74c3c')
                    .setDescription('❌ Cette commande ne peut être utilisée qu\'sur un serveur Discord.');
                return await loadingMsg.edit({ embeds: [embed] });
            }
            
            // Vérifier la configuration du serveur
            const guildConfig = await this.db.getGuildConfig(guildId);
            if (!guildConfig) {
                embed.setColor('#e74c3c')
                    .setDescription('❌ Ce serveur n\'est pas encore configuré. Utilisez `!setup` pour le configurer.');
                return await loadingMsg.edit({ embeds: [embed] });
            }
            
            const user = await this.db.getUser(discordId);

            if (!user) {
                embed.setColor('#e74c3c')
                    .setDescription('❌ Vous devez d\'abord vous authentifier avec `!oauth`');
                return await loadingMsg.edit({ embeds: [embed] });
            }

            // Vérifier YouTube
            const youtubeResult = guildConfig.require_youtube ? 
                await this.checkYouTubeSubscription(guildId, discordId) : { subscribed: true };
            
            // Vérifier Twitch
            const twitchFollowResult = guildConfig.require_twitch_follow ? 
                await this.checkTwitchFollow(guildId, discordId) : { following: true };
            const twitchSubResult = guildConfig.require_twitch_sub ? 
                await this.checkTwitchSubscription(guildId, discordId) : { subscribed: true };

            // Vérifier si toutes les conditions sont remplies
            const allConditionsMet = 
                (!guildConfig.require_youtube || youtubeResult.subscribed) &&
                (!guildConfig.require_twitch_follow || twitchFollowResult.following) &&
                (!guildConfig.require_twitch_sub || twitchSubResult.subscribed);
            
            // Attribution automatique du rôle si configuré
            let roleAssigned = false;
            if (guildConfig.auto_assign_role && allConditionsMet && guildConfig.verified_role_id) {
                try {
                    const member = await message.guild.members.fetch(discordId);
                    const role = message.guild.roles.cache.get(guildConfig.verified_role_id);
                    if (role && !member.roles.cache.has(guildConfig.verified_role_id)) {
                        await member.roles.add(role);
                        roleAssigned = true;
                    }
                } catch (error) {
                    console.error('Erreur lors de l\'attribution du rôle:', error);
                }
            }

            // Construire l'embed de résultat
            const resultColor = allConditionsMet ? '#27ae60' : '#e74c3c';
            embed.setColor(resultColor)
                .setTitle(allConditionsMet ? '✅ Vérification Réussie' : '❌ Vérification Échouée')
                .setDescription(`Vérification terminée pour <@${message.author.id}>`)
            
            const fields = [];
            
            if (guildConfig.require_youtube) {
                fields.push({
                    name: '📺 YouTube',
                    value: youtubeResult.subscribed ? 
                        '✅ Abonné à la chaîne' : 
                        (youtubeResult.needsAuth ? '🔒 Authentification requise' : '❌ Non abonné'),
                    inline: true
                });
            }
            
            if (guildConfig.require_twitch_follow) {
                fields.push({
                    name: '📱 Twitch Follow',
                    value: twitchFollowResult.following ? 
                        '✅ Suit la chaîne' : 
                        (twitchFollowResult.needsAuth ? '🔒 Authentification requise' : '❌ Ne suit pas'),
                    inline: true
                });
            }
            
            if (guildConfig.require_twitch_sub) {
                fields.push({
                    name: '💎 Twitch Sub',
                    value: twitchSubResult.subscribed ? 
                        `✅ Abonné (Tier ${twitchSubResult.tier || 'N/A'})` : 
                        (twitchSubResult.needsAuth ? '🔒 Authentification requise' : '❌ Non abonné'),
                    inline: true
                });
            }
            
            if (roleAssigned) {
                fields.push({
                    name: '🏆 Rôle Attribué',
                    value: `✅ Rôle <@&${guildConfig.verified_role_id}> attribué automatiquement`,
                    inline: false
                });
            }
            
            embed.addFields(fields);

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
        await this.db.createUser(discordId, discordUsername);

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
        const user = await this.db.getUser(discordId);

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📊 Statut de votre Compte')
            .setTimestamp();

        if (!user) {
            embed.setDescription('❌ Aucun compte trouvé. Utilisez `!oauth` pour vous authentifier.');
            return await message.reply({ embeds: [embed] });
        }

        const youtubeToken = await this.db.getYouTubeToken(user.id);
        const twitchToken = await this.db.getTwitchToken(user.id);

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
        const history = await this.db.getVerificationHistory(user.id, 5);
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
        const guildId = message.guild?.id;
        const member = guildId ? await message.guild.members.fetch(message.author.id) : null;
        const guildConfig = guildId ? await this.db.getGuildConfig(guildId) : null;
        const isUserAdmin = member ? await this.isAdmin(member, guildConfig) : false;

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🤖 Aide - Bot de Vérification OAuth')
            .setDescription('Commandes disponibles :');

        // Commandes utilisateur
        const userFields = [
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
            }
        ];

        embed.addFields(userFields);

        // Commandes admin si l'utilisateur est admin
        if (isUserAdmin) {
            embed.addFields(
                {
                    name: '**🛠️ Commandes Administrateur**',
                    value: '_(Vous avez les permissions administrateur)_',
                    inline: false
                },
                {
                    name: '`!setup` ou `!config`',
                    value: 'Configurer le serveur (chaînes, rôles, exigences)',
                    inline: false
                }
            );
        }

        embed.addFields(
            {
                name: '`!help`',
                value: 'Afficher cette aide',
                inline: false
            }
        );

        if (guildConfig) {
            embed.addFields({
                name: '📋 Configuration du Serveur',
                value: `• **YouTube**: ${guildConfig.require_youtube ? '✅ Requis' : '❌ Non requis'}\n` +
                       `• **Twitch Follow**: ${guildConfig.require_twitch_follow ? '✅ Requis' : '❌ Non requis'}\n` +
                       `• **Twitch Sub**: ${guildConfig.require_twitch_sub ? '✅ Requis' : '❌ Non requis'}\n` +
                       `• **Auto-rôle**: ${guildConfig.auto_assign_role ? '✅ Activé' : '❌ Désactivé'}`,
                inline: false
            });
        } else if (guildId) {
            embed.addFields({
                name: '⚠️ Serveur Non Configuré',
                value: 'Ce serveur n\'est pas encore configuré. Un administrateur doit utiliser `!setup`.',
                inline: false
            });
        }

        embed.setFooter({ text: 'Interface web: ' + this.webUrl });

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
        const user = await this.db.getUser(discordId);

        if (!user) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription('❌ Aucun compte trouvé.');
            return await message.reply({ embeds: [embed] });
        }

        try {
            const deletePromises = [];
            
            if (platform === 'all' || platform === 'youtube') {
                deletePromises.push(new Promise((resolve, reject) => {
                    this.db.db.run('DELETE FROM youtube_tokens WHERE user_id = ?', [user.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }));
            }

            if (platform === 'all' || platform === 'twitch') {
                deletePromises.push(new Promise((resolve, reject) => {
                    this.db.db.run('DELETE FROM twitch_tokens WHERE user_id = ?', [user.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }));
            }
            
            await Promise.all(deletePromises);

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

    async checkYouTubeSubscription(guildId, discordId) {
        try {
            const response = await axios.get(`${this.webUrl}/api/youtube/subscription/${guildId}/${discordId}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                return error.response.data;
            }
            return { subscribed: false, error: 'Erreur de connexion au service de vérification' };
        }
    }

    async checkTwitchFollow(guildId, discordId) {
        try {
            const response = await axios.get(`${this.webUrl}/api/twitch/follow/${guildId}/${discordId}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                return error.response.data;
            }
            return { following: false, error: 'Erreur de connexion au service de vérification' };
        }
    }

    async checkTwitchSubscription(guildId, discordId) {
        try {
            const response = await axios.get(`${this.webUrl}/api/twitch/subscription/${guildId}/${discordId}`);
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

    async isAdmin(member, guildConfig) {
        // Vérifier si l'utilisateur a les permissions d'administrateur
        if (member.permissions.has('ADMINISTRATOR')) {
            return true;
        }
        
        // Vérifier si l'utilisateur a le rôle d'admin configuré
        if (guildConfig?.admin_role_id && member.roles.cache.has(guildConfig.admin_role_id)) {
            return true;
        }
        
        // Vérifier si l'utilisateur a la permission de gérer le serveur
        if (member.permissions.has('MANAGE_GUILD')) {
            return true;
        }
        
        return false;
    }

    async cleanupExpiredTokens() {
        try {
            const result = await this.db.cleanExpiredTokens();
            if (result.youtube > 0 || result.twitch > 0) {
                console.log(`🧹 Tokens expirés nettoyés: ${result.youtube} YouTube, ${result.twitch} Twitch`);
            }
        } catch (error) {
            console.error('Erreur lors du nettoyage des tokens:', error);
        }
    }

    async handleSetupCommand(message) {
        const guildId = message.guild?.id;
        if (!guildId) {
            return await message.reply('❌ Cette commande ne peut être utilisée que sur un serveur Discord.');
        }

        const member = await message.guild.members.fetch(message.author.id);
        const guildConfig = await this.db.getGuildConfig(guildId);
        
        if (!(await this.isAdmin(member, guildConfig))) {
            return await message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
        }

        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('⚙️ Configuration du Serveur')
            .setDescription(`Configuration pour **${message.guild.name}**`);

        if (guildConfig) {
            embed.addFields(
                {
                    name: '📋 Configuration Actuelle',
                    value: `• **Chaîne YouTube:** ${guildConfig.youtube_channel_id || 'Non configurée'}\n` +
                           `• **Chaîne Twitch:** ${guildConfig.twitch_channel_name || 'Non configurée'}\n` +
                           `• **Rôle vérifié:** ${guildConfig.verified_role_id ? `<@&${guildConfig.verified_role_id}>` : 'Non configuré'}\n` +
                           `• **Attribution auto:** ${guildConfig.auto_assign_role ? '✅' : '❌'}`,
                    inline: false
                },
                {
                    name: '🔍 Exigences',
                    value: `• **YouTube:** ${guildConfig.require_youtube ? '✅' : '❌'}\n` +
                           `• **Twitch Follow:** ${guildConfig.require_twitch_follow ? '✅' : '❌'}\n` +
                           `• **Twitch Sub:** ${guildConfig.require_twitch_sub ? '✅' : '❌'}`,
                    inline: false
                }
            );
        } else {
            embed.addFields({
                name: '⚠️ Aucune Configuration',
                value: 'Ce serveur n\'est pas encore configuré.',
                inline: false
            });
        }

        embed.addFields({
            name: '🔗 Interface Web',
            value: `Utilisez l'interface web pour configurer facilement votre serveur :\n${this.webUrl}/config/guild/${guildId}`,
            inline: false
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 Configurer en Ligne')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${this.webUrl}/config/guild/${guildId}`)
            );

        await message.reply({ embeds: [embed], components: [row] });
    }

    async handleAdminCommand(message) {
        // Cette méthode peut être étendue pour d'autres commandes d'admin
        await message.reply('🛠️ Utilisez `!setup` pour configurer le serveur.');
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