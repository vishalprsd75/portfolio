// ═══════════════════════════════════════════════════════════
// Activity Logger
// Supports both signature styles:
// 1. logActivity(req, action, entityType, entityId, details)
// 2. logActivity({ userId, action, entityType, entityId, details, req })
// ═══════════════════════════════════════════════════════════

import { prisma } from '../config/db.js';

export async function logActivity(arg1, action, entityType, entityId, details = null) {
  try {
    let finalUserId = null;
    let finalAction = action;
    let finalEntityType = entityType;
    let finalEntityId = entityId;
    let finalDetails = details;
    let ipAddress = null;

    if (arg1 && typeof arg1 === 'object' && !arg1.session && !arg1.headers && arg1.action) {
      // Called with options object
      finalUserId = arg1.userId || null;
      finalAction = arg1.action;
      finalEntityType = arg1.entityType || null;
      finalEntityId = arg1.entityId || null;
      finalDetails = arg1.details || null;
      ipAddress = arg1.ipAddress || null;
    } else if (arg1 && (arg1.session || arg1.headers || arg1.ip)) {
      // Called with req object
      finalUserId = arg1.session?.userId || null;
      ipAddress = arg1.ip || arg1.connection?.remoteAddress || null;
    }

    await prisma.activityLog.create({
      data: {
        userId: finalUserId,
        action: finalAction || 'unknown.action',
        entityType: finalEntityType,
        entityId: finalEntityId,
        details: finalDetails,
        ipAddress,
      },
    });
  } catch (err) {
    // Don't let logging failures break the main flow
    console.error('[ActivityLog Error]', err.message);
  }
}
