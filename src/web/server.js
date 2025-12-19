const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const configRoutes = require('./routes/config');
require('dotenv').config();

const app = express();
const PORT = process.env.WEB_PORT || 8458;

// Middleware
app.use(cors({
    origin: ['http://localhost:8458', 'http://127.0.0.1:8458'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'discord-oauth-bot-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true en production avec HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', verificationRoutes);
app.use('/config', configRoutes);

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de configuration de serveur
app.get('/config/guild/:guildId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// Route de statut
app.get('/status', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        session: req.session.user ? 'authenticated' : 'not authenticated'
    });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
    console.error('Erreur serveur:', error);
    res.status(500).json({ 
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Démarrage du serveur
const server = app.listen(PORT, () => {
    console.log(`🌐 Serveur web démarré sur http://localhost:${PORT}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('⏹️ Arrêt du serveur web...');
    server.close(() => {
        console.log('✅ Serveur web arrêté');
        process.exit(0);
    });
});

module.exports = app;