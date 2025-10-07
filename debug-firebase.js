// Script de test pour vérifier la configuration Firebase et l'existence du compte admin
// À ouvrir dans la console du navigateur

async function testFirebaseConnection() {
  console.log('🔍 Test de connexion Firebase...');
  
  try {
    // Test 1: Vérifier l'initialisation Firebase
    console.log('1. Vérification de l\'initialisation Firebase...');
    if (!firebase || !firebase.apps || firebase.apps.length === 0) {
      console.error('❌ Firebase n\'est pas initialisé');
      return;
    }
    console.log('✅ Firebase initialisé');
    
    // Test 2: Vérifier Firestore
    console.log('2. Test de connexion Firestore...');
    const db = firebase.firestore();
    
    // Test 3: Lister tous les utilisateurs admin (pour debug)
    console.log('3. Recherche des comptes admin...');
    const usersRef = db.collection('users');
    const adminQuery = usersRef.where('isAdmin', '==', true);
    
    const adminUsers = await adminQuery.get();
    console.log(`✅ Trouvé ${adminUsers.size} compte(s) admin:`);
    
    adminUsers.forEach(doc => {
      const data = doc.data();
      console.log(`  - Email: ${data.email || 'N/A'}, UID: ${doc.id}`);
    });
    
    // Test 4: Vérifier si l'authentification par email est activée
    console.log('4. Test d\'authentification...');
    console.log('⚠️  Maintenant essayez de vous connecter manuellement');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    
    if (error.code === 'permission-denied') {
      console.error('💡 Problème de permissions Firestore - les règles de sécurité bloquent l\'accès');
    } else if (error.code === 'unavailable') {
      console.error('💡 Firestore non disponible - problème de réseau ou de configuration');
    }
  }
}

// Lancer le test
testFirebaseConnection();