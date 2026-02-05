#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { UniversalImporter } from './core/UniversalImporter.js';
import { NodeFileAdapter } from './adapters/NodeFileAdapter.js';
import { SupabaseAdapter } from './adapters/SupabaseAdapter.js';
import { OpenAILLMAdapter } from './adapters/OpenAILLMAdapter.js';

dotenv.config();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: data-importer <file-path>");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error("Missing env vars: SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY");
    process.exit(1);
  }

  const importer = new UniversalImporter(
    new NodeFileAdapter(),
    new OpenAILLMAdapter(openaiKey),
    new SupabaseAdapter(supabaseUrl, supabaseKey)
  );

  try {
    await importer.execute(filePath);
  } catch (e) {
    console.error("Import failed:", e);
    process.exit(1);
  }
}

main();
