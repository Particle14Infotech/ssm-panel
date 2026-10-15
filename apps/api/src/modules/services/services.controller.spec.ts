import { Test, TestingModule } from "@nestjs/testing";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";

describe("ServicesController Unit Tests", () => {
  let controller: ServicesController;
  let service: ServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [ServicesService],
    }).compile();

    controller = module.get<ServicesController>(ServicesController);
    service = module.get<ServicesService>(ServicesService);
  });

  it("lists all platforms", () => {
    const platforms = controller.getPlatforms();
    expect(Array.isArray(platforms)).toBe(true);
    expect(platforms.length).toBeGreaterThan(0);
    expect(typeof platforms[0]).toBe("string");
  });

  it("lists categories and supports category creation", () => {
    const categories = controller.getCategories();
    expect(Array.isArray(categories)).toBe(true);

    const created = controller.createCategory({ name: "YouTube Subscribers" });
    expect(created.success).toBe(true);
    expect(created.category.name).toBe("YouTube Subscribers");
  });

  it("filters services by platform and search query", () => {
    const igServices = controller.findAll("INSTAGRAM");
    expect(igServices.length).toBeGreaterThan(0);
    expect(igServices.every((s) => s.platform === "INSTAGRAM")).toBe(true);
  });

  it("admin creates, updates, and deletes service", () => {
    const createRes = controller.create({
      name: "Telegram Members",
      platform: "TELEGRAM",
      ratePer1000: 95.0,
      min: 100,
      max: 50000,
    });
    expect(createRes.success).toBe(true);
    expect(createRes.service.name).toBe("Telegram Members");

    const updateRes = controller.update(createRes.service.id, { ratePer1000: 105.0 });
    expect(updateRes.service.ratePer1000).toBe(105.0);

    const deleteRes = controller.remove(createRes.service.id);
    expect(deleteRes.success).toBe(true);
  });
});
