import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Zap, Users, ArrowRight, Minus, Plus, Shuffle } from 'lucide-react';
import { motion } from 'framer-motion';
import { createRoom, joinRoom, getPlayerId, getCategories } from '../utils/gameService';

const categories = getCategories();

// Couleurs Tailwind mappées par nom
const colorMap = {
  indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/50', ring: 'ring-indigo-500/40' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50', ring: 'ring-emerald-500/40' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50', ring: 'ring-amber-500/40' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50', ring: 'ring-cyan-500/40' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50', ring: 'ring-orange-500/40' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50', ring: 'ring-pink-500/40' },
  violet: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/50', ring: 'ring-violet-500/40' },
};

function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  // Options de création
  const [hostName, setHostName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!hostName.trim()) {
      setError("Entrez votre pseudo pour créer une salle.");
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const { roomCode: code, playerId } = await createRoom(hostName.trim(), maxPlayers, questionCount, selectedCategory);
      navigate(`/lobby/${code}`, { state: { userName: hostName.trim(), isHost: true, playerId } });
    } catch (err) {
      setError(err.message || "Erreur lors de la création de la salle.");
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !userName.trim()) return;
    setIsJoining(true);
    setError('');
    try {
      const { playerId } = await joinRoom(roomCode.trim().toUpperCase(), userName.trim());
      navigate(`/lobby/${roomCode.trim().toUpperCase()}`, { state: { userName: userName.trim(), isHost: false, playerId } });
    } catch (err) {
      setError(err.message || "Impossible de rejoindre la salle.");
      setIsJoining(false);
    }
  };

  // Calculer le max de questions disponibles pour la catégorie sélectionnée
  const maxAvailable = selectedCategory === 'all'
    ? categories.reduce((sum, c) => sum + c.count, 0)
    : categories.find(c => c.id === selectedCategory)?.count || 30;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-pink-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10 relative z-10"
      >
        <h1 className="text-6xl md:text-7xl font-extrabold mb-4 pb-2">
          <span className="text-gradient">Quiz</span>
          <span className="text-white">Master</span>
        </h1>
        <p className="text-xl text-text-secondary max-w-lg mx-auto leading-relaxed">
          Lancez une salle, défiez vos amis et prouvez qui est le meilleur en temps réel.
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-6 py-3 rounded-xl bg-danger/20 border border-danger/40 text-danger text-sm font-medium max-w-5xl w-full text-center"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full max-w-5xl relative z-10">
        
        {/* Section Créer — plus large */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="glass-panel p-8 flex flex-col lg:col-span-3"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Zap size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Nouvelle Partie</h2>
              <p className="text-text-secondary text-sm">Questions générées automatiquement</p>
            </div>
          </div>
          
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-4 flex-grow">
            <input 
              type="text" 
              placeholder="Votre pseudo" 
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              required
            />

            {/* Sélecteur de catégorie */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Catégorie</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Option Toutes */}
                <button
                  type="button"
                  onClick={() => { setSelectedCategory('all'); setQuestionCount(Math.min(questionCount, maxAvailable)); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    selectedCategory === 'all' 
                      ? 'bg-white/15 border-white/30 text-white ring-2 ring-white/20' 
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Shuffle size={16} />
                  <span>Toutes</span>
                </button>
                {categories.map(cat => {
                  const colors = colorMap[cat.color] || colorMap.indigo;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { setSelectedCategory(cat.id); setQuestionCount(Math.min(questionCount, cat.count)); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        selectedCategory === cat.id 
                          ? `${colors.bg} ${colors.border} ${colors.text} ring-2 ${colors.ring}` 
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-text-secondary mt-1.5">
                {selectedCategory === 'all' 
                  ? `${categories.reduce((s, c) => s + c.count, 0)} questions disponibles` 
                  : `${categories.find(c => c.id === selectedCategory)?.count || 0} questions disponibles`
                }
              </p>
            </div>

            {/* Nombre de joueurs et questions côte à côte */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-sm text-text-secondary font-medium">Joueurs</span>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setMaxPlayers(Math.max(2, maxPlayers - 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-lg font-bold text-indigo-400 w-6 text-center">{maxPlayers}</span>
                  <button 
                    type="button"
                    onClick={() => setMaxPlayers(Math.min(10, maxPlayers + 1))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-sm text-text-secondary font-medium">Questions</span>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setQuestionCount(Math.max(5, questionCount - 5))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-lg font-bold text-purple-400 w-6 text-center">{questionCount}</span>
                  <button 
                    type="button"
                    onClick={() => setQuestionCount(Math.min(maxAvailable, questionCount + 5))}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isCreating}
              className="btn-primary w-full py-4 text-lg mt-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Créer la Salle
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Section Rejoindre */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="glass-panel p-8 flex flex-col items-center lg:col-span-2"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 text-purple-400">
            <Users size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Rejoindre</h2>
          <p className="text-text-secondary mb-6 text-sm text-center">
            Vous avez un code ? Rejoignez la partie.
          </p>
          
          <form onSubmit={handleJoinRoom} className="w-full flex flex-col gap-4 mt-auto">
            <input 
              type="text" 
              placeholder="Votre pseudo" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              required
            />
            <input 
              type="text" 
              placeholder="Code du salon" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium tracking-widest uppercase"
              required
            />
            <button 
              type="submit" 
              disabled={isJoining}
              className="btn-secondary w-full py-4 text-lg group hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Rejoindre
                  <Play size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </motion.div>

      </div>
    </div>
  );
}

export default Home;
