import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Orders Node Server API",
      version: "1.0.0",
      description: "API documentation for Orders Node Server",
    },
    servers: [
      {
        url: "http://localhost:3000",
      },
      {
        url: "https://pos-uwuz.onrender.com",
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;