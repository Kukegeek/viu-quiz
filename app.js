/**
 * VIU Quiz - Aplicación de Test de Ingeniería Web
 * @author VIU Quiz App
 * @version 1.0.0
 */

// ================================
// Estado Global de la Aplicación
// ================================
const APP_STATE = {
    // Datos del quiz
    questions: [],
    modules: {},
    
    // Estado actual del test
    currentTest: {
        mode: null,           // 'mini', 'normal', 'examen', 'ultra', 'module'
        moduleId: null,       // ID del módulo si es modo módulo
        questions: [],        // Preguntas del test actual
        answers: {},          // Respuestas del usuario {questionId: 'A'/'B'/'C'}
        currentIndex: 0,      // Índice de la pregunta actual
        startTime: null,      // Timestamp de inicio
        endTime: null,        // Timestamp de fin
        timeLimit: 0,         // Tiempo límite en segundos
        feedbackEnabled: false,
        score: 0,             // Puntuación actual (para feedback instantáneo)
        finished: false
    },
    
    // Configuración de modos
    modeConfig: {
        mini: { questions: 10, time: 15 * 60 },      // 15 minutos
        normal: { questions: 20, time: 30 * 60 },    // 30 minutos
        examen: { questions: 40, time: 60 * 60 },    // 60 minutos
        ultra: { questions: 64, time: 100 * 60 },    // 100 minutos
        module: { time: 30 * 60 }                     // 30 minutos para módulos
    },
    
    // Timer
    timerInterval: null
};

// ================================
// Storage Manager - localStorage
// ================================
const StorageManager = {
    KEYS: {
        RESULTS: 'viu_quiz_results',
        STATS: 'viu_quiz_stats'
    },
    
    // Obtener resultados guardados
    getResults() {
        try {
            const data = localStorage.getItem(this.KEYS.RESULTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading results:', e);
            return [];
        }
    },
    
    // Guardar un nuevo resultado
    saveResult(result) {
        try {
            const results = this.getResults();
            results.push({
                ...result,
                id: Date.now(),
                date: new Date().toISOString()
            });
            
            // Ordenar por puntuación (mayor a menor), luego por tiempo (menor a mayor)
            results.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.timeSpent - b.timeSpent;
            });
            
            localStorage.setItem(this.KEYS.RESULTS, JSON.stringify(results));
            this.updateStats(results);
            return true;
        } catch (e) {
            console.error('Error saving result:', e);
            return false;
        }
    },
    
    // Obtener los mejores 10 resultados
    getTopResults(limit = 10) {
        const results = this.getResults();
        return results.slice(0, limit);
    },
    
    // Actualizar estadísticas globales
    updateStats(results) {
        if (!results || results.length === 0) {
            localStorage.setItem(this.KEYS.STATS, JSON.stringify({
                totalTests: 0,
                totalCorrect: 0,
                totalQuestions: 0,
                bestScore: 0,
                bestTime: null
            }));
            return;
        }
        
        const stats = {
            totalTests: results.length,
            totalCorrect: results.reduce((sum, r) => sum + r.correct, 0),
            totalQuestions: results.reduce((sum, r) => sum + r.totalQuestions, 0),
            bestScore: results[0]?.score || 0,
            bestTime: results.reduce((min, r) => {
                if (!min) return r.timeSpent;
                return r.timeSpent < min ? r.timeSpent : min;
            }, null)
        };
        
        localStorage.setItem(this.KEYS.STATS, JSON.stringify(stats));
    },
    
    // Obtener estadísticas
    getStats() {
        try {
            const data = localStorage.getItem(this.KEYS.STATS);
            return data ? JSON.parse(data) : {
                totalTests: 0,
                totalCorrect: 0,
                totalQuestions: 0,
                bestScore: 0,
                bestTime: null
            };
        } catch (e) {
            return {
                totalTests: 0,
                totalCorrect: 0,
                totalQuestions: 0,
                bestScore: 0,
                bestTime: null
            };
        }
    },
    
    // Borrar todos los datos
    clearAll() {
        localStorage.removeItem(this.KEYS.RESULTS);
        localStorage.removeItem(this.KEYS.STATS);
    }
};

