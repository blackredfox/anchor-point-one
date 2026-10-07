export type Bindings = {
  DB: D1Database;
  BUCKET?: R2Bucket;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL_TO?: string;
  NOTIFICATION_EMAIL_FROM?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
  TWILIO_WEBHOOK_URL?: string;
  TWILIO_STATUS_WEBHOOK_URL?: string;
  TWILIO_AUTO_ACK_ENABLED?: string;
  TWILIO_VOICE_WEBHOOK_URL?: string;
  TWILIO_VOICE_COMPLETE_WEBHOOK_URL?: string;
  TWILIO_RECORDING_WEBHOOK_URL?: string;
  TWILIO_TRANSCRIPTION_WEBHOOK_URL?: string;
  TWILIO_VOICEMAIL_TRANSCRIPTION_ENABLED?: string;
  NOTIFICATION_SMS_TO?: string;
};

export function getBindings(): Bindings {
  const bindings = (
    globalThis as typeof globalThis & { __ANCHOR_POINT_ENV__?: Bindings }
  ).__ANCHOR_POINT_ENV__;
  if (!bindings) throw new Error("Runtime bindings are unavailable.");
  return bindings;
}

let ready: Promise<void> | null = null;

export async function ensureDatabase(): Promise<D1Database> {
  const { DB } = getBindings();
  if (!DB) throw new Error("Database is unavailable.");
  ready ??= initialize(DB).catch((error) => {
    ready = null;
    throw error;
  });
  await ready;
  return DB;
}

async function initialize(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY NOT NULL, access_token TEXT NOT NULL,
      customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, service_type TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL, owner_read_at INTEGER, is_important INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS service_requests_access_token_idx ON service_requests (access_token)"),
    db.prepare("CREATE INDEX IF NOT EXISTS service_requests_updated_at_idx ON service_requests (updated_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS request_preferences (
      request_id TEXT PRIMARY KEY NOT NULL, submission_key TEXT NOT NULL,
      preferred_contact_method TEXT NOT NULL, rv_details TEXT NOT NULL,
      equipment_model TEXT NOT NULL, appointment_preference TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '', postal_code TEXT NOT NULL DEFAULT '',
      rv_type TEXT NOT NULL DEFAULT '', source_channel TEXT NOT NULL DEFAULT 'web',
      FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS request_preferences_submission_key_idx ON request_preferences (submission_key)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS request_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, request_id TEXT NOT NULL,
      author_type TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL,
      FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS request_messages_request_id_idx ON request_messages (request_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS request_attachments (
      id TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL,
      message_created_at INTEGER NOT NULL, author_type TEXT NOT NULL,
      object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL, created_at INTEGER NOT NULL,
      FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS request_attachments_request_id_idx ON request_attachments (request_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS request_attachments_message_idx ON request_attachments (request_id, message_created_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS sms_consents (
      request_id TEXT PRIMARY KEY NOT NULL, phone_e164 TEXT NOT NULL,
      consented_at INTEGER NOT NULL, consent_version TEXT NOT NULL,
      consent_method TEXT NOT NULL DEFAULT 'legacy', consent_call_sid TEXT,
      opted_out_at INTEGER,
      FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS sms_consents_phone_e164_idx ON sms_consents (phone_e164)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS twilio_message_events (
      sid TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL,
      direction TEXT NOT NULL, created_at INTEGER NOT NULL,
      FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS twilio_message_events_request_id_idx ON twilio_message_events (request_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS twilio_delivery_statuses (
      sid TEXT PRIMARY KEY NOT NULL, request_id TEXT, message_id INTEGER,
      status TEXT NOT NULL, error_code TEXT, updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS twilio_delivery_statuses_request_id_idx ON twilio_delivery_statuses (request_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS twilio_delivery_statuses_message_id_idx ON twilio_delivery_statuses (message_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS phone_conversations (
      phone_e164 TEXT PRIMARY KEY NOT NULL, active_request_id TEXT NOT NULL,
      last_activity_at INTEGER NOT NULL, last_ack_at INTEGER,
      FOREIGN KEY (active_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS phone_conversations_request_id_idx ON phone_conversations (active_request_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY NOT NULL, customer_name TEXT NOT NULL, email TEXT NOT NULL,
      service_type TEXT NOT NULL, rating INTEGER NOT NULL, body TEXT NOT NULL,
      owner_response TEXT, owner_responded_at INTEGER, created_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews (created_at)"),
  ]);
}
