import { IFileAdapter } from '../interfaces/index.js';
import * as fs from 'fs';
import * as readline from 'readline';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';

export class NodeFileAdapter implements IFileAdapter {
  async readSample(filePath: string, lines: number = 5): Promise<string> {
    if (filePath.endsWith('.csv')) {
      return this.readCsvSample(filePath, lines);
    } else if (filePath.endsWith('.json')) {
        return this.readJsonSample(filePath, lines);
    } else if (filePath.endsWith('.xlsx')) {
        return this.readXlsxSample(filePath, lines);
    }
    throw new Error('Unsupported file format');
  }

  async *getStream(filePath: string): AsyncIterable<any> {
    if (filePath.endsWith('.csv')) {
        const stream = fs.createReadStream(filePath).pipe(csv());
        for await (const row of stream) {
            yield row;
        }
    } else if (filePath.endsWith('.json')) {
        // Simple JSON array streaming (not robust for massive single-line arrays, but okay for ndjson or pretty-printed)
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            for (const item of data) yield item;
        } else {
            yield data;
        }
    } else if (filePath.endsWith('.xlsx')) {
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        for (const item of data) yield item;
    }
  }

  private async readCsvSample(filePath: string, lines: number): Promise<string> {
    const results: any[] = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                if (results.length < lines) results.push(data);
            })
            .on('end', () => resolve(JSON.stringify(results, null, 2)))
            .on('error', reject);
    });
  }

  private async readJsonSample(filePath: string, lines: number): Promise<string> {
      // Just read first 2KB for sample
      const fd = await fs.promises.open(filePath, 'r');
      const buf = Buffer.alloc(2048);
      await fd.read(buf, 0, 2048, 0);
      await fd.close();
      return buf.toString('utf-8');
  }

  private async readXlsxSample(filePath: string, lines: number): Promise<string> {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      return JSON.stringify(data.slice(0, lines), null, 2);
  }
}
