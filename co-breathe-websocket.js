// Co-Breathe WebSocket Server Integration
// Add this to your existing server.js on Railway

const WebSocket = require('ws');

// Family breath session rooms
const breathRooms = new Map(); // roomId -> { participant, family: Set(), sessionData, startTime }
const userConnections = new Map(); // userId -> WebSocket connection

// Generate secure room invite codes
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initialize WebSocket server (add after your existing Express setup)
function initializeCoBreathWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
        let userId = null;
        let roomId = null;
        let userType = null; // 'participant' or 'family'
        
        console.log('New WebSocket connection established');
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                switch(data.type) {
                    case 'register':
                        handleUserRegistration(ws, data);
                        break;
                        
                    case 'create_room':
                        handleRoomCreation(ws, data);
                        break;
                        
                    case 'join_room':
                        handleRoomJoin(ws, data);
                        break;
                        
                    case 'breath_sync':
                        handleBreathSync(ws, data);
                        break;
                        
                    case 'session_start':
                        handleSessionStart(ws, data);
                        break;
                        
                    case 'session_complete':
                        handleSessionComplete(ws, data);
                        break;
                        
                    case 'biometric_data':
                        handleBiometricShare(ws, data);
                        break;
                        
                    default:
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Unknown message type'
                        }));
                }
            } catch (error) {
                console.error('WebSocket message parse error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format'
                }));
            }
        });
        
        ws.on('close', () => {
            handleUserDisconnection(ws, userId, roomId, userType);
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
        
        // User registration handler
        function handleUserRegistration(ws, data) {
            userId = data.userId;
            userType = data.userType; // 'participant' or 'family'
            userConnections.set(userId, ws);
            
            ws.send(JSON.stringify({
                type: 'registered',
                userId: userId,
                userType: userType
            }));
            
            console.log(`User registered: ${userId} (${userType})`);
        }
        
        // Room creation handler (participant creates room)
        function handleRoomCreation(ws, data) {
            if (userType !== 'participant') {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Only participants can create rooms'
                }));
                return;
            }
            
            roomId = generateRoomCode();
            const room = {
                participant: { ws, userId },
                family: new Set(),
                sessionData: {
                    sessionNumber: data.sessionNumber || 1,
                    breathProfile: data.breathProfile || null,
                    privacySettings: data.privacySettings || { shareHRV: false, shareCoherence: true }
                },
                status: 'waiting',
                createdAt: new Date()
            };
            
            breathRooms.set(roomId, room);
            
            ws.send(JSON.stringify({
                type: 'room_created',
                roomId: roomId,
                sessionNumber: room.sessionData.sessionNumber
            }));
            
            console.log(`Room created: ${roomId} by participant ${userId}`);
        }
        
        // Room join handler (family joins room)
        function handleRoomJoin(ws, data) {
            const targetRoomId = data.roomId;
            const room = breathRooms.get(targetRoomId);
            
            if (!room) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Room not found or expired'
                }));
                return;
            }
            
            if (room.status !== 'waiting') {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Session already in progress'
                }));
                return;
            }
            
            // Add family member to room
            roomId = targetRoomId;
            room.family.add({ ws, userId, relationship: data.relationship || 'family' });
            
            // Notify participant
            room.participant.ws.send(JSON.stringify({
                type: 'family_joined',
                familyMember: {
                    userId: userId,
                    relationship: data.relationship || 'family'
                },
                familyCount: room.family.size
            }));
            
            // Confirm to family member
            ws.send(JSON.stringify({
                type: 'room_joined',
                roomId: roomId,
                participantId: room.participant.userId,
                sessionNumber: room.sessionData.sessionNumber,
                familyCount: room.family.size
            }));
            
            console.log(`Family member ${userId} joined room ${roomId}`);
        }
        
        // Breath synchronization handler
        function handleBreathSync(ws, data) {
            const room = breathRooms.get(roomId);
            if (!room) return;
            
            // Broadcast breath phase to all connected family members
            const breathData = {
                type: 'breath_sync',
                phase: data.phase, // 'inhale', 'hold', 'exhale'
                timestamp: data.timestamp,
                sessionProgress: data.sessionProgress,
                breathCount: data.breathCount
            };
            
            // Send to family members
            room.family.forEach(familyMember => {
                if (familyMember.ws.readyState === WebSocket.OPEN) {
                    familyMember.ws.send(JSON.stringify(breathData));
                }
            });
            
            // If participant, also send to family; if family, send to participant
            if (userType === 'participant') {
                // Already sent to family above
            } else {
                // Family member breath sync (optional feature)
                if (room.participant.ws.readyState === WebSocket.OPEN) {
                    room.participant.ws.send(JSON.stringify({
                        ...breathData,
                        type: 'family_breath_sync',
                        familyMemberId: userId
                    }));
                }
            }
        }
        
        // Session start handler
        function handleSessionStart(ws, data) {
            const room = breathRooms.get(roomId);
            if (!room) return;
            
            room.status = 'active';
            room.startedAt = new Date();
            
            const sessionStartData = {
                type: 'session_started',
                sessionNumber: room.sessionData.sessionNumber,
                breathProfile: room.sessionData.breathProfile,
                startTime: room.startedAt
            };
            
            // Notify all participants
            room.family.forEach(familyMember => {
                if (familyMember.ws.readyState === WebSocket.OPEN) {
                    familyMember.ws.send(JSON.stringify(sessionStartData));
                }
            });
            
            if (userType === 'participant') {
                room.participant.ws.send(JSON.stringify({
                    ...sessionStartData,
                    familyCount: room.family.size
                }));
            }
            
            console.log(`Session started in room ${roomId}`);
        }
        
        // Session completion handler
        function handleSessionComplete(ws, data) {
            const room = breathRooms.get(roomId);
            if (!room) return;
            
            room.status = 'completed';
            room.completedAt = new Date();
            
            const completionData = {
                type: 'session_completed',
                sessionNumber: room.sessionData.sessionNumber,
                completionTime: room.completedAt,
                sessionDuration: Math.round((room.completedAt - room.startedAt) / 1000),
                coherenceScore: data.coherenceScore || null,
                breathCount: data.breathCount || null
            };
            
            // Celebrate with family
            room.family.forEach(familyMember => {
                if (familyMember.ws.readyState === WebSocket.OPEN) {
                    familyMember.ws.send(JSON.stringify({
                        ...completionData,
                        type: 'family_celebration',
                        message: 'Your loved one completed their healing session!'
                    }));
                }
            });
            
            // Confirm to participant
            if (userType === 'participant') {
                ws.send(JSON.stringify({
                    ...completionData,
                    familyWitnessed: room.family.size > 0
                }));
            }
            
            // Clean up room after 5 minutes
            setTimeout(() => {
                breathRooms.delete(roomId);
                console.log(`Room ${roomId} cleaned up after session completion`);
            }, 5 * 60 * 1000);
            
            console.log(`Session completed in room ${roomId}`);
        }
        
        // Biometric data sharing handler
        function handleBiometricShare(ws, data) {
            const room = breathRooms.get(roomId);
            if (!room || userType !== 'participant') return;
            
            // Check privacy settings
            const { shareHRV, shareCoherence } = room.sessionData.privacySettings;
            
            const biometricData = {
                type: 'biometric_update',
                timestamp: data.timestamp
            };
            
            if (shareCoherence && data.coherenceScore) {
                biometricData.coherenceScore = data.coherenceScore;
            }
            
            if (shareHRV && data.hrv) {
                biometricData.hrv = data.hrv;
                biometricData.heartRate = data.heartRate;
            }
            
            // Send to family members
            room.family.forEach(familyMember => {
                if (familyMember.ws.readyState === WebSocket.OPEN) {
                    familyMember.ws.send(JSON.stringify(biometricData));
                }
            });
        }
        
        // User disconnection handler
        function handleUserDisconnection(ws, userId, roomId, userType) {
            console.log(`User disconnected: ${userId} (${userType})`);
            
            if (userId) {
                userConnections.delete(userId);
            }
            
            if (roomId) {
                const room = breathRooms.get(roomId);
                if (room) {
                    if (userType === 'participant') {
                        // Participant left - notify family and close room
                        room.family.forEach(familyMember => {
                            if (familyMember.ws.readyState === WebSocket.OPEN) {
                                familyMember.ws.send(JSON.stringify({
                                    type: 'participant_disconnected',
                                    message: 'Session ended - participant disconnected'
                                }));
                            }
                        });
                        breathRooms.delete(roomId);
                    } else {
                        // Family member left - remove from room
                        room.family = new Set([...room.family].filter(fm => fm.userId !== userId));
                        
                        // Notify participant
                        if (room.participant.ws.readyState === WebSocket.OPEN) {
                            room.participant.ws.send(JSON.stringify({
                                type: 'family_left',
                                familyCount: room.family.size
                            }));
                        }
                    }
                }
            }
        }
    });
    
    // Heartbeat to keep connections alive
    setInterval(() => {
        wss.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        });
    }, 30000);
    
    console.log('Co-Breathe WebSocket server initialized');
    return wss;
}

