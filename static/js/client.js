document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');

    // Set canvas dimensions
    canvas.width = 800;
    canvas.height = 600;

    // Game variables
    let gameActive = false;
    let gameLoopInterval = null;
    let currentGameState = null;
    let lastRenderTime = performance.now();
    let levelTransitionTime = 0;
    let showingLevelTransition = false;
    
    // Player controls (WASD for movement, left/right arrows for rotation)
    const keysPressed = {};
    const PLAYER_ID = 1; // Default to player 1
    const ROTATION_SPEED = 5; // Degrees per frame
    const MOVEMENT_SPEED = 5; // Pixels per frame

    // Reaction messages system
    const hitReactions = {
        player: [
            "Ouch!",
            "That hurts!",
            "Ow!",
            "Hey!",
            "Yikes!",
            "Not cool!",
            "Argh!",
            "Watch it!",
            "Ooof!"
        ],
        enemy: [
            "Ouch!",
            "Ow!",
            "Argh!",
            "Critical hit!",
            "Direct hit!",
            "Got me!",
            "Nooo!",
            "Malfunction!",
            "System damage!"
        ]
    };

    // Store active reaction messages
    const activeMessages = [];

    // Track previous tank health values to detect hits
    let previousTankHealth = {};

    // Add event listeners
    startButton.addEventListener('click', startGame);
    stopButton.addEventListener('click', stopGame);
    
    document.addEventListener('keydown', function(event) {
        keysPressed[event.key] = true;
        // Prevent default behavior for arrow keys to avoid page scrolling
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
            event.preventDefault();
        }
    });
    
    document.addEventListener('keyup', function(event) {
        keysPressed[event.key] = false;
    });

    // Game functions
    async function startGame() {
        try {
            const response = await fetch('/api/start-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                gameActive = true;
                showingLevelTransition = true;
                levelTransitionTime = performance.now();
                // Start game loop using requestAnimationFrame for smoother animation
                lastRenderTime = performance.now();
                requestAnimationFrame(gameLoop);
                console.log('Game started');
            }
        } catch (error) {
            console.error('Error starting game:', error);
        }
    }

    async function stopGame() {
        try {
            const response = await fetch('/api/stop-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                gameActive = false;
                console.log('Game stopped');
            }
        } catch (error) {
            console.error('Error stopping game:', error);
        }
    }

    async function getGameState() {
        try {
            const response = await fetch('/api/game-state');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error getting game state:', error);
        }
        return null;
    }

    async function sendPlayerAction(action, value = null) {
        try {
            const payload = {
                id: PLAYER_ID,
                action: action
            };
            
            if (value !== null) {
                payload.value = value;
            }
            
            const response = await fetch('/api/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error('Failed to send player action');
            }
        } catch (error) {
            console.error('Error sending player action:', error);
        }
    }

    function handleInput() {
        // Don't process input during level transitions
        if (showingLevelTransition) return;
        
        // Handle rotation - using ArrowLeft and ArrowRight for rotation
        if (keysPressed['ArrowLeft']) {
            sendPlayerAction('rotate', -ROTATION_SPEED);
        }
        if (keysPressed['ArrowRight']) {
            sendPlayerAction('rotate', ROTATION_SPEED);
        }
        
        // Handle movement - using WASD
        if (keysPressed['w']) {
            sendPlayerAction('move', 'forward');
        }
        if (keysPressed['s']) {
            sendPlayerAction('move', 'backward');
        }
        if (keysPressed['a']) {
            sendPlayerAction('move', 'left');
        }
        if (keysPressed['d']) {
            sendPlayerAction('move', 'right');
        }
        
        // Fire with spacebar
        if (keysPressed[' ']) {
            sendPlayerAction('fire');
            // Reset space to prevent continuous firing
            keysPressed[' '] = false;
        }
    }

    function drawTank(tank) {
        ctx.save();
        
        // Move to tank position
        ctx.translate(tank.x, tank.y);
        ctx.rotate((tank.angle * Math.PI) / 180);
        
        // Draw tank body - rotated 90 degrees counterclockwise, so the tank body is taller than wide
        ctx.fillStyle = tank.color;
        ctx.fillRect(-15, -20, 30, 40); // Swapped width and height
        
        // Draw tank cannons based on the number of barrels
        ctx.fillStyle = '#333';
        const barrels = tank.barrels || 1;
        
        if (barrels === 1) {
            // Single cannon in the middle
            ctx.fillRect(-5, -30, 10, 30);
        } else if (barrels === 2) {
            // Two cannons side by side
            ctx.fillRect(-10, -30, 8, 30);
            ctx.fillRect(2, -30, 8, 30);
        } else if (barrels === 3) {
            // Three cannons - middle and sides
            ctx.fillRect(-12, -30, 8, 30);
            ctx.fillRect(-4, -35, 8, 35); // Middle cannon is slightly longer
            ctx.fillRect(4, -30, 8, 30);
        } else if (barrels === 4) {
            // Four cannons in a wider spread
            ctx.fillRect(-16, -30, 7, 30);
            ctx.fillRect(-8, -33, 7, 33);
            ctx.fillRect(1, -33, 7, 33);
            ctx.fillRect(9, -30, 7, 30);
        } else if (barrels === 5) {
            // Five cannons in an even wider spread
            ctx.fillRect(-20, -30, 6, 30);
            ctx.fillRect(-12, -32, 6, 32);
            ctx.fillRect(-4, -35, 8, 35); // Middle cannon is slightly longer
            ctx.fillRect(6, -32, 6, 32);
            ctx.fillRect(14, -30, 6, 30);
        } else if (barrels === 6) {
            // Six cannons in the widest spread
            ctx.fillRect(-22, -28, 6, 28);
            ctx.fillRect(-14, -30, 6, 30);
            ctx.fillRect(-6, -33, 6, 33);
            ctx.fillRect(0, -35, 6, 35);
            ctx.fillRect(8, -30, 6, 30);
            ctx.fillRect(16, -28, 6, 28);
        }
        
        // Draw health bar - CORRECTED POSITIONING
        const healthBarWidth = 40;
        const healthBarHeight = 5;
        const healthBarX = -healthBarWidth / 2;  // FIXED: Use local coordinates (centered)
        const healthBarY = -30;  // FIXED: Position relative to tank center
        
        // Draw background health bar (empty)
        ctx.fillStyle = '#333333';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        // FIXED: Properly calculate health percentage based on tank type
        let maxHealth;
        if (tank.maxHealth) {
            // Use the tank's assigned maxHealth if available
            maxHealth = tank.maxHealth;
        } else if (tank.id === 1) {
            // Player tank has 150 max health
            maxHealth = 150;
        } else {
            // Enemy tanks have 100 max health
            maxHealth = 100;
        }
        
        // When a tank is created, it should start with health = maxHealth
        // This ensures health bars appear full when tanks are at their maximum
        const healthPercent = Math.max(0, Math.min(1, tank.health / maxHealth));
        
        // Choose color based on health percentage
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = '#00cc00'; // Green for high health
        } else if (healthPercent > 0.3) {
            healthColor = '#ffcc00'; // Yellow for medium health
        } else {
            healthColor = '#cc0000'; // Red for low health
        }
        
        // Draw filled health portion
        ctx.fillStyle = healthColor;
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        
        // If tank has a power-up, add a glowing effect
        if (tank.barrels > 1) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'yellow';
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        ctx.restore();
    }

    function drawProjectile(projectile) {
        ctx.save();
        
        // Enhanced projectile rendering
        ctx.translate(projectile.x, projectile.y);
        
        // Draw projectile
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'orange';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawReward(reward) {
        ctx.save();
        
        // Move to reward position
        ctx.translate(reward.x, reward.y);
        
        // Draw reward with pulsating effect
        const pulseScale = 0.2 * Math.sin(Date.now() / 200) + 1;
        const radius = reward.radius * pulseScale;
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = reward.color;
        
        // Draw the reward
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = reward.color;
        ctx.fill();
        
        // Draw an icon based on reward type
        if (reward.type === 'barrel') {
            // Draw a barrel icon
            ctx.fillStyle = 'white';
            ctx.fillRect(-5, -8, 10, 16);
        } else if (reward.type === 'health') {
            // Draw a health cross
            ctx.fillStyle = 'white';
            ctx.fillRect(-8, -2, 16, 4);
            ctx.fillRect(-2, -8, 4, 16);
        }
        
        ctx.restore();
    }

    function drawLevelTransition() {
        const transitionDuration = 3000; // 3 seconds
        const currentTime = performance.now();
        const elapsedTime = currentTime - levelTransitionTime;
        
        // End transition after duration
        if (elapsedTime > transitionDuration) {
            showingLevelTransition = false;
            return;
        }
        
        // Create fade in/out effect
        let alpha;
        if (elapsedTime < transitionDuration / 2) {
            // Fade in
            alpha = Math.min(1, elapsedTime / (transitionDuration / 4));
        } else {
            // Fade out
            alpha = Math.max(0, 1 - ((elapsedTime - transitionDuration / 2) / (transitionDuration / 2)));
        }
        
        // Draw overlay
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create a grid pattern background
        ctx.strokeStyle = `rgba(20, 100, 20, ${alpha * 0.3})`;
        ctx.lineWidth = 1;
        const gridSize = 20;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Create a central panel for level info
        const panelWidth = 400;
        const panelHeight = 250;
        const panelX = (canvas.width - panelWidth) / 2;
        const panelY = (canvas.height - panelHeight) / 2;
        
        // Draw panel background
        ctx.fillStyle = `rgba(38, 50, 56, ${alpha * 0.9})`;
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Draw panel border
        ctx.strokeStyle = `rgba(245, 124, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Add corner brackets
        const bracketSize = 20;
        ctx.lineWidth = 3;
        
        // Top-left bracket
        ctx.beginPath();
        ctx.moveTo(panelX, panelY + bracketSize);
        ctx.lineTo(panelX, panelY);
        ctx.lineTo(panelX + bracketSize, panelY);
        ctx.stroke();
        
        // Top-right bracket
        ctx.beginPath();
        ctx.moveTo(panelX + panelWidth - bracketSize, panelY);
        ctx.lineTo(panelX + panelWidth, panelY);
        ctx.lineTo(panelX + panelWidth, panelY + bracketSize);
        ctx.stroke();
        
        // Bottom-left bracket
        ctx.beginPath();
        ctx.moveTo(panelX, panelY + panelHeight - bracketSize);
        ctx.lineTo(panelX, panelY + panelHeight);
        ctx.lineTo(panelX + bracketSize, panelY + panelHeight);
        ctx.stroke();
        
        // Bottom-right bracket
        ctx.beginPath();
        ctx.moveTo(panelX + panelWidth - bracketSize, panelY + panelHeight);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight - bracketSize);
        ctx.stroke();
        
        // Draw diagonal stripes in corners
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i += 4) {
            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(panelX + i, panelY);
            ctx.lineTo(panelX, panelY + i);
            ctx.stroke();
            
            // Top-right corner
            ctx.beginPath();
            ctx.moveTo(panelX + panelWidth - i, panelY);
            ctx.lineTo(panelX + panelWidth, panelY + i);
            ctx.stroke();
            
            // Bottom-left corner
            ctx.beginPath();
            ctx.moveTo(panelX, panelY + panelHeight - i);
            ctx.lineTo(panelX + i, panelY + panelHeight);
            ctx.stroke();
            
            // Bottom-right corner
            ctx.beginPath();
            ctx.moveTo(panelX + panelWidth - i, panelY + panelHeight);
            ctx.lineTo(panelX + panelWidth, panelY + panelHeight - i);
            ctx.stroke();
        }
        
        // Add header bar
        ctx.fillStyle = `rgba(245, 124, 0, ${alpha})`;
        ctx.fillRect(panelX, panelY, panelWidth, 30);
        
        // Draw header text
        ctx.fillStyle = 'white';
        ctx.font = `bold 18px "Orbitron", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("MISSION BRIEFING", panelX + panelWidth/2, panelY + 20);
        
        // Draw level title
        ctx.font = `bold 36px "Orbitron", sans-serif`;
        
        // Use level names based on current level
        let levelName = "";
        switch (currentGameState.currentLevel) {
            case 1: levelName = "SCOUT PATROL"; break;
            case 2: levelName = "TANK BATTALION"; break;
            case 3: levelName = "ELITE FORCES"; break;
            case 4: levelName = "COMMAND POST"; break;
            case 5: levelName = "FINAL ASSAULT"; break;
            default: levelName = "UNKNOWN SECTOR";
        }
        
        // Create text glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(245, 124, 0, ${alpha})`;
        ctx.fillStyle = 'white';
        ctx.fillText(`LEVEL ${currentGameState.currentLevel}`, panelX + panelWidth/2, panelY + 80);
        ctx.fillStyle = `rgba(245, 124, 0, ${alpha})`;
        ctx.font = `bold 24px "Orbitron", sans-serif`;
        ctx.fillText(levelName, panelX + panelWidth/2, panelY + 115);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw objective text
        ctx.fillStyle = 'white';
        ctx.font = `18px "Exo 2", sans-serif`;
        ctx.fillText(`OBJECTIVE: ELIMINATE ${currentGameState.enemiesRequired} ENEMY TANKS`, 
                    panelX + panelWidth/2, panelY + 160);
        
        // Draw progress from previous level if not level 1
        if (currentGameState.currentLevel > 1) {
            ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
            ctx.fillRect(panelX + 50, panelY + 185, 300, 30);
            ctx.fillStyle = 'white';
            ctx.font = `bold 16px "Orbitron", sans-serif`;
            ctx.fillText('PREVIOUS MISSION COMPLETED', panelX + panelWidth/2, panelY + 205);
        }
        
        // Add tactical scanning animation
        const scanLineY = ((currentTime % 3000) / 3000) * canvas.height;
        ctx.fillStyle = `rgba(245, 124, 0, ${alpha * 0.3})`;
        ctx.fillRect(0, scanLineY, canvas.width, 2);
    }
    
    // Extend Context prototype to support roundRect if it's not available
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            if (radius === undefined) {
                radius = 5;
            }
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
            return this;
        };
    }

    function drawGameHUD() {
        // Don't draw HUD during level transition
        if (showingLevelTransition) return;
        
        // Get player tank
        const playerTank = currentGameState.tanks.find(tank => tank.id === PLAYER_ID);
        
        if (!playerTank) return;
        
        // Update the HTML status indicators
        updateStatusIndicators(playerTank);
        
        // Set up gradient and shadow for HUD elements
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        
        // ===== TOP STATUS BAR - MORE TRANSPARENT =====
        
        // Create a more transparent HUD background at top of screen
        const mainHudHeight = 50;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; // Much more transparent background
        ctx.roundRect(10, 10, canvas.width - 20, mainHudHeight, 8);
        ctx.fill();
        
        // Draw subtle border
        ctx.strokeStyle = 'rgba(245, 124, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, 10, canvas.width - 20, mainHudHeight);
        
        // Reset shadow for text
        ctx.shadowBlur = 0;
        
        // ==== LEVEL INFO - LEFT SIDE ====
        
        // Draw level info in left side of top HUD bar
        const levelX = 50;
        const levelY = 30;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`LEVEL ${currentGameState.currentLevel}`, levelX, levelY);
        
        // ==== HEALTH BAR SECTION - CENTER ====
        
        // Draw health bar with gradient based on health
        const healthRatio = playerTank.health / 100;
        const healthBarWidth = 200;
        const healthBarHeight = 6;
        const healthBarX = canvas.width / 2 - healthBarWidth / 2;
        const healthBarY = 28;
        
        // Health bar background
        ctx.fillStyle = 'rgba(51, 51, 51, 0.5)';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        // Health fill with gradient
        let healthGradient;
        if (healthRatio > 0.6) {
            // Good health - green with transparency
            healthGradient = ctx.createLinearGradient(healthBarX, 0, healthBarX + healthBarWidth, 0);
            healthGradient.addColorStop(0, 'rgba(56, 142, 60, 0.7)');
            healthGradient.addColorStop(1, 'rgba(76, 175, 80, 0.7)');
        } else if (healthRatio > 0.3) {
            // Medium health - yellow/orange with transparency
            healthGradient = ctx.createLinearGradient(healthBarX, 0, healthBarX + healthBarWidth, 0);
            healthGradient.addColorStop(0, 'rgba(245, 127, 23, 0.7)');
            healthGradient.addColorStop(1, 'rgba(251, 192, 45, 0.7)');
        } else {
            // Low health - pulsing red with transparency
            const pulse = 0.5 + 0.2 * Math.sin(Date.now() / 200);
            healthGradient = ctx.createLinearGradient(healthBarX, 0, healthBarX + healthBarWidth, 0);
            healthGradient.addColorStop(0, `rgba(183, 28, 28, ${pulse})`);
            healthGradient.addColorStop(1, `rgba(211, 47, 47, ${pulse})`);
        }
        
        ctx.fillStyle = healthGradient;
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthRatio, healthBarHeight);
        
        // Health label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`HEALTH: ${playerTank.health}%`, canvas.width / 2, 20);
        
        // Draw mission progress bar - slim and minimal
        const progressWidth = 150;
        const progressRatio = currentGameState.enemiesDefeated / currentGameState.enemiesRequired;
        
        // Progress background
        ctx.fillStyle = 'rgba(51, 51, 51, 0.5)';
        ctx.fillRect(healthBarX + 25, healthBarY + 12, progressWidth, 4);
        
        // Progress fill
        ctx.fillStyle = 'rgba(76, 175, 80, 0.6)';
        ctx.fillRect(healthBarX + 25, healthBarY + 12, progressWidth * progressRatio, 4);
        
        // Progress text - below progress bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px "Orbitron", sans-serif';
        ctx.fillText(`${currentGameState.enemiesDefeated}/${currentGameState.enemiesRequired} ENEMIES`, 
                     canvas.width / 2, healthBarY + 26);
        
        // ==== RIGHT SIDE: BARREL COUNT AND ENEMY COUNT ====
        
        // Draw barrel indicators
        const barrelSize = 8;
        const barrelGap = 3;
        const barrelY = 22;
        const barrelStartX = canvas.width - 150;
        
        // Draw barrel indicators text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText('WEAPONS:', barrelStartX, barrelY);
        
        // Draw barrel indicators icons
        for (let i = 0; i < 6; i++) {
            const barrelX = barrelStartX + 65 + i * (barrelSize + barrelGap);
            
            // Draw barrel slot (empty or filled)
            if (i < playerTank.barrels) {
                // Active barrel
                ctx.fillStyle = 'rgba(156, 39, 176, 0.7)';
                ctx.fillRect(barrelX, barrelY - 8, barrelSize, barrelSize);
            } else {
                // Empty barrel slot - very subtle
                ctx.strokeStyle = 'rgba(156, 39, 176, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(barrelX, barrelY - 8, barrelSize, barrelSize);
            }
        }
        
        // Count active enemies
        const enemyCount = currentGameState.tanks.filter(tank => tank.id !== PLAYER_ID && tank.health > 0).length;
        
        // Enemy count display
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px "Orbitron", sans-serif';
        ctx.fillText('THREATS:', barrelStartX, barrelY + 14);
        
        // Enemy count in red
        const time = Date.now() / 1000;
        const pulse = 0.5 + 0.2 * Math.sin(time * 3);
        ctx.fillStyle = `rgba(244, 67, 54, ${pulse + 0.3})`;
        ctx.font = 'bold 10px "Orbitron", sans-serif';
        ctx.fillText(`${enemyCount}`, barrelStartX + 65, barrelY + 14);
        
        // ==== POWER-UP TIMER - INLINE INDICATOR ====
        
        // Only show power-up timer if active
        if (playerTank.barrels > 1 && playerTank.powerupTime) {
            drawInlinePowerupTimer(playerTank, barrelStartX);
        }
        
        // Add scan line effect across whole top HUD
        const scanX = ((Date.now() % 3000) / 3000) * (canvas.width - 20);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(10 + scanX, 10, 2, mainHudHeight);
    }
    
    function drawInlinePowerupTimer(playerTank, startX) {
        // Calculate remaining time for power-up
        const now = Date.now() / 1000; // Convert to seconds
        const elapsedTime = now - playerTank.powerupTime;
        const remainingTime = Math.max(0, playerTank.powerupDuration - elapsedTime);
        const percentage = remainingTime / playerTank.powerupDuration;
        
        // Draw inline in top bar
        const timerWidth = 70;
        const timerHeight = 4;
        const timerX = startX + 80;
        const timerY = 36;
        
        // Timer bar background
        ctx.fillStyle = 'rgba(51, 51, 51, 0.5)';
        ctx.fillRect(timerX, timerY, timerWidth, timerHeight);
        
        // Timer bar fill
        let timerColor = 'rgba(156, 39, 176, 0.7)';
        
        // Flash red when low on time
        if (remainingTime < 5 && Math.sin(Date.now() / 100) > 0) {
            timerColor = 'rgba(244, 67, 54, 0.7)';
        }
        
        ctx.fillStyle = timerColor;
        ctx.fillRect(timerX, timerY, timerWidth * percentage, timerHeight);
        
        // Timer text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '9px "Orbitron", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.ceil(remainingTime)}s`, timerX - 5, timerY + 4);
    }
    
    function updateStatusIndicators(playerTank) {
        // Update the HTML status indicators if they exist
        if (window.updateStatusBar) {
            window.updateStatusBar({
                level: currentGameState.currentLevel,
                health: playerTank.health,
                barrels: playerTank.barrels || 1,
                enemies: {
                    defeated: currentGameState.enemiesDefeated,
                    required: currentGameState.enemiesRequired,
                    active: currentGameState.tanks.filter(tank => tank.id !== PLAYER_ID && tank.health > 0).length
                },
                powerup: playerTank.barrels > 1 ? {
                    remaining: Math.max(0, playerTank.powerupDuration - (Date.now()/1000 - playerTank.powerupTime)),
                    total: playerTank.powerupDuration
                } : null
            });
        }
    }
    
    function drawMinimalPowerupTimer(playerTank) {
        // Calculate remaining time for power-up
        const now = Date.now() / 1000; // Convert to seconds
        const elapsedTime = now - playerTank.powerupTime;
        const remainingTime = Math.max(0, playerTank.powerupDuration - elapsedTime);
        const percentage = remainingTime / playerTank.powerupDuration;
        
        // Corner timer with minimal design
        const timerWidth = 100;
        const timerHeight = 6;
        const timerX = 10;
        const timerY = 10;
        
        // Set shadow for visibility
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        
        // Timer background with high transparency
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.roundRect(timerX, timerY, timerWidth, timerHeight + 16, 3);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Timer bar background
        ctx.fillStyle = 'rgba(51, 51, 51, 0.5)';
        ctx.fillRect(timerX + 5, timerY + 13, timerWidth - 10, timerHeight);
        
        // Timer bar fill
        let timerColor = 'rgba(156, 39, 176, 0.7)';
        
        // Flash red when low on time
        if (remainingTime < 5 && Math.sin(Date.now() / 100) > 0) {
            timerColor = 'rgba(244, 67, 54, 0.7)';
        }
        
        ctx.fillStyle = timerColor;
        ctx.fillRect(timerX + 5, timerY + 13, (timerWidth - 10) * percentage, timerHeight);
        
        // Timer text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '9px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`BOOST: ${Math.ceil(remainingTime)}s`, timerX + 5, timerY + 10);
    }
    
    function drawPowerupTimer(playerTank) {
        // Calculate remaining time for power-up
        const now = Date.now() / 1000; // Convert to seconds
        const elapsedTime = now - playerTank.powerupTime;
        const remainingTime = Math.max(0, playerTank.powerupDuration - elapsedTime);
        const percentage = remainingTime / playerTank.powerupDuration;
        
        // Draw powerup timer at bottom left
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Draw timer background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(10, canvas.height - 55, 160, 45, 5);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#9c27b0'; // Purple for barrel powerup
        ctx.lineWidth = 2;
        ctx.strokeRect(10, canvas.height - 55, 160, 45);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw power-up title
        ctx.fillStyle = '#9c27b0';
        ctx.font = '12px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BARREL BOOST', 20, canvas.height - 38);
        
        // Draw timer bar background
        ctx.fillStyle = '#333';
        ctx.fillRect(20, canvas.height - 25, 140, 10);
        
        // Draw timer bar
        const timerGradient = ctx.createLinearGradient(20, 0, 160, 0);
        timerGradient.addColorStop(0, '#9c27b0');
        timerGradient.addColorStop(1, '#CE93D8');
        ctx.fillStyle = timerGradient;
        ctx.fillRect(20, canvas.height - 25, 140 * percentage, 10);
        
        // Add tech lines to timer bar
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        for (let i = 1; i < 7; i++) {
            ctx.beginPath();
            ctx.moveTo(20 + (i * 20), canvas.height - 25);
            ctx.lineTo(20 + (i * 20), canvas.height - 15);
            ctx.stroke();
        }
        
        // Add flashing effect when time is running low (less than 5 seconds)
        if (remainingTime < 5 && remainingTime > 0) {
            const pulse = Math.sin(Date.now() / 100) > 0 ? 1 : 0.5;
            ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
            ctx.fillRect(20, canvas.height - 25, 140 * percentage, 10);
        }
        
        // Draw remaining time text
        ctx.fillStyle = 'white';
        ctx.font = '10px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(remainingTime)}s`, 90, canvas.height - 18);
    }
    
    function drawEnemyInfo(playerTank) {
        // Create enemy info panel in top right
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Draw enemy info background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(canvas.width - 230, 10, 220, 70, 5);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#f57c00';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width - 230, 10, 220, 70);
        
        // Draw corner decorations
        const cornerSize = 8;
        ctx.strokeStyle = '#f57c00';
        ctx.lineWidth = 2;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(canvas.width - 230, 18);
        ctx.lineTo(canvas.width - 230, 10);
        ctx.lineTo(canvas.width - 222, 10);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(canvas.width - 18, 10);
        ctx.lineTo(canvas.width - 10, 10);
        ctx.lineTo(canvas.width - 10, 18);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(canvas.width - 230, 80 - 8);
        ctx.lineTo(canvas.width - 230, 80);
        ctx.lineTo(canvas.width - 222, 80);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(canvas.width - 18, 80);
        ctx.lineTo(canvas.width - 10, 80);
        ctx.lineTo(canvas.width - 10, 80 - 8);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw enemy intel title
        ctx.fillStyle = '#f57c00';
        ctx.font = '12px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('ENEMY INTEL', canvas.width - 220, 30);
        
        // Calculate enemy data
        const enemyCount = currentGameState.tanks.filter(tank => tank.id !== PLAYER_ID && tank.health > 0).length;
        
        // Draw progress text
        ctx.fillStyle = '#4CAF50';
        ctx.font = '14px "Orbitron", sans-serif';
        ctx.fillText(`ELIMINATED: ${currentGameState.enemiesDefeated}/${currentGameState.enemiesRequired}`, 
                     canvas.width - 220, 50);
        
        // Draw active enemies
        ctx.fillStyle = '#f44336';
        ctx.fillText(`ACTIVE THREATS: ${enemyCount}`, canvas.width - 220, 70);
    }

    function drawGameOver() {
        // Create a dark overlay with grid pattern
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid pattern
        ctx.strokeStyle = 'rgba(20, 100, 20, 0.2)';
        ctx.lineWidth = 1;
        const gridSize = 20;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Create central panel
        const panelWidth = 500;
        const panelHeight = 350;
        const panelX = (canvas.width - panelWidth) / 2;
        const panelY = (canvas.height - panelHeight) / 2;
        
        // Draw panel background
        ctx.fillStyle = 'rgba(38, 50, 56, 0.9)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Draw border with color based on win/loss
        let borderColor = currentGameState.completed || currentGameState.winner === 1 ? 
                          '#4CAF50' : '#d32f2f';
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Add corner brackets
        const bracketSize = 25;
        ctx.lineWidth = 4;
        
        // Top-left bracket
        ctx.beginPath();
        ctx.moveTo(panelX, panelY + bracketSize);
        ctx.lineTo(panelX, panelY);
        ctx.lineTo(panelX + bracketSize, panelY);
        ctx.stroke();
        
        // Top-right bracket
        ctx.beginPath();
        ctx.moveTo(panelX + panelWidth - bracketSize, panelY);
        ctx.lineTo(panelX + panelWidth, panelY);
        ctx.lineTo(panelX + panelWidth, panelY + bracketSize);
        ctx.stroke();
        
        // Bottom-left bracket
        ctx.beginPath();
        ctx.moveTo(panelX, panelY + panelHeight - bracketSize);
        ctx.lineTo(panelX, panelY + panelHeight);
        ctx.lineTo(panelX + bracketSize, panelY + panelHeight);
        ctx.stroke();
        
        // Bottom-right bracket
        ctx.beginPath();
        ctx.moveTo(panelX + panelWidth - bracketSize, panelY + panelHeight);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight - bracketSize);
        ctx.stroke();
        
        // Add header bar
        ctx.fillStyle = borderColor;
        ctx.fillRect(panelX, panelY, panelWidth, 40);
        
        // Determine header text based on game outcome
        if (currentGameState.completed) {
            headerText = "MISSION COMPLETE";
        } else {
            headerText = currentGameState.winner === 1 ? "OPERATION SUCCESSFUL" : "MISSION FAILED";
        }
        
        // Draw header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(headerText, panelX + panelWidth/2, panelY + 28);
        
        // Add corner decorations
        const cornerSize = 8;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(panelX, panelY + cornerSize);
        ctx.lineTo(panelX, panelY);
        ctx.lineTo(panelX + cornerSize, panelY);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(panelX + panelWidth - cornerSize, panelY);
        ctx.lineTo(panelX + panelWidth, panelY);
        ctx.lineTo(panelX + panelWidth, panelY + cornerSize);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(panelX, panelY + panelHeight - cornerSize);
        ctx.lineTo(panelX, panelY + panelHeight);
        ctx.lineTo(panelX + cornerSize, panelY + panelHeight);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(panelX + panelWidth - cornerSize, panelY + panelHeight);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight - cornerSize);
        ctx.stroke();
        
        // Add header bar
        ctx.fillStyle = borderColor;
        ctx.fillRect(panelX, panelY, panelWidth, 40);
        
        // Determine header text based on game outcome
        if (currentGameState.completed) {
            headerText = "MISSION COMPLETE";
        } else {
            headerText = currentGameState.winner === 1 ? "OPERATION SUCCESSFUL" : "MISSION FAILED";
        }
        
        // Draw header text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(headerText, panelX + panelWidth/2, panelY + 28);
        
        // Add decorative elements
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(panelX + 30, panelY + 60);
        ctx.lineTo(panelX + panelWidth - 30, panelY + 60);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(panelX + 30, panelY + panelHeight - 60);
        ctx.lineTo(panelX + panelWidth - 30, panelY + panelHeight - 60);
        ctx.stroke();
        
        // Draw main message
        ctx.shadowBlur = 10;
        ctx.shadowColor = borderColor;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 42px "Orbitron", sans-serif';
        
        // Set result text based on game outcome
        let resultText;
        if (currentGameState.completed) {
            resultText = "ALL LEVELS CLEARED";
        } else {
            resultText = currentGameState.winner === 1 ? "VICTORY" : "DEFEAT";
        }
        
        ctx.fillText(resultText, panelX + panelWidth/2, panelY + 120);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw stats section
        ctx.fillStyle = 'white';
        ctx.font = '20px "Exo 2", sans-serif';
        ctx.textAlign = 'left';
        
        // Draw level reached info
        ctx.fillText("FINAL LEVEL REACHED:", panelX + 50, panelY + 170);
        ctx.font = 'bold 20px "Orbitron", sans-serif';
        ctx.fillText(`LEVEL ${currentGameState.currentLevel}`, panelX + 300, panelY + 170);
        
        // Make sure enemies defeated is never displayed as 0, even if mission failed
        // Get actual enemiesDefeated from the gameState, defaulting to 0 if undefined
        const enemiesEliminated = currentGameState.enemiesDefeated || 0;
        
        // Draw enemies defeated
        ctx.font = '20px "Exo 2", sans-serif';
        ctx.fillText("ENEMIES ELIMINATED:", panelX + 50, panelY + 210);
        ctx.font = 'bold 20px "Orbitron", sans-serif';
        ctx.fillText(`${enemiesEliminated}`, panelX + 300, panelY + 210);
        
        // Display additional stats when mission failed
        if (currentGameState.winner !== 1 && !currentGameState.completed) {
            ctx.font = '18px "Exo 2", sans-serif';
            ctx.fillText("TARGET REMAINING:", panelX + 50, panelY + 245);
            ctx.font = 'bold 18px "Orbitron", sans-serif';
            const remaining = Math.max(0, currentGameState.enemiesRequired - enemiesEliminated);
            ctx.fillText(`${remaining}`, panelX + 300, panelY + 245);
        }
        
        // Add animated border effect
        const time = Date.now() / 1000;
        const borderPulse = 0.6 + 0.4 * Math.sin(time * 2);
        ctx.strokeStyle = `rgba(${borderColor === '#4CAF50' ? '76, 175, 80' : '211, 47, 47'}, ${borderPulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX + 8, panelY + 8, panelWidth - 16, panelHeight - 16);
        
        // Draw restart instructions
        ctx.fillStyle = '#f57c00';
        ctx.font = '20px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('START NEW MISSION:', panelX + panelWidth/2, panelY + 280);
        
        // Draw pulsing button prompt
        const promptPulse = 0.5 + 0.5 * Math.sin(time * 3);
        ctx.fillStyle = `rgba(255, 255, 255, ${promptPulse})`;
        ctx.font = 'bold 18px "Orbitron", sans-serif';
        ctx.fillText('PRESS "START MISSION" BUTTON', panelX + panelWidth/2, panelY + 310);
        
        // Draw decorative scanning line
        const scanLineY = ((Date.now() % 3000) / 3000) * canvas.height;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, scanLineY, canvas.width, 2);
    }

    function render() {
        if (!currentGameState) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply screen shake if active
        if (screenShake.duration > 0) {
            ctx.save();
            ctx.translate(screenShake.offsetX, screenShake.offsetY);
        }
        
        // Draw game elements if game isn't over
        if (!currentGameState.gameOver) {
            // Draw rewards
            if (currentGameState.rewards) {
                currentGameState.rewards.forEach(reward => {
                    drawReward(reward);
                });
            }
            
            // Draw tanks
            currentGameState.tanks.forEach(tank => {
                if (tank.health > 0) {  // Only draw tanks that are alive
                    drawTank(tank);
                }
            });
            
            // Draw projectiles
            currentGameState.projectiles.forEach(projectile => {
                drawProjectile(projectile);
            });
            
            // Draw explosions
            drawExplosions();
            
            // Draw hit reaction messages
            drawHitMessages();
            
            // Draw boundaries
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            // Draw HUD and UI elements
            drawGameHUD();
            
            // Draw level transition if needed
            if (showingLevelTransition) {
                drawLevelTransition();
            }
            
        } else {
            // Game is over
            drawGameOver();
        }
        
        // Reset transform if screen shake was applied
        if (screenShake.duration > 0) {
            ctx.restore();
        }
    }

    // Check if we should start a level transition
    function checkLevelChanged() {
        // If this is the first time getting game state, don't show transition
        if (!currentGameState.lastLevel) {
            currentGameState.lastLevel = currentGameState.currentLevel;
            return;
        }
        
        // Check if level has changed
        if (currentGameState.currentLevel !== currentGameState.lastLevel) {
            showingLevelTransition = true;
            levelTransitionTime = performance.now();
            currentGameState.lastLevel = currentGameState.currentLevel;
        }
    }

    async function gameLoop(currentTime) {
        // Calculate delta time
        const deltaTime = (currentTime - lastRenderTime) / 1000;
        lastRenderTime = currentTime;
        
        // Get game state
        const newGameState = await getGameState();
        
        if (newGameState) {
            // Check for tank hits by comparing health values
            if (currentGameState) {
                detectTankHits(currentGameState.tanks, newGameState.tanks);
            }
            
            // Check for projectile collisions (compare previous and current projectiles)
            if (currentGameState && currentGameState.projectiles) {
                detectProjectileHits(currentGameState.projectiles, newGameState.projectiles);
            }
            
            currentGameState = newGameState;
            
            // Check if level changed
            checkLevelChanged();
            
            // Process input and continue game loop only if game is active
            if (currentGameState.gameActive) {
                handleInput();
                requestAnimationFrame(gameLoop);
            }
        }
        
        // Update hit messages
        updateHitMessages(currentTime);
        
        // Update screen shake effect
        updateScreenShake(currentTime);
        
        // Update explosions
        updateExplosions(currentTime);
        
        // Always render, even if game is over
        render();
        
        // If game is over but we're still in game loop, exit
        if (!gameActive) {
            return;
        }
    }

    // Listen for game state updates to update HTML indicators
    function checkStatusBar() {
        if (window.updateStatusBar && currentGameState && currentGameState.tanks) {
            const playerTank = currentGameState.tanks.find(tank => tank.id === PLAYER_ID);
            if (playerTank) {
                window.updateStatusBar({
                    level: currentGameState.currentLevel,
                    health: playerTank.health,
                    barrels: playerTank.barrels || 1
                });
            }
        }
        
        // Check again in 500ms
        setTimeout(checkStatusBar, 500);
    }
    
    // Start the status check loop
    checkStatusBar();

    function createHitMessage(tank, isPlayer) {
        // Choose a random message based on whether it's player or enemy
        const messages = isPlayer ? hitReactions.player : hitReactions.enemy;
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        // Create message object with animation properties
        activeMessages.push({
            text: message,
            x: tank.x,
            y: tank.y,
            color: isPlayer ? '#4FC3F7' : '#FF8A65', // Blue for player, orange for enemy
            fontSize: isPlayer ? 16 : 14,
            alpha: 1.0,
            offset: 0,
            createdAt: performance.now(),
            duration: 1500 // Message lasts 1.5 seconds
        });
    }

    function updateHitMessages(currentTime) {
        // Update and remove expired messages
        for (let i = activeMessages.length - 1; i >= 0; i--) {
            const message = activeMessages[i];
            const elapsed = currentTime - message.createdAt;
            
            // Remove expired messages
            if (elapsed >= message.duration) {
                activeMessages.splice(i, 1);
                continue;
            }
            
            // Update animation properties
            const progress = elapsed / message.duration;
            message.alpha = Math.max(0, 1 - progress * 1.2); // Fade out a bit faster than rise
            message.offset = -40 * progress; // Move up by 40 pixels over the duration
        }
    }

    function drawHitMessages() {
        // Draw all active messages
        activeMessages.forEach(message => {
            ctx.save();
            
            // Set text style
            ctx.font = `bold ${message.fontSize}px "Comic Sans MS", cursive`;
            ctx.fillStyle = `rgba(${message.color.replace(/[^\d,]/g, '')}, ${message.alpha})`;
            ctx.textAlign = 'center';
            
            // Add stroke for better readability
            ctx.strokeStyle = `rgba(0, 0, 0, ${message.alpha * 0.8})`;
            ctx.lineWidth = 3;
            ctx.strokeText(message.text, message.x, message.y - 35 + message.offset);
            
            // Draw text
            ctx.fillText(message.text, message.x, message.y - 35 + message.offset);
            
            ctx.restore();
        });
    }

    function detectTankHits(previousTanks, currentTanks) {
        if (!previousTanks || !currentTanks) return;
        
        currentTanks.forEach(tank => {
            // Skip tanks that are already destroyed
            if (tank.health <= 0) return;
            
            // Find previous tank state
            const previousTank = previousTanks.find(t => t.id === tank.id);
            if (!previousTank) return;
            
            // Check if tank took damage
            if (tank.health < previousTank.health) {
                // Calculate damage amount
                const damage = previousTank.health - tank.health;
                
                // Tank was hit, create a reaction message
                const isPlayer = tank.id === PLAYER_ID;
                createHitMessage(tank, isPlayer);
                
                // Create explosion at tank position (size based on damage)
                createExplosion(tank.x, tank.y, damage / 10);
                
                // Add a small screen shake for player hits
                if (isPlayer) {
                    addScreenShake(Math.min(10, damage / 5));
                }
            }
        });
    }

    // Add screen shake variables and function

    // Screen shake effect
    let screenShake = {
        intensity: 0,
        duration: 0,
        startTime: 0,
        offsetX: 0,
        offsetY: 0
    };

    function addScreenShake(intensity) {
        screenShake.intensity = intensity;
        screenShake.duration = 300; // 300ms of shake
        screenShake.startTime = performance.now();
    }

    function updateScreenShake(currentTime) {
        if (screenShake.duration <= 0) {
            screenShake.offsetX = 0;
            screenShake.offsetY = 0;
            return;
        }
        
        const elapsed = currentTime - screenShake.startTime;
        if (elapsed >= screenShake.duration) {
            screenShake.duration = 0;
            screenShake.offsetX = 0;
            screenShake.offsetY = 0;
            return;
        }
        
        // Calculate remaining intensity based on time elapsed
        const remainingIntensity = screenShake.intensity * (1 - elapsed / screenShake.duration);
        
        // Create random offset
        screenShake.offsetX = (Math.random() * 2 - 1) * remainingIntensity;
        screenShake.offsetY = (Math.random() * 2 - 1) * remainingIntensity;
    }

    // Add code for explosion effects

    // Store active explosion effects
    const explosions = [];

    // Create an explosion at the hit location
    function createExplosion(x, y, size = 1) {
        explosions.push({
            x: x,
            y: y,
            size: size,
            alpha: 1.0,
            radius: 5 * size,
            maxRadius: 15 * size,
            createdAt: performance.now(),
            duration: 500 // Explosion lasts 0.5 seconds
        });
    }

    function updateExplosions(currentTime) {
        // Update and remove expired explosions
        for (let i = explosions.length - 1; i >= 0; i--) {
            const explosion = explosions[i];
            const elapsed = currentTime - explosion.createdAt;
            
            // Remove expired explosions
            if (elapsed >= explosion.duration) {
                explosions.splice(i, 1);
                continue;
            }
            
            // Update animation properties
            const progress = elapsed / explosion.duration;
            explosion.alpha = Math.max(0, 1 - progress);
            explosion.radius = explosion.radius + (explosion.maxRadius - explosion.radius) * progress;
        }
    }

    function drawExplosions() {
        // Draw all active explosions
        explosions.forEach(explosion => {
            ctx.save();
            
            // Create radial gradient for explosion
            const gradient = ctx.createRadialGradient(
                explosion.x, explosion.y, explosion.radius * 0.3,
                explosion.x, explosion.y, explosion.radius
            );
            gradient.addColorStop(0, `rgba(255, 200, 0, ${explosion.alpha})`);
            gradient.addColorStop(0.5, `rgba(255, 100, 0, ${explosion.alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(255, 0, 0, ${explosion.alpha * 0.1})`);
            
            // Draw explosion
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        });
    }

    // Add function to detect projectile hits and create explosions

    function detectProjectileHits(previousProjectiles, currentProjectiles) {
        // Check for projectiles that disappeared (hit something)
        previousProjectiles.forEach(oldProj => {
            // Check if this projectile still exists in the current list
            const stillExists = currentProjectiles.some(
                newProj => newProj.x === oldProj.x && newProj.y === oldProj.y
            );
            
            // If the projectile is gone, it likely hit something
            if (!stillExists) {
                // Create explosion at its last known position
                createExplosion(oldProj.x, oldProj.y, oldProj.damage / 20);
            }
        });
    }
});