import { database } from './firebase';
import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect
} from 'firebase/database';
import questionsData from '../data/questions.json';

// ─── Fonctions d'accès aux questions ───

export function getCategories() {
  return questionsData.categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    count: c.questions.length
  }));
}

function getQuestionsByCategory(categoryId) {
  if (categoryId === 'all') {
    // Mélanger toutes les questions de toutes les catégories
    return questionsData.categories.flatMap(c => c.questions);
  }
  const category = questionsData.categories.find(c => c.id === categoryId);
  return category ? category.questions : [];
}

// ─── Utilitaires ───

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

// Récupérer ou créer un identifiant joueur persistant dans la session
export function getPlayerId() {
  let id = sessionStorage.getItem('quizPlayerId');
  if (!id) {
    id = generatePlayerId();
    sessionStorage.setItem('quizPlayerId', id);
  }
  return id;
}

// ─── Création de salle ───

export async function createRoom(userName, maxPlayers, questionCount, categoryId = 'all') {
  let roomCode = generateRoomCode();

  // Vérifier que le code n'existe pas déjà
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    const snapshot = await get(ref(database, `rooms/${roomCode}`));
    exists = snapshot.exists();
    if (exists) {
      roomCode = generateRoomCode();
    }
    attempts++;
  }

  // Sélectionner des questions aléatoires de la catégorie choisie
  const availableQuestions = getQuestionsByCategory(categoryId);
  const selectedQuestions = shuffleArray(availableQuestions).slice(0, Math.min(questionCount, availableQuestions.length));

  // Trouver le nom de la catégorie
  const categoryName = categoryId === 'all'
    ? 'Toutes catégories'
    : questionsData.categories.find(c => c.id === categoryId)?.name || 'Quiz';

  const playerId = getPlayerId();

  const roomData = {
    host: playerId,
    maxPlayers,
    categoryId,
    categoryName,
    state: 'lobby', // lobby | playing | results
    currentQuestionIndex: 0,
    questionStartTime: null,
    createdAt: Date.now(),
    players: {
      [playerId]: {
        name: userName,
        score: 0,
        currentAnswer: null,
        joinedAt: Date.now()
      }
    },
    questions: selectedQuestions,
    questionCount: selectedQuestions.length
  };

  await set(ref(database, `rooms/${roomCode}`), roomData);

  // Nettoyer la salle si l'hôte se déconnecte
  const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
  onDisconnect(playerRef).remove();

  return { roomCode, playerId };
}

// ─── Rejoindre une salle ───

export async function joinRoom(roomCode, userName) {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    throw new Error("Le code de la salle est invalide ou la salle n'existe plus.");
  }

  const roomData = snapshot.val();

  if (roomData.state !== 'lobby') {
    throw new Error("La partie a déjà commencé !");
  }

  const currentPlayers = roomData.players ? Object.keys(roomData.players).length : 0;
  if (currentPlayers >= roomData.maxPlayers) {
    throw new Error("La salle est pleine !");
  }

  const playerId = getPlayerId();

  // Vérifier si ce joueur est déjà dans la salle
  if (roomData.players && roomData.players[playerId]) {
    return { roomCode, playerId, roomData };
  }

  await update(ref(database, `rooms/${roomCode}/players/${playerId}`), {
    name: userName,
    score: 0,
    currentAnswer: null,
    joinedAt: Date.now()
  });

  // Nettoyer si le joueur se déconnecte
  const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
  onDisconnect(playerRef).remove();

  // Vérifier si la salle est pleine maintenant → démarrer automatiquement
  const updatedSnapshot = await get(roomRef);
  const updatedData = updatedSnapshot.val();
  const playerCount = updatedData.players ? Object.keys(updatedData.players).length : 0;

  if (playerCount >= updatedData.maxPlayers && updatedData.state === 'lobby') {
    await startGame(roomCode);
  }

  return { roomCode, playerId };
}

// ─── Écouter les changements de la salle ───

export function subscribeToRoom(roomCode, callback) {
  const roomRef = ref(database, `rooms/${roomCode}`);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });

  return unsubscribe;
}

