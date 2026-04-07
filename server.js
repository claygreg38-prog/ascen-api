const Sentry = require('./src/instrument');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cron = require('node-cron');
const app = express();
const PORT = process.env.PORT || 3000;

// ── STRIPE WEBHOOK (must be before express.json() for raw body) ──
try {
  const webhookRoutes = require('./src/routes/webhookRoutes');
  app.use('/api/webhooks', webhookRoutes);
  console.log('[WEBHOOKS] Stripe webhook mounted at /api/webhooks/stripe');
} catch (err) {
  console.warn('[WEBHOOKS] Could not mount:', err.message);
}

app.use(express.json());

// ── CLINICAL TEST HARNESS (temporary — delete after 5-day test) ──
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'public/test.html')));
app.get('/test/config', (req, res) => {
  // Serves the test harness API key so it's not hardcoded in HTML source
  const key = process.env.TEST_HARNESS_API_KEY || '';
  res.json({ key });
});

// ── CROWN SVGs — static assets ──────────────────────────────
app.use('/assets/crowns', express.static(path.join(__dirname, 'src/assets/crowns')));

// ── TTS AUDIO — cached ElevenLabs audio files ───────────────
app.use('/audio/tts', express.static(path.join(__dirname, 'public/audio/tts')));

// ── V8 IMMERSIVE FRONTEND — canonical participant experience ─
app.get('/breathe', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index_v8.html'));
});

// ── PRODUCTION FRONTEND PWA (Session 23) ────────────────────
app.use('/app', express.static(path.join(__dirname, 'frontend/dist')));
app.get('/app/*', (req, res) => res.sendFile(path.join(__dirname, 'frontend/dist/index.html')));

// ── DATABASE ────────────────────────────────────────────────
// Declared FIRST so all middleware and routes can reference it
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

// Prevent unhandled Pool errors from crashing the process
if (pool) {
  pool.on('error', (err) => {
    console.error('[DB POOL] Unexpected error on idle client:', err.message);
  });
}

// ── HARDENING MIDDLEWARE ────────────────────────────────────
const abiHardening = require('./src/middleware/abiHardening');
// rateLimiter is a factory — must be invoked to get middleware
const rateLimiterMw = abiHardening.rateLimiter ? abiHardening.rateLimiter() : ((req, res, next) => next());
const validateABI = abiHardening.validateBiometrics || ((req, res, next) => next());
const auditLogger = abiHardening.auditLogger || ((req, res, next) => next());
const cfrGuard = abiHardening.cfrGuard || ((req, res, next) => next());
const createResilientPool = abiHardening.createResilientPool || (() => {});
const createHealthCheck = abiHardening.createHealthCheck || ((pool) => (req, res) => res.json({ status: 'healthy' }));

// ── AUTH MIDDLEWARE ─────────────────────────────────────────
const {
  authenticate,
  requireRole,
  authenticateOrApiKey,
  optionalAuth,
  authRoutes
} = require('./src/middleware/auth');

// ── TENANT RESOLVER ─────────────────────────────────────────
const { tenantResolver } = require('./src/middleware/tenantResolver');

// ── AGE FILTER ──────────────────────────────────────────────
const { ageFilter } = require('./src/middleware/ageFilter');

// DB resilience — retry transient connection failures
if (pool) createResilientPool(pool);

// CORS — allow frontend origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-session-key, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── SENTRY USER CONTEXT ─────────────────────────────────────
// Uses addEventProcessor so req.user is read at capture time (after auth
// middleware has run), not at registration time when req.user is undefined.
app.use((req, res, next) => {
  Sentry.addEventProcessor((event) => {
    if (req.user) {
      const pid = req.user.participant_id || req.user.user_id || req.user.sub;
      event.user = { ...event.user, id: pid };
      event.tags = { ...event.tags, participant_id: pid };
    }
    if (req.body) {
      if (req.body.session_number) event.tags = { ...event.tags, session_number: req.body.session_number };
      if (req.body.device_type) event.tags = { ...event.tags, device_type: req.body.device_type };
    }
    if (req.query && req.query.session_number) {
      event.tags = { ...event.tags, session_number: req.query.session_number };
    }
    return event;
  });
  next();
});

// ── TENANT RESOLUTION (after auth, before routes) ───────────
app.use(tenantResolver);

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (public — registration, login, codes)
// ═══════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes); // Legacy token/verify/refresh endpoints

try {
  const productionAuthRoutes = require('./src/routes/authRoutes');
  // Public auth endpoints (register, login, verify, reset) — no auth required
  app.use('/api/auth', productionAuthRoutes);
  console.log('[AUTH] Production auth routes mounted at /api/auth');
} catch (err) {
  console.warn('[AUTH] Could not mount production auth:', err.message);
}

// Auth context route (requires JWT or API key) — persona, features, capacity, next session
try {
  const contextRoute = require('./src/routes/contextRoute');
  app.use('/api/auth', authenticateOrApiKey('participant'));
  app.use('/api/auth', contextRoute);
  console.log('[CONTEXT] Auth context route mounted at /api/auth/context');
} catch (err) {
  console.warn('[CONTEXT] Could not mount:', err.message);
}

// User routes (requires JWT or API key) — next session
try {
  const nextSessionRoute = require('./src/routes/nextSessionRoute');
  app.use('/api/user', authenticateOrApiKey('participant'));
  app.use('/api/user', nextSessionRoute);
  console.log('[USER] Next session route mounted at /api/user/next-session');
} catch (err) {
  console.warn('[USER] Could not mount:', err.message);
}

// Vagal journey + pattern routes (requires JWT or API key)
try {
  const vagalRoutes = require('./src/routes/vagalRoutes');
  app.use('/api/user', authenticateOrApiKey('participant'));
  app.use('/api/user', vagalRoutes);
  console.log('[VAGAL] Routes mounted at /api/user/vagal-journey, /api/user/vagal-pattern');
} catch (err) {
  console.warn('[VAGAL] Could not mount:', err.message);
}

