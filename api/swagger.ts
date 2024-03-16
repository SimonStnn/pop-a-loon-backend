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
