import { jest } from '@jest/globals';
import { OpenAILLMAdapter } from '../src/adapters/OpenAILLMAdapter';

// Mock global fetch with correct typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('OpenAILLMAdapter', () => {
  let adapter: OpenAILLMAdapter;

  beforeEach(() => {
    mockFetch.mockClear();
    adapter = new OpenAILLMAdapter('fake-key');
  });

  test('generateSchema should parse JSON response from LLM', async () => {
    const mockResponse = {
      tableName: 'users',
      columns: [{ name: 'email', type: 'TEXT' }]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      })
    } as Response);

    const schema = await adapter.generateSchema('email,name\ntest@test.com,test');

    expect(schema).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Verify prompt construction
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
    expect(callBody.model).toBe('gpt-4-turbo-preview');
    expect(callBody.response_format).toEqual({ type: 'json_object' });
  });

  test('mapData should return mapped array', async () => {
    const mockMapped = [{ id: 1, active: true }];
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockMapped) } }]
      })
    } as Response);

    const result = await adapter.mapData([{ ID: '1', IsActive: 'YES' }], { tableName: 't', columns: [] });
    
    expect(result).toEqual(mockMapped);
  });
});
