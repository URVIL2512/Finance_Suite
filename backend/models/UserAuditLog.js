import mongoose from 'mongoose';

const userAuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'status_change', 'password_reset', 'role_change'],
      required: true,
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

userAuditLogSchema.index({ userId: 1, createdAt: -1 });
userAuditLogSchema.index({ performedBy: 1, createdAt: -1 });

const UserAuditLog = mongoose.model('UserAuditLog', userAuditLogSchema);
export default UserAuditLog;
