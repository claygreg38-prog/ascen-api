// ============================================================
// IPFS Service — Pinata Upload + Clinical Payload Encryption
// File: src/services/ipfsService.js
//
// Uploads breath art PNGs and metadata JSON to IPFS via Pinata.
// Clinical payload is AES-256 encrypted before upload.
// Called by sessionOrchestrator after breathArtEngine.generate().
// ============================================================

const crypto = require('crypto');

const PINATA_API_URL = 'https://api.pinata.cloud';

/**
 * Encrypt clinical payload with AES-256-CBC
 * @param {Object} payload - Clinical data to encrypt
 * @param {string} key - 256-bit hex key from ART_ENCRYPTION_KEY env var
 * @returns {string} iv:ciphertext (hex encoded)
 */
function encryptClinicalPayload(payload, key) {
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(key, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt clinical payload
 * @param {string} encryptedString - iv:ciphertext (hex encoded)
 * @param {string} key - 256-bit hex key
 * @returns {Object} Decrypted clinical data
 */
function decryptClinicalPayload(encryptedString, key) {
  const [ivHex, ciphertext] = encryptedString.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * Upload a buffer to Pinata as a file
 * @param {Buffer} buffer - File content
 * @param {string} fileName - Name for the file on IPFS
 * @returns {string} IPFS hash (CID)
 */
async function uploadBufferToPinata(buffer, fileName) {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY must be set');
  }

  // Build multipart form data manually to avoid extra dependencies
  const boundary = '----PinataFormBoundary' + crypto.randomBytes(16).toString('hex');
  const metadata = JSON.stringify({
    name: fileName,
    keyvalues: { app: 'ascen-breathworx', type: 'breath-art' }
  });

  const parts = [];

  // Pinata metadata part
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="pinataMetadata"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    metadata + '\r\n'
  );

  // File part
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  );

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, buffer, footer]);

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'pinata_api_key': apiKey,
      'pinata_secret_api_key': secretKey,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result.IpfsHash;
}

/**
 * Upload JSON metadata to Pinata
 * @param {Object} metadata - Metadata JSON object
 * @param {string} name - Name for the pin
 * @returns {string} IPFS hash (CID)
 */
async function uploadJSONToPinata(metadata, name) {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY must be set');
  }

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'pinata_api_key': apiKey,
      'pinata_secret_api_key': secretKey,
    },
    body: JSON.stringify({
      pinataMetadata: {
        name,
        keyvalues: { app: 'ascen-breathworx', type: 'breath-art-metadata' }
      },
      pinataContent: metadata,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata JSON upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result.IpfsHash;
}

/**
 * Full upload pipeline: PNG + metadata to IPFS
 *
 * @param {Buffer} pngBuffer - Rendered PNG image
 * @param {Object} metadataJSON - Token metadata (name, description, attributes)
 * @param {Object} clinicalPayload - Clinical data to encrypt and embed
 * @param {Object} options - { sessionNumber, firstName }
 * @returns {{ imageHash: string, metadataHash: string }}
 */
async function upload(pngBuffer, metadataJSON, clinicalPayload, options = {}) {
  const { sessionNumber = 0, firstName = 'Participant' } = options;
  const encryptionKey = process.env.ART_ENCRYPTION_KEY;

  if (!encryptionKey) {
    console.warn('[IPFS] ART_ENCRYPTION_KEY not set — skipping art upload, session completion continues');
    return { imageHash: null, metadataHash: null, skipped: true, reason: 'no_encryption_key' };
  }

  // Graceful degradation: if Pinata keys are missing, skip IPFS upload
  const pinataKey = process.env.PINATA_API_KEY;
  const pinataSecret = process.env.PINATA_SECRET_KEY;
  if (!pinataKey || !pinataSecret) {
    console.warn('[IPFS] PINATA_API_KEY/PINATA_SECRET_KEY not set — art generated but IPFS upload skipped. Session completion continues.');
    // Encrypt clinical payload locally even without upload (for future backfill)
    const encryptedClinical = encryptClinicalPayload(clinicalPayload, encryptionKey);
    return {
      imageHash: null,
      metadataHash: null,
      skipped: true,
      reason: 'no_pinata_keys',
      encrypted_clinical: encryptedClinical
    };
  }

  // 1. Upload PNG to Pinata
  const imageFileName = `breath_${sessionNumber}_${Date.now()}.png`;
  const imageHash = await uploadBufferToPinata(pngBuffer, imageFileName);

  // 2. Encrypt clinical payload
  const encryptedClinical = encryptClinicalPayload(clinicalPayload, encryptionKey);

  // 3. Build final metadata with image hash and encrypted clinical data
  const fullMetadata = {
    ...metadataJSON,
    image: `ipfs://${imageHash}`,
    clinical_payload: encryptedClinical,
    encoding_version: 1,
  };

  // 4. Upload metadata JSON to Pinata
  const metadataName = `breath_meta_${sessionNumber}_${Date.now()}`;
  const metadataHash = await uploadJSONToPinata(fullMetadata, metadataName);

  return { imageHash, metadataHash };
}

module.exports = {
  upload,
  encryptClinicalPayload,
  decryptClinicalPayload,
};
