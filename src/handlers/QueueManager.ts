import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export type Priority = 'urgent' | 'high' | 'normal' | 'low';
export type Status = 'pending' | 'processing' | 'resolved' | 'failed';
export type RoutingAction = 'notify' | 'queue' | 'auto-respond' | 'ignore';

export interface Message {
  id: number;
  sender: string;
  content: string;
  priority: Priority;
  status: Status;
  timestamp: number;
  routing_action: RoutingAction;
  metadata?: string; // JSON string for extra data
}

export interface QueueFilters {
  status?: Status;
  priority?: Priority;
  routing_action?: RoutingAction;
  sender?: string;
  limit?: number;
  offset?: number;
}

export class QueueManager {
  private db: Database.Database;
  private insertStmt!: Database.Statement;
  private updateStatusStmt!: Database.Statement;
  private selectStmt!: Database.Statement;

  constructor(dbPath?: string) {
    const defaultPath = join(process.cwd(), 'data', 'antenna.db');
    const actualPath = dbPath || defaultPath;
    
    // Ensure directory exists
    const dir = join(actualPath, '..');
    try {
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      // Directory might already exist
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }

    this.db = new Database(actualPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeSchema();
    this.prepareStatements();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        priority TEXT NOT NULL CHECK(priority IN ('urgent', 'high', 'normal', 'low')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'resolved', 'failed')),
        timestamp INTEGER NOT NULL,
        routing_action TEXT NOT NULL CHECK(routing_action IN ('notify', 'queue', 'auto-respond', 'ignore')),
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_routing_action ON messages(routing_action);

      CREATE TRIGGER IF NOT EXISTS update_messages_timestamp
      AFTER UPDATE ON messages
      FOR EACH ROW
      BEGIN
        UPDATE messages SET updated_at = unixepoch() WHERE id = NEW.id;
      END;
    `);
  }

  private prepareStatements(): void {
    this.insertStmt = this.db.prepare(`
      INSERT INTO messages (sender, content, priority, status, timestamp, routing_action, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.updateStatusStmt = this.db.prepare(`
      UPDATE messages SET status = ? WHERE id = ?
    `);

    this.selectStmt = this.db.prepare(`
      SELECT id, sender, content, priority, status, timestamp, routing_action, metadata
      FROM messages
      WHERE 1=1
    `);
  }

  /**
   * Add a new message to the queue
   */
  addToQueue(
    message: string,
    priority: Priority,
    action: RoutingAction,
    sender: string,
    metadata?: Record<string, unknown>
  ): number {
    try {
      const result = this.insertStmt.run(
        sender,
        message,
        priority,
        'pending',
        Date.now(),
        action,
        metadata ? JSON.stringify(metadata) : null
      );
      
      console.log(`[QueueManager] Added message ${result.lastInsertRowid} from ${sender} (${priority}/${action})`);
      return result.lastInsertRowid as number;
    } catch (err) {
      console.error('[QueueManager] Failed to add message:', err);
      throw new Error(`Failed to add message to queue: ${(err as Error).message}`);
    }
  }

  /**
   * Retrieve messages from the queue based on filters
   */
  getQueue(filters: QueueFilters = {}): Message[] {
    try {
      let query = `
        SELECT id, sender, content, priority, status, timestamp, routing_action, metadata
        FROM messages
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.priority) {
        query += ' AND priority = ?';
        params.push(filters.priority);
      }

      if (filters.routing_action) {
        query += ' AND routing_action = ?';
        params.push(filters.routing_action);
      }

      if (filters.sender) {
        query += ' AND sender = ?';
        params.push(filters.sender);
      }

      query += ' ORDER BY timestamp DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as Message[];
      
      console.log(`[QueueManager] Retrieved ${results.length} messages with filters:`, filters);
      return results;
    } catch (err) {
      console.error('[QueueManager] Failed to retrieve messages:', err);
      throw new Error(`Failed to retrieve queue: ${(err as Error).message}`);
    }
  }

  /**
   * Mark a message as resolved
   */
  markResolved(messageId: number): void {
    this.updateStatus(messageId, 'resolved');
  }

  /**
   * Mark a message as processing
   */
  markProcessing(messageId: number): void {
    this.updateStatus(messageId, 'processing');
  }

  /**
   * Mark a message as failed
   */
  markFailed(messageId: number): void {
    this.updateStatus(messageId, 'failed');
  }

  /**
   * Update message status
   */
  private updateStatus(messageId: number, status: Status): void {
    try {
      const result = this.updateStatusStmt.run(status, messageId);
      
      if (result.changes === 0) {
        throw new Error(`Message ${messageId} not found`);
      }
      
      console.log(`[QueueManager] Updated message ${messageId} status to ${status}`);
    } catch (err) {
      console.error(`[QueueManager] Failed to update message ${messageId}:`, err);
      throw new Error(`Failed to update message status: ${(err as Error).message}`);
    }
  }

  /**
   * Get a single message by ID
   */
  getMessage(messageId: number): Message | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
      const result = stmt.get(messageId) as Message | undefined;
      return result || null;
    } catch (err) {
      console.error(`[QueueManager] Failed to get message ${messageId}:`, err);
      throw new Error(`Failed to get message: ${(err as Error).message}`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): Record<string, number> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM messages
        GROUP BY status
      `);
      
      const results = stmt.all() as Array<{ status: Status; count: number }>;
      const stats: Record<string, number> = {
        total: 0,
        pending: 0,
        processing: 0,
        resolved: 0,
        failed: 0,
      };

      for (const row of results) {
        stats[row.status] = row.count;
        stats.total += row.count;
      }

      return stats;
    } catch (err) {
      console.error('[QueueManager] Failed to get stats:', err);
      throw new Error(`Failed to get queue stats: ${(err as Error).message}`);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    console.log('[QueueManager] Database connection closed');
  }
}
