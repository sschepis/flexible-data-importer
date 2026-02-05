import { IDatabaseAdapter, TargetSchema } from '../interfaces/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseAdapter implements IDatabaseAdapter {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async createTable(schema: TargetSchema): Promise<void> {
    // Supabase JS client doesn't support DDL directly via typical methods.
    // We usually need to run raw SQL via RPC or use the Postgres connection directly.
    // However, assuming we have a privileged "service_role" key, we might run SQL via an edge function or RPC.
    // For this POC, we will mock the DDL execution OR assume a 'exec_sql' RPC function exists.
    
    const sql = this.generateDDL(schema);
    console.log(`[SupabaseAdapter] Executing DDL:\n${sql}`);
    
    // In a real generic skill, we'd probably require a direct PG connection for DDL, 
    // or rely on the user manually running the schema.
    // Here we will try to use the `rpc` method if available, or just log it if we can't.
    
    try {
        const { error } = await this.client.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.warn(`[SupabaseAdapter] Warning: Automatic table creation failed (RPC 'exec_sql' missing?). You may need to run this SQL manually:\n${sql}`);
        }
    } catch (e) {
        console.warn(`[SupabaseAdapter] Warning: Could not auto-create table. SQL:\n${sql}`);
    }
  }

  async insertBatch(tableName: string, data: any[]): Promise<void> {
    const { error } = await this.client.from(tableName).upsert(data);
    if (error) throw new Error(`Supabase Insert Failed: ${error.message}`);
  }

  private generateDDL(schema: TargetSchema): string {
    const cols = schema.columns.map(c => `  "${c.name}" ${c.type} ${c.constraints || ''}`).join(',\n');
    return `CREATE TABLE IF NOT EXISTS "${schema.tableName}" (\n${cols}\n);`;
  }
}
