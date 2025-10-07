// Script de test pour vérifier l'accès aux données Firebase
// Ouvrir la console (F12) et coller ce code pour tester

console.log('🧪 Test de connexion Firebase...');

async function testFirebaseData() {
  try {
    console.log('📊 Test 1: Collection "report"');
    const reports = await firebase.firestore().collection('report').limit(5).get();
    console.log('✅ Signalements trouvés:', reports.size);
    
    console.log('\n📊 Test 2: Collection "suspicious_accounts"');
    const suspicious = await firebase.firestore().collection('suspicious_accounts').get();
    console.log('✅ Comptes suspects trouvés:', suspicious.size);
    
    console.log('\n📊 Test 3: Collection "user_reputation"');
    const reputation = await firebase.firestore().collection('user_reputation').get();
    console.log('✅ Réputations trouvées:', reputation.size);
    
    console.log('\n📊 Test 4: Collection "user_actions_log"');
    const actions = await firebase.firestore().collection('user_actions_log').limit(10).get();
    console.log('✅ Actions trouvées:', actions.size);
    
    console.log('\n📊 Test 5: Comptes suspects niveau >= 2');
    const suspiciousFiltered = await firebase.firestore()
      .collection('suspicious_accounts')
      .where('suspicionLevel', '>=', 2)
      .get();
    console.log('✅ Comptes suspects (niveau >= 2):', suspiciousFiltered.size);
    
    console.log('\n📊 Test 6: Utilisateurs avec restrictions');
    const restricted = await firebase.firestore()
      .collection('user_reputation')
      .where('restrictions.canReport', '==', false)
      .get();
    console.log('✅ Utilisateurs restreints:', restricted.size);
    
    console.log('\n📊 Test 7: Signalements dernières 24h');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentReports = await firebase.firestore()
      .collection('report')
      .get();
    let count24h = 0;
    recentReports.docs.forEach(doc => {
      const data = doc.data();
      if (data.timestamp && data.timestamp.toDate) {
        const timestamp = data.timestamp.toDate();
        if (timestamp > yesterday) count24h++;
      }
    });
    console.log('✅ Signalements 24h:', count24h, '/', recentReports.size, 'total');
    
    console.log('\n✅ Tous les tests réussis!');
    console.log('\n📋 Résumé:');
    console.log('- Signalements:', reports.size);
    console.log('- Comptes suspects:', suspiciousFiltered.size);
    console.log('- Actions bloquées:', restricted.size);
    console.log('- Signalements 24h:', count24h);
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  }
}

// Lancer les tests
testFirebaseData();
