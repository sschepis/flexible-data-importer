import { IFileAdapter, ILLMAdapter, IDatabaseAdapter, TargetSchema } from '../interfaces/index.js';

export class UniversalImporter {
  constructor(
    private fileAdapter: IFileAdapter,
    private llmAdapter: ILLMAdapter,
    private dbAdapter: IDatabaseAdapter
  ) {}

  async execute(filePath: string) {
    console.log(`[Importer] Starting import for ${filePath}...`);

    // 1. Inspection: Read sample and generate schema
    const sample = await this.fileAdapter.readSample(filePath, 5); // Read first 5 records/lines
    console.log(`[Importer] Sample data loaded. Analyzing with AI...`);

    const schema = await this.llmAdapter.generateSchema(sample);
    console.log(`[Importer] Schema proposed: ${schema.tableName}`);
    console.log(JSON.stringify(schema, null, 2));

    // 2. Preparation: Create table in DB
    await this.dbAdapter.createTable(schema);
    console.log(`[Importer] Table ${schema.tableName} ready.`);

    // 3. Transformation & Loading: Stream and batch process
    const BATCH_SIZE = 50; // Keep small for LLM stability if using mapping
    let batch: any[] = [];
    let totalProcessed = 0;

    for await (const record of this.fileAdapter.getStream(filePath)) {
      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        await this.processBatch(batch, schema);
        totalProcessed += batch.length;
        console.log(`[Importer] Processed ${totalProcessed} records...`);
        batch = [];
      }
    }

    // Process remaining
    if (batch.length > 0) {
      await this.processBatch(batch, schema);
      totalProcessed += batch.length;
    }

    console.log(`[Importer] Import complete! Total records: ${totalProcessed}`);
    return { success: true, totalRecords: totalProcessed, schema };
  }

  private async processBatch(batch: any[], schema: TargetSchema) {
    // Transform data to match schema types/names using LLM or heuristic
    // For high volume, LLM per batch is slow. 
    // Optimization: Generate a mapping function ONCE in step 1, then apply it here code-side.
    // For this POC, we will ask the LLM to "clean/map" the batch to ensure robustness.
    
    const mappedData = await this.llmAdapter.mapData(batch, schema);
    await this.dbAdapter.insertBatch(schema.tableName, mappedData);
  }
}
