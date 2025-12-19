const axios = require('axios');

class YouTubeService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    }

    /**
     * Vérifie si l'utilisateur est abonné à une chaîne YouTube
     * @param {string} accessToken - Token d'accès YouTube de l'utilisateur
     * @param {string} channelId - ID de la chaîne à vérifier
     * @returns {Promise<{subscribed: boolean, error?: string}>}
     */
    async checkSubscription(accessToken, channelId) {
        try {
            // D'abord, obtenir l'ID du canal de l'utilisateur connecté
            const userResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'id',
                    mine: true,
                    key: this.apiKey
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!userResponse.data.items || userResponse.data.items.length === 0) {
                return { subscribed: false, error: 'Impossible d\'obtenir les informations du compte YouTube' };
            }

            const userChannelId = userResponse.data.items[0].id;

            // Vérifier l'abonnement
            const subscriptionResponse = await axios.get(`${this.baseUrl}/subscriptions`, {
                params: {
                    part: 'snippet',
                    mine: true,
                    forChannelId: channelId,
                    key: this.apiKey
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const isSubscribed = subscriptionResponse.data.items && 
                                subscriptionResponse.data.items.length > 0;

            return { subscribed: isSubscribed };

        } catch (error) {
            console.error('Erreur lors de la vérification YouTube:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                return { subscribed: false, error: 'Token d\'accès YouTube expiré' };
            }
            
            return { subscribed: false, error: 'Erreur lors de la vérification de l\'abonnement YouTube' };
        }
    }

    /**
     * Obtient les informations d'une chaîne YouTube
     * @param {string} channelId - ID de la chaîne
     * @returns {Promise<Object>}
     */
    async getChannelInfo(channelId) {
        try {
            const response = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet,statistics',
                    id: channelId,
                    key: this.apiKey
                }
            });

            if (response.data.items && response.data.items.length > 0) {
                const channel = response.data.items[0];
                return {
                    id: channel.id,
                    title: channel.snippet.title,
                    description: channel.snippet.description,
                    thumbnail: channel.snippet.thumbnails.default.url,
                    subscriberCount: channel.statistics.subscriberCount,
                    videoCount: channel.statistics.videoCount
                };
            }

            return null;
        } catch (error) {
            console.error('Erreur lors de la récupération des infos de chaîne:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Rafraîchit un token d'accès YouTube
     * @param {string} refreshToken - Token de rafraîchissement
     * @param {string} clientId - Client ID Google
     * @param {string} clientSecret - Client Secret Google
     * @returns {Promise<Object>}
     */
    async refreshAccessToken(refreshToken, clientId, clientSecret) {
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            });

            return response.data;
        } catch (error) {
            console.error('Erreur lors du rafraîchissement du token YouTube:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = YouTubeService;