// ================================
// Quiz Logic
// ================================
const QuizManager = {
    // Cargar datos del archivo JSON
    async loadData() {
        try {
            const response = await fetch('data.json');
            const data = await response.json();
            APP_STATE.questions = data.preguntas;
            APP_STATE.modules = data.bloques;
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error cargando las preguntas. Por favor, recarga la página.');
            return false;
        }
    },
    
    // Obtener preguntas aleatorias
    getRandomQuestions(count, moduleId = null) {
        let pool = [...APP_STATE.questions];
        
        // Filtrar por módulo si es necesario
        if (moduleId) {
            pool = pool.filter(q => q.id_bloque === parseInt(moduleId));
        }
        
        // Mezclar (Fisher-Yates)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        
        // Devolver la cantidad solicitada
        return pool.slice(0, Math.min(count, pool.length));
    },
    
    // Iniciar un test
    startTest(mode, moduleId = null) {
        const config = APP_STATE.modeConfig[mode];
        let questions;
        let timeLimit;
        
        if (mode === 'module' && moduleId) {
            // Modo módulo: todas las preguntas del módulo
            questions = this.getRandomQuestions(Infinity, moduleId);
            timeLimit = config.time;
            APP_STATE.currentTest.moduleId = moduleId;
        } else {
            // Otros modos: número fijo de preguntas aleatorias
            questions = this.getRandomQuestions(config.questions);
            timeLimit = config.time;
        }
        
        // Configurar el test
        APP_STATE.currentTest = {
            mode,
            moduleId: moduleId,
            questions,
            answers: {},
            currentIndex: 0,
            startTime: Date.now(),
            endTime: null,
            timeLimit,
            feedbackEnabled: document.getElementById('feedback-toggle').checked,
            score: 0,
            finished: false
        };
        
        return questions.length > 0;
    },
    
    // Obtener pregunta actual
    getCurrentQuestion() {
        return APP_STATE.currentTest.questions[APP_STATE.currentTest.currentIndex];
    },
    
    // Seleccionar respuesta
    selectAnswer(questionId, answer) {
        const test = APP_STATE.currentTest;
        const question = test.questions.find(q => q.id === questionId);
        
        // Si ya respondió y hay feedback, no permitir cambiar
        if (test.feedbackEnabled && test.answers[questionId]) {
            return null;
        }
        
        test.answers[questionId] = answer;
        
        // Si hay feedback, calcular puntuación
        if (test.feedbackEnabled && question) {
            const isCorrect = answer === question.respuesta_correcta;
            const pointsPerQuestion = 10 / test.questions.length;
            
            if (isCorrect) {
                test.score += pointsPerQuestion;
            } else {
                test.score -= pointsPerQuestion / 3;
            }
            
            // No permitir puntuación negativa
            test.score = Math.max(0, test.score);
            
            return isCorrect;
        }
        
        return null; // Sin feedback
    },
    
    // Calcular resultados finales
    calculateResults() {
        const test = APP_STATE.currentTest;
        test.endTime = Date.now();
        test.finished = true;
        
        const totalQuestions = test.questions.length;
        const pointsPerQuestion = 10 / totalQuestions;
        
        let correct = 0;
        let incorrect = 0;
        let unanswered = 0;
        
        test.questions.forEach(q => {
            const userAnswer = test.answers[q.id];
            if (!userAnswer) {
                unanswered++;
            } else if (userAnswer === q.respuesta_correcta) {
                correct++;
            } else {
                incorrect++;
            }
        });
        
        // Calcular puntuación (si no hay feedback, calcular ahora)
        let score;
        if (test.feedbackEnabled) {
            score = test.score;
        } else {
            score = (correct * pointsPerQuestion) - (incorrect * (pointsPerQuestion / 3));
            score = Math.max(0, score);
        }
        
        const timeSpent = Math.floor((test.endTime - test.startTime) / 1000);
        
        return {
            mode: test.mode,
            moduleId: test.moduleId,
            moduleName: test.moduleId ? APP_STATE.modules[test.moduleId] : null,
            totalQuestions,
            correct,
            incorrect,
            unanswered,
            score: Math.round(score * 100) / 100,
            timeSpent,
            timeLimit: test.timeLimit,
            feedbackEnabled: test.feedbackEnabled
        };
    },
    
    // Navegar a pregunta
    goToQuestion(index) {
        if (index >= 0 && index < APP_STATE.currentTest.questions.length) {
            APP_STATE.currentTest.currentIndex = index;
            return true;
        }
        return false;
    }
};

