// Co-Breathe Client-Side WebSocket Integration
// Add this to your existing BreathWorx HTML/JavaScript

class CoBreathConnection {
    constructor(serverUrl = 'wss://hearty-optimism-production-2eb6.up.railway.app') {
        this.serverUrl = serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        this.ws = null;
        this.userId = null;
        this.userType = null; // 'participant' or 'family'
        this.roomId = null;
        this.isConnected = false;
        this.familyCount = 0;
        this.callbacks = {
            onConnected: null,
            onRoomCreated: null,
            onRoomJoined: null,
            onFamilyJoined: null,
            onBreathSync: null,
            onSessionStarted: null,
            onSessionCompleted: null,
            onBiometricUpdate: null,
            onFamilyCelebration: null,
            onError: null
        };
    }

    // Initialize WebSocket connection
    connect(userId, userType = 'participant') {
        this.userId = userId;
        this.userType = userType;
        
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('Co-Breathe WebSocket connected');
                this.isConnected = true;
                
                // Register user
                this.send({
                    type: 'register',
                    userId: this.userId,
                    userType: this.userType
                });
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Co-Breathe message parse error:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('Co-Breathe WebSocket disconnected');
                this.isConnected = false;
                this.roomId = null;
                
                // Attempt reconnection after 3 seconds
                setTimeout(() => {
                    if (!this.isConnected) {
                        console.log('Attempting Co-Breathe reconnection...');
                        this.connect(this.userId, this.userType);
                    }
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('Co-Breathe WebSocket error:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            };
            
        } catch (error) {
            console.error('Co-Breathe connection failed:', error);
        }
    }

    // Handle incoming WebSocket messages
    handleMessage(data) {
        switch(data.type) {
            case 'registered':
                console.log('Co-Breathe registration successful');
                if (this.callbacks.onConnected) {
                    this.callbacks.onConnected();
                }
                break;
                
            case 'room_created':
                this.roomId = data.roomId;
                console.log(`Co-Breathe room created: ${this.roomId}`);
                if (this.callbacks.onRoomCreated) {
                    this.callbacks.onRoomCreated(data);
                }
                break;
                
            case 'room_joined':
                this.roomId = data.roomId;
                this.familyCount = data.familyCount;
                console.log(`Co-Breathe room joined: ${this.roomId}`);
                if (this.callbacks.onRoomJoined) {
                    this.callbacks.onRoomJoined(data);
                }
                break;
                
            case 'family_joined':
                this.familyCount = data.familyCount;
                console.log(`Family member joined: ${data.familyMember.relationship}`);
                if (this.callbacks.onFamilyJoined) {
                    this.callbacks.onFamilyJoined(data);
                }
                break;
                
            case 'breath_sync':
                if (this.callbacks.onBreathSync) {
                    this.callbacks.onBreathSync(data);
                }
                break;
                
            case 'family_breath_sync':
                console.log('Family member breathing:', data.phase);
                if (this.callbacks.onBreathSync) {
                    this.callbacks.onBreathSync(data);
                }
                break;
                
            case 'session_started':
                console.log('Co-Breathe session started');
                if (this.callbacks.onSessionStarted) {
                    this.callbacks.onSessionStarted(data);
                }
                break;
                
            case 'session_completed':
                console.log('Co-Breathe session completed');
                if (this.callbacks.onSessionCompleted) {
                    this.callbacks.onSessionCompleted(data);
                }
                break;
                
            case 'family_celebration':
                console.log('Family celebration:', data.message);
                if (this.callbacks.onFamilyCelebration) {
                    this.callbacks.onFamilyCelebration(data);
                }
                break;
                
            case 'biometric_update':
                if (this.callbacks.onBiometricUpdate) {
                    this.callbacks.onBiometricUpdate(data);
                }
                break;
                
            case 'participant_disconnected':
                console.log('Participant disconnected');
                this.roomId = null;
                this.familyCount = 0;
                break;
                
            case 'family_left':
                this.familyCount = data.familyCount;
                console.log(`Family member left. Remaining: ${this.familyCount}`);
                break;
                
            case 'error':
                console.error('Co-Breathe server error:', data.message);
                if (this.callbacks.onError) {
                    this.callbacks.onError(data.message);
                }
                break;
        }
    }

    // Send message to server
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('Co-Breathe WebSocket not connected');
        }
    }

