// Script de démarrage simple pour tester le serveur web
require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.WEB_PORT || 8458;

// Middleware basique
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'web', 'public')));

// Route de test
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'web', 'public', 'index.html'));
});

app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Serveur web fonctionnel !',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

const server = app.listen(PORT, () => {
    console.log(`🌐 Serveur de test démarré sur http://localhost:${PORT}`);
    console.log(`📝 Test API: http://localhost:${PORT}/test`);
    console.log(`🏠 Page d'accueil: http://localhost:${PORT}/`);
});

// Arrêt propre
process.on('SIGINT', () => {
    console.log('\n⏹️ Arrêt du serveur de test...');
    server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
    });
});

module.exports = app;