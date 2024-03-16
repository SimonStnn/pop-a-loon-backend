import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Pop-a-loon API',
      version: '0.1.0',
    },
  },
  apis: ['./api/**/*.ts'],
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       properties:
 *         error:
 *           type: string
 *           description: The error message
 *           required: true
 *     User:
 *       properties:
 *         id:
 *           type: string
 *           description: The user's id
 *         username:
 *           type: string
 *           description: The user's username
 *         count:
 *           type: int
 *           description: The user's count
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was last updated
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was created
 *       required:
 *         - id
 *         - username
 *         - updatedAt
 */
