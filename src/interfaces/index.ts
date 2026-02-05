export interface TargetSchema {
  tableName: string;
  columns: Array<{ name: string; type: string; constraints?: string }>;
  description?: string;
}

export interface ILLMAdapter {
  generateSchema(sample: string): Promise<TargetSchema>;
  mapData(batch: any[], schema: TargetSchema): Promise<any[]>;
}

export interface IFileAdapter {
  readSample(path: string, lines?: number): Promise<string>;
  getStream(path: string): AsyncIterable<any>;
}

export interface IDatabaseAdapter {
  createTable(schema: TargetSchema): Promise<void>;
  insertBatch(tableName: string, data: any[]): Promise<void>;
}