// ================================
// UI Manager
// ================================
const UIManager = {
    // Elementos DOM
    screens: {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen'),
        results: document.getElementById('results-screen'),
        review: document.getElementById('review-screen')
    },
    
    // Cambiar pantalla
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
    },
    
    // Actualizar estadísticas en home
    updateHomeStats() {
        const stats = StorageManager.getStats();
        const topResults = StorageManager.getTopResults(10);
        
        // Mejor nota de los top 10
        const bestScore = topResults.length > 0 
            ? topResults[0].score.toFixed(2) 
            : '--';
        document.getElementById('best-score').textContent = bestScore;
        
        // Mejor tiempo de los top 10
        if (topResults.length > 0) {
            const bestTime = Math.min(...topResults.map(r => r.timeSpent));
            document.getElementById('best-time').textContent = this.formatTime(bestTime);
        } else {
            document.getElementById('best-time').textContent = '--';
        }
        
        // Porcentaje de acierto global
        if (stats.totalQuestions > 0) {
            const accuracy = ((stats.totalCorrect / stats.totalQuestions) * 100).toFixed(1);
            document.getElementById('accuracy').textContent = accuracy + '%';
        } else {
            document.getElementById('accuracy').textContent = '--';
        }
    },
    
    // Formatear tiempo
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Renderizar pregunta
    renderQuestion() {
        const question = QuizManager.getCurrentQuestion();
        const test = APP_STATE.currentTest;
        
        if (!question) return;
        
        // Actualizar contador
        document.getElementById('question-counter').textContent = 
            `${test.currentIndex + 1}/${test.questions.length}`;
        
        // Actualizar barra de progreso
        const progress = ((test.currentIndex + 1) / test.questions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        
        // Módulo
        const moduleName = APP_STATE.modules[question.id_bloque];
        document.getElementById('question-module').textContent = moduleName;
        
        // Texto de la pregunta
        document.getElementById('question-text').textContent = question.pregunta;
        
        // Puntuación actual (si hay feedback)
        const liveScore = document.getElementById('live-score');
        if (test.feedbackEnabled) {
            liveScore.classList.remove('hidden');
            document.getElementById('current-score').textContent = test.score.toFixed(2);
        } else {
            liveScore.classList.add('hidden');
        }
        
        // Opciones
        const container = document.getElementById('options-container');
        container.innerHTML = '';
        
        const userAnswer = test.answers[question.id];
        const isAnswered = userAnswer !== undefined;
        const isCorrectAnswer = userAnswer === question.respuesta_correcta;
        
        Object.entries(question.opciones).forEach(([key, value]) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.dataset.option = key;
            
            // Si ya respondió con feedback
            if (test.feedbackEnabled && isAnswered) {
                btn.classList.add('disabled');
                
                if (key === question.respuesta_correcta) {
                    btn.classList.add('correct');
                } else if (key === userAnswer && !isCorrectAnswer) {
                    btn.classList.add('incorrect');
                }
            } else if (key === userAnswer) {
                btn.classList.add('selected');
            }
            
            btn.innerHTML = `
                <span class="option-letter">${key}</span>
                <span class="option-text">${value}</span>
            `;
            
            btn.addEventListener('click', () => this.handleOptionClick(question.id, key));
            container.appendChild(btn);
        });
        
        // Botones de navegación
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const finishBtn = document.getElementById('finish-btn');
        
        prevBtn.disabled = test.currentIndex === 0;
        
        const isLast = test.currentIndex === test.questions.length - 1;
        nextBtn.classList.toggle('hidden', isLast);
        finishBtn.classList.toggle('hidden', !isLast);
    },
    
    // Manejar click en opción
    handleOptionClick(questionId, answer) {
        const test = APP_STATE.currentTest;
        
        // Si ya respondió con feedback, ignorar
        if (test.feedbackEnabled && test.answers[questionId]) {
            return;
        }
        
        const result = QuizManager.selectAnswer(questionId, answer);
        
        // Actualizar UI
        this.renderQuestion();
        
        // Si hay feedback, mostrar efecto
        if (test.feedbackEnabled && result !== null) {
            const options = document.querySelectorAll('.option-btn');
            options.forEach(opt => {
                if (result && opt.dataset.option === answer) {
                    opt.classList.add('bounce');
                } else if (!result && opt.dataset.option === answer) {
                    opt.classList.add('shake');
                }
            });
        }
    },
    
    // Iniciar timer
    startTimer() {
        const test = APP_STATE.currentTest;
        const timerDisplay = document.getElementById('timer-display');
        const timerContainer = document.getElementById('timer');
        
        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - test.startTime) / 1000);
            const remaining = Math.max(0, test.timeLimit - elapsed);
            
            timerDisplay.textContent = this.formatTime(remaining);
            
            // Advertencias de tiempo
            timerContainer.classList.remove('warning', 'danger');
            if (remaining <= 60) {
                timerContainer.classList.add('danger');
            } else if (remaining <= 300) {
                timerContainer.classList.add('warning');
            }
            
            // Tiempo agotado
            if (remaining <= 0 && !test.finished) {
                this.finishTest();
            }
        };
        
        updateTimer();
        APP_STATE.timerInterval = setInterval(updateTimer, 1000);
    },
    
    // Detener timer
    stopTimer() {
        if (APP_STATE.timerInterval) {
            clearInterval(APP_STATE.timerInterval);
            APP_STATE.timerInterval = null;
        }
    },
    
    // Finalizar test
    finishTest() {
        this.stopTimer();
        
        const results = QuizManager.calculateResults();
        
        // Guardar resultado
        StorageManager.saveResult(results);
        
        // Mostrar pantalla de resultados
        this.showResults(results);
    },
    
    // Mostrar resultados
    showResults(results) {
        // Icono y título según puntuación
        const icon = document.getElementById('results-icon');
        const title = document.getElementById('results-title');
        
        if (results.score >= 9) {
            icon.textContent = '🏆';
            title.textContent = '¡Excelente!';
        } else if (results.score >= 7) {
            icon.textContent = '🎉';
            title.textContent = '¡Muy bien!';
        } else if (results.score >= 5) {
            icon.textContent = '👍';
            title.textContent = '¡Aprobado!';
        } else {
            icon.textContent = '💪';
            title.textContent = 'Sigue practicando';
        }
        
        // Puntuación circular
        document.getElementById('final-score').textContent = results.score.toFixed(2);
        const scoreCircle = document.getElementById('score-circle');
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (results.score / 10) * circumference;
        
        // Color según puntuación
        if (results.score >= 5) {
            scoreCircle.style.stroke = 'var(--success)';
        } else {
            scoreCircle.style.stroke = 'var(--danger)';
        }
        
        setTimeout(() => {
            scoreCircle.style.strokeDashoffset = offset;
        }, 100);
        
        // Detalles
        document.getElementById('result-time').textContent = this.formatTime(results.timeSpent);
        document.getElementById('result-correct').textContent = results.correct;
        document.getElementById('result-incorrect').textContent = results.incorrect;
        document.getElementById('result-unanswered').textContent = results.unanswered;
        
        // Comparativa con mejores
        const topResults = StorageManager.getTopResults(10);
        if (topResults.length > 0) {
            document.getElementById('compare-best-score').textContent = 
                topResults[0].score.toFixed(2);
            const bestTime = Math.min(...topResults.map(r => r.timeSpent));
            document.getElementById('compare-best-time').textContent = 
                this.formatTime(bestTime);
        }
        
        this.showScreen('results');
    },
    
    // Mostrar revisión
    showReview() {
        const test = APP_STATE.currentTest;
        const container = document.getElementById('review-list');
        container.innerHTML = '';
        
        test.questions.forEach((q, index) => {
            const userAnswer = test.answers[q.id];
            const isCorrect = userAnswer === q.respuesta_correcta;
            const isUnanswered = !userAnswer;
            
            let statusClass = 'unanswered';
            if (!isUnanswered) {
                statusClass = isCorrect ? 'correct' : 'incorrect';
            }
            
            const item = document.createElement('div');
            item.className = `review-item ${statusClass}`;
            
            item.innerHTML = `
                <p class="review-question"><strong>${index + 1}.</strong> ${q.pregunta}</p>
                <p class="review-answer user-answer">
                    Tu respuesta: ${userAnswer 
                        ? `<span class="${isCorrect ? 'correct-text' : 'incorrect-text'}">${userAnswer}. ${q.opciones[userAnswer]}</span>` 
                        : '<span class="incorrect-text">Sin responder</span>'}
                </p>
                ${!isCorrect ? `
                    <p class="review-answer">
                        Correcta: <span class="correct-text">${q.respuesta_correcta}. ${q.opciones[q.respuesta_correcta]}</span>
                    </p>
                ` : ''}
            `;
            
            container.appendChild(item);
        });
        
        this.showScreen('review');
    },
    
    // Mostrar modal de estadísticas
    showStatsModal() {
        const stats = StorageManager.getStats();
        const topResults = StorageManager.getTopResults(10);
        
        // Resumen
        document.getElementById('stats-tests-count').textContent = stats.totalTests;
        
        if (stats.totalTests > 0) {
            const avgScore = topResults.reduce((sum, r) => sum + r.score, 0) / 
                            Math.min(topResults.length, 10);
            document.getElementById('stats-avg-score').textContent = avgScore.toFixed(2);
            
            const accuracy = ((stats.totalCorrect / stats.totalQuestions) * 100).toFixed(1);
            document.getElementById('stats-accuracy').textContent = accuracy + '%';
        } else {
            document.getElementById('stats-avg-score').textContent = '--';
            document.getElementById('stats-accuracy').textContent = '--';
        }
        
        // Lista top 10
        const list = document.getElementById('top-tests-list');
        
        if (topResults.length === 0) {
            list.innerHTML = '<p class="empty-state">Aún no has completado ningún test</p>';
        } else {
            list.innerHTML = topResults.map((r, i) => {
                let rankClass = '';
                if (i === 0) rankClass = 'gold';
                else if (i === 1) rankClass = 'silver';
                else if (i === 2) rankClass = 'bronze';
                
                const modeText = r.moduleId 
                    ? APP_STATE.modules[r.moduleId]?.substring(0, 20) + '...'
                    : r.mode.charAt(0).toUpperCase() + r.mode.slice(1);
                
                return `
                    <div class="top-test-item">
                        <span class="top-rank ${rankClass}">${i + 1}</span>
                        <div class="top-info">
                            <span class="top-score">${r.score.toFixed(2)}/10</span>
                            <span class="top-details">${modeText} · ${r.correct}/${r.totalQuestions} correctas</span>
                        </div>
                        <span class="top-time">${this.formatTime(r.timeSpent)}</span>
                    </div>
                `;
            }).join('');
        }
        
        document.getElementById('stats-modal').classList.add('active');
    },
    
    // Cerrar modal
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },
    
    // Mostrar confirmación
    showConfirm(title, message, onConfirm) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const modal = document.getElementById('confirm-modal');
        modal.classList.add('active');
        
        const confirmBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        
        const handleConfirm = () => {
            modal.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            onConfirm();
        };
        
        const handleCancel = () => {
            modal.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    }
};

