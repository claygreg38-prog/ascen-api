// ============================================================
// Tenant Helper — Query Filtering Utilities
// File: src/utils/tenantHelper.js
//
// Adds tenant_id filtering to queries. If tenantId is null
// (backward compat during transition), returns unfiltered.
// ============================================================

/**
 * Get tenant_id from request context.
 */
function getTenantId(req) {
  return req.tenantId || req.user?.tenantId || null;
}

/**
 * Build a tenant WHERE clause for existing queries.
 * Returns { clause, params } where clause starts with " AND ".
 *
 * Usage:
 *   const t = tenantWhere(req.tenantId, existingParams.length);
 *   const query = `SELECT * FROM foo WHERE user_id = $1 ${t.clause}`;
 *   const params = [...existingParams, ...t.params];
 *
 * @param {string|null} tenantId
 * @param {number} paramOffset - current number of params (for $N numbering)
 * @param {string} alias - table alias (default: no alias)
 * @returns {{ clause: string, params: Array }}
 */
function tenantWhere(tenantId, paramOffset = 0, alias = '') {
  if (!tenantId) return { clause: '', params: [] };
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  return { clause: ` AND ${col} = $${paramOffset + 1}`, params: [tenantId] };
}

/**
 * Build tenant_id column + value for INSERT statements.
 * Returns { columns: ', tenant_id', values: ', $N', params: [tenantId] }
 *
 * @param {string|null} tenantId
 * @param {number} paramOffset
 */
function tenantInsert(tenantId, paramOffset = 0) {
  if (!tenantId) return { columns: '', values: '', params: [] };
  return { columns: ', tenant_id', values: `, $${paramOffset + 1}`, params: [tenantId] };
}

module.exports = { getTenantId, tenantWhere, tenantInsert };
