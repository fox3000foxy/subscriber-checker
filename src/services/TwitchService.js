const axios = require('axios');

class TwitchService {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.baseUrl = 'https://api.twitch.tv/helix';
        this.appAccessToken = null;
    }

    /**
     * Obtient un token d'application Twitch (pour les requêtes qui ne nécessitent pas de token utilisateur)
     */
    async getAppAccessToken() {
        if (this.appAccessToken) {
            return this.appAccessToken;
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'client_credentials'
            });

            this.appAccessToken = response.data.access_token;
            return this.appAccessToken;
        } catch (error) {
            console.error('Erreur lors de l\'obtention du token d\'application Twitch:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Obtient les informations d'un utilisateur Twitch à partir de son token
     * @param {string} accessToken - Token d'accès de l'utilisateur
     * @returns {Promise<Object>}
     */
    async getUserInfo(accessToken) {
        try {
            const response = await axios.get(`${this.baseUrl}/users`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': this.clientId
                }
            });

            return response.data.data[0];
        } catch (error) {
            console.error('Erreur lors de la récupération des infos utilisateur Twitch:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Obtient les informations d'un streamer par son nom
     * @param {string} channelName - Nom de la chaîne Twitch
     * @returns {Promise<Object>}
     */
    async getChannelInfo(channelName) {
        try {
            const appToken = await this.getAppAccessToken();
            
            const response = await axios.get(`${this.baseUrl}/users`, {
                params: {
                    login: channelName
                },
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Client-Id': this.clientId
                }
            });

            if (response.data.data && response.data.data.length > 0) {
                return response.data.data[0];
            }

            return null;
        } catch (error) {
            console.error('Erreur lors de la récupération des infos de chaîne Twitch:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Vérifie si l'utilisateur suit une chaîne Twitch
     * @param {string} accessToken - Token d'accès de l'utilisateur
     * @param {string} targetChannelId - ID de la chaîne à vérifier
     * @returns {Promise<{following: boolean, error?: string}>}
     */
    async checkFollow(accessToken, targetChannelId) {
        try {
            // D'abord obtenir l'ID de l'utilisateur
            const userInfo = await this.getUserInfo(accessToken);
            const userId = userInfo.id;

            // Vérifier si l'utilisateur suit la chaîne
            const response = await axios.get(`${this.baseUrl}/channels/followers`, {
                params: {
                    broadcaster_id: targetChannelId,
                    user_id: userId
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': this.clientId
                }
            });

            const isFollowing = response.data.data && response.data.data.length > 0;
            
            return { following: isFollowing };

        } catch (error) {
            console.error('Erreur lors de la vérification du follow Twitch:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                return { following: false, error: 'Token d\'accès Twitch expiré' };
            }
            
            return { following: false, error: 'Erreur lors de la vérification du follow Twitch' };
        }
    }

    /**
     * Vérifie si l'utilisateur est abonné à une chaîne et récupère le tier d'abonnement
     * @param {string} accessToken - Token d'accès de l'utilisateur
     * @param {string} targetChannelId - ID de la chaîne à vérifier
     * @returns {Promise<{subscribed: boolean, tier?: string, error?: string}>}
     */
    async checkSubscription(accessToken, targetChannelId) {
        try {
            // Obtenir l'ID de l'utilisateur
            const userInfo = await this.getUserInfo(accessToken);
            const userId = userInfo.id;

            // Vérifier l'abonnement
            const response = await axios.get(`${this.baseUrl}/subscriptions`, {
                params: {
                    broadcaster_id: targetChannelId,
                    user_id: userId
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': this.clientId
                }
            });

            if (response.data.data && response.data.data.length > 0) {
                const subscription = response.data.data[0];
                return {
                    subscribed: true,
                    tier: subscription.tier,
                    planName: subscription.plan_name,
                    isGift: subscription.is_gift
                };
            }

            return { subscribed: false };

        } catch (error) {
            console.error('Erreur lors de la vérification de l\'abonnement Twitch:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                return { subscribed: false, error: 'Token d\'accès Twitch expiré' };
            }
            
            if (error.response?.status === 404) {
                return { subscribed: false, error: 'Utilisateur non abonné' };
            }
            
            return { subscribed: false, error: 'Erreur lors de la vérification de l\'abonnement Twitch' };
        }
    }

    /**
     * Rafraîchit un token d'accès Twitch
     * @param {string} refreshToken - Token de rafraîchissement
     * @returns {Promise<Object>}
     */
    async refreshAccessToken(refreshToken) {
        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.clientId,
                client_secret: this.clientSecret
            });

            return response.data;
        } catch (error) {
            console.error('Erreur lors du rafraîchissement du token Twitch:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Révoque un token Twitch
     * @param {string} accessToken - Token à révoquer
     */
    async revokeToken(accessToken) {
        try {
            await axios.post('https://id.twitch.tv/oauth2/revoke', {
                client_id: this.clientId,
                token: accessToken
            });
        } catch (error) {
            console.error('Erreur lors de la révocation du token Twitch:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = TwitchService;