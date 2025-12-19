// Test de la base de données SQLite
const DatabaseManager = require('./src/database/DatabaseManager');

async function testDatabase() {
    console.log('🔄 Test de la base de données...');
    
    try {
        const db = new DatabaseManager('./data/test.db');
        await db.initTables();
        
        console.log('✅ Tables créées avec succès');
        
        // Test création utilisateur
        const result = await db.createUser('123456789', 'TestUser#1234');
        console.log('✅ Utilisateur créé:', result);
        
        // Test récupération utilisateur
        const user = await db.getUser('123456789');
        console.log('✅ Utilisateur récupéré:', user);
        
        // Test token YouTube fictif
        await db.saveYouTubeToken(user.id, {
            access_token: 'test_access_token',
            refresh_token: 'test_refresh_token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/youtube.readonly'
        });
        console.log('✅ Token YouTube sauvegardé');
        
        const token = await db.getYouTubeToken(user.id);
        console.log('✅ Token YouTube récupéré:', token);
        
        // Test log de vérification
        await db.logVerification(user.id, 'youtube', 'subscription', 'subscribed');
        console.log('✅ Log de vérification créé');
        
        const history = await db.getVerificationHistory(user.id, 5);
        console.log('✅ Historique récupéré:', history);
        
        db.close();
        console.log('🎉 Tous les tests sont passés avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    }
}

testDatabase();