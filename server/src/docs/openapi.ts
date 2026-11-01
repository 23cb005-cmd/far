import {
  ACCESS_COOKIE,
  API_PREFIX,
  CROP_KEYS,
  CSRF_HEADER,
  FAIR_PRICE_TOLERANCE_PERCENT,
  GRADES,
  JOB_NAMES,
  JOB_RUN_STATUSES,
  LANGUAGES,
  LISTING_STATUSES,
  MANDI_PRICE_SOURCES,
  NOTIFICATION_TYPES,
  OFFER_STATUSES,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PRICE_TREND_DEFAULT_DAYS,
  PRICE_TREND_MAX_DAYS,
  RATING_MAX,
  RATING_MIN,
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
    { name: 'Prices', description: 'Mandi (market) prices' },
    { name: 'Listings', description: 'Crop listings' },
    { name: 'Offers', description: 'Offers made on listings' },
    { name: 'Orders', description: 'Escrow orders formed by accepting an offer' },
    { name: 'Notifications', description: "A user's in-app and WhatsApp alerts" },
    { name: 'Admin', description: 'Scheduled jobs and bot message monitoring' },
    { name: 'Bot', description: 'WhatsApp bot webhook and development simulator' },
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
      CropPrice: {
        type: 'object',
        properties: {
          cropKey: { type: 'string', enum: [...CROP_KEYS] },
          unit: { type: 'string', example: 'kg' },
          date: { type: 'string', format: 'date' },
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          minPrice: { type: 'number' },
          maxPrice: { type: 'number' },
          modalPrice: { type: 'number' },
          markets: { type: 'array', items: { type: 'string' } },
          source: { type: 'string', enum: [...MANDI_PRICE_SOURCES] },
          changePercent: { type: 'number', description: 'Versus the previous available day' },
        },
      },
      TodayPricesResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              district: { type: 'string', enum: [...TN_DISTRICTS] },
              date: { type: 'string', format: 'date' },
              crops: { type: 'array', items: { $ref: '#/components/schemas/CropPrice' } },
            },
          },
        },
      },
      PriceTrendResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              district: { type: 'string', enum: [...TN_DISTRICTS] },
              cropKey: { type: 'string', enum: [...CROP_KEYS] },
              unit: { type: 'string', example: 'kg' },
              source: { type: 'string', enum: [...MANDI_PRICE_SOURCES] },
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string', format: 'date' },
                    modalPrice: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
      FairPriceCheckRequest: {
        type: 'object',
        required: ['district', 'crop', 'price'],
        properties: {
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          crop: { type: 'string', enum: [...CROP_KEYS] },
          price: { type: 'number', example: 22 },
        },
      },
      FairPriceCheckResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              district: { type: 'string', enum: [...TN_DISTRICTS] },
              cropKey: { type: 'string', enum: [...CROP_KEYS] },
              unit: { type: 'string', example: 'kg' },
              date: { type: 'string', format: 'date' },
              modalPrice: { type: 'number' },
              yourPrice: { type: 'number' },
              diffPercent: { type: 'number' },
              verdict: { type: 'string', enum: ['below_market', 'fair', 'above_market'] },
              source: { type: 'string', enum: [...MANDI_PRICE_SOURCES] },
            },
          },
        },
      },
      Listing: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          farmer: { $ref: '#/components/schemas/PublicUser' },
          cropKey: { type: 'string', enum: [...CROP_KEYS] },
          grade: { $ref: '#/components/schemas/Grade' },
          quantityKg: { type: 'number' },
          pricePerKg: { type: 'number' },
          readyDate: { type: 'string', format: 'date-time' },
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          photoUrl: { type: 'string' },
          status: { type: 'string', enum: [...LISTING_STATUSES] },
          expiresAt: { type: 'string', format: 'date-time' },
          offerCount: {
            type: 'integer',
            description: 'Present only on the farmer’s own "my listings" view',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: [...ROLES] },
          district: { type: 'string', enum: [...TN_DISTRICTS] },
          village: { type: 'string' },
          businessName: { type: 'string' },
          verified: { type: 'boolean' },
          ratingAvg: { type: 'number' },
          ratingCount: { type: 'integer' },
          memberSince: { type: 'string', format: 'date-time' },
        },
      },
      CreateListingRequest: {
        type: 'object',
        required: ['cropKey', 'grade', 'quantityKg', 'pricePerKg', 'readyDate'],
        description: 'Sent as `multipart/form-data`; `photo` is an optional file field.',
        properties: {
          cropKey: { type: 'string', enum: [...CROP_KEYS] },
          grade: { $ref: '#/components/schemas/Grade' },
          quantityKg: { type: 'number', example: 200 },
          pricePerKg: { type: 'number', example: 22 },
          readyDate: { type: 'string', format: 'date' },
          photo: { type: 'string', format: 'binary' },
        },
      },
      Offer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          listing: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              cropKey: { type: 'string', enum: [...CROP_KEYS] },
              grade: { $ref: '#/components/schemas/Grade' },
              pricePerKg: { type: 'number' },
              quantityKg: { type: 'number' },
              district: { type: 'string', enum: [...TN_DISTRICTS] },
              photoUrl: { type: 'string' },
              status: { type: 'string', enum: [...LISTING_STATUSES] },
            },
          },
          buyer: { $ref: '#/components/schemas/PublicUser' },
          quantityKg: { type: 'number' },
          offeredPricePerKg: { type: 'number' },
          message: { type: 'string' },
          marketPriceAtOffer: { type: 'number' },
          diffPercent: { type: 'number' },
          status: { type: 'string', enum: [...OFFER_STATUSES] },
          declineReason: { type: 'string' },
          code: {
            type: 'string',
            example: 'TK4P9Q',
            description: 'For ACCEPT/REJECT over WhatsApp',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateOfferRequest: {
        type: 'object',
        required: ['quantityKg', 'offeredPricePerKg'],
        properties: {
          quantityKg: { type: 'number', example: 50 },
          offeredPricePerKg: { type: 'number', example: 20 },
          message: { type: 'string', example: 'Can collect this weekend' },
        },
      },
      DeclineOfferRequest: {
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Already sold the full quantity' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          listing: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              cropKey: { type: 'string', enum: [...CROP_KEYS] },
              grade: { $ref: '#/components/schemas/Grade' },
              pricePerKg: { type: 'number' },
              quantityKg: { type: 'number' },
              district: { type: 'string', enum: [...TN_DISTRICTS] },
              photoUrl: { type: 'string' },
              status: { type: 'string', enum: [...LISTING_STATUSES] },
            },
          },
          farmer: { $ref: '#/components/schemas/PublicUser' },
          buyer: { $ref: '#/components/schemas/PublicUser' },
          cropKey: { type: 'string', enum: [...CROP_KEYS] },
          quantityKg: { type: 'number' },
          pricePerKg: { type: 'number' },
          totalAmount: { type: 'number' },
          commissionPercent: { type: 'number' },
          commissionAmount: { type: 'number' },
          payoutAmount: { type: 'number' },
          status: { type: 'string', enum: [...ORDER_STATUSES] },
          paymentProvider: { type: 'string', enum: [...PAYMENT_PROVIDERS] },
          paidAt: { type: 'string', format: 'date-time' },
          farmerConfirmedAt: { type: 'string', format: 'date-time' },
          buyerConfirmedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          cancelledAt: { type: 'string', format: 'date-time' },
          cancelReason: { type: 'string' },
          code: { type: 'string', example: 'TK4P9Q', description: 'For CONFIRM over WhatsApp' },
          myRatingSubmitted: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CancelOrderRequest: {
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Changed my mind' },
        },
      },
      Rating: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          order: { type: 'string' },
          rater: { type: 'string' },
          ratee: { type: 'string' },
          score: { type: 'integer', minimum: RATING_MIN, maximum: RATING_MAX },
          comment: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateRatingRequest: {
        type: 'object',
        required: ['score'],
        properties: {
          score: { type: 'integer', minimum: RATING_MIN, maximum: RATING_MAX, example: 5 },
          comment: { type: 'string', example: 'Smooth pickup, good quality.' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: [...NOTIFICATION_TYPES] },
          title: { type: 'string' },
          message: { type: 'string' },
          data: { type: 'object', additionalProperties: true },
          read: { type: 'boolean' },
          readAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      JobRun: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', enum: [...JOB_NAMES] },
          status: { type: 'string', enum: [...JOB_RUN_STATUSES] },
          startedAt: { type: 'string', format: 'date-time' },
          finishedAt: { type: 'string', format: 'date-time' },
          summary: { type: 'string' },
          error: { type: 'string' },
        },
      },
      InboundMessage: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          phone: { type: 'string', example: '+91 98••••••43' },
          body: { type: 'string' },
          outcome: { type: 'string', example: 'ok' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
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
    '/prices/today': {
      get: {
        tags: ['Prices'],
        summary: "Today's mandi price per crop for a district",
        description:
          'Defaults to the district on the signed-in user, and to their selected crops when they have any. Falls back to generated sample data when `DATA_GOV_API_KEY` is unset.',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'district',
            in: 'query',
            schema: { type: 'string', enum: [...TN_DISTRICTS] },
            description: "Overrides the user's own district",
          },
        ],
        responses: {
          '200': {
            description: "Today's prices",
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TodayPricesResponse' } },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/prices/trend': {
      get: {
        tags: ['Prices'],
        summary: 'Daily modal price for one crop over a trailing window',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'district',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: [...TN_DISTRICTS] },
          },
          {
            name: 'crop',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: [...CROP_KEYS] },
          },
          {
            name: 'days',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 2,
              maximum: PRICE_TREND_MAX_DAYS,
              default: PRICE_TREND_DEFAULT_DAYS,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Trend points, oldest first',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PriceTrendResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/prices/fair-check': {
      post: {
        tags: ['Prices'],
        summary: "Compare a quoted price against today's modal price",
        description: `Within ${FAIR_PRICE_TOLERANCE_PERCENT}% of the modal price counts as "fair".`,
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/FairPriceCheckRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Comparison result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FairPriceCheckResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': {
            description: "Today's price for that crop is not yet available",
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } },
            },
          },
        },
      },
    },
    '/listings': {
      post: {
        tags: ['Listings'],
        summary: 'Create a crop listing',
        description: "Farmers only. District is taken from the farmer's own profile.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { $ref: '#/components/schemas/CreateListingRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Listing created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Listing' } },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
      get: {
        tags: ['Listings'],
        summary: 'Browse active listings',
        description: 'Any signed-in, non-suspended user, including pending buyers.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'crop', in: 'query', schema: { type: 'string', enum: [...CROP_KEYS] } },
          { name: 'district', in: 'query', schema: { type: 'string', enum: [...TN_DISTRICTS] } },
          { name: 'grade', in: 'query', schema: { $ref: '#/components/schemas/Grade' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
        ],
        responses: {
          '200': { description: 'A page of active listings' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/listings/mine': {
      get: {
        tags: ['Listings'],
        summary: "A farmer's own listings, with each one's pending offer count",
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: "A page of the signed-in farmer's listings" },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/listings/{id}': {
      get: {
        tags: ['Listings'],
        summary: 'Listing detail',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'The listing' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'No such listing' },
        },
      },
    },
    '/listings/{id}/withdraw': {
      patch: {
        tags: ['Listings'],
        summary: 'Close a listing early',
        description: 'The owning farmer only. A withdrawn listing cannot be reopened.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Withdrawn' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The listing is already withdrawn or has expired' },
        },
      },
    },
    '/listings/{id}/offers': {
      post: {
        tags: ['Offers'],
        summary: 'Make an offer on a listing',
        description:
          "Approved buyers only. The offer is labelled against today's modal price for the listing's crop and district at the moment it is made.",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateOfferRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Offer created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Offer' } },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': {
            description: 'Not a buyer, or a pending buyer awaiting verification',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiFailure' } },
            },
          },
        },
      },
      get: {
        tags: ['Offers'],
        summary: 'Offers made on one of your own listings',
        description: 'The owning farmer only.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'A page of offers' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/offers/mine': {
      get: {
        tags: ['Offers'],
        summary: 'Offers you have made, across every listing',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: "A page of the signed-in buyer's offers" },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/offers/{id}/withdraw': {
      patch: {
        tags: ['Offers'],
        summary: 'Withdraw a pending offer',
        description: 'The offering buyer only.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Withdrawn' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The offer is no longer pending' },
        },
      },
    },
    '/offers/{id}/decline': {
      patch: {
        tags: ['Offers'],
        summary: 'Decline a pending offer',
        description: 'The farmer who owns the listing the offer was made on, only.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DeclineOfferRequest' } },
          },
        },
        responses: {
          '200': { description: 'Declined' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The offer is no longer pending' },
        },
      },
    },
    '/offers/{id}/accept': {
      patch: {
        tags: ['Offers', 'Orders'],
        summary: 'Accept a pending offer, forming an order',
        description:
          'The farmer who owns the listing the offer was made on, only. Marks the listing sold and declines every other pending offer on it.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Order' } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The offer or its listing is no longer active' },
        },
      },
    },
    '/orders/mine': {
      get: {
        tags: ['Orders'],
        summary: 'Every order where you are the farmer or the buyer',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
        ],
        responses: {
          '200': { description: 'A page of orders' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/orders/{id}/pay': {
      patch: {
        tags: ['Orders'],
        summary: "Pay the order's total into escrow",
        description:
          'The buyer only. Uses the configured payment provider (simulated unless `PAYMENT_PROVIDER=razorpay`, which is not yet implemented and falls back to simulated).',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Paid',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Order' } },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The order is not awaiting payment' },
        },
      },
    },
    '/orders/{id}/confirm': {
      patch: {
        tags: ['Orders'],
        summary: 'Confirm pickup from one side',
        description:
          'Either party. The order completes - and funds are considered released to the farmer - once both sides have confirmed.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Confirmed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Order' } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': {
            description: 'The order is not paid yet, or this party already confirmed',
          },
        },
      },
    },
    '/orders/{id}/cancel': {
      patch: {
        tags: ['Orders'],
        summary: 'Cancel an order before payment',
        description:
          'Either party. Only possible while the order is awaiting payment; once paid, the only forward path is pickup confirmation. Reactivates the listing.',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CancelOrderRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Cancelled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Order' } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The order has already been paid' },
        },
      },
    },
    '/orders/{id}/rating': {
      post: {
        tags: ['Orders'],
        summary: 'Rate the other party on a completed order',
        description: "Either party, once per order. Recomputes the ratee's rating average.",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateRatingRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Rating recorded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Rating' } },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { description: 'The order is not completed, or you have already rated it' },
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: "The signed-in user's notifications, newest first",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
          { name: 'unreadOnly', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          '200': { description: 'A page of notifications' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'Count of unread notifications, for the bell badge',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: '{ count }' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark one notification read',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Marked read',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Notification' } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Not this user’s notification' },
        },
      },
    },
    '/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark every notification read',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: 'Marked read' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/admin/jobs': {
      get: {
        tags: ['Admin'],
        summary: 'Recent runs of every scheduled job',
        description: 'Admin only.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: 'Up to five recent runs per job, newest first' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/admin/jobs/{name}/run': {
      post: {
        tags: ['Admin'],
        summary: 'Trigger one job immediately',
        description: 'Admin only. Audit logged.',
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: [...JOB_NAMES] },
          },
        ],
        responses: {
          '200': {
            description: 'The resulting job run',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/JobRun' } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/admin/bot-messages': {
      get: {
        tags: ['Admin'],
        summary: 'Recent inbound WhatsApp messages and their outcomes',
        description: 'Admin only, for debugging the bot.',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
        ],
        responses: {
          '200': { description: 'A page of inbound messages' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/webhooks/twilio/whatsapp': {
      post: {
        tags: ['Bot'],
        summary: 'Twilio inbound WhatsApp webhook',
        description: [
          'Called by Twilio, not by the client. Verified by `X-Twilio-Signature` instead of a',
          'session or CSRF token; rate limited to 20 messages / 10 minutes per sender. Always',
          'responds with TwiML, even on an unknown number or an error, so Twilio never retries',
          'a message that was in fact handled.',
        ].join(' '),
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['From', 'Body', 'MessageSid'],
                properties: {
                  From: { type: 'string', example: 'whatsapp:+919876543210' },
                  Body: { type: 'string', example: 'PRICE tomato' },
                  MessageSid: { type: 'string', example: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'TwiML reply',
            content: { 'text/xml': { schema: { type: 'string' } } },
          },
          '403': { description: 'Invalid Twilio signature' },
          '429': { description: 'Too many messages from this sender' },
        },
      },
    },
    '/dev/bot': {
      post: {
        tags: ['Bot'],
        summary: 'Simulate an inbound WhatsApp message',
        description: 'Development only (also available in tests). Bypasses Twilio entirely.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from', 'body'],
                properties: {
                  from: { type: 'string', example: '9876543210' },
                  body: { type: 'string', example: 'PRICE tomato' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '{ reply }' },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
  },
} as const;
