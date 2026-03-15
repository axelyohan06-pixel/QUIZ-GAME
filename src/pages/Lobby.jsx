import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Users, Copy, CheckCircle, ArrowLeft, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import { subscribeToRoom, getPlayerId, startGame } from '../utils/gameService';

function Lobby() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const unsubscribeRef = useRef(null);

  const isHost = location.state?.isHost || false;
  const userName = location.state?.userName || '';
  const playerId = getPlayerId();

  useEffect(() => {
    if (!roomId || roomId === 'new') {
      navigate('/');
      return;
    }

    // Écouter les changements de la salle en temps réel
    unsubscribeRef.current = subscribeToRoom(roomId, (data) => {
      if (!data) {
        setError("La salle n'existe plus.");
        return;
      }
      
      setRoomData(data);

      // Si le jeu a commencé, naviguer vers la page de jeu
      if (data.state === 'playing' || data.state === 'showing_results') {
        navigate(`/game/${roomId}`, { state: { userName, isHost, playerId } });
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [roomId, navigate, userName, isHost, playerId]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleForceStart = async () => {
    if (isHost && roomId) {
      try {
        await startGame(roomId);
      } catch (err) {
        console.error('Erreur démarrage:', err);
      }
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-danger mb-4">Erreur</h2>
          <p className="mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="btn-secondary w-full">
            <ArrowLeft size={20} /> Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const players = roomData.players ? Object.entries(roomData.players) : [];
  const currentCount = players.length;
  const maxPlayers = roomData.maxPlayers || 4;
  const progress = (currentCount / maxPlayers) * 100;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto flex flex-col items-center justify-center animate-fade-in relative z-10">
      
      {/* Code du salon */}
      <div className="bg-white/5 border border-white/10 rounded-full px-6 py-2 mb-8 flex items-center gap-3">
        <span className="text-white/60 text-sm uppercase tracking-wider font-semibold">Code :</span>
        <span className="text-2xl font-bold tracking-widest text-indigo-400">{roomId}</span>
        <button 
          onClick={copyCode}
          className="ml-2 p-2 hover:bg-white/10 rounded-full transition-colors"
          title="Copier le code"
        >
          {copied ? <CheckCircle size={20} className="text-success" /> : <Copy size={20} className="text-white/60 hover:text-white" />}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel w-full p-8 md:p-12 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{roomData.categoryName || 'Quiz en attente'}</h1>
            <p className="text-text-secondary flex items-center gap-2">
              <Users size={18} />
              {currentCount} / {maxPlayers} Joueur(s) · {roomData.questionCount} questions
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mb-8">
          <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full rounded-full ${progress >= 100 ? 'bg-gradient-to-r from-success to-emerald-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
            />
          </div>
          <p className="text-sm text-text-secondary mt-2 text-center">
            {currentCount >= maxPlayers 
              ? '✨ Tous les joueurs sont connectés ! La partie va commencer...' 
              : `En attente de ${maxPlayers - currentCount} joueur(s) supplémentaire(s)...`
            }
          </p>
        </div>

        {/* Liste des joueurs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {players.map(([pId, player]) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={pId}
              className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden group"
            >
              {pId === roomData.host && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-warning to-amber-300"></div>
              )}
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xl mb-3">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium truncate w-full">{player.name}</span>
              {pId === roomData.host && (
                <span className="text-xs text-warning mt-1 font-semibold">Hôte</span>
              )}
              {pId === playerId && pId !== roomData.host && (
                <span className="text-xs text-indigo-400 mt-1 font-semibold">Vous</span>
              )}
            </motion.div>
          ))}

          {/* Emplacements vides */}
          {Array.from({ length: maxPlayers - currentCount }).map((_, i) => (
            <div 
              key={`empty-${i}`}
              className="border-2 border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center opacity-40"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Loader size={20} className="text-white/30 animate-spin" />
              </div>
              <span className="text-sm text-white/30">En attente...</span>
            </div>
          ))}
        </div>

        {/* Bouton démarrage forcé pour l'hôte (si au moins 2 joueurs) */}
        {isHost && currentCount >= 2 && currentCount < maxPlayers && (
          <div className="mt-8 text-center">
            <button 
              onClick={handleForceStart}
              className="btn-secondary text-sm py-2 px-6"
            >
              Démarrer maintenant ({currentCount} joueurs)
            </button>
          </div>
        )}
      </motion.div>

      {currentCount >= maxPlayers && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 text-success"
        >
          <div className="w-4 h-4 rounded-full bg-success animate-pulse"></div>
          <span className="font-semibold text-lg">Démarrage automatique en cours...</span>
        </motion.div>
      )}
    </div>
  );
}

export default Lobby;
