import {
  ACCESS_COOKIE,
  API_PREFIX,
  CSRF_HEADER,
  GRADES,
  LANGUAGES,
  ROLES,
  SELF_REGISTERABLE_ROLES,
  TN_DISTRICTS,
  VERIFICATION_STATUSES,
} from '@farmfair/shared';
import { env } from '../config/env';
import { version } from '../version';

/**
 * Hand-written OpenAPI document.
 *
 * Kept explicit rather than generated from the Zod schemas: the generated
 * output needs almost as much annotation to be readable, and this file doubles
 * as the human description of the auth flow.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'FarmFair API',
    version,
    description: [
      'Fair price discovery and marketplace API for Tamil Nadu farmers and buyers.',
      '',
      '### Authentication',
      'Sessions are cookie based. `POST /auth/login` sets two httpOnly cookies:',
      `an access token (\`${ACCESS_COOKIE}\`, 15 minutes) and a refresh token`,
      '(7 days, scoped to `/api/v1/auth`). When a request returns 401 with code',
      '`TOKEN_EXPIRED`, call `POST /auth/refresh` to rotate both and retry once.',
      '',
      '### CSRF',
      `Call \`GET /auth/csrf\` first, then send the token in the \`${CSRF_HEADER}\``,
      'header on every POST, PATCH, PUT and DELETE. Requests without a matching',
      'header and cookie are rejected with 403 `CSRF_INVALID`.',
      '',
      '### Errors',
      'Every response uses `{ success, data?, error? }`. Validation failures',
      'return 400 with `error.details` listing `{ path, message }` per field.',
    ].join('\n'),
  },
  servers: [{ url: `http://localhost:${env.PORT}${API_PREFIX}`, description: 'Local' }],
  tags: [
    { name: 'Health', description: 'Service status' },
    { name: 'Auth', description: 'Registration, sessions and profile' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: ACCESS_COOKIE },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          details: {},
        },
        required: ['code', 'message'],
      },
      ApiFailure: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { $ref: '#/components/schemas/ApiError' },
        },
        required: ['success', 'error'],
      },
      Business: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Priya Traders' },
          gstNumber: { type: 'string', example: '33ASDFG1234H1ZX' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          phone: { type: 'string', example: '+919876543210' },
          role: { type: 'string', enum: [...ROLES] },
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          village: { type: 'string' },
          crops: { type: 'array', items: { type: 'string' } },
          language: { type: 'string', enum: [...LANGUAGES] },
          business: { $ref: '#/components/schemas/Business' },
          verificationStatus: { type: 'string', enum: [...VERIFICATION_STATUSES] },
          isSuspended: { type: 'boolean' },
          notifyWhatsApp: { type: 'boolean' },
          phoneVerified: { type: 'boolean' },
          ratingAvg: { type: 'number' },
          ratingCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/User' } },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'phone', 'password', 'role', 'district'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 80, example: 'Murugan S' },
          phone: {
            type: 'string',
            description: 'Any Indian mobile format; normalised to +91XXXXXXXXXX',
            example: '9876543210',
          },
          password: { type: 'string', minLength: 8, maxLength: 72, example: 'farmfair1' },
          role: { type: 'string', enum: [...SELF_REGISTERABLE_ROLES] },
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          village: { type: 'string', example: 'Attur' },
          crops: {
            type: 'array',
            items: { type: 'string' },
            description: 'Required for farmers',
            example: ['tomato', 'onion'],
          },
          language: { type: 'string', enum: [...LANGUAGES] },
          business: {
            allOf: [{ $ref: '#/components/schemas/Business' }],
            description: 'Required for buyers',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['phone', 'password'],
        properties: {
          phone: { type: 'string', example: '9876543210' },
          password: { type: 'string', example: 'farmfair1' },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          village: { type: 'string' },
          crops: { type: 'array', items: { type: 'string' } },
          language: { type: 'string', enum: [...LANGUAGES] },
          notifyWhatsApp: { type: 'boolean' },
          business: { $ref: '#/components/schemas/Business' },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8, maxLength: 72 },
        },
      },
      Grade: { type: 'string', enum: [...GRADES] },
    },
    responses: {
      BadRequest: {
        description: 'Validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } } },
      },
      Unauthorized: {
        description: 'Not signed in, or the session has expired',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } } },
      },
      Forbidden: {
        description: 'Signed in but not permitted (includes CSRF failures)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } } },
      },
      Conflict: {
        description: 'Duplicate value, e.g. the phone number is already registered',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } } },
      },
      Locked: {
        description: 'Account locked after too many failed sign-in attempts',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } } },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service and database status',
        responses: { '200': { description: 'Status report' } },
      },
    },
    '/auth/csrf': {
      get: {
        tags: ['Auth'],
        summary: 'Issue a CSRF token',
        description: `Sets a readable cookie and returns the same value. Echo it in \`${CSRF_HEADER}\`.`,
        responses: { '200': { description: 'Token issued' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a farmer or buyer',
        description: 'Buyers are created with `verificationStatus: pending`.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Account created; session cookies set',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with phone and password',
        description:
          'Returns a deliberately generic error for both an unknown phone and a wrong password. Five consecutive failures lock the account for 15 minutes.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Signed in',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '423': { $ref: '#/components/responses/Locked' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the access and refresh tokens',
        responses: {
          '200': {
            description: 'New cookies set',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out everywhere',
        description: 'Clears the cookies and increments `tokenVersion`, revoking all sessions.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: 'Signed out' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'The signed-in user',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update profile',
        description: 'Unknown fields are rejected, so privileged fields cannot be smuggled in.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change password',
        description: 'Requires the current password; revokes every other session.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } },
          },
        },
        responses: {
          '200': { description: 'Password changed' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/otp/send': {
      post: {
        tags: ['Auth'],
        summary: 'Send a phone verification code',
        description:
          'Six-digit code, valid for 5 minutes, maximum 5 attempts. Limited to 3 sends per 15 minutes per phone. In development the code is returned as `devCode`.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: {
                    type: 'string',
                    description: 'Defaults to the phone on the account',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Code sent' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/auth/otp/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Verify a phone verification code',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', example: '123456' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Phone verified',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
} as const;