// ================================
// Event Listeners
// ================================
function initEventListeners() {
    // Botones de modo
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            if (QuizManager.startTest(mode)) {
                UIManager.showScreen('quiz');
                UIManager.renderQuestion();
                UIManager.startTimer();
            }
        });
    });
    
    // Selector de módulo
    document.getElementById('module-select').addEventListener('change', (e) => {
        const moduleId = e.target.value;
        if (moduleId) {
            if (QuizManager.startTest('module', moduleId)) {
                UIManager.showScreen('quiz');
                UIManager.renderQuestion();
                UIManager.startTimer();
            }
            e.target.value = ''; // Reset selector
        }
    });
    
    // Navegación del quiz
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (QuizManager.goToQuestion(APP_STATE.currentTest.currentIndex - 1)) {
            UIManager.renderQuestion();
        }
    });
    
    document.getElementById('next-btn').addEventListener('click', () => {
        if (QuizManager.goToQuestion(APP_STATE.currentTest.currentIndex + 1)) {
            UIManager.renderQuestion();
        }
    });
    
    // Finalizar test
    document.getElementById('finish-btn').addEventListener('click', () => {
        const test = APP_STATE.currentTest;
        const unanswered = test.questions.length - Object.keys(test.answers).length;
        
        if (unanswered > 0) {
            UIManager.showConfirm(
                '¿Finalizar test?',
                `Tienes ${unanswered} pregunta(s) sin responder. Las preguntas sin responder no suman ni restan puntos.`,
                () => UIManager.finishTest()
            );
        } else {
            UIManager.finishTest();
        }
    });
    
    // Abandonar test
    document.getElementById('quit-btn').addEventListener('click', () => {
        UIManager.showConfirm(
            '¿Abandonar test?',
            'Se perderá todo el progreso de este test.',
            () => {
                UIManager.stopTimer();
                UIManager.showScreen('home');
                UIManager.updateHomeStats();
            }
        );
    });
    
    // Botones de resultados
    document.getElementById('review-btn').addEventListener('click', () => {
        UIManager.showReview();
    });
    
    document.getElementById('retry-btn').addEventListener('click', () => {
        const test = APP_STATE.currentTest;
        if (QuizManager.startTest(test.mode, test.moduleId)) {
            UIManager.showScreen('quiz');
            UIManager.renderQuestion();
            UIManager.startTimer();
        }
    });
    
    document.getElementById('home-btn').addEventListener('click', () => {
        UIManager.showScreen('home');
        UIManager.updateHomeStats();
    });
    
    // Volver de revisión
    document.getElementById('back-results-btn').addEventListener('click', () => {
        UIManager.showScreen('results');
    });
    
    // Modal de estadísticas
    document.getElementById('stats-btn').addEventListener('click', () => {
        UIManager.showStatsModal();
    });
    
    document.getElementById('close-stats').addEventListener('click', () => {
        UIManager.closeModal('stats-modal');
    });
    
    // Borrar datos
    document.getElementById('clear-stats-btn').addEventListener('click', () => {
        UIManager.showConfirm(
            '¿Borrar todos los datos?',
            'Se eliminarán todos los resultados y estadísticas guardados. Esta acción no se puede deshacer.',
            () => {
                StorageManager.clearAll();
                UIManager.closeModal('stats-modal');
                UIManager.updateHomeStats();
            }
        );
    });
    
    // Cerrar modales al hacer click fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// ================================
// Inicialización
// ================================
async function init() {
    // Cargar datos
    const loaded = await QuizManager.loadData();
    if (!loaded) return;
    
    // Actualizar estadísticas
    UIManager.updateHomeStats();
    
    // Inicializar event listeners
    initEventListeners();
    
    console.log('VIU Quiz App initialized');
    console.log(`Loaded ${APP_STATE.questions.length} questions`);
    console.log(`Modules: ${Object.keys(APP_STATE.modules).length}`);
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
