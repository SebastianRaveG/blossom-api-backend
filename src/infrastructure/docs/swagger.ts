/**
 * @module swagger
 *
 * OpenAPI 3.0 specification for the Blossom API.
 * Served at GET /docs via swagger-ui-express.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Blossom API',
      version:     '1.0.0',
      description: `
Unified REST API that provides normalized access to **Pokémon** and **Digimon** franchise data.

## Architecture
Built with **Hexagonal Architecture** (Ports & Adapters) in TypeScript:
- **Domain** — pure business entities and port interfaces
- **Application** — use cases with no infrastructure dependencies
- **Infrastructure** — adapters (PokeAPI, DigiAPI), SQLite logger, in-memory cache

## Plus Features
- 🗄️  SQLite request logging with queryable \`/api/logs\` endpoint
- ⚡  In-memory TTL cache (configurable via \`CACHE_TTL_SECONDS\`)
- 🛡️  Rate limiting (100 req / IP / 15 min, configurable)
- 🔑  Request ID tracking (\`X-Request-ID\` header)
- 🏥  Health check endpoint (\`/health\`)
- 📄  This Swagger documentation
      `.trim(),
      contact: { name: 'Blossom API' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    tags: [
      { name: 'Franchise', description: 'Franchise character lookup' },
      { name: 'Logs',      description: 'Request audit logs' },
      { name: 'Health',    description: 'Server health' },
    ],
    components: {
      schemas: {
        FranchiseCharacter: {
          type: 'object',
          required: ['name', 'powers', 'evolutions'],
          properties: {
            name:       { type: 'string', example: 'pikachu' },
            weight:     { type: 'number', nullable: true, example: 60, description: 'Weight in hectograms (Pokémon only)' },
            powers:     { type: 'array', items: { type: 'string' }, example: ['static', 'lightning-rod'] },
            evolutions: { type: 'array', items: { type: 'string' }, example: ['pichu', 'pikachu', 'raichu'] },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code:    { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Query parameter "metadata" is required.' },
                details: { type: 'object', nullable: true },
              },
            },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
        LogEntry: {
          type: 'object',
          properties: {
            id:             { type: 'integer' },
            requestId:      { type: 'string', format: 'uuid' },
            franchise:      { type: 'string', enum: ['pokemon', 'digimon'] },
            version:        { type: 'string' },
            metadata:       { type: 'string', description: 'JSON-serialized CharacterQuery' },
            timestamp:      { type: 'string', format: 'date-time' },
            status:         { type: 'string', enum: ['success', 'error'] },
            responseTimeMs: { type: 'integer' },
            errorMessage:   { type: 'string', nullable: true },
          },
        },
      },
    },
    paths: {
      '/api/{franchise}/{version}': {
        get: {
          summary:     'Get character data',
          description: 'Retrieve and normalize a character from the specified franchise.',
          tags:        ['Franchise'],
          parameters: [
            {
              in: 'path', name: 'franchise', required: true,
              schema: { type: 'string', enum: ['pokemon', 'digimon'] },
              example: 'pokemon',
            },
            {
              in: 'path', name: 'version', required: true,
              schema: { type: 'string' },
              example: 'v1',
            },
            {
              in: 'query', name: 'metadata', required: true,
              description: 'JSON object. Must contain "name" (string) OR "id" (integer).',
              schema: { type: 'string' },
              example: '{"name":"pikachu"}',
            },
            {
              in: 'query', name: 'config', required: true,
              description: 'JSON object with "baseUrl" (required), "apiKey" and "headers" (optional).',
              schema: { type: 'string' },
              example: '{"baseUrl":"https://pokeapi.co/api/v2"}',
            },
          ],
          responses: {
            '200': {
              description: 'Character data',
              headers: {
                'X-Cache':            { schema: { type: 'string', enum: ['HIT', 'MISS'] } },
                'X-Request-ID':       { schema: { type: 'string' } },
                'X-Response-Time-Ms': { schema: { type: 'integer' } },
              },
              content: { 'application/json': { schema: { $ref: '#/components/schemas/FranchiseCharacter' } } },
            },
            '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Character not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '429': { description: 'Rate limit exceeded' },
            '502': { description: 'External API error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/logs': {
        get: {
          summary: 'Get request logs',
          tags:    ['Logs'],
          parameters: [
            { in: 'query', name: 'limit',     schema: { type: 'integer', default: 50, maximum: 200 } },
            { in: 'query', name: 'franchise', schema: { type: 'string', enum: ['pokemon', 'digimon'] } },
          ],
          responses: {
            '200': {
              description: 'Log entries',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      limit: { type: 'integer' },
                      logs:  { type: 'array', items: { $ref: '#/components/schemas/LogEntry' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/health': {
        get: {
          summary:  'Health check',
          tags:     ['Health'],
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status:    { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime:    { type: 'string', example: '42s' },
                      version:   { type: 'string', example: '1.0.0' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],  // We define everything inline above
};

export const swaggerSpec = swaggerJsdoc(options);
