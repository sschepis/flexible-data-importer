import { ILLMAdapter, TargetSchema } from '../interfaces/index.js';

export class OpenAILLMAdapter implements ILLMAdapter {
  constructor(private apiKey: string, private model: string = 'gpt-4-turbo-preview') {}

  async generateSchema(sample: string): Promise<TargetSchema> {
    const prompt = `Analyze this data sample and propose a SQL table schema.
    Identify the most likely 'tableName' (e.g., users, transactions).
    For each column, determine the standard SQL type (TEXT, INT, BOOLEAN, TIMESTAMP, etc.).
    
    Sample Data:
    ${sample.substring(0, 2000)}

    Return JSON format:
    {
      "tableName": "string",
      "columns": [
        { "name": "string", "type": "string", "constraints": "PRIMARY KEY | NULL | etc" }
      ]
    }`;

    const response = await this.callLLM(prompt, true);
    return JSON.parse(response);
  }

  async mapData(batch: any[], schema: TargetSchema): Promise<any[]> {
    // For small batches, we can ask LLM to normalize.
    // Ideally, we'd ask LLM to generate a JS mapping function, but this is safer for complex dirty data.
    const prompt = `Map the following raw data batch to the target schema.
    Target Schema: ${JSON.stringify(schema.columns.map(c => c.name))}
    
    Rules:
    1. Rename keys to match schema column names exactly.
    2. Convert types (e.g. "YES" -> true, "2023/01/01" -> ISO Date).
    3. Return valid JSON array of objects.

    Raw Data:
    ${JSON.stringify(batch)}
    `;

    const response = await this.callLLM(prompt, true);
    return JSON.parse(response);
  }

  private async callLLM(prompt: string, jsonMode: boolean): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'system', content: 'You are a Data Engineer.' }, { role: 'user', content: prompt }],
        response_format: jsonMode ? { type: 'json_object' } : undefined
      })
    });
    
    const data = await res.json();
    return data.choices[0].message.content;
  }
}
