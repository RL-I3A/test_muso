# MUSO Admin Dashboard Web

Dashboard web de modération pour l'application MUSO - Version web standalone du système d'administration Flutter.

## 🚀 Fonctionnalités

- **Authentification Google** - Connexion sécurisée pour les administrateurs
- **Gestion Utilisateurs** - Bloquer, débloquer et supprimer des utilisateurs
- **Modération Publications** - Masquer, afficher et supprimer des publications
- **Traitement Signalements** - Résoudre et rejeter les signalements utilisateurs
- **Statistiques en Temps Réel** - Vue d'ensemble des métriques importantes
- **Interface Responsive** - Optimisée pour desktop et mobile
- **Thème Sombre** - Design identique à l'application Flutter

## 📋 Prérequis

- Projet Firebase configuré avec :
  - Authentication (Google Provider)
  - Firestore Database
  - Permissions admin configurées
- Hébergement web (GitHub Pages, Netlify, Vercel, etc.)

## 🛠 Installation

### 1. Configuration Firebase

1. **Créer un projet Firebase** (si pas déjà fait)
   - Aller sur [Firebase Console](https://console.firebase.google.com/)
   - Créer un nouveau projet ou utiliser l'existant

2. **Configurer Authentication**
   ```
   Authentication > Sign-in method > Google > Activer
   ```

3. **Configurer Firestore**
   ```
   Firestore Database > Créer une base de données
   ```

4. **Ajouter une application Web**
   ```
   Project Settings > Ajouter une app > Web
   Copier la configuration Firebase
   ```

5. **Mettre à jour la configuration**
   - Ouvrir `js/firebase-config.js`
   - Remplacer les valeurs de `firebaseConfig` par votre configuration

### 2. Structure Firestore Requise

Votre base de données Firestore doit avoir ces collections :

```
users/
  {userId}/
    - email: string
    - displayName: string
    - photoURL: string
    - isAdmin: boolean  ← Important pour les permissions
    - isBlocked: boolean
    - createdAt: timestamp

posts/
  {postId}/
    - title: string
    - content: string
    - authorId: string
    - isHidden: boolean
    - createdAt: timestamp

reports/
  {reportId}/
    - targetType: "user" | "post"
    - targetId: string
    - reporterId: string
    - reason: string
    - status: "pending" | "resolved" | "dismissed"
    - createdAt: timestamp

admin_actions/
  {actionId}/
    - adminId: string
    - action: string
    - targetId: string
    - timestamp: timestamp
```

### 3. Permissions Administrateur

Pour qu'un utilisateur puisse accéder au dashboard :

1. **Via Console Firebase**
   ```
   Firestore > users > {userId} > isAdmin: true
   ```

2. **Via Code (dans votre app Flutter)**
   ```dart
   await FirebaseFirestore.instance
     .collection('users')
     .doc(userId)
     .update({'isAdmin': true});
   ```

## 🌐 Déploiement

### GitHub Pages

1. **Créer un repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MUSO Admin Dashboard"
   git remote add origin https://github.com/USERNAME/muso-admin-dashboard.git
   git push -u origin main
   ```

2. **Activer GitHub Pages**
   ```
   Repository Settings > Pages > Source: Deploy from branch
   Branch: main / root
   ```

3. **Configurer le domaine autorisé dans Firebase**
   ```
   Firebase Console > Authentication > Settings > Authorized domains
   Ajouter: https://USERNAME.github.io
   ```

### Netlify

1. **Drag & Drop**
   - Aller sur [Netlify](https://www.netlify.com/)
   - Glisser le dossier du projet
   - Copier l'URL générée

2. **Autoriser le domaine dans Firebase**
   ```
   Firebase Console > Authentication > Settings > Authorized domains
   Ajouter votre URL Netlify
   ```

### Vercel

1. **Import Project**
   - Aller sur [Vercel](https://vercel.com/)
   - Import Git Repository
   - Sélectionner le repository

2. **Autoriser le domaine dans Firebase**
   ```
   Firebase Console > Authentication > Settings > Authorized domains
   Ajouter votre URL Vercel
   ```

## 🔒 Sécurité

### Règles Firestore Recommandées

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - read for admins, write restricted
    match /users/{userId} {
      allow read: if isAdmin();
      allow write: if isAdmin() || request.auth.uid == userId;
    }
    
    // Posts collection - read for admins
    match /posts/{postId} {
      allow read, write: if isAdmin();
    }
    
    // Reports collection - read/write for admins
    match /reports/{reportId} {
      allow read, write: if isAdmin();
    }
    
    // Admin actions - write only for admins
    match /admin_actions/{actionId} {
      allow read, write: if isAdmin();
    }
    
    // Helper function to check admin status
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

## 📱 Utilisation

### Connexion

1. Ouvrir le dashboard dans le navigateur
2. Cliquer sur "Se connecter avec Google"
3. Autoriser l'application
4. L'accès est accordé si l'utilisateur a le flag `isAdmin: true`

### Navigation

- **Utilisateurs** - Voir, bloquer, débloquer et supprimer des utilisateurs
- **Publications** - Modérer et supprimer des publications
- **Signalements** - Traiter les signalements en attente
- **Statistiques** - Vue d'ensemble des métriques

### Actions Disponibles

#### Gestion Utilisateurs
- ✅ Bloquer un utilisateur
- ✅ Débloquer un utilisateur  
- 🗑️ Supprimer un utilisateur (et ses publications)

#### Modération Publications
- 👁️ Masquer une publication
- 👁️ Afficher une publication masquée
- 🗑️ Supprimer une publication

#### Traitement Signalements
- ✅ Résoudre un signalement
- ❌ Rejeter un signalement

## 🔍 Monitoring

Toutes les actions admin sont loggées automatiquement dans la collection `admin_actions` :

```javascript
{
  adminId: "user123",
  adminEmail: "admin@example.com", 
  action: "block_user",
  targetId: "reported_user456",
  timestamp: "2024-01-15T10:30:00Z",
  source: "web_dashboard"
}
```

## 🆘 Dépannage

### Erreur "Access Denied"
- Vérifier que l'utilisateur a `isAdmin: true` dans Firestore
- Vérifier les règles de sécurité Firestore

### Erreur de Connexion
- Vérifier que le domaine est autorisé dans Firebase Auth
- Vérifier la configuration dans `firebase-config.js`

### Interface Vide
- Ouvrir les DevTools (F12) pour voir les erreurs
- Vérifier que les collections Firestore existent
- Vérifier les permissions de lecture

### CSS/Style Cassé
- Vérifier que les polices Google se chargent
- Vérifier que les Material Icons se chargent
- Tester en mode navigation privée

## 🔄 Synchronisation avec Flutter

Ce dashboard web est conçu pour être 100% compatible avec l'application Flutter MUSO :

- **Même structure de données** Firestore
- **Mêmes permissions** administrateur  
- **Mêmes actions** de modération
- **Même design** et thème visuel

Les actions effectuées sur ce dashboard web sont immédiatement visibles dans l'application Flutter et vice-versa.

## 📞 Support

Pour toute question ou problème :
1. Vérifier cette documentation
2. Consulter les logs du navigateur (F12)
3. Vérifier la configuration Firebase
4. Tester les permissions administrateur

---

**Développé pour MUSO** - Dashboard de modération web autonome  
Compatible avec l'architecture Flutter existante