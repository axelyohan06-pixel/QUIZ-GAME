import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Trophy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToRoom, submitAnswer, processQuestionResults, nextQuestion, getPlayerId } from '../utils/gameService';

const QUESTION_TIME = 15; // secondes par question
const RESULTS_DELAY = 4000; // ms avant la question suivante

function Game() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [roomData, setRoomData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasProcessedTimeout, setHasProcessedTimeout] = useState(false);

  const userName = location.state?.userName || '';
  const playerId = getPlayerId();
  const unsubscribeRef = useRef(null);
  const timerRef = useRef(null);
  const nextQuestionTimeoutRef = useRef(null);

  // Déterminer qui est l'hôte de façon fiable (survit aux rafraîchissements)
  const isHost = roomData?.host === playerId || location.state?.isHost || false;

  // ─── Abonnement Firebase ───
  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    unsubscribeRef.current = subscribeToRoom(roomId, (data) => {
      if (!data) {
        navigate('/');
        return;
      }
      setRoomData(data);
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextQuestionTimeoutRef.current) clearTimeout(nextQuestionTimeoutRef.current);
    };
  }, [roomId, navigate]);

  // ─── Timer local (100% côté client pour éviter le désynchro des horloges) ───
  useEffect(() => {
    if (!roomData || roomData.state !== 'playing' || !roomData.questions) return;

    // Nettoyer l'ancien timer
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedAnswer(null);
    setHasProcessedTimeout(false);
    setTimeLeft(QUESTION_TIME);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomData?.currentQuestionIndex, roomData?.state]);

  // ─── Quand le temps est écoulé, l'hôte traite les résultats ───
  useEffect(() => {
    if (timeLeft <= 0 && isHost && roomData?.state === 'playing' && !hasProcessedTimeout) {
      setHasProcessedTimeout(true);
      processQuestionResults(roomId).catch(console.error);
    }
  }, [timeLeft, isHost, roomData?.state, roomId, hasProcessedTimeout]);

  // ─── Quand les résultats sont affichés, l'hôte passe à la question suivante après un délai ───
  useEffect(() => {
    if (roomData?.state === 'showing_results' && isHost) {
      if (nextQuestionTimeoutRef.current) clearTimeout(nextQuestionTimeoutRef.current);
      
      nextQuestionTimeoutRef.current = setTimeout(() => {
        nextQuestion(roomId).catch(console.error);
      }, RESULTS_DELAY);
    }

    return () => {
      if (nextQuestionTimeoutRef.current) clearTimeout(nextQuestionTimeoutRef.current);
    };
  }, [roomData?.state, roomData?.currentQuestionIndex, isHost, roomId]);

  // ─── Répondre ───
  const handleSelectAnswer = async (index) => {
    if (selectedAnswer !== null || roomData?.state === 'showing_results') return;
    setSelectedAnswer(index);
    try {
      await submitAnswer(roomId, playerId, index);
    } catch (err) {
      console.error('Erreur soumission réponse:', err);
    }
  };

  // ─── Données dérivées ───
  if (!roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const players = roomData.players ? Object.entries(roomData.players) : [];
  const questions = roomData.questions || [];
  const currentQuestion = questions[roomData.currentQuestionIndex];
  const isShowingResults = roomData.state === 'showing_results';
  const isEnded = roomData.state === 'ended';

  // ─── Écran de fin (Leaderboard) ───
  if (isEnded) {
    const sorted = players
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto flex flex-col items-center justify-center animate-fade-in relative z-10">
        <div className="text-center mb-12">
          <Trophy size={64} className="mx-auto text-warning mb-4 animate-bounce" />
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-warning to-amber-300">
            Podium Final
          </h1>
        </div>

        <div className="glass-panel w-full p-8 md:p-12 mb-8 flex flex-col gap-4">
          {sorted.map((player, index) => (
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              key={player.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${player.id === playerId ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-black/20 border-white/5'} transition-colors`}
            >
              <div className="flex items-center gap-4">
                <span className={`text-2xl font-bold w-8 text-center ${index === 0 ? 'text-warning' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-text-secondary'}`}>
                  #{index + 1}
                </span>
                <span className="text-xl font-medium">{player.name} {player.id === playerId && '(Vous)'}</span>
              </div>
              <span className="text-2xl font-bold tracking-wider">{player.score || 0} pts</span>
            </motion.div>
          ))}
        </div>

        <button onClick={() => navigate('/')} className="btn-primary py-4 px-8 text-lg">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // ─── Attente de la première question ───
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl text-indigo-300 font-semibold tracking-wide">La partie va commencer...</p>
        </div>
      </div>
    );
  }

  // ─── Timer visuel ───
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / QUESTION_TIME) * circumference;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto flex flex-col relative z-10 pt-12">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-12 px-4">
        <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-3">
          <span className="text-text-secondary font-medium tracking-wide uppercase text-sm">Question</span>
          <span className="text-xl font-bold text-white bg-indigo-500/30 px-3 py-1 rounded-md">
            {roomData.currentQuestionIndex + 1} / {roomData.questionCount}
          </span>
        </div>

        <div className="relative flex items-center justify-center w-24 h-24">
          <svg className="transform -rotate-90 w-24 h-24">
            <circle
              className="text-white/10"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="48"
              cy="48"
            />
            <circle
              className={`${timeLeft <= 5 ? 'text-danger' : 'text-success'} transition-colors duration-300`}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="48"
              cy="48"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-danger animate-pulse' : 'text-white'}`}>
              {timeLeft}
            </span>
            <span className="text-[10px] text-white/50 uppercase">sec</span>
          </div>
        </div>
      </div>

      {/* Question */}
      <motion.div 
        key={`q-${roomData.currentQuestionIndex}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel w-full p-8 md:p-12 mb-12 text-center"
      >
        <h2 className="text-3xl md:text-5xl font-extrabold leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">
          {currentQuestion.text}
        </h2>
      </motion.div>

      {/* Réponses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 flex-grow">
        {currentQuestion.options.map((opt, index) => {
          let btnClass = "glass-panel p-6 text-xl font-semibold text-left transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 ";
          let answerIcon = null;

          if (isShowingResults) {
            if (index === roomData.correctOptionIndex) {
              btnClass += "bg-success/20 border-success shadow-[0_0_20px_rgba(16,185,129,0.3)] ";
              answerIcon = <CheckCircle size={28} className="text-success absolute right-6 top-1/2 -translate-y-1/2" />;
            } else if (selectedAnswer === index) {
              btnClass += "bg-danger/20 border-danger ";
              answerIcon = <XCircle size={28} className="text-danger absolute right-6 top-1/2 -translate-y-1/2" />;
            } else {
              btnClass += "opacity-50 ";
            }
          } else {
            if (selectedAnswer === index) {
              btnClass += "bg-indigo-500/40 border-indigo-400 scale-[1.02] shadow-[0_0_20px_rgba(99,102,241,0.4)] ";
            } else {
              btnClass += "hover:bg-white/10 hover:border-white/30 cursor-pointer ";
            }
          }

          return (
            <motion.button 
              key={`${roomData.currentQuestionIndex}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleSelectAnswer(index)}
              disabled={selectedAnswer !== null || isShowingResults}
              className={btnClass}
            >
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-text-secondary font-bold font-display group-hover:bg-black/50 transition-colors">
                  {['A', 'B', 'C', 'D'][index]}
                </span>
                <span className="pr-12">{opt}</span>
              </div>
              {answerIcon}
            </motion.button>
          );
        })}
      </div>

      {/* Overlay résultat */}
      <AnimatePresence>
        {isShowingResults && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-8 max-w-lg mx-auto z-50 pointer-events-none"
          >
            {(() => {
              const myPlayer = roomData.players?.[playerId];
              const isWin = myPlayer?.isCorrectLast;
              
              return (
                <div className={`glass-panel p-6 text-center ${isWin ? 'bg-success/20 border-success' : 'bg-danger/20 border-danger'}`}>
                  <div className="flex flex-col items-center justify-center">
                    {isWin ? (
                      <>
                        <CheckCircle size={48} className="text-success mb-2" />
                        <h3 className="text-2xl font-bold text-success">Bonne Réponse !</h3>
                        <p className="text-white mt-1">Score actuel : {myPlayer?.score || 0} pts</p>
                      </>
                    ) : (
                      <>
                        <XCircle size={48} className="text-danger mb-2" />
                        <h3 className="text-2xl font-bold text-danger">Mauvaise Réponse...</h3>
                        <p className="text-white mt-1">La bonne réponse était : {['A', 'B', 'C', 'D'][roomData.correctOptionIndex]}</p>
                      </>
                    )}
                    <span className="text-sm text-text-secondary mt-4 animate-pulse">Question suivante dans quelques secondes...</span>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Game;