// API endpoints for family connection management
function addCoBreathAPIEndpoints(app, pool) {
    
    // Create family connection invitation
    app.post('/api/family/invite', async (req, res) => {
        try {
            const { participantUserId, familyEmail, relationship, privacySettings } = req.body;
            
            const result = await pool.query(
                `INSERT INTO family_connections 
                 (participant_user_id, family_member_email, relationship_type, privacy_settings) 
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [participantUserId, familyEmail, relationship, JSON.stringify(privacySettings)]
            );
            
            // TODO: Send invitation email to family member
            
            res.json({
                success: true,
                connection: result.rows[0],
                message: 'Family invitation sent'
            });
        } catch (error) {
            console.error('Family invite error:', error);
            res.status(500).json({ error: 'Failed to send family invitation' });
        }
    });
    
    // Get family connections for participant
    app.get('/api/family/connections/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            
            const result = await pool.query(
                `SELECT * FROM family_connections 
                 WHERE participant_user_id = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );
            
            res.json({
                success: true,
                connections: result.rows
            });
        } catch (error) {
            console.error('Get family connections error:', error);
            res.status(500).json({ error: 'Failed to get family connections' });
        }
    });
    
    // Update privacy settings
    app.put('/api/family/privacy/:connectionId', async (req, res) => {
        try {
            const { connectionId } = req.params;
            const { privacySettings } = req.body;
            
            const result = await pool.query(
                `UPDATE family_connections 
                 SET privacy_settings = $1 
                 WHERE id = $2 RETURNING *`,
                [JSON.stringify(privacySettings), connectionId]
            );
            
            res.json({
                success: true,
                connection: result.rows[0],
                message: 'Privacy settings updated'
            });
        } catch (error) {
            console.error('Privacy update error:', error);
            res.status(500).json({ error: 'Failed to update privacy settings' });
        }
    });
    
    // Get active breath rooms (for debugging/monitoring)
    app.get('/api/co-breathe/rooms', (req, res) => {
        const rooms = Array.from(breathRooms.entries()).map(([roomId, room]) => ({
            roomId,
            participantId: room.participant.userId,
            familyCount: room.family.size,
            status: room.status,
            createdAt: room.createdAt,
            sessionNumber: room.sessionData.sessionNumber
        }));
        
        res.json({
            success: true,
            activeRooms: rooms.length,
            rooms
        });
    });
}

// Database migration for family connections
const familyConnectionsMigration = `
-- Family connections table
CREATE TABLE IF NOT EXISTS family_connections (
    id SERIAL PRIMARY KEY,
    participant_user_id VARCHAR(255) NOT NULL,
    family_member_email VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50), 
    connection_status VARCHAR(20) DEFAULT 'pending',
    privacy_settings JSONB DEFAULT '{"shareHRV": false, "shareCoherence": true}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP
);

-- Breath session rooms (optional - mainly for logging)
CREATE TABLE IF NOT EXISTS breath_rooms_log (
    room_id VARCHAR(20) PRIMARY KEY,
    participant_user_id VARCHAR(255) NOT NULL,
    session_number INTEGER,
    family_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    session_duration_seconds INTEGER
);
`;

module.exports = {
    initializeCoBreathWebSocket,
    addCoBreathAPIEndpoints,
    familyConnectionsMigration
};