// Onboarding routes (requires JWT or API key)
try {
  const onboardingRoutes = require('./src/routes/onboardingRoutes');
  app.use('/api/onboarding', authenticateOrApiKey('participant'));
  app.use('/api/onboarding', onboardingRoutes);
  console.log('[ONBOARDING] Routes mounted at /api/onboarding');
} catch (err) {
  console.warn('[ONBOARDING] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// ABI ROUTES — Session lifecycle, clinical, admin
// ═══════════════════════════════════════════════════════════════
const abiRoutes = require('./src/routes/abiRoutes');

// Hardening on all ABI routes
app.use('/api/abi', rateLimiterMw);
app.use('/api/abi', validateABI);
app.use('/api/abi', auditLogger);

// Session lifecycle — accepts JWT or API key (transition period)
// Participants use JWT, legacy frontend uses API key
app.use('/api/abi/session', authenticateOrApiKey('participant'));

// Clinical routes — requires clinician role + 42 CFR Part 2 guard
app.use('/api/abi/clinical', authenticateOrApiKey('clinician'));
app.use('/api/abi/clinical', cfrGuard);

// Admin routes — requires admin role
app.use('/api/abi/admin', authenticateOrApiKey('admin'));

// Drill routes — accepts JWT or API key
app.use('/api/abi/drills', authenticateOrApiKey('participant'));
app.use('/api/abi/drill', authenticateOrApiKey('participant'));

// Health — public (no auth)
// /api/abi/health is handled by abiRoutes, no auth middleware above it

app.use('/api/abi', abiRoutes);
// FR Routes (Family Receiver)
try {
  const frRoutes = require('./src/routes/frRoutes');
  app.use('/api/abi/fr', frRoutes);
  console.log('[FR] Routes mounted at /api/abi/fr');
} catch (err) {
  console.warn('[FR] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// V8 ROUTES — Progress, Vault (encrypted at rest)
// ═══════════════════════════════════════════════════════════════
try {
  const v8Routes = require('./src/routes/v8Routes');
  app.use('/api/fr', authenticateOrApiKey('participant'));
  app.use('/api/fr', v8Routes);
  console.log('[V8] FR progress/vault routes mounted at /api/fr');
} catch (err) {
  console.warn('[V8] Could not mount FR routes:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// AXIS ROUTES — Brain stem analytics
// ═══════════════════════════════════════════════════════════════
const axisRoutes = require('./src/routes/axisRoutes');

// Dashboard/protocols/insights — clinician or above
app.use('/api/axis/dashboard', authenticateOrApiKey('clinician'));
app.use('/api/axis/protocols', authenticateOrApiKey('clinician'));
app.use('/api/axis/insights', authenticateOrApiKey('clinician'));
app.use('/api/axis/difficulty-map', authenticateOrApiKey('clinician'));
app.use('/api/axis/refinement-history', authenticateOrApiKey('clinician'));
app.use('/api/axis/context', authenticateOrApiKey('clinician'));
app.use('/api/axis/user', authenticateOrApiKey('clinician'));

// Refinement trigger — admin only
app.use('/api/axis/refine', authenticateOrApiKey('admin'));
app.use('/api/axis/ingest', authenticateOrApiKey('admin'));

// Health — public
// /api/axis/health has no auth middleware

app.use('/api/axis', axisRoutes);

// ── AXIS VALUE ROUTES — Healing economy metrics ──────────────
try {
  const axisValueRoutes = require('./src/routes/axisValueRoutes');
  app.use('/api/axis/value', authenticateOrApiKey('clinician'));
  app.use('/api/axis/value', axisValueRoutes);
  console.log('[AXIS] Value routes mounted at /api/axis/value');
} catch (err) {
  console.warn('[AXIS] Value routes not loaded:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// ART ROUTES — Breath Art gallery, decode, crown, intention
// ═══════════════════════════════════════════════════════════════
try {
  const artRoutes = require('./src/routes/artRoutes');
  // Gallery, crown, intention, photo-palette — participant or above
  app.use('/api/art', authenticateOrApiKey('participant'));
  // Decode route also checks X-Clinical-Key internally for clinical access
  app.use('/api/art', artRoutes);
  console.log('[ART] Routes mounted at /api/art');
} catch (err) {
  console.warn('[ART] Could not mount:', err.message);
}

try {
  const personalizationRoutes = require('./src/routes/personalizationRoutes');
  // Auth already applied at /api/art above
  app.use('/api/art', personalizationRoutes);
  console.log('[ART] Personalization routes mounted at /api/art');
} catch (err) {
  console.warn('[ART] Personalization routes could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS ROUTES — Co-Creation Canvas
// ═══════════════════════════════════════════════════════════════
try {
  const canvasRoutes = require('./src/routes/canvasRoutes');
  app.use('/api/canvas', authenticateOrApiKey('participant'));
  app.use('/api/canvas', canvasRoutes);
  console.log('[CANVAS] Routes mounted at /api/canvas');
} catch (err) {
  console.warn('[CANVAS] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// SHOWCASE ROUTES — Breath Art Social Gallery
// ═══════════════════════════════════════════════════════════════
try {
  const socialRoutes = require('./src/routes/socialRoutes');
  app.use('/api/showcase', authenticateOrApiKey('participant'));
  app.use('/api/showcase', socialRoutes);
  console.log('[SHOWCASE] Routes mounted at /api/showcase');
} catch (err) {
  console.warn('[SHOWCASE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY VAULT ROUTES — Capsules, Unlock, Ancestral Sessions
// ═══════════════════════════════════════════════════════════════
try {
  const legacyRoutes = require('./src/routes/legacyRoutes');
  app.use('/api/legacy', authenticateOrApiKey('participant'));
  app.use('/api/legacy', legacyRoutes);
  console.log('[LEGACY] Routes mounted at /api/legacy');
} catch (err) {
  console.warn('[LEGACY] Could not mount:', err.message);
}

// ── Vault Recovery (dual-key seed phrase backup) ─────────────
try {
  const vaultRecoveryRoutes = require('./src/routes/vaultRecoveryRoutes');
  app.use('/api/vault/recovery', authenticateOrApiKey('clinician'));
  app.use('/api/vault/recovery', vaultRecoveryRoutes);
  console.log('[VAULT_RECOVERY] Routes mounted at /api/vault/recovery');
} catch (err) {
  console.warn('[VAULT_RECOVERY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// MERCHANDISE ROUTES — Export, Poster, Verify
// ═══════════════════════════════════════════════════════════════
try {
  const merchandiseRoutes = require('./src/routes/merchandiseRoutes');
  app.use('/api/merch', authenticateOrApiKey('participant'));
  app.use('/api/merch', merchandiseRoutes);
  console.log('[MERCH] Routes mounted at /api/merch');
} catch (err) {
  console.warn('[MERCH] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// FAMILY ROUTES — Family Units, Intelligence, Invitations
// ═══════════════════════════════════════════════════════════════
try {
  const familyRoutes = require('./src/routes/familyRoutes');
  app.use('/api/family', authenticateOrApiKey('participant'));
  app.use('/api/family', familyRoutes);
  console.log('[FAMILY] Routes mounted at /api/family');
} catch (err) {
  console.warn('[FAMILY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CAPACITY CURRENCY ROUTES — Balance, History, Trend, Invest
// ═══════════════════════════════════════════════════════════════
try {
  const capacityRoutes = require('./src/routes/capacityRoutes');
  app.use('/api/capacity', authenticateOrApiKey('participant'));
  app.use('/api/capacity', capacityRoutes);
  console.log('[CAPACITY] Routes mounted at /api/capacity');
} catch (err) {
  console.warn('[CAPACITY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// LIGHTBRIDGE ROUTES — IoT Device Control
// ═══════════════════════════════════════════════════════════════
try {
  const lightBridgeRoutes = require('./src/routes/lightBridgeRoutes');
  app.use('/api/lightbridge', authenticateOrApiKey('participant'));
  app.use('/api/lightbridge', lightBridgeRoutes);
  console.log('[LIGHTBRIDGE] Routes mounted at /api/lightbridge');
} catch (err) {
  console.warn('[LIGHTBRIDGE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CLINICAL KITCHEN TABLE ROUTES — Clinician-Only Layer
// Must mount BEFORE family kitchen table routes so /clinical
// path matches before the broader /api/kitchen-table middleware.
// ═══════════════════════════════════════════════════════════════
try {
  const clinicalKitchenTableRoutes = require('./src/routes/clinicalKitchenTableRoutes');
  app.use('/api/kitchen-table/clinical', authenticateOrApiKey('clinician'));
  app.use('/api/kitchen-table/clinical', clinicalKitchenTableRoutes);
  console.log('[CLINICAL KT] Routes mounted at /api/kitchen-table/clinical');
} catch (err) {
  console.warn('[CLINICAL KT] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// KITCHEN TABLE ROUTES — Topic Discussion
// ═══════════════════════════════════════════════════════════════
try {
  const kitchenTableRoutes = require('./src/routes/kitchenTableRoutes');
  app.use('/api/kitchen-table', authenticateOrApiKey('participant'));
  app.use('/api/kitchen-table', ageFilter());
  app.use('/api/kitchen-table', kitchenTableRoutes);
  console.log('[KITCHEN TABLE] Routes mounted at /api/kitchen-table');
} catch (err) {
  console.warn('[KITCHEN TABLE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CO-BREATH ROUTES — Synchronized Family Breathing
// ═══════════════════════════════════════════════════════════════
try {
  const coBreathRoutes = require('./src/routes/coBreathRoutes');
  app.use('/api/cobreath', authenticateOrApiKey('participant'));
  app.use('/api/cobreath', coBreathRoutes);
  console.log('[COBREATH] Routes mounted at /api/cobreath');
} catch (err) {
  console.warn('[COBREATH] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// PREMIUM ROUTES — Guided Bridge (Session 19)
// ═══════════════════════════════════════════════════════════════
try {
  const premiumRoutes = require('./src/routes/premiumRoutes');
  // Premium routes — participant auth required
  app.use('/api/premium', authenticateOrApiKey('participant'));
  app.use('/api/premium', premiumRoutes);
  // Clinical disclosure & video review routes — clinician auth
  app.use('/api/clinical', authenticateOrApiKey('clinician'));
  app.use('/api/clinical', premiumRoutes);
  console.log('[PREMIUM] Routes mounted at /api/premium + /api/clinical');
} catch (err) {
  console.warn('[PREMIUM] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// COMPASS ROUTES — Family Compass Intelligence (Session 20)
// ═══════════════════════════════════════════════════════════════
try {
  const compassRoutes = require('./src/routes/compassRoutes');
  app.use('/api/compass', authenticateOrApiKey('participant'));
  app.use('/api/compass', compassRoutes);
  console.log('[COMPASS] Routes mounted at /api/compass');
} catch (err) {
  console.warn('[COMPASS] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CRISIS ROUTES — Crisis Lifecycle, Steward, Domestic Safety (Session 22)
// ═══════════════════════════════════════════════════════════════
try {
  const crisisRoutes = require('./src/routes/crisisRoutes');
  app.use('/api/crisis', authenticateOrApiKey('participant'));
  app.use('/api/crisis', crisisRoutes);
  console.log('[CRISIS] Routes mounted at /api/crisis');
} catch (err) {
  console.warn('[CRISIS] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// HOS FAMILY LAYER — LACE, Firmware, Lineage (Session 25)
// ═══════════════════════════════════════════════════════════════
try {
  const laceRoutes = require('./src/routes/laceRoutes');
  app.use('/api/lace', authenticateOrApiKey('participant'));
  app.use('/api/lace', laceRoutes);
  console.log('[LACE] Routes mounted at /api/lace');
} catch (err) {
  console.warn('[LACE] Could not mount:', err.message);
}

try {
  const firmwareRoutes = require('./src/routes/firmwareRoutes');
  app.use('/api/firmware', authenticateOrApiKey('participant'));
  app.use('/api/firmware', ageFilter());
  app.use('/api/firmware', firmwareRoutes);
  console.log('[FIRMWARE] Routes mounted at /api/firmware');
} catch (err) {
  console.warn('[FIRMWARE] Could not mount:', err.message);
}

try {
  const lineageRoutes = require('./src/routes/lineageRoutes');
  app.use('/api/lineage', authenticateOrApiKey('participant'));
  app.use('/api/lineage', lineageRoutes);
  console.log('[LINEAGE] Routes mounted at /api/lineage');
} catch (err) {
  console.warn('[LINEAGE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// HERITAGE/PRICE ROUTES — Heritage Strength & Cost Mapping (Session 26)
// ═══════════════════════════════════════════════════════════════
try {
  const heritagePriceRoutes = require('./src/routes/heritagePriceRoutes');
  app.use('/api/heritage', authenticateOrApiKey('participant'));
  app.use('/api/heritage', heritagePriceRoutes);
  console.log('[HERITAGE] Routes mounted at /api/heritage');
} catch (err) {
  console.warn('[HERITAGE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// FAMILY DESIGN ROUTES — System Design Mode (Session 26)
// ═══════════════════════════════════════════════════════════════
try {
  const familyDesignRoutes = require('./src/routes/familyDesignRoutes');
  app.use('/api/design', authenticateOrApiKey('participant'));
  app.use('/api/design', familyDesignRoutes);
  console.log('[DESIGN] Routes mounted at /api/design');
} catch (err) {
  console.warn('[DESIGN] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// TTS ROUTES — ElevenLabs Text-to-Speech (Session 26)
// ═══════════════════════════════════════════════════════════════
try {
  const ttsRoutes = require('./src/routes/ttsRoutes');
  // TTS routes are public — they generate audio from text, no sensitive data.
  // Voice IDs come from env vars, tenant context from tenantResolver (global).
  app.use('/api/tts', ttsRoutes);
  console.log('[TTS] Routes mounted at /api/tts (public — no auth required)');
} catch (err) {
  console.warn('[TTS] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION ROUTES — Billing & Tier Management (Session 21)
// ═══════════════════════════════════════════════════════════════
try {
  const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
  app.use('/api/subscription', authenticateOrApiKey('participant'));
  app.use('/api/subscription', subscriptionRoutes);
  console.log('[SUBSCRIPTION] Routes mounted at /api/subscription');
} catch (err) {
  console.warn('[SUBSCRIPTION] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// PRENATAL ROUTES — System Preparation (Session 32)
// ═══════════════════════════════════════════════════════════════
try {
  const prenatalRoutes = require('./src/routes/prenatalRoutes');
  app.use('/api/prenatal', authenticateOrApiKey('participant'));
  app.use('/api/prenatal', prenatalRoutes);
  console.log('[PRENATAL] Routes mounted at /api/prenatal');
} catch (err) {
  console.warn('[PRENATAL] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// PARTNERSHIP ROUTES — Couples/Intimate Partner Co-Regulation (Session 30)
// ═══════════════════════════════════════════════════════════════
try {
  const partnershipRoutes = require('./src/routes/partnershipRoutes');
  app.use('/api/partnership', authenticateOrApiKey('participant'));
  app.use('/api/partnership', ageFilter());
  app.use('/api/partnership', partnershipRoutes);
  console.log('[PARTNERSHIP] Routes mounted at /api/partnership');
} catch (err) {
  console.warn('[PARTNERSHIP] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// FAMILY CREST ROUTES — Living System Document (Session 29)
// ═══════════════════════════════════════════════════════════════
try {
  const crestRoutes = require('./src/routes/crestRoutes');
  app.use('/api/crest', authenticateOrApiKey('participant'));
  app.use('/api/crest', crestRoutes);
  console.log('[CREST] Routes mounted at /api/crest');
} catch (err) {
  console.warn('[CREST] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// QUILTING ROUTES — System Weave (Quilting Intelligence)
// ═══════════════════════════════════════════════════════════════
try {
  const quiltingRoutes = require('./src/routes/quiltingRoutes');
  app.use('/api/quilting', authenticateOrApiKey('participant'));
  app.use('/api/quilting', quiltingRoutes);
  console.log('[QUILTING] Routes mounted at /api/quilting');
} catch (err) {
  console.warn('[QUILTING] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// HEALING ECONOMY ROUTES — LIT/FCR/FIS/Bond/LHX
// ═══════════════════════════════════════════════════════════════
try {
  const healingEconomyRoutes = require('./src/routes/healingEconomyRoutes');
  app.use('/api/economy', authenticateOrApiKey('participant'));
  app.use('/api/economy', healingEconomyRoutes);
  console.log('[ECONOMY] Routes mounted at /api/economy');
} catch (err) {
  console.warn('[ECONOMY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// EQUITY ROUTES — Anti-Redlining Governance (Admin Only)
// ═══════════════════════════════════════════════════════════════
try {
  const equityRoutes = require('./src/routes/equityRoutes');
  app.use('/api/admin/equity', authenticateOrApiKey('admin'));
  app.use('/api/admin/equity', equityRoutes);
  console.log('[EQUITY] Routes mounted at /api/admin/equity');
} catch (err) {
  console.warn('[EQUITY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// EXISTING ROUTES
// ═══════════════════════════════════════════════════════════════

// ── Health (public) ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'no DATABASE_URL set';
  if (pool) {
    try { await pool.query('SELECT 1'); dbStatus = 'connected'; }
    catch (e) { dbStatus = 'error: ' + e.message; }
  }
  res.json({
    status: 'healthy',
    message: 'CHOS + AOT System Online',
    timestamp: new Date().toISOString(),
    system: 'Maryland AOT Ready',
    database: dbStatus,
    abi_version: '2.1 — 14/14 systems wired',
    auth: 'JWT + API key (transition)',
    hardening: 'rate_limit + validation + audit + cfr_guard + db_resilience'
  });
});

app.get('/api/health/deep', createHealthCheck(pool));

app.get('/', (req, res) => {
  res.json({
    system: 'CHOS + AOT Unified System',
    status: 'Live and Ready',
    abi: '14/14 systems connected',
    auth: 'JWT required on clinical/admin routes',
    routes: {
      auth_token: 'POST /api/auth/token',
      auth_verify: 'GET /api/auth/verify',
      health: '/api/health',
      abi_health: '/api/abi/health',
      abi_session: '/api/abi/session/* (JWT or API key)',
      abi_clinical: '/api/abi/clinical/* (clinician+)',
      abi_admin: '/api/abi/admin/* (admin only)',
      axis_dashboard: '/api/axis/dashboard (clinician+)',
      axis_refine: 'POST /api/axis/refine (admin only)',
      axis_health: '/api/axis/health',
      sessions: '/api/sessions',
    }
  });
});

// ── Schema (dev only) ───────────────────────────────────────
app.get('/api/schema', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Schema endpoint disabled in production' });
  }
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const tableNames = tables.rows.map(r => r.table_name);
    const columns = {};
    for (const t of tableNames) {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
      columns[t] = cols.rows;
    }
    res.json({ tables: tableNames, columns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sessions (public — curriculum browsing) ─────────────────
app.get('/api/sessions', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const result = await pool.query('SELECT session_number, title, arc, breath_mode, ratio, duration_seconds, luno_arrival, luno_mid, luno_close, vault_prompt, dialogue_phases FROM session_templates ORDER BY session_number ASC');
    res.json({ count: result.rows.length, sessions: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const { id } = req.params;
    const num = parseInt(id.replace(/\D/g, '')) || 1;
    const result = await pool.query('SELECT * FROM session_templates WHERE session_number = $1', [num]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Clinical dashboard (legacy — requires auth) ─────────────
app.get('/api/clinical/dashboard', authenticateOrApiKey('clinician'), (req, res) => {
  res.json({
    participants: [
      { id: 'p001', name: 'Marcus J.', compliance: 89, status: 'Engaged', sessions_completed: 24 },
      { id: 'p002', name: 'Kevin T.', compliance: 61, status: 'Needs Support', sessions_completed: 12 }
    ],
    metrics: { total_participants: 12, avg_compliance: 78, sessions_this_week: 45 },
    note: 'For real-time ABI clinical data, use /api/abi/clinical/profile/:userId',
    timestamp: new Date().toISOString()
  });
});

// ── Court participants (legacy — requires auth + 42 CFR) ────
app.get('/api/court/participants', authenticateOrApiKey('clinician'), (req, res) => {
  res.json({
    participants: [
      { id: 'p001', initials: 'M.J.', compliance_rate: 89 },
      { id: 'p002', initials: 'K.T.', compliance_rate: 61 }
    ],
    compliance_note: 'Protected per 42 CFR Part 2',
    timestamp: new Date().toISOString()
  });
});

// ── LightBridge ─────────────────────────────────────────────
app.get('/api/lightbridge/activate', (req, res) => {
  res.json({ message: 'LightBridge Family Connection System', system_status: 'Ready', timestamp: new Date().toISOString() });
});

app.post('/api/lightbridge/activate', authenticateOrApiKey('participant'), (req, res) => {
  res.json({ activation_id: 'lb_' + Date.now(), participant_id: req.body.participant_id, connection_established: true, timestamp: new Date().toISOString() });
});

// ── Blockchain verification (real Polygon contract wire) ─────
const { VerificationService } = require('./src/blockchain/verificationService');
const verificationService = new VerificationService(pool);
verificationService.initialize().catch(err =>
  console.warn('[BLOCKCHAIN] Deferred init:', err.message)
);

// Submit attestation — requires dual signatures (participant + facilitator)
app.post('/api/blockchain/submit-attestation', authenticateOrApiKey('admin'), async (req, res) => {
  try {
    const result = await verificationService.submitAttestation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process gas-deferred attestations (admin/cron)
app.post('/api/blockchain/process-deferred', authenticateOrApiKey('admin'), async (req, res) => {
  try {
    const result = await verificationService.processDeferred();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy endpoint — backwards compatible, queues for attestation
app.post('/api/blockchain/verify-session', authenticateOrApiKey('participant'), async (req, res) => {
  try {
    const { participantId, sessionNumber, sessionType } = req.body;
    // Queue in attestation_queue as awaiting_facilitator
    await pool.query(
      `INSERT INTO attestation_queue (user_id, packet_hash, status)
       SELECT $1, sc.packet_hash, 'awaiting_facilitator'
       FROM session_completions sc
       WHERE sc.user_id = $1 AND sc.session_number = $2
         AND sc.packet_hash IS NOT NULL
       ORDER BY sc.completed_at DESC LIMIT 1
       ON CONFLICT DO NOTHING`,
      [participantId, sessionNumber]
    );
    res.json({ success: true, message: 'Session verification queued', participantId, sessionNumber, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ── NOTIFICATION ROUTES — Push Token Management ──────────────
try {
  const notificationRoutes = require('./src/routes/notificationRoutes');
  app.use('/api/notifications', authenticateOrApiKey('participant'));
  app.use('/api/notifications', notificationRoutes);
  console.log('[NOTIFICATIONS] Routes mounted at /api/notifications');
} catch (err) {
  console.warn('[NOTIFICATIONS] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// RIPPLE SIGNAL ROUTES — "They showed up today."
// ═══════════════════════════════════════════════════════════════
try {
  const rippleRoutes = require('./src/routes/rippleRoutes');
  app.use('/api/ripple', authenticateOrApiKey('participant'));
  app.use('/api/ripple', rippleRoutes);
  console.log('[RIPPLE] Routes mounted at /api/ripple');
} catch (err) {
  console.warn('[RIPPLE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// SESSION MONITOR ROUTES — SSE + Reports (Phase 1)
// ═══════════════════════════════════════════════════════════════
try {
  const monitorRoutes = require('./src/routes/monitorRoutes');
  app.use('/api/monitor', authenticateOrApiKey('clinician'));
  app.use('/api/monitor', monitorRoutes);
  console.log('[MONITOR] Session monitoring routes mounted at /api/monitor');
} catch (err) {
  console.warn('[MONITOR] Could not mount:', err.message);
}

// ── ADMIN ROUTES — System Audit (Session 23) ─────────────────
try {
  const adminRoutes = require('./src/routes/adminRoutes');
  app.use('/api/admin', authenticateOrApiKey('admin'));
  app.use('/api/admin', adminRoutes);
  console.log('[ADMIN] Audit routes mounted at /api/admin');
} catch (err) {
  console.warn('[ADMIN] Could not mount:', err.message);
}

// ── CHILD SESSION ROUTES — Breath Bridge Phase 1 ─────────────
try {
  const childSessionRoutes = require('./src/routes/childSessionRoutes');
  app.use('/api/child-session', childSessionRoutes);
  console.log('[CHILD_SESSION] Routes mounted at /api/child-session');
} catch (err) {
  console.warn('[CHILD_SESSION] Could not mount:', err.message);
}

// ── BREATH BRIDGE ROUTES — Phase 2 ──────────────────────────
try {
  const breathBridgeRoutes = require('./src/routes/breathBridgeRoutes');
  app.use('/api/breath-bridge', breathBridgeRoutes);
  console.log('[BREATH_BRIDGE] Routes mounted at /api/breath-bridge');
} catch (err) {
  console.warn('[BREATH_BRIDGE] Could not mount:', err.message);
}

// ── AI USAGE DASHBOARD (admin) ─────────────────────────────
app.get('/api/admin/ai-usage', authenticateOrApiKey('admin'), async (req, res) => {
  try {
    const aiRouter = require('./src/services/aiRouter');
    const period = parseInt(req.query.period) || 7;
    const stats = await aiRouter.getUsageStats(req.tenantId, period);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get AI usage stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SENTRY ERROR HANDLER — after all routes, before error middleware
// ═══════════════════════════════════════════════════════════════
Sentry.setupExpressErrorHandler(app);

// ═══════════════════════════════════════════════════════════════
// MIGRATIONS + SERVER START + CRON
// ═══════════════════════════════════════════════════════════════

const { runPendingMigrations } = require('./src/services/migrationRunner');

// Run pending migrations before accepting traffic, but never block startup
runPendingMigrations()
  .catch(err => console.error('[MIGRATE] Startup migration failed:', err.message))
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log('Server running on port', PORT);
      console.log('ABI: 21/21 systems wired | AXIS: active | Auth: JWT + API key | Premium: Guided Bridge + Family Compass');
      console.log('Hardening: rate_limit + validation + audit + cfr_guard');
    });

// ── CO-BREATH WEBSOCKET ────────────────────────────────────
try {
  const { initCoBreathWS } = require('./src/services/coBreathWebSocket');
  initCoBreathWS(server);
} catch (err) {
  console.warn('[CoBreath WS] Could not initialize:', err.message);
}

// ── AXIS NIGHTLY REFINEMENT CRON ────────────────────────────
let isRefinementRunning = false;

if (process.env.ENABLE_AXIS_CRON === 'true') {
  const cronSchedule = process.env.AXIS_CRON_SCHEDULE || '0 2 * * *';

  cron.schedule(cronSchedule, async () => {
    if (isRefinementRunning) {
      console.log('[AXIS CRON] Skipping: previous cycle still running.');
      return;
    }

    isRefinementRunning = true;
    console.log('[AXIS CRON] Starting nightly refinement cycle...');
    const startTime = Date.now();
    let cronPool = null;

    try {
      const { AxisEngine } = require('./src/axis/axisEngine');
      cronPool = new Pool({ connectionString: process.env.DATABASE_URL });
      const axis = new AxisEngine(cronPool);

      const results = await axis.runRefinementCycle();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AXIS CRON] Refinement complete in ${duration}s`);
      console.log('[AXIS CRON] Results:', JSON.stringify({
        sessions_processed: results?.sessions_processed || 0,
        profiles_updated: results?.profiles_updated || 0,
        insights_generated: results?.insights_generated || 0,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[AXIS CRON] Refinement failed:', error.message);
    } finally {
      isRefinementRunning = false;
      if (cronPool) await cronPool.end().catch(() => {});
      console.log('[AXIS CRON] Cycle finished. Lock released.');
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  console.log(`[AXIS CRON] Scheduled: ${cronSchedule} America/New_York`);
} else {
  console.log('[AXIS CRON] Disabled (set ENABLE_AXIS_CRON=true to activate)');
}

// ── CAPACITY CURRENCY DAILY SNAPSHOT CRON ─────────────────
try {
  const capacitySnapshot = require('./src/jobs/capacitySnapshot');
  cron.schedule('0 3 * * *', async () => {
    console.log('[CAPACITY CRON] Running daily capacity snapshots...');
    const result = await capacitySnapshot.runDailySnapshots();
    console.log(`[CAPACITY CRON] Done: ${result.count} snapshots, ${result.errors} errors`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[CAPACITY CRON] Scheduled: 0 3 * * * UTC');
} catch (err) {
  console.warn('[CAPACITY CRON] Could not schedule:', err.message);
}

// ── WEEKLY PREDICTIONS CRON (Family Compass) ─────────────────
try {
  const weeklyPredictions = require('./src/jobs/weeklyPredictions');
  cron.schedule('0 6 * * 1', async () => {
    console.log('[PREDICTIONS CRON] Running weekly relationship predictions...');
    const result = await weeklyPredictions.runAll();
    console.log(`[PREDICTIONS CRON] Done: ${result.processed} processed, ${result.errors} errors`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[PREDICTIONS CRON] Scheduled: 0 6 * * 1 UTC (Monday 6 AM)');
} catch (err) {
  console.warn('[PREDICTIONS CRON] Could not schedule:', err.message);
}

// ── SUBSCRIPTION TRIAL EXPIRY + PAST DUE CRON ───────────────
try {
  const subscriptionService = require('./src/services/subscriptionService');
  cron.schedule('0 8 * * *', async () => {
    console.log('[BILLING CRON] Processing expired trials + past due...');
    const trials = await subscriptionService.processExpiredTrials();
    const pastDue = await subscriptionService.processPastDue();
    console.log(`[BILLING CRON] Done: ${trials.processed} trials expired, ${pastDue.processed} past due downgraded`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[BILLING CRON] Scheduled: 0 8 * * * UTC (daily 8 AM)');
} catch (err) {
  console.warn('[BILLING CRON] Could not schedule:', err.message);
}

// ── CRISIS CHECK-IN + STEWARD EXPIRY CRON ────────────────────
try {
  const crisisEngine = require('./src/abi/crisisEngine');
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRISIS CRON] Processing check-ins + steward expiry...');
    const checkins = await crisisEngine.processPeriodicCheckins();
    const stewards = await crisisEngine.processExpiredStewards();
    console.log(`[CRISIS CRON] Done: ${checkins.sent} check-ins sent, ${stewards.expired} stewards expired`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[CRISIS CRON] Scheduled: 0 9 * * * UTC (daily 9 AM)');
} catch (err) {
  console.warn('[CRISIS CRON] Could not schedule:', err.message);
}

// ── STALE SESSION CLEANUP CRON ────────────────────────────────
try {
  const sessionStateManager = require('./src/services/sessionStateManager');
  cron.schedule('*/15 * * * *', async () => {
    await sessionStateManager.cleanupStaleSessions();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[SESSION CRON] Stale cleanup scheduled: */15 * * * * UTC');
} catch (err) {
  console.warn('[SESSION CRON] Could not schedule:', err.message);
}

// ── PREVENTION IMPACT SCORE (1st of month, 2 AM UTC) ────────
try {
  const preventionImpactEngine = require('./src/axis/preventionImpactEngine');
  cron.schedule('0 2 1 * *', async () => {
    console.log('[CRON] Running monthly Prevention Impact Score computation...');
    const users = await pool.query(
      "SELECT id FROM users WHERE role = 'participant' AND is_active = true"
    );
    let computed = 0, skipped = 0;
    for (const user of users.rows) {
      try {
        const result = await preventionImpactEngine.computePIS(user.id);
        if (result.score !== null) computed++;
        else skipped++;
      } catch (err) {
        console.error(`[PIS] Failed for user ${user.id}:`, err.message);
        Sentry.captureException(err);
      }
    }
    console.log(`[CRON] PIS: ${computed} computed, ${skipped} skipped (insufficient data)`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[PIS CRON] Monthly PIS computation scheduled: 1st of month, 2 AM UTC');
} catch (err) {
  console.warn('[PIS CRON] Could not schedule:', err.message);
}

// ── ARTIFACT VALUATION REFRESH (2nd of month, 3 AM UTC) ─────
try {
  const artifactValuationEngine = require('./src/axis/artifactValuationEngine');
  const litEngineForCron = require('./src/axis/litEngine');
  cron.schedule('0 3 2 * *', async () => {
    console.log('[CRON] Running monthly artifact valuation refresh...');
    const sessions = await pool.query(`
      SELECT sc.id, sc.user_id, sc.family_unit_id, sc.tenant_id FROM session_completions sc
      WHERE sc.art_ipfs_hash IS NOT NULL
    `);

    let refreshed = 0, litRevaluations = 0;
    for (const session of sessions.rows) {
      try {
        const result = await artifactValuationEngine.computeArtifactValue(session.user_id, session.id, true);
        refreshed++;
        if (result.previousValue === null && result.value > 0) {
          // First-time valuation — initial LIT credit
          await litEngineForCron.creditCredential(
            session.user_id, session.family_unit_id, session.id,
            result.value, session.tenant_id
          );
          litRevaluations++;
        } else if (result.revaluationDelta && result.revaluationDelta !== 0) {
          // Revaluation — record delta
          await litEngineForCron.recordRevaluation(
            session.user_id, session.family_unit_id, session.id,
            result.revaluationDelta, session.tenant_id
          );
          litRevaluations++;
        }
      } catch (err) {
        console.error(`[VALUATION] Refresh failed for session ${session.id}:`, err.message);
        Sentry.captureException(err);
      }
    }

    // Check annual portfolio ceilings
    const portfolios = await pool.query(`
      SELECT user_id, SUM(value_usd) as total FROM artifact_valuations
      WHERE is_latest = true AND computed_at > NOW() - INTERVAL '1 year'
      GROUP BY user_id HAVING SUM(value_usd) > ${artifactValuationEngine.ANNUAL_PORTFOLIO_CEILING}
    `);
    for (const p of portfolios.rows) {
      Sentry.captureMessage(`User ${p.user_id} portfolio exceeds annual ceiling: $${p.total}`, 'warning');
    }

    console.log(`[CRON] Valuations refreshed: ${refreshed}, LIT revaluations: ${litRevaluations}`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[VALUATION CRON] Monthly refresh scheduled: 2nd of month, 3 AM UTC');
} catch (err) {
  console.warn('[VALUATION CRON] Could not schedule:', err.message);
}

// ── BLOCKCHAIN QUEUE PROCESSING (every 30 minutes) ──────────
try {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const result = await verificationService.processQueue();
      if (result.processed > 0) {
        console.log(`[BLOCKCHAIN CRON] Processed ${result.processed} attestations`);
      }
    } catch (err) {
      console.error('[BLOCKCHAIN CRON] Queue processing failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[BLOCKCHAIN CRON] Attestation queue processing scheduled: */30 * * * * UTC');
} catch (err) {
  console.warn('[BLOCKCHAIN CRON] Could not schedule queue processing:', err.message);
}

// ── BLOCKCHAIN RETRY (every 15 minutes) ─────────────────────
try {
  const { BlockchainRetry } = require('./src/blockchain/blockchainRetry');
  const blockchainRetry = new BlockchainRetry(pool);
  cron.schedule('*/15 * * * *', async () => {
    try {
      await blockchainRetry.processRetries();
      await blockchainRetry.processGasDeferred();
    } catch (err) {
      console.error('[BLOCKCHAIN CRON] Retry processing failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[BLOCKCHAIN CRON] Retry processing scheduled: */15 * * * * UTC');
} catch (err) {
  console.warn('[BLOCKCHAIN CRON] Could not schedule retries:', err.message);
}

// ── BLOCKCHAIN BALANCE MONITOR (daily 9 AM UTC) ─────────────
try {
  cron.schedule('0 9 * * *', async () => {
    try {
      await verificationService.checkSignerBalance();
    } catch (err) {
      console.error('[BLOCKCHAIN CRON] Balance monitor failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[BLOCKCHAIN CRON] Balance monitor scheduled: daily 9 AM UTC');
} catch (err) {
  console.warn('[BLOCKCHAIN CRON] Could not schedule balance monitor:', err.message);
}

// ── TTS INITIALIZATION + CACHE CLEANUP CRON ─────────────────
try {
  const ttsService = require('./src/services/ttsService');
  ttsService.initTTS();
  // Clean up unused TTS cache entries weekly (Sunday 4 AM UTC)
  cron.schedule('0 4 * * 0', async () => {
    await ttsService.cleanupCache();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[TTS CRON] Cache cleanup scheduled: Sunday 4 AM UTC');
} catch (err) {
  console.warn('[TTS] Could not initialize:', err.message);
}

// ── EMAIL + SMS INITIALIZATION ──────────────────────────────
try {
  const emailService = require('./src/services/emailService');
  emailService.initEmail();
} catch (err) {
  console.warn('[EMAIL] Could not initialize:', err.message);
}

try {
  const smsService = require('./src/services/smsService');
  smsService.initSMS();
} catch (err) {
  console.warn('[SMS] Could not initialize:', err.message);
}

// ── NOTIFICATION RETRY CRON (every 5 minutes) ───────────────
try {
  const emailService = require('./src/services/emailService');
  cron.schedule('*/5 * * * *', async () => {
    await emailService.retryFailedNotifications();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[NOTIFICATION CRON] Retry scheduled: */5 * * * * UTC');
} catch (err) {
  console.warn('[NOTIFICATION CRON] Could not schedule:', err.message);
}

// ── FIS + BOND MATURATION (1st of month, 4 AM UTC — after PIS at 2AM, before valuation at 3AM) ──
try {
  const fisEngine = require('./src/axis/fisEngine');
  const bondMaturationEngine = require('./src/axis/bondMaturationEngine');
  cron.schedule('0 4 1 * *', async () => {
    console.log('[CRON] Running monthly FIS computation + bond maturation evaluation...');
    const families = await pool.query('SELECT DISTINCT family_unit_id FROM family_memberships');
    let fisComputed = 0, bondsMatured = 0;
    for (const f of families.rows) {
      try {
        await fisEngine.computeFIS(f.family_unit_id);
        fisComputed++;
        const evaluation = await bondMaturationEngine.evaluateMaturation(f.family_unit_id);
        if (evaluation.ready) {
          await bondMaturationEngine.matureBond(f.family_unit_id);
          bondsMatured++;
        }
      } catch (err) {
        Sentry.captureException(err);
      }
    }
    console.log(`[CRON] FIS computed: ${fisComputed}, bonds matured: ${bondsMatured}`);
  }, { scheduled: true, timezone: 'UTC' });
  console.log('[FIS CRON] Monthly FIS + bond maturation scheduled: 1st of month, 4 AM UTC');
} catch (err) {
  console.warn('[FIS CRON] Could not schedule:', err.message);
}

// ── WEEKLY EXTRACTION SCAN (Monday 5 AM UTC) ─────────────────
try {
  const antiRedliningEngine = require('./src/axis/antiRedliningEngine');
  cron.schedule('0 5 * * 1', async () => {
    console.log('[CRON] Running weekly extraction scan + equity scores...');
    const alerts = await antiRedliningEngine.runExtractionScan();
    const scores = await antiRedliningEngine.computeEquityScores();
    console.log(`[CRON] Extraction scan: ${alerts.length} alerts, ${scores.length} community scores`);
  }, { scheduled: true, timezone: 'UTC' });
  console.log('[EQUITY CRON] Weekly extraction scan scheduled: Monday 5 AM UTC');
} catch (err) {
  console.warn('[EQUITY CRON] Could not schedule:', err.message);
}

// ── BREATH BRIDGE SCHEDULER (Mon/Wed/Fri 10 AM ET) ──────────
try {
  const breathBridgeService = require('./src/services/breathBridgeService');
  cron.schedule('0 10 * * 1,3,5', async () => {
    try {
      await breathBridgeService.runSchedulerCron();
    } catch (err) {
      console.error('[BREATH_BRIDGE CRON] Scheduler failed:', err.message);
      Sentry.captureException(err);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });
  console.log('[BREATH_BRIDGE CRON] Scheduler: Mon/Wed/Fri 10 AM America/New_York');
} catch (err) {
  console.warn('[BREATH_BRIDGE CRON] Could not schedule scheduler:', err.message);
}

// ── BREATH BRIDGE DELIVERY (every 30 minutes) ────────────────
try {
  const breathBridgeService = require('./src/services/breathBridgeService');
  cron.schedule('*/30 * * * *', async () => {
    try {
      await breathBridgeService.runDeliveryCron();
    } catch (err) {
      console.error('[BREATH_BRIDGE CRON] Delivery failed:', err.message);
      Sentry.captureException(err);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[BREATH_BRIDGE CRON] Delivery: */30 * * * * UTC');
} catch (err) {
  console.warn('[BREATH_BRIDGE CRON] Could not schedule delivery:', err.message);
}

// ── BREATH BRIDGE MONTHLY WARMTH SUMMARY (1st of month, 8 AM ET) ──
try {
  const breathBridgeSummary = require('./src/services/breathBridgeService');
  cron.schedule('0 8 1 * *', async () => {
    try {
      await breathBridgeSummary.runMonthlySummaryCron();
    } catch (err) {
      console.error('[BREATH_BRIDGE CRON] Monthly summary failed:', err.message);
      Sentry.captureException(err);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });
  console.log('[BREATH_BRIDGE CRON] Monthly summary: 1st of month 8 AM America/New_York');
} catch (err) {
  console.warn('[BREATH_BRIDGE CRON] Could not schedule monthly summary:', err.message);
}

  }); // end runPendingMigrations().finally()
