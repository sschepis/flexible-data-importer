import { jest } from '@jest/globals';
import { UniversalImporter } from '../src/core/UniversalImporter';
import { IFileAdapter, ILLMAdapter, IDatabaseAdapter, TargetSchema } from '../src/interfaces';

// Mock Interfaces
const mockFileAdapter = {
  readSample: jest.fn<IFileAdapter['readSample']>(),
  getStream: jest.fn<IFileAdapter['getStream']>()
};

const mockLLMAdapter = {
  generateSchema: jest.fn<ILLMAdapter['generateSchema']>(),
  mapData: jest.fn<ILLMAdapter['mapData']>()
};

const mockDBAdapter = {
  createTable: jest.fn<IDatabaseAdapter['createTable']>(),
  insertBatch: jest.fn<IDatabaseAdapter['insertBatch']>()
};

describe('UniversalImporter Core', () => {
  let importer: UniversalImporter;

  beforeEach(() => {
    jest.clearAllMocks();
    importer = new UniversalImporter(
      mockFileAdapter as unknown as IFileAdapter,
      mockLLMAdapter as unknown as ILLMAdapter,
      mockDBAdapter as unknown as IDatabaseAdapter
    );
  });

  test('should execute full import pipeline successfully', async () => {
    // 1. Setup Mocks
    const mockSchema: TargetSchema = {
      tableName: 'test_users',
      columns: [{ name: 'id', type: 'INT' }, { name: 'name', type: 'TEXT' }]
    };

    // File Adapter Mock
    mockFileAdapter.readSample.mockResolvedValue('id,name\n1,alice');
    // Async Generator for stream
    mockFileAdapter.getStream.mockImplementation(async function* () {
      yield { id: '1', name: 'alice' };
      yield { id: '2', name: 'bob' };
    });

    // LLM Mock
    mockLLMAdapter.generateSchema.mockResolvedValue(mockSchema);
    mockLLMAdapter.mapData.mockImplementation(async (batch) => batch); // Identity transform

    // 2. Execute
    const result = await importer.execute('dummy.csv');

    // 3. Assertions
    // Step 1: Inspection
    expect(mockFileAdapter.readSample).toHaveBeenCalledWith('dummy.csv', 5);
    expect(mockLLMAdapter.generateSchema).toHaveBeenCalledWith('id,name\n1,alice');
    
    // Step 2: Prep
    expect(mockDBAdapter.createTable).toHaveBeenCalledWith(mockSchema);

    // Step 3: Load
    // We yielded 2 items. Batch size is 50. Should be 1 batch.
    expect(mockLLMAdapter.mapData).toHaveBeenCalledTimes(1);
    expect(mockDBAdapter.insertBatch).toHaveBeenCalledTimes(1);
    expect(mockDBAdapter.insertBatch).toHaveBeenCalledWith('test_users', [
      { id: '1', name: 'alice' },
      { id: '2', name: 'bob' }
    ]);

    expect(result.success).toBe(true);
    expect(result.totalRecords).toBe(2);
  });

  test('should chunk processing into batches', async () => {
     // Mock a stream larger than default batch size (50)
     mockFileAdapter.readSample.mockResolvedValue('header');
     mockLLMAdapter.generateSchema.mockResolvedValue({ tableName: 't', columns: [] });
     mockLLMAdapter.mapData.mockImplementation(async (b) => b);

     mockFileAdapter.getStream.mockImplementation(async function* () {
       for (let i = 0; i < 55; i++) {
         yield { id: i };
       }
     });

     await importer.execute('bigfile.csv');

     // 55 items / 50 batch size = 1 full batch + 1 partial batch
     expect(mockDBAdapter.insertBatch).toHaveBeenCalledTimes(2);
     
     // First call should have 50 items
     expect(mockDBAdapter.insertBatch.mock.calls[0][1].length).toBe(50);
     // Second call should have 5 items
     expect(mockDBAdapter.insertBatch.mock.calls[1][1].length).toBe(5);
  });
});
