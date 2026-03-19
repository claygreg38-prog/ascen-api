// ============================================================
// Tenant Resolver Middleware
// File: src/middleware/tenantResolver.js
//
// Resolves tenant context on every request. Does NOT break
// existing routes — tenantId is nullable during transition.
//
// Resolution order:
//   1. JWT claim: req.user.tenant_id
//   2. X-Tenant-Slug header (test harness)
//   3. Subdomain: {slug}.ascenbreath.com
//   4. Default: 'ascen' tenant
// ============================================================

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Cache tenant lookups (tenants rarely change)
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function resolveTenantBySlug(slug) {
  const cached = tenantCache.get(slug);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const result = await pool.query('SELECT id, slug, config, feature_flags FROM tenants WHERE slug = $1', [slug]);
    const data = result.rows[0] || null;
    tenantCache.set(slug, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error('[Tenant] Lookup failed:', err.message);
    return null;
  }
}

async function tenantResolver(req, res, next) {
  let tenantId = null;
  let tenantConfig = null;
  let tenantFeatures = null;

  // 1. From JWT claim
  if (req.user && req.user.tenant_id) {
    tenantId = req.user.tenant_id;
  }
  // 2. From X-Tenant-Slug header (test harness)
  else if (req.headers['x-tenant-slug']) {
    const tenant = await resolveTenantBySlug(req.headers['x-tenant-slug']);
    if (tenant) {
      tenantId = tenant.id;
      tenantConfig = tenant.config;
      tenantFeatures = tenant.feature_flags;
    }
  }
  // 3. From subdomain
  else if (req.hostname) {
    const slug = req.hostname.split('.')[0];
    if (slug !== 'www' && slug !== 'localhost' && slug !== '127') {
      const tenant = await resolveTenantBySlug(slug);
      if (tenant) {
        tenantId = tenant.id;
        tenantConfig = tenant.config;
        tenantFeatures = tenant.feature_flags;
      }
    }
  }

  // 4. Default to ASCEN tenant
  if (!tenantId) {
    const defaultTenant = await resolveTenantBySlug('ascen');
    if (defaultTenant) {
      tenantId = defaultTenant.id;
      tenantConfig = defaultTenant.config;
      tenantFeatures = defaultTenant.feature_flags;
    }
  }

  req.tenantId = tenantId;
  req.tenantConfig = tenantConfig;
  req.tenantFeatures = tenantFeatures;
  next();
}

module.exports = { tenantResolver };
