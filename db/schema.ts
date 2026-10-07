import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  serviceType: text("service_type").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  ownerReadAt: integer("owner_read_at"),
  isImportant: integer("is_important").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("service_requests_access_token_idx").on(table.accessToken),
  index("service_requests_updated_at_idx").on(table.updatedAt),
]);

export const requestPreferences = sqliteTable("request_preferences", {
  requestId: text("request_id").primaryKey().references(() => serviceRequests.id, { onDelete: "cascade" }),
  submissionKey: text("submission_key").notNull(),
  preferredContactMethod: text("preferred_contact_method").notNull(),
  rvDetails: text("rv_details").notNull(),
  equipmentModel: text("equipment_model").notNull(),
  appointmentPreference: text("appointment_preference").notNull(),
  city: text("city").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  rvType: text("rv_type").notNull().default(""),
  sourceChannel: text("source_channel").notNull().default("web"),
}, (table) => [
  uniqueIndex("request_preferences_submission_key_idx").on(table.submissionKey),
]);

export const requestMessages = sqliteTable("request_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("request_messages_request_id_idx").on(table.requestId)]);

export const requestAttachments = sqliteTable("request_attachments", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  messageCreatedAt: integer("message_created_at").notNull(),
  authorType: text("author_type").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("request_attachments_request_id_idx").on(table.requestId),
  index("request_attachments_message_idx").on(table.requestId, table.messageCreatedAt),
]);

export const smsConsents = sqliteTable("sms_consents", {
  requestId: text("request_id").primaryKey().references(() => serviceRequests.id, { onDelete: "cascade" }),
  phoneE164: text("phone_e164").notNull(),
  consentedAt: integer("consented_at").notNull(),
  consentVersion: text("consent_version").notNull(),
  consentMethod: text("consent_method").notNull().default("legacy"),
  consentCallSid: text("consent_call_sid"),
  optedOutAt: integer("opted_out_at"),
}, (table) => [index("sms_consents_phone_e164_idx").on(table.phoneE164)]);

export const twilioMessageEvents = sqliteTable("twilio_message_events", {
  sid: text("sid").primaryKey(),
  requestId: text("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("twilio_message_events_request_id_idx").on(table.requestId)]);

export const twilioDeliveryStatuses = sqliteTable("twilio_delivery_statuses", {
  sid: text("sid").primaryKey(),
  requestId: text("request_id"),
  messageId: integer("message_id"),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("twilio_delivery_statuses_request_id_idx").on(table.requestId),
  index("twilio_delivery_statuses_message_id_idx").on(table.messageId),
]);

export const phoneConversations = sqliteTable("phone_conversations", {
  phoneE164: text("phone_e164").primaryKey(),
  activeRequestId: text("active_request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  lastActivityAt: integer("last_activity_at").notNull(),
  lastAckAt: integer("last_ack_at"),
}, (table) => [index("phone_conversations_request_id_idx").on(table.activeRequestId)]);

export const twilioVoiceCalls = sqliteTable("twilio_voice_calls", {
  callSid: text("call_sid").primaryKey(),
  requestId: text("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  fromPhone: text("from_phone").notNull(),
  recordingSid: text("recording_sid"),
  recordingStatus: text("recording_status").notNull().default("pending"),
  recordingAttachmentId: text("recording_attachment_id"),
  transcriptionText: text("transcription_text"),
  notificationSentAt: integer("notification_sent_at"),
  transcriptionNotifiedAt: integer("transcription_notified_at"),
  smsFollowUpSentAt: integer("sms_follow_up_sent_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("twilio_voice_calls_request_id_idx").on(table.requestId),
  uniqueIndex("twilio_voice_calls_recording_sid_idx").on(table.recordingSid),
]);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  serviceType: text("service_type").notNull(),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  ownerResponse: text("owner_response"),
  ownerRespondedAt: integer("owner_responded_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("reviews_created_at_idx").on(table.createdAt)]);
