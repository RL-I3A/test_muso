// Core Firebase initialization and helpers
// Centralized to avoid multiple inits

if (!window._firebaseInitialized) {
  if (!firebase.apps.length) {
    // Assumes firebase-config.js already called firebase.initializeApp
    console.log('🔥 Firebase core ready (firebase.js)');
  }
  window._firebaseInitialized = true;
}

export const db = firebase.firestore();
export const auth = firebase.auth();

// Generic collection fetch with error handling
export async function fetchCollection({ name, limit = 100, orderBy, where }) {
  try {
    let ref = db.collection(name);
    if (where && Array.isArray(where)) {
      where.forEach(w => { ref = ref.where(w[0], w[1], w[2]); });
    }
    if (orderBy) ref = ref.orderBy(orderBy.field, orderBy.direction || 'desc');
    if (limit) ref = ref.limit(limit);
    const snap = await ref.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(`❌ fetchCollection(${name}) failed`, e);
    return [];
  }
}

export function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  return null;
}
