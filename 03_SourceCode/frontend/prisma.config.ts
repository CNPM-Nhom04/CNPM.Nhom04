import "dotenv/config";

const config = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "mysql://root:@localhost:3306/ctdt_management",
  },
};

export default config;
