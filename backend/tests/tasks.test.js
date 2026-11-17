const request = require("supertest");
const app = require("../app");

describe("Task endpoints", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/tasks");
    expect(res.statusCode).toBe(401);
  });
});
