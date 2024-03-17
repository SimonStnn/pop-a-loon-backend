import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Pop-a-loon API',
      version: process.env.npm_package_version || '0.0.0',
    },
  },
  apis: ['./api/swagger.yaml', './api/**/*.ts'],
};