// ─── Démarrer la partie ───

export async function startGame(roomCode) {
  await update(ref(database, `rooms/${roomCode}`), {
    state: 'playing',
    currentQuestionIndex: 0,
    questionStartTime: Date.now()
  });

  // Réinitialiser toutes les réponses
  const snapshot = await get(ref(database, `rooms/${roomCode}/players`));
  if (snapshot.exists()) {
    const players = snapshot.val();
    const updates = {};
    for (const playerId of Object.keys(players)) {
      updates[`rooms/${roomCode}/players/${playerId}/currentAnswer`] = null;
    }
    await update(ref(database), updates);
  }
}

// ─── Soumettre une réponse ───

export async function submitAnswer(roomCode, playerId, answerIndex) {
  await update(ref(database, `rooms/${roomCode}/players/${playerId}`), {
    currentAnswer: answerIndex,
    answerTime: Date.now()
  });

  // Vérifier si tous les joueurs ont répondu
  const snapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const players = roomData.players || {};
  const allAnswered = Object.values(players).every(p => p.currentAnswer !== null && p.currentAnswer !== undefined);

  if (allAnswered) {
    // Tous ont répondu → traiter les résultats immédiatement
    await processQuestionResults(roomCode);
  }
}

// ─── Traiter les résultats d'une question ───

export async function processQuestionResults(roomCode) {
  const snapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  
  // Éviter le double traitement
  if (roomData.state === 'showing_results') return;
  
  const currentQuestion = roomData.questions[roomData.currentQuestionIndex];
  const players = roomData.players || {};

  const updates = {};

  // Calculer les scores
  for (const [playerId, player] of Object.entries(players)) {
    if (player.currentAnswer === currentQuestion.correctOptionIndex) {
      const newScore = (player.score || 0) + 1000;
      updates[`rooms/${roomCode}/players/${playerId}/score`] = newScore;
      updates[`rooms/${roomCode}/players/${playerId}/isCorrectLast`] = true;
    } else {
      updates[`rooms/${roomCode}/players/${playerId}/isCorrectLast`] = false;
    }
  }

  updates[`rooms/${roomCode}/state`] = 'showing_results';
  updates[`rooms/${roomCode}/correctOptionIndex`] = currentQuestion.correctOptionIndex;

  await update(ref(database), updates);
}

// ─── Passer à la question suivante ───

export async function nextQuestion(roomCode) {
  const snapshot = await get(ref(database, `rooms/${roomCode}`));
  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const nextIndex = (roomData.currentQuestionIndex || 0) + 1;

  if (nextIndex >= roomData.questionCount) {
    // Fin du quiz
    await update(ref(database, `rooms/${roomCode}`), {
      state: 'ended'
    });
    return;
  }

  // Réinitialiser les réponses des joueurs
  const players = roomData.players || {};
  const updates = {};
  for (const playerId of Object.keys(players)) {
    updates[`rooms/${roomCode}/players/${playerId}/currentAnswer`] = null;
    updates[`rooms/${roomCode}/players/${playerId}/answerTime`] = null;
    updates[`rooms/${roomCode}/players/${playerId}/isCorrectLast`] = null;
  }

  updates[`rooms/${roomCode}/currentQuestionIndex`] = nextIndex;
  updates[`rooms/${roomCode}/questionStartTime`] = Date.now();
  updates[`rooms/${roomCode}/state`] = 'playing';
  updates[`rooms/${roomCode}/correctOptionIndex`] = null;

  await update(ref(database), updates);
}

// ─── Quitter une salle ───

export async function leaveRoom(roomCode, playerId) {
  await remove(ref(database, `rooms/${roomCode}/players/${playerId}`));

  // Vérifier si la salle est vide
  const snapshot = await get(ref(database, `rooms/${roomCode}/players`));
  if (!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
    await remove(ref(database, `rooms/${roomCode}`));
  }
}

// ─── Supprimer une salle ───

export async function deleteRoom(roomCode) {
  await remove(ref(database, `rooms/${roomCode}`));
}