    // Create a new breath room (participant only)
    createRoom(sessionNumber, breathProfile = null, privacySettings = null) {
        if (this.userType !== 'participant') {
            console.error('Only participants can create rooms');
            return;
        }
        
        this.send({
            type: 'create_room',
            sessionNumber: sessionNumber,
            breathProfile: breathProfile,
            privacySettings: privacySettings || {
                shareHRV: false,
                shareCoherence: true
            }
        });
    }

    // Join an existing room (family member)
    joinRoom(roomCode, relationship = 'family') {
        this.send({
            type: 'join_room',
            roomId: roomCode.toUpperCase(),
            relationship: relationship
        });
    }

    // Start session (participant only)
    startSession(sessionData = {}) {
        this.send({
            type: 'session_start',
            ...sessionData
        });
    }

    // Send breath synchronization data
    sendBreathSync(phase, timestamp, sessionProgress = 0, breathCount = 0) {
        this.send({
            type: 'breath_sync',
            phase: phase, // 'inhale', 'hold', 'exhale'
            timestamp: timestamp,
            sessionProgress: sessionProgress,
            breathCount: breathCount
        });
    }

    // Send biometric data (participant only)
    sendBiometricData(biometricData) {
        if (this.userType !== 'participant') return;
        
        this.send({
            type: 'biometric_data',
            timestamp: Date.now(),
            ...biometricData
        });
    }

    // Complete session
    completeSession(sessionResults = {}) {
        this.send({
            type: 'session_complete',
            ...sessionResults
        });
    }

