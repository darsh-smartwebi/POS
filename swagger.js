import swaggerJSDoc from "swagger-jsdoc";

const serverUrl =
  process.env.NODE_ENV === "production"
    ? "https://pos-uwuz.onrender.com"
    : "http://localhost:3000";

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
        url: serverUrl,
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;