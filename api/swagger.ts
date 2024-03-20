import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Pop-a-loon API',
      version: process.env.npm_package_version || '0.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://pop-a-loon-backend.vercel.app',
        description: 'Production server',
      },
    ],
  },
  apis: ['./**/swagger.yaml', './api/**/*.ts'],
};