    // Set event callbacks
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase()}${event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`] = callback;
        }
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            userId: this.userId,
            userType: this.userType,
            roomId: this.roomId,
            familyCount: this.familyCount
        };
    }

    // Disconnect
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.roomId = null;
        this.familyCount = 0;
    }
}

// Co-Breathe UI Integration Functions
class CoBreathUI {
    constructor() {
        this.coBreathe = null;
        this.isParticipantMode = true;
        this.currentBreathPhase = 'waiting';
        this.familyIndicators = [];
    }

    // Initialize Co-Breathe system
    initialize(userId, isParticipant = true) {
        this.coBreathe = new CoBreathConnection();
        this.isParticipantMode = isParticipant;
        
        // Set up event handlers
        this.coBreathe.on('connected', () => this.onConnected());
        this.coBreathe.on('roomCreated', (data) => this.onRoomCreated(data));
        this.coBreathe.on('familyJoined', (data) => this.onFamilyJoined(data));
        this.coBreathe.on('breathSync', (data) => this.onBreathSync(data));
        this.coBreathe.on('sessionStarted', (data) => this.onSessionStarted(data));
        this.coBreathe.on('familyCelebration', (data) => this.onFamilyCelebration(data));
        this.coBreathe.on('error', (error) => this.onError(error));
        
        // Connect
        this.coBreathe.connect(userId, isParticipant ? 'participant' : 'family');
        
        // Create UI elements
        this.createCoBreathUI();
    }

    // Create Co-Breathe UI elements
    createCoBreathUI() {
        // Add Co-Breathe panel to existing BreathWorx interface
        const coBreathPanel = document.createElement('div');
        coBreathPanel.id = 'co-breathe-panel';
        coBreathPanel.innerHTML = `
            <div class="co-breathe-container" style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(16, 32, 64, 0.95);
                border: 1px solid rgba(100, 200, 255, 0.3);
                border-radius: 12px;
                padding: 15px;
                min-width: 280px;
                max-width: 320px;
                color: rgba(200, 230, 255, 0.9);
                font-family: system-ui;
                font-size: 14px;
                backdrop-filter: blur(10px);
                z-index: 1000;
                display: none;
            ">
                <div class="co-breathe-header" style="display: flex; align-items: center; margin-bottom: 12px;">
                    <div class="family-connection-dot" style="
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: #ff6b6b;
                        margin-right: 8px;
                    "></div>
                    <span style="font-weight: 500; letter-spacing: 0.5px;">Family Connection</span>
                    <button id="co-breathe-toggle" style="
                        margin-left: auto;
                        background: none;
                        border: none;
                        color: rgba(200, 230, 255, 0.7);
                        cursor: pointer;
                        padding: 4px;
                    ">×</button>
                </div>
                
                <div id="co-breathe-status" class="co-breathe-status">
                    <span>Connecting to family...</span>
                </div>
                
                <div id="co-breathe-actions" class="co-breathe-actions" style="margin-top: 12px;">
                    <!-- Actions will be populated based on participant/family mode -->
                </div>
                
                <div id="co-breathe-family" class="co-breathe-family" style="
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(100, 200, 255, 0.2);
                    display: none;
                ">
                    <div class="family-members" id="family-members"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(coBreathPanel);
        
        // Toggle panel visibility
        document.getElementById('co-breathe-toggle').onclick = () => {
            const panel = document.getElementById('co-breathe-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };
    }

    // Show Co-Breathe panel
    showPanel() {
        const panel = document.querySelector('.co-breathe-container');
        if (panel) {
            panel.style.display = 'block';
        }
    }

    // Update connection status
    updateConnectionStatus(status, message) {
        const statusEl = document.getElementById('co-breathe-status');
        const dotEl = document.querySelector('.family-connection-dot');
        
        if (statusEl) {
            statusEl.textContent = message;
        }
        
        if (dotEl) {
            dotEl.style.background = status === 'connected' ? '#4ade80' : '#ff6b6b';
        }
    }

    // Event handlers
    onConnected() {
        this.updateConnectionStatus('connected', 'Connected to family system');
        this.showPanel();
        
        if (this.isParticipantMode) {
            this.showParticipantActions();
        } else {
            this.showFamilyActions();
        }
    }

    onRoomCreated(data) {
        this.updateConnectionStatus('connected', `Room created: ${data.roomId}`);
        this.showRoomCode(data.roomId);
    }

    onFamilyJoined(data) {
        this.updateConnectionStatus('connected', `${data.familyMember.relationship} joined`);
        this.addFamilyMember(data.familyMember);
    }

    onBreathSync(data) {
        // Sync breath visualization with family member's breathing
        if (!this.isParticipantMode) {
            this.syncWithParticipantBreath(data);
        }
    }

    onSessionStarted(data) {
        this.updateConnectionStatus('active', 'Family session active');
        if (data.familyCount > 0) {
            this.showSessionActive(data.familyCount);
        }
    }

    onFamilyCelebration(data) {
        this.showCelebration(data.message);
    }

    onError(error) {
        this.updateConnectionStatus('error', `Error: ${error}`);
        console.error('Co-Breathe error:', error);
    }

    // Show participant actions
    showParticipantActions() {
        const actionsEl = document.getElementById('co-breathe-actions');
        actionsEl.innerHTML = `
            <button onclick="coBreathUI.createFamilySession()" style="
                width: 100%;
                background: linear-gradient(135deg, #3b82f6, #1e40af);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
                cursor: pointer;
                margin-bottom: 8px;
            ">Share with Family</button>
            
            <div class="privacy-settings" style="font-size: 12px; color: rgba(200, 230, 255, 0.7);">
                <label><input type="checkbox" id="share-coherence" checked> Share coherence score</label><br>
                <label><input type="checkbox" id="share-hrv"> Share heart rate</label>
            </div>
        `;
    }

    // Show family member actions  
    showFamilyActions() {
        const actionsEl = document.getElementById('co-breathe-actions');
        actionsEl.innerHTML = `
            <input type="text" id="room-code-input" placeholder="Enter room code" style="
                width: 100%;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(100, 200, 255, 0.3);
                border-radius: 4px;
                padding: 8px;
                color: white;
                margin-bottom: 8px;
                font-size: 13px;
            ">
            <button onclick="coBreathUI.joinFamilySession()" style="
                width: 100%;
                background: linear-gradient(135deg, #10b981, #047857);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
                cursor: pointer;
            ">Join Family Session</button>
        `;
    }

    // Create family session (participant)
    createFamilySession() {
        const sessionNumber = parseInt(document.getElementById('sessionSelect')?.value || '1');
        const shareCoherence = document.getElementById('share-coherence')?.checked || true;
        const shareHRV = document.getElementById('share-hrv')?.checked || false;
        
        this.coBreathe.createRoom(sessionNumber, null, {
            shareCoherence: shareCoherence,
            shareHRV: shareHRV
        });
    }

    // Join family session (family member)
    joinFamilySession() {
        const roomCode = document.getElementById('room-code-input')?.value.trim();
        if (roomCode) {
            this.coBreathe.joinRoom(roomCode, 'family');
        }
    }

    // Show room code for family to join
    showRoomCode(roomId) {
        const actionsEl = document.getElementById('co-breathe-actions');
        actionsEl.innerHTML = `
            <div style="text-align: center; margin: 12px 0;">
                <div style="font-size: 11px; color: rgba(200, 230, 255, 0.7); margin-bottom: 4px;">
                    Family Room Code:
                </div>
                <div style="
                    font-size: 24px;
                    font-weight: bold;
                    letter-spacing: 4px;
                    background: rgba(59, 130, 246, 0.2);
                    padding: 8px 16px;
                    border-radius: 6px;
                    color: #60a5fa;
                ">${roomId}</div>
                <div style="font-size: 11px; color: rgba(200, 230, 255, 0.5); margin-top: 4px;">
                    Share this code with family
                </div>
            </div>
            <button onclick="coBreathUI.startSharedSession()" style="
                width: 100%;
                background: linear-gradient(135deg, #10b981, #047857);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
                cursor: pointer;
                margin-top: 8px;
            ">Start Session</button>
        `;
    }

    // Start shared session
    startSharedSession() {
        // Begin the breath session with family connected
        this.coBreathe.startSession();
        
        // Hook into existing BreathWorx session start
        if (typeof startBreathSession === 'function') {
            startBreathSession();
        }
    }

    // Add family member indicator
    addFamilyMember(member) {
        const familyEl = document.getElementById('co-breathe-family');
        const membersEl = document.getElementById('family-members');
        
        familyEl.style.display = 'block';
        
        const memberDiv = document.createElement('div');
        memberDiv.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                margin: 4px 0;
                font-size: 12px;
            ">
                <div style="
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #4ade80;
                    margin-right: 8px;
                "></div>
                <span>${member.relationship || 'Family'} connected</span>
            </div>
        `;
        
        membersEl.appendChild(memberDiv);
    }

    // Show celebration message
    showCelebration(message) {
        // Create celebration overlay
        const celebration = document.createElement('div');
        celebration.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #10b981, #047857);
                color: white;
                padding: 20px 30px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 500;
                text-align: center;
                z-index: 10000;
                animation: celebrationPulse 2s ease-in-out;
            ">
                🎉 ${message} 🎉
            </div>
        `;
        
        document.body.appendChild(celebration);
        
        // Remove after 3 seconds
        setTimeout(() => {
            celebration.remove();
        }, 3000);
    }

    // Integrate with existing breath session
    integrateWithBreathSession() {
        // Hook into existing breath phase changes
        const originalBreathPhaseUpdate = window.updateBreathPhase || (() => {});
        
        window.updateBreathPhase = (phase) => {
            // Call original function
            originalBreathPhaseUpdate(phase);
            
            // Send to family if connected
            if (this.coBreathe && this.coBreathe.roomId) {
                this.coBreathe.sendBreathSync(
                    phase,
                    Date.now(),
                    window.sessionProgress || 0,
                    window.breathCount || 0
                );
            }
        };
        
        // Hook into session completion
        const originalSessionComplete = window.onSessionComplete || (() => {});
        
        window.onSessionComplete = (results) => {
            // Call original function
            originalSessionComplete(results);
            
            // Notify family
            if (this.coBreathe && this.coBreathe.roomId) {
                this.coBreathe.completeSession(results);
            }
        };
    }
}

// Add CSS for animations
const coBreathStyles = document.createElement('style');
coBreathStyles.textContent = `
    @keyframes celebrationPulse {
        0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
    }
`;
document.head.appendChild(coBreathStyles);

// Global instance
let coBreathUI = null;

// Initialize Co-Breathe for participant
function initializeCoBreathParticipant(userId) {
    coBreathUI = new CoBreathUI();
    coBreathUI.initialize(userId, true);
    coBreathUI.integrateWithBreathSession();
}

// Initialize Co-Breathe for family member
function initializeCoBreathFamily(familyId) {
    coBreathUI = new CoBreathUI();
    coBreathUI.initialize(familyId, false);
}

// Export for use
window.CoBreathConnection = CoBreathConnection;
window.CoBreathUI = CoBreathUI;
window.initializeCoBreathParticipant = initializeCoBreathParticipant;
window.initializeCoBreathFamily = initializeCoBreathFamily;